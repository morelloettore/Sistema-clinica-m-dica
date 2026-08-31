// eslint-disable-next-line
import { z } from 'npm:zod@3.24.1'
import {
  createSupabaseClient,
  errorResponse,
  getUserPatientId,
  handleCors,
  json,
} from '../_shared/index.ts'

const bookAppointmentSchema = z.object({
  patient_id: z.string().uuid(),
  doctor_id: z.string().uuid(),
  schedule_id: z.string().uuid(),
  clinic_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).optional().nullable(),
})

export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req)
  if (preflight) return preflight

  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'Método não permitido', 405)
  }

  try {
    const supabase = createSupabaseClient()
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return errorResponse('UNAUTHORIZED', 'Não autenticado', 401)
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))

    if (authError || !user) {
      return errorResponse('UNAUTHORIZED', 'Não autenticado', 401)
    }

    const body: unknown = await req.json()
    const parsed = bookAppointmentSchema.safeParse(body)

    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', 'Dados de entrada inválidos', 400, parsed.error.flatten())
    }

    const input = parsed.data

    const roleResult = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (roleResult.error) {
      return errorResponse('FORBIDDEN', 'Não foi possível determinar o papel do usuário', 403)
    }

    const role = roleResult.data.role

    if (role === 'patient') {
      const patientId = await getUserPatientId(supabase, user.id)
      if (!patientId) {
        return errorResponse('FORBIDDEN', 'Perfil de paciente não encontrado', 403)
      }
      if (patientId !== input.patient_id) {
        return errorResponse('UNAUTHORIZED', 'Não é possível agendar para outro paciente', 403)
      }
    }

    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select('*')
      .eq('id', input.schedule_id)
      .eq('is_active', true)
      .gt('available_slots', 0)
      .single()

    if (scheduleError || !schedule) {
      return errorResponse('SLOT_UNAVAILABLE', 'Este horário não está mais disponível', 409)
    }

    const { data: doctor, error: doctorError } = await supabase
      .from('doctors')
      .select('id, is_active')
      .eq('id', input.doctor_id)
      .eq('is_active', true)
      .single()

    if (doctorError || !doctor) {
      return errorResponse('DOCTOR_INACTIVE', 'Este médico não está disponível para agendamento', 400)
    }

    const { data: patientCheck, error: patientError } = await supabase
      .from('patients')
      .select('id, profile:profiles!inner(is_active)')
      .eq('id', input.patient_id)

    if (patientError || !patientCheck || patientCheck.length === 0) {
      return errorResponse('PATIENT_INACTIVE', 'Conta do paciente está desativada', 400)
    }

    const isPatientActive = patientCheck[0].profile?.is_active
    if (!isPatientActive) {
      return errorResponse('PATIENT_INACTIVE', 'Conta do paciente está desativada', 400)
    }

    const { data: existing } = await supabase
      .from('appointments')
      .select('id')
      .eq('patient_id', input.patient_id)
      .eq('schedule_id', input.schedule_id)
      .eq('status', 'scheduled')
      .single()

    if (existing) {
      return json({ id: existing.id, already_booked: true })
    }

    const { data: sameDateAppointments, error: conflictError } = await supabase
      .from('appointments')
      .select('schedule_id')
      .eq('patient_id', input.patient_id)
      .eq('date', input.date)
      .neq('schedule_id', input.schedule_id)
      .eq('status', 'scheduled')

    if (conflictError) throw conflictError

    if (sameDateAppointments && sameDateAppointments.length > 0) {
      const scheduleIds = sameDateAppointments.map((a) => a.schedule_id)
      const { data: otherSchedules, error: otherScheduleError } = await supabase
        .from('schedules')
        .select('start_time, end_time')
        .in('id', scheduleIds)

      if (otherScheduleError) throw otherScheduleError

      const overlaps = otherSchedules?.some((s) => {
        const newStart = schedule.start_time
        const newEnd = schedule.end_time
        return s.start_time < newEnd && s.end_time > newStart
      })

      if (overlaps) {
        return errorResponse('TIME_CONFLICT', 'Conflito com outra consulta agendada', 409)
      }
    }

    const { data: appointment, error: insertError } = await supabase
      .from('appointments')
      .insert({
        patient_id: input.patient_id,
        doctor_id: input.doctor_id,
        schedule_id: input.schedule_id,
        clinic_id: input.clinic_id,
        date: input.date,
        status: 'scheduled',
        notes: input.notes ?? null,
      })
      .select()
      .single()

    if (insertError) {
      if (insertError.code === 'PGRST301' || /No available slots/.test(insertError.message)) {
        return errorResponse('SLOT_UNAVAILABLE', 'Este horário não está mais disponível', 409)
      }
      return errorResponse('TIME_CONFLICT', 'Conflito com outra consulta agendada', 409)
    }

    return json(appointment)
  } catch (err) {
    console.error('book-appointment error:', err)
    return errorResponse('INTERNAL_ERROR', 'Erro inesperado', 500)
  }
})
