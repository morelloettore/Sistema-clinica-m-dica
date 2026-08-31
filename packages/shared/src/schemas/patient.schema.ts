import { z } from 'zod'
import { cpfSchema, emailSchema, nameSchema, phoneSchema } from './auth.schema'

export const createPatientSchema = z.object({
  profile_id: z.string().uuid('Perfil inválido'),
  name: nameSchema,
  cpf: cpfSchema,
  email: emailSchema,
  phone: phoneSchema,
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de nascimento inválida')
    .refine((d) => {
      const date = new Date(d)
      const now = new Date()
      if (isNaN(date.getTime()) || date >= now) return false
      const years = (now.getTime() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      return years <= 150
    }, 'Data de nascimento deve ser no passado (0-150 anos)'),
  gender: z.enum(['male', 'female', 'other'], { errorMap: () => ({ message: 'Gênero inválido' }) }),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z
    .string()
    .length(2, 'UF inválido')
    .regex(/^[A-Za-z]{2}$/, 'UF inválido')
    .optional()
    .nullable(),
  zip_code: z
    .string()
    .regex(/^\d{8}$/, 'CEP inválido')
    .optional()
    .nullable(),
  blood_type: z
    .enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], {
      errorMap: () => ({ message: 'Tipo sanguíneo inválido' }),
    })
    .optional()
    .nullable(),
  allergies: z.string().max(2000).optional().nullable(),
})

export const updatePatientSchema = z.object({
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de nascimento inválida')
    .refine((d) => {
      const date = new Date(d)
      const now = new Date()
      if (isNaN(date.getTime()) || date >= now) return false
      const years = (now.getTime() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      return years <= 150
    }, 'Data de nascimento deve ser no passado (0-150 anos)')
    .optional(),
  gender: z
    .enum(['male', 'female', 'other'], { errorMap: () => ({ message: 'Gênero inválido' }) })
    .optional(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z
    .string()
    .length(2, 'UF inválido')
    .regex(/^[A-Za-z]{2}$/, 'UF inválido')
    .optional()
    .nullable(),
  zip_code: z
    .string()
    .regex(/^\d{8}$/, 'CEP inválido')
    .optional()
    .nullable(),
  blood_type: z
    .enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], {
      errorMap: () => ({ message: 'Tipo sanguíneo inválido' }),
    })
    .optional()
    .nullable(),
  allergies: z.string().max(2000).optional().nullable(),
})

export type CreatePatientInput = z.infer<typeof createPatientSchema>
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>
