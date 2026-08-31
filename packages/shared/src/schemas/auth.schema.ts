import { z } from 'zod'

export const cpfSchema = z
  .string()
  .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/, 'CPF inválido')
  .refine((cpf) => validateCpfChecksum(cpf), 'CPF inválido')

export const emailSchema = z.string().email('Email inválido')

export const passwordSchema = z
  .string()
  .min(8, 'A senha deve ter no mínimo 8 caracteres')
  .regex(/[a-z]/, 'A senha deve conter pelo menos uma letra minúscula')
  .regex(/[A-Z]/, 'A senha deve conter pelo menos uma letra maiúscula')
  .regex(/\d/, 'A senha deve conter pelo menos um número')

export const phoneSchema = z
  .string()
  .optional()
  .refine((phone) => phone === undefined || phone === '' || /^\d{10,11}$/.test(phone.replace(/\D/g, '')), 'Telefone inválido')

export const nameSchema = z
  .string()
  .min(2, 'Nome deve ter entre 2 e 200 caracteres')
  .max(200, 'Nome deve ter entre 2 e 200 caracteres')
  .regex(/^[^<>&"]*$/, 'Nome contém caracteres inválidos')

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Senha é obrigatória'),
})

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  cpf: cpfSchema,
  password: passwordSchema,
})

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

export const resetPasswordSchema = z.object({
  password: passwordSchema,
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

export function validateCpfChecksum(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '')

  if (digits.length !== 11) return false
  if (/^(\d)\1{10}$/.test(digits)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i], 10) * (10 - i)
  }
  let remainder = sum % 11
  const firstDigit = remainder < 2 ? 0 : 11 - remainder

  if (firstDigit !== parseInt(digits[9], 10)) return false

  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i], 10) * (11 - i)
  }
  remainder = sum % 11
  const secondDigit = remainder < 2 ? 0 : 11 - remainder

  if (secondDigit !== parseInt(digits[10], 10)) return false

  return true
}
