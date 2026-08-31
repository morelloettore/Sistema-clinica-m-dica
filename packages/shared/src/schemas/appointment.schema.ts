import { z } from 'zod'
import type { AppointmentStatus } from '../types'

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')

const statusSchema = z.enum(
  ['scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'],
  { errorMap: () => ({ message: 'Status inválido' }) }
)

const cancellableStatuses: AppointmentStatus[] = ['scheduled', 'confirmed', 'checked_in', 'in_progress']
const completableStatuses: AppointmentStatus[] = ['scheduled', 'confirmed', 'checked_in', 'in_progress']

export const createAppointmentSchema = z
  .object({
    patient_id: z.string().uuid('Paciente inválido'),
    doctor_id: z.string().uuid('Médico inválido'),
    schedule_id: z.string().uuid('Horário inválido'),
    clinic_id: z.string().uuid('Clínica inválida'),
    date: dateSchema,
    notes: z.string().max(500, 'Notas devem ter no máximo 500 caracteres').optional().nullable(),
  })
  .refine((data) => {
    const today = new Date()
    const appointmentDate = new Date(data.date + 'T00:00:00')
    return appointmentDate >= today
  }, 'Não é possível agendar consultas para datas passadas')

export const updateAppointmentSchema = z.object({
  notes: z.string().max(500, 'Notas devem ter no máximo 500 caracteres').optional().nullable(),
  schedule_id: z.string().uuid('Horário inválido').optional(),
  date: dateSchema.optional(),
  clinic_id: z.string().uuid('Clínica inválida').optional(),
})

export const cancelAppointmentSchema = z.object({
  appointment_id: z.string().uuid('Consulta inválida'),
  cancellation_reason: z
    .string()
    .max(500, 'Motivo do cancelamento deve ter no máximo 500 caracteres')
    .optional(),
})

export const updateAppointmentStatusSchema = z
  .object({
    appointment_id: z.string().uuid('Consulta inválida'),
    status: statusSchema,
  })
  .superRefine((data, ctx) => {
    void data
    void ctx
  })

export const isCancellable = (status: AppointmentStatus): boolean => cancellableStatuses.includes(status)
export const isCompletable = (status: AppointmentStatus): boolean => completableStatuses.includes(status)

export const allowedStatusTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled: ['confirmed', 'cancelled', 'no_show', 'checked_in'],
  confirmed: ['checked_in', 'cancelled', 'no_show', 'in_progress'],
  checked_in: ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['completed', 'cancelled', 'no_show'],
  completed: [],
  cancelled: [],
  no_show: [],
}

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return allowedStatusTransitions[from]?.includes(to) ?? false
}

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>
export type UpdateAppointmentStatusInput = z.infer<typeof updateAppointmentStatusSchema>
