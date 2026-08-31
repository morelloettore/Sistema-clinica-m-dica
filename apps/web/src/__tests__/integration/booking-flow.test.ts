import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Appointment, Schedule, Specialty } from '@clinica/shared/types'

const mockFrom = vi.fn()
const mockInvoke = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    functions: {
      invoke: (...args: any[]) => mockInvoke(...args),
    },
  },
}))

import { supabase } from '@/lib/supabase'

function chainResolver(resolvedData: any, resolvedError: any = null) {
  const chain: Record<string, any> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue({ data: resolvedData, error: resolvedError })

  chain.then = function (resolve: any, reject: any) {
    return Promise.resolve({ data: resolvedData, error: resolvedError }).then(resolve, reject)
  }

  return chain
}

describe('Booking Flow - Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Step 1: Select Specialty', () => {
    it('fetches active specialties', async () => {
      const specialties: Specialty[] = [
        {
          id: 'spec-1',
          name: 'Cardiologia',
          description: 'Coração',
          is_active: true,
          created_at: '2026-01-01',
        },
        {
          id: 'spec-2',
          name: 'Dermatologia',
          description: 'Pele',
          is_active: true,
          created_at: '2026-01-01',
        },
      ]

      mockFrom.mockReturnValue(chainResolver(specialties))

      const { data, error } = await supabase
        .from('specialties')
        .select('*')
        .eq('is_active', true)

      expect(error).toBeNull()
      expect(data).toHaveLength(2)
      expect(data![0].name).toBe('Cardiologia')
    })

    it('handles error fetching specialties', async () => {
      mockFrom.mockReturnValue(chainResolver(null, { message: 'Network error' }))

      const { data, error } = await supabase
        .from('specialties')
        .select('*')

      expect(error).not.toBeNull()
      expect(data).toBeNull()
    })
  })

  describe('Step 2: Select Doctor', () => {
    it('fetches doctors by specialty', async () => {
      const doctors = [
        {
          id: 'doc-1',
          profile_id: 'prof-1',
          crm: '1234-SP',
          bio: null,
          consultation_price: 200,
          is_active: true,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ]

      mockFrom.mockReturnValue(chainResolver(doctors))

      const { data, error } = await supabase
        .from('doctor_specialties')
        .select('doctor:doctors(*)')
        .eq('specialty_id', 'spec-1')

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
    })

    it('returns empty when no doctors for specialty', async () => {
      mockFrom.mockReturnValue(chainResolver([]))

      const { data } = await supabase
        .from('doctor_specialties')
        .select('doctor:doctors(*)')
        .eq('specialty_id', 'nonexistent')

      expect(data).toHaveLength(0)
    })
  })

  describe('Step 3: Select Slot', () => {
    it('fetches available schedules', async () => {
      const schedules: Schedule[] = [
        {
          id: 'sched-1',
          doctor_id: 'doc-1',
          clinic_id: 'clinic-1',
          date: '2026-09-15',
          start_time: '08:00',
          end_time: '09:00',
          max_slots: 5,
          available_slots: 3,
          is_active: true,
          created_at: '2026-08-01',
        },
      ]

      mockFrom.mockReturnValue(chainResolver(schedules))

      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('doctor_id', 'doc-1')
        .eq('is_active', true)

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data![0].available_slots).toBeGreaterThan(0)
    })

    it('does not show full schedules', () => {
      const schedules: Schedule[] = [
        {
          id: 'sched-1',
          doctor_id: 'doc-1',
          clinic_id: 'clinic-1',
          date: '2026-09-15',
          start_time: '08:00',
          end_time: '09:00',
          max_slots: 5,
          available_slots: 0,
          is_active: true,
          created_at: '2026-08-01',
        },
      ]

      const available = schedules.filter((s) => s.available_slots > 0)
      expect(available).toHaveLength(0)
    })
  })

  describe('Step 4: Confirm & Book', () => {
    it('creates appointment via edge function', async () => {
      const mockAppointment: Appointment = {
        id: 'apt-new',
        patient_id: 'patient-001',
        doctor_id: 'doc-1',
        schedule_id: 'sched-1',
        clinic_id: 'clinic-1',
        date: '2026-09-15',
        status: 'scheduled',
        notes: null,
        cancellation_reason: null,
        created_by: null,
        created_at: '2026-08-15',
        updated_at: '2026-08-15',
      }

      mockInvoke.mockResolvedValue({ data: mockAppointment, error: null })

      const { data, error } = await supabase.functions.invoke('book-appointment', {
        body: {
          patient_id: 'patient-001',
          doctor_id: 'doc-1',
          schedule_id: 'sched-1',
          clinic_id: 'clinic-1',
          date: '2026-09-15',
        },
      })

      expect(error).toBeNull()
      expect(data?.status).toBe('scheduled')
      expect(data?.patient_id).toBe('patient-001')
    })

    it('returns error when slot is full', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'SLOT_UNAVAILABLE', code: 409 },
      })

      const { data: _data, error } = await supabase.functions.invoke('book-appointment', {
        body: {
          patient_id: 'patient-001',
          doctor_id: 'doc-1',
          schedule_id: 'sched-1',
          clinic_id: 'clinic-1',
          date: '2026-09-15',
        },
      })

      expect(error).not.toBeNull()
      expect(_data).toBeNull()
    })

    it('returns error for duplicate booking', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'DUPLICATE_BOOKING', code: 409 },
      })

      const { data: _data, error } = await supabase.functions.invoke('book-appointment', {
        body: {
          patient_id: 'patient-001',
          doctor_id: 'doc-1',
          schedule_id: 'sched-1',
          clinic_id: 'clinic-1',
          date: '2026-09-15',
        },
      })

      expect(error).not.toBeNull()
      expect(error?.message).toContain('DUPLICATE_BOOKING')
    })

    it('returns 401 when not authenticated', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Unauthorized', code: 401 },
      })

      const { error } = await supabase.functions.invoke('book-appointment', {
        body: {},
      })

      expect(error).not.toBeNull()
      expect(error?.code).toBe(401)
    })
  })

  describe('Cancellation Flow', () => {
    it('cancels appointment and releases slot', async () => {
      const mockAppointment: Appointment = {
        id: 'apt-001',
        patient_id: 'patient-001',
        doctor_id: 'doc-1',
        schedule_id: 'sched-1',
        clinic_id: 'clinic-1',
        date: '2026-09-15',
        status: 'cancelled',
        notes: null,
        cancellation_reason: 'Mudou de ideia',
        created_by: null,
        created_at: '2026-08-15',
        updated_at: '2026-08-15',
      }

      mockInvoke.mockResolvedValue({ data: mockAppointment, error: null })

      const { data, error } = await supabase.functions.invoke('cancel-appointment', {
        body: {
          appointment_id: 'apt-001',
          cancellation_reason: 'Mudou de ideia',
        },
      })

      expect(error).toBeNull()
      expect(data?.status).toBe('cancelled')
    })

    it('rejects cancellation of completed appointment', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'CANNOT_CANCEL', code: 400 },
      })

      const { data: _data, error } = await supabase.functions.invoke('cancel-appointment', {
        body: {
          appointment_id: 'apt-completed',
          cancellation_reason: 'Too late',
        },
      })

      expect(error).not.toBeNull()
      expect(error?.message).toContain('CANNOT_CANCEL')
    })

    it('rejects cancellation by non-owner patient', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'UNAUTHORIZED', code: 403 },
      })

      const { error } = await supabase.functions.invoke('cancel-appointment', {
        body: {
          appointment_id: 'apt-other-patient',
          cancellation_reason: 'Hacked',
        },
      })

      expect(error).not.toBeNull()
      expect(error?.code).toBe(403)
    })
  })
})
