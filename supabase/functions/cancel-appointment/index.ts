import { z } from 'npm:zod@3.24.1'
import {
  createSupabaseClient,
  errorResponse,
  getUserPatientId,
  handleCors,
  json,
  getUserRole,
  getUserDoctorId,
} from '../_shared/index.ts'

const cancelAppointmentSchema = z.object({
  appointment_id: z.string().uuid(),
  cancellation_reason: z.string().max(500).optional(),
})

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
    const parsed = cancelAppointmentSchema.safeParse(body)

    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', 'Dados de entrada inválidos', 400, parsed.error.flatten())
    }

    const input = parsed.data

    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', input.appointment_id)
      .single()

    if (appointmentError || !appointment) {
      return errorResponse('NOT_FOUND', 'Consulta não encontrada', 404)
    }

    if (appointment.status === 'cancelled') {
      return json(appointment)
    }

    if (!['scheduled', 'confirmed', 'checked_in', 'in_progress'].includes(appointment.status)) {
      return errorResponse('CANNOT_CANCEL', 'Esta consulta não pode ser cancelada', 409)
    }

    const appointmentDate = new Date(appointment.date + 'T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (appointmentDate < today) {
      return errorResponse('CANNOT_CANCEL', 'Não é possível cancelar consultas passadas', 409)
    }

    const role = await getUserRole(supabase, user.id)

    if (role === 'patient') {
      const patientId = await getUserPatientId(supabase, user.id)
      if (!patientId || patientId !== appointment.patient_id) {
        return errorResponse('UNAUTHORIZED', 'Não é possível cancelar esta consulta', 403)
      }
    } else if (role === 'doctor') {
      const doctorId = await getUserDoctorId(supabase, user.id)
      if (!doctorId || doctorId !== appointment.doctor_id) {
        return errorResponse('UNAUTHORIZED', 'Não é possível cancelar esta consulta', 403)
      }
    } else if (role !== 'employee' && role !== 'admin') {
      return errorResponse('UNAUTHORIZED', 'Não é possível cancelar esta consulta', 403)
    }

    const { data: updated, error: updateError } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        cancellation_reason: input.cancellation_reason ?? appointment.cancellation_reason,
      })
      .eq('id', input.appointment_id)
      .eq('status', appointment.status)
      .select()
      .single()

    if (updateError) {
      if (updateError.code === 'PGRST301' || /ROW_COUNT/i.test(updateError.message)) {
        return errorResponse('CANNOT_CANCEL', 'Esta consulta não pode ser cancelada', 409)
      }
      throw updateError
    }

    return json(updated)
  } catch (err) {
    console.error('cancel-appointment error:', err)
    return errorResponse('INTERNAL_ERROR', 'Erro inesperado', 500)
  }
})
