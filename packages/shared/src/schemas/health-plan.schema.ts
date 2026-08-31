import { z } from 'zod'

export const createHealthPlanSchema = z.object({
  name: z
    .string()
    .min(1, 'Nome é obrigatório')
    .max(200, 'Nome deve ter no máximo 200 caracteres'),
  description: z.string().max(2000, 'Descrição deve ter no máximo 2000 caracteres').optional().nullable(),
  coverage_percentage: z
    .number()
    .min(0, 'Percentual de cobertura deve estar entre 0 e 100')
    .max(100, 'Percentual de cobertura deve estar entre 0 e 100'),
  monthly_price: z.number().nonnegative('Preço deve ser positivo'),
})

export const updateHealthPlanSchema = z.object({
  name: z
    .string()
    .min(1, 'Nome é obrigatório')
    .max(200, 'Nome deve ter no máximo 200 caracteres')
    .optional(),
  description: z.string().max(2000, 'Descrição deve ter no máximo 2000 caracteres').optional().nullable(),
  coverage_percentage: z
    .number()
    .min(0, 'Percentual de cobertura deve estar entre 0 e 100')
    .max(100, 'Percentual de cobertura deve estar entre 0 e 100')
    .optional(),
  monthly_price: z.number().nonnegative('Preço deve ser positivo').optional(),
  is_active: z.boolean().optional(),
})

export type CreateHealthPlanInput = z.infer<typeof createHealthPlanSchema>
export type UpdateHealthPlanInput = z.infer<typeof updateHealthPlanSchema>
