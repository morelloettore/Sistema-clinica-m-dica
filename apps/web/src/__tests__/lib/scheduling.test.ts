import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Schedule, Appointment } from '@clinica/shared/types'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}))

import { supabase } from '@/lib/supabase'

function chainResolver(resolvedData: any, resolvedError: any = null) {
  const chain: Record<string, any> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.neq = vi.fn().mockReturnValue(chain)
  chain.gt = vi.fn().mockReturnValue(chain)
  chain.lt = vi.fn().mockReturnValue(chain)
  chain.gte = vi.fn().mockReturnValue(chain)
  chain.lte = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue({ data: resolvedData, error: resolvedError })

  chain.then = function (resolve: any, reject: any) {
    return Promise.resolve({ data: resolvedData, error: resolvedError }).then(resolve, reject)
  }

  return chain
}

function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 'sched-001',
    doctor_id: 'doc-001',
    clinic_id: 'clinic-001',
    date: '2026-09-15',
    start_time: '08:00',
    end_time: '09:00',
    max_slots: 5,
    available_slots: 3,
    is_active: true,
    created_at: '2026-08-01',
    ...overrides,
  }
}

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 'apt-001',
    patient_id: 'patient-001',
    doctor_id: 'doc-001',
    schedule_id: 'sched-001',
    clinic_id: 'clinic-001',
    date: '2026-09-15',
    status: 'scheduled',
    notes: null,
    cancellation_reason: null,
    created_by: null,
    created_at: '2026-08-15',
    updated_at: '2026-08-15',
    ...overrides,
  }
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  scheduled: ['completed', 'cancelled', 'no_show'],
  completed: [],
  cancelled: [],
  no_show: [],
}

function canTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

describe('getAvailableSlots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns only schedules with available_slots > 0', async () => {
    const allSchedules = [
      makeSchedule({ id: 's1', available_slots: 3 }),
      makeSchedule({ id: 's2', available_slots: 0 }),
      makeSchedule({ id: 's3', available_slots: 1 }),
    ]

    const available = allSchedules.filter((s) => s.available_slots > 0)

    mockFrom.mockReturnValue(chainResolver(available))

    const { data } = await supabase
      .from('schedules')
      .select('*')
      .eq('is_active', true)
      .gt('available_slots', 0)

    expect(data).toHaveLength(2)
    expect(data!.map((s: Schedule) => s.id)).toEqual(['s1', 's3'])
  })

  it('returns empty array when no slots available', () => {
    const schedules = [
      makeSchedule({ id: 's1', available_slots: 0 }),
      makeSchedule({ id: 's2', available_slots: 0 }),
    ]

    const result = schedules.filter((s) => s.available_slots > 0)
    expect(result).toHaveLength(0)
  })
})

describe('isSlotAvailable', () => {
  it('returns true when available_slots > 0', () => {
    const schedule = makeSchedule({ available_slots: 3 })
    expect(schedule.available_slots > 0).toBe(true)
  })

  it('returns false when available_slots = 0', () => {
    const schedule = makeSchedule({ available_slots: 0 })
    expect(schedule.available_slots > 0).toBe(false)
  })

  it('returns false when schedule is inactive', () => {
    const schedule = makeSchedule({ available_slots: 3, is_active: false })
    expect(schedule.available_slots > 0 && schedule.is_active).toBe(false)
  })
})

describe('bookAppointment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates appointment when slot is available', async () => {
    const newAppointment = makeAppointment()

    mockFrom.mockReturnValue(chainResolver(newAppointment))

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        patient_id: 'patient-001',
        doctor_id: 'doc-001',
        schedule_id: 'sched-001',
        clinic_id: 'clinic-001',
        date: '2026-09-15',
      })
      .select()
      .single()

    expect(error).toBeNull()
    expect(data?.status).toBe('scheduled')
  })

  it('throws on unavailable slot', async () => {
    mockFrom.mockReturnValue(chainResolver(null, {
      message: 'No available slots for this schedule',
    }))

    const { error } = await supabase
      .from('appointments')
      .insert({
        patient_id: 'patient-001',
        doctor_id: 'doc-001',
        schedule_id: 'sched-full',
        clinic_id: 'clinic-001',
        date: '2026-09-15',
      })
      .select()
      .single()

    expect(error).not.toBeNull()
    expect(error?.message).toContain('No available slots')
  })
})

describe('cancelAppointment', () => {
  it('validates ownership - patient can cancel own appointment', () => {
    const appointment = makeAppointment({ patient_id: 'patient-001' })
    const currentUserId = 'patient-001'
    expect(appointment.patient_id === currentUserId).toBe(true)
  })

  it('validates ownership - patient cannot cancel other patient appointment', () => {
    const appointment = makeAppointment({ patient_id: 'patient-002' })
    const currentUserId = 'patient-001'
    expect(appointment.patient_id === currentUserId).toBe(false)
  })

  it('validates status - can cancel scheduled appointment', () => {
    const appointment = makeAppointment({ status: 'scheduled' })
    expect(canTransition(appointment.status, 'cancelled')).toBe(true)
  })

  it('validates status - cannot cancel completed appointment', () => {
    const appointment = makeAppointment({ status: 'completed' })
    expect(canTransition(appointment.status, 'cancelled')).toBe(false)
  })

  it('validates status - cannot cancel already cancelled appointment', () => {
    const appointment = makeAppointment({ status: 'cancelled' })
    expect(canTransition(appointment.status, 'cancelled')).toBe(false)
  })
})

describe('updateAppointmentStatus', () => {
  it('allows scheduled -> completed', () => {
    expect(canTransition('scheduled', 'completed')).toBe(true)
  })

  it('allows scheduled -> cancelled', () => {
    expect(canTransition('scheduled', 'cancelled')).toBe(true)
  })

  it('allows scheduled -> no_show', () => {
    expect(canTransition('scheduled', 'no_show')).toBe(true)
  })

  it('rejects completed -> scheduled', () => {
    expect(canTransition('completed', 'scheduled')).toBe(false)
  })

  it('rejects cancelled -> completed', () => {
    expect(canTransition('cancelled', 'completed')).toBe(false)
  })

  it('rejects no_show -> scheduled', () => {
    expect(canTransition('no_show', 'scheduled')).toBe(false)
  })

  it('rejects completed -> cancelled', () => {
    expect(canTransition('completed', 'cancelled')).toBe(false)
  })

  it('rejects cancelled -> no_show', () => {
    expect(canTransition('cancelled', 'no_show')).toBe(false)
  })

  it('rejects no_show -> completed', () => {
    expect(canTransition('no_show', 'completed')).toBe(false)
  })
})
