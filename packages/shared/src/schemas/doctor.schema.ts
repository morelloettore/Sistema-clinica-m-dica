import { z } from 'zod'

export const crmSchema = z
  .string()
  .min(4, 'CRM inválido')
  .max(10, 'CRM inválido')
  .regex(/^[a-zA-Z0-9]+(-[A-Za-z]{2})?$/, 'CRM inválido')

export const createDoctorSchema = z.object({
  profile_id: z.string().uuid('Perfil inválido'),
  crm: crmSchema,
  bio: z.string().max(2000).optional().nullable(),
  consultation_price: z
    .number()
    .nonnegative('Preço deve ser positivo')
    .optional()
    .nullable(),
})

export const updateDoctorSchema = z.object({
  crm: crmSchema.optional(),
  bio: z.string().max(2000).optional().nullable(),
  consultation_price: z
    .number()
    .nonnegative('Preço deve ser positivo')
    .optional()
    .nullable(),
  is_active: z.boolean().optional(),
})

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>
