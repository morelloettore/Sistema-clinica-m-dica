import { z } from 'zod'

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, 'Horário inválido')

export const createScheduleSchema = z
  .object({
    doctor_id: z.string().uuid('Médico inválido'),
    clinic_id: z.string().uuid('Clínica inválida'),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
      .refine((d) => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        return new Date(d + 'T00:00:00') >= today
      }, 'Não é possível criar agenda para datas passadas'),
    start_time: timeSchema,
    end_time: timeSchema,
    max_slots: z.number().int('Capacidade deve ser inteira').positive('Capacidade deve ser maior que 0'),
  })
  .refine((data) => data.end_time > data.start_time, 'Horário de término deve ser após o horário de início')

export const updateScheduleSchema = z
  .object({
    clinic_id: z.string().uuid('Clínica inválida').optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
      .optional(),
    start_time: timeSchema.optional(),
    end_time: timeSchema.optional(),
    max_slots: z.number().int('Capacidade deve ser inteira').positive('Capacidade deve ser maior que 0').optional(),
    is_active: z.boolean().optional(),
  })
  .refine((data) => {
    if (data.start_time && data.end_time) return data.end_time > data.start_time
    return true
  }, 'Horário de término deve ser após o horário de início')

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>
