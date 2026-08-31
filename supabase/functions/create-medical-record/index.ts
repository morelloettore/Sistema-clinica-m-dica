import { z } from 'npm:zod@3.24.1'
import {
  createSupabaseClient,
  errorResponse,
  getUserDoctorId,
  handleCors,
  json,
  getUserRole,
} from '../_shared/index.ts'

const createMedicalRecordSchema = z.object({
  patient_id: z.string().uuid(),
  appointment_id: z.string().uuid().optional().nullable(),
  diagnosis: z.string().min(1).max(5000),
  notes: z.string().max(10000).optional().nullable(),
  prescription: z.string().max(5000).optional().nullable(),
  next_appointment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
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

    const role = await getUserRole(supabase, user.id)
    if (role !== 'doctor') {
      return errorResponse('FORBIDDEN', 'Apenas médicos podem criar prontuários', 403)
    }

    const doctorId = await getUserDoctorId(supabase, user.id)
    if (!doctorId) {
      return errorResponse('FORBIDDEN', 'Perfil de médico não encontrado', 403)
    }

    const body: unknown = await req.json()
    const parsed = createMedicalRecordSchema.safeParse(body)

    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', 'Dados de entrada inválidos', 400, parsed.error.flatten())
    }

    const input = parsed.data

    let appointmentQuery = supabase
      .from('appointments')
      .select('id')
      .eq('patient_id', input.patient_id)
      .eq('doctor_id', doctorId)

    if (input.appointment_id) {
      appointmentQuery = appointmentQuery.eq('id', input.appointment_id)
    }

    const { data: appointment, error: assignmentError } = await appointmentQuery.single()

    if (assignmentError || !appointment) {
      return errorResponse(
        'FORBIDDEN',
        'O paciente não está atribuído a este médico em nenhuma consulta',
        403
      )
    }

    if (input.appointment_id) {
      const { data: existingRecord, error: recordError } = await supabase
        .from('medical_records')
        .select('id')
        .eq('appointment_id', input.appointment_id)
        .eq('is_deleted', false)
        .single()

      if (!(recordError && recordError.code === 'PGRST116') && existingRecord) {
        return errorResponse('CONFLICT', 'Consulta já possui prontuário', 409)
      }
    }

    const { data: record, error: insertError } = await supabase
      .from('medical_records')
      .insert({
        patient_id: input.patient_id,
        doctor_id: doctorId,
        appointment_id: input.appointment_id ?? null,
        diagnosis: input.diagnosis,
        notes: input.notes ?? null,
        prescription: input.prescription ?? null,
        next_appointment_date: input.next_appointment_date ?? null,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      if (/already exists|unique/.test(insertError.message)) {
        return errorResponse('CONFLICT', 'Consulta já possui prontuário', 409)
      }
      throw insertError
    }

    return json(record)
  } catch (err) {
    console.error('create-medical-record error:', err)
    return errorResponse('INTERNAL_ERROR', 'Erro inesperado', 500)
  }
})
