import { z } from 'npm:zod@3.24.1'
import {
  createSupabaseClient,
  errorResponse,
  handleCors,
  json,
  getUserRole,
} from '../_shared/index.ts'

const assignDoctorSchema = z.object({
  doctor_id: z.string().uuid(),
  specialty_ids: z.array(z.string().uuid()).optional(),
  clinic_ids: z.array(z.string().uuid()).optional(),
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
    if (role !== 'admin') {
      return errorResponse('FORBIDDEN', 'Apenas administradores podem executar esta operação', 403)
    }

    const body: unknown = await req.json()
    const parsed = assignDoctorSchema.safeParse(body)

    if (!parsed.success) {
      return errorResponse('VALIDATION_ERROR', 'Dados de entrada inválidos', 400, parsed.error.flatten())
    }

    const input = parsed.data

    const { data: doctor, error: doctorError } = await supabase
      .from('doctors')
      .select('id')
      .eq('id', input.doctor_id)
      .single()

    if (doctorError || !doctor) {
      return errorResponse('NOT_FOUND', 'Médico não encontrado', 404)
    }

    if (input.specialty_ids) {
      const { error: deleteSpecialtiesError } = await supabase
        .from('doctor_specialties')
        .delete()
        .eq('doctor_id', input.doctor_id)

      if (deleteSpecialtiesError) throw deleteSpecialtiesError

      if (input.specialty_ids.length > 0) {
        const rows = input.specialty_ids.map((specialty_id) => ({
          doctor_id: input.doctor_id,
          specialty_id,
        }))
        const { error: insertSpecialtiesError } = await supabase
          .from('doctor_specialties')
          .insert(rows)

        if (insertSpecialtiesError) throw insertSpecialtiesError
      }
    }

    if (input.clinic_ids) {
      const { error: deleteClinicsError } = await supabase
        .from('doctor_clinics')
        .delete()
        .eq('doctor_id', input.doctor_id)

      if (deleteClinicsError) throw deleteClinicsError

      if (input.clinic_ids.length > 0) {
        const rows = input.clinic_ids.map((clinic_id) => ({
          doctor_id: input.doctor_id,
          clinic_id,
        }))
        const { error: insertClinicsError } = await supabase
          .from('doctor_clinics')
          .insert(rows)

        if (insertClinicsError) throw insertClinicsError
      }
    }

    return json({ success: true, doctor_id: input.doctor_id })
  } catch (err) {
    console.error('assign-doctor error:', err)
    return errorResponse('INTERNAL_ERROR', 'Erro inesperado', 500)
  }
})
