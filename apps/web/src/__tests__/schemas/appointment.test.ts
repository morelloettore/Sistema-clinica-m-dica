import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const appointmentStatusSchema = z.enum([
  'scheduled',
  'completed',
  'cancelled',
  'no_show',
])

const VALID_TRANSITIONS: Record<string, string[]> = {
  scheduled: ['completed', 'cancelled', 'no_show'],
  completed: [],
  cancelled: [],
  no_show: [],
}

const canTransition = (from: string, to: string): boolean => {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

const appointmentSchema = z.object({
  patient_id: z.string().uuid(),
  doctor_id: z.string().uuid(),
  schedule_id: z.string().uuid(),
  clinic_id: z.string().uuid(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  notes: z.string().max(500).optional(),
  cancellation_reason: z.string().max(500).optional(),
})

const scheduleDateSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((date) => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return new Date(date) >= today
    }, 'Data não pode ser no passado'),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/),
})

describe('appointmentSchema', () => {
  const validAppointment = {
    patient_id: '550e8400-e29b-41d4-a716-446655440000',
    doctor_id: '550e8400-e29b-41d4-a716-446655440001',
    schedule_id: '550e8400-e29b-41d4-a716-446655440002',
    clinic_id: '550e8400-e29b-41d4-a716-446655440003',
    date: '2026-09-15',
  }

  it('accepts valid appointment data', () => {
    const result = appointmentSchema.safeParse(validAppointment)
    expect(result.success).toBe(true)
  })

  it('accepts appointment with optional notes', () => {
    const result = appointmentSchema.safeParse({
      ...validAppointment,
      notes: 'Primeira consulta',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid patient_id UUID', () => {
    const result = appointmentSchema.safeParse({
      ...validAppointment,
      patient_id: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid doctor_id UUID', () => {
    const result = appointmentSchema.safeParse({
      ...validAppointment,
      doctor_id: 'invalid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid date format', () => {
    const result = appointmentSchema.safeParse({
      ...validAppointment,
      date: '15-09-2026',
    })
    expect(result.success).toBe(false)
  })

  it('rejects notes exceeding 500 characters', () => {
    const result = appointmentSchema.safeParse({
      ...validAppointment,
      notes: 'A'.repeat(501),
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing required fields', () => {
    const result = appointmentSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('appointmentStatusSchema', () => {
  it('accepts valid statuses', () => {
    expect(appointmentStatusSchema.safeParse('scheduled').success).toBe(true)
    expect(appointmentStatusSchema.safeParse('completed').success).toBe(true)
    expect(appointmentStatusSchema.safeParse('cancelled').success).toBe(true)
    expect(appointmentStatusSchema.safeParse('no_show').success).toBe(true)
  })

  it('rejects invalid status', () => {
    expect(appointmentStatusSchema.safeParse('pending').success).toBe(false)
    expect(appointmentStatusSchema.safeParse('active').success).toBe(false)
    expect(appointmentStatusSchema.safeParse('').success).toBe(false)
  })
})

describe('status transition validation', () => {
  it('allows scheduled -> completed', () => {
    expect(canTransition('scheduled', 'completed')).toBe(true)
  })

  it('allows scheduled -> cancelled', () => {
    expect(canTransition('scheduled', 'cancelled')).toBe(true)
  })

  it('allows scheduled -> no_show', () => {
    expect(canTransition('scheduled', 'no_show')).toBe(true)
  })

  it('rejects completed -> any', () => {
    expect(canTransition('completed', 'scheduled')).toBe(false)
    expect(canTransition('completed', 'cancelled')).toBe(false)
    expect(canTransition('completed', 'no_show')).toBe(false)
  })

  it('rejects cancelled -> any', () => {
    expect(canTransition('cancelled', 'scheduled')).toBe(false)
    expect(canTransition('cancelled', 'completed')).toBe(false)
    expect(canTransition('cancelled', 'no_show')).toBe(false)
  })

  it('rejects no_show -> any', () => {
    expect(canTransition('no_show', 'scheduled')).toBe(false)
    expect(canTransition('no_show', 'completed')).toBe(false)
    expect(canTransition('no_show', 'cancelled')).toBe(false)
  })

  it('rejects same-status transitions for terminal states', () => {
    expect(canTransition('completed', 'completed')).toBe(false)
    expect(canTransition('cancelled', 'cancelled')).toBe(false)
    expect(canTransition('no_show', 'no_show')).toBe(false)
  })
})

describe('scheduleDateSchema', () => {
  it('accepts future date', () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 1)
    const dateStr = futureDate.toISOString().split('T')[0]
    const result = scheduleDateSchema.safeParse({
      date: dateStr,
      start_time: '08:00',
      end_time: '09:00',
    })
    expect(result.success).toBe(true)
  })

  it('rejects past date', () => {
    const result = scheduleDateSchema.safeParse({
      date: '2020-01-01',
      start_time: '08:00',
      end_time: '09:00',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid time format', () => {
    const result = scheduleDateSchema.safeParse({
      date: '2026-12-01',
      start_time: '8:00',
      end_time: '9:00',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid date format', () => {
    const result = scheduleDateSchema.safeParse({
      date: '01-12-2026',
      start_time: '08:00',
      end_time: '09:00',
    })
    expect(result.success).toBe(false)
  })
})
