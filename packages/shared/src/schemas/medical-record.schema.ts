import { z } from 'zod'

export const createMedicalRecordSchema = z.object({
  patient_id: z.string().uuid('Paciente inválido'),
  appointment_id: z.string().uuid('Consulta inválida').optional().nullable(),
  diagnosis: z
    .string()
    .min(1, 'Diagnóstico é obrigatório')
    .max(5000, 'Diagnóstico deve ter no máximo 5000 caracteres'),
  notes: z.string().max(10000, 'Anotações devem ter no máximo 10000 caracteres').optional().nullable(),
  prescription: z.string().max(5000, 'Prescrição deve ter no máximo 5000 caracteres').optional().nullable(),
  next_appointment_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
    .optional()
    .nullable(),
})

export const updateMedicalRecordSchema = z.object({
  diagnosis: z
    .string()
    .min(1, 'Diagnóstico é obrigatório')
    .max(5000, 'Diagnóstico deve ter no máximo 5000 caracteres')
    .optional(),
  notes: z.string().max(10000, 'Anotações devem ter no máximo 10000 caracteres').optional().nullable(),
  prescription: z.string().max(5000, 'Prescrição deve ter no máximo 5000 caracteres').optional().nullable(),
  next_appointment_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
    .optional()
    .nullable(),
})

export type CreateMedicalRecordInput = z.infer<typeof createMedicalRecordSchema>
export type UpdateMedicalRecordInput = z.infer<typeof updateMedicalRecordSchema>
