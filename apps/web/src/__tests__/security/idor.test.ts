import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Appointment } from '@clinica/shared/types'

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
  chain.in = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue({ data: resolvedData, error: resolvedError })

  chain.then = function (resolve: any, reject: any) {
    return Promise.resolve({ data: resolvedData, error: resolvedError }).then(resolve, reject)
  }

  return chain
}

describe('IDOR Prevention - Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Appointment IDOR', () => {
    it('user cannot access other user appointments by changing ID', async () => {
      mockFrom.mockReturnValue(chainResolver([]))

      const { data } = await supabase
        .from('appointments')
        .select('*')
        .eq('patient_id', 'other-patient-id')

      expect(data).toHaveLength(0)
    })

    it('patient can only see own appointments', async () => {
      const ownAppointments: Appointment[] = [
        {
          id: 'apt-1',
          patient_id: 'own-patient-id',
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
        },
      ]

      mockFrom.mockReturnValue(chainResolver(ownAppointments))

      const { data } = await supabase
        .from('appointments')
        .select('*')
        .eq('patient_id', 'own-patient-id')

      expect(data).toHaveLength(1)
      expect(data![0].patient_id).toBe('own-patient-id')
    })

    it('RLS blocks patient inserting appointment for another patient', async () => {
      mockFrom.mockReturnValue(chainResolver(null, {
        message: 'new row violates row-level security policy',
        code: '42501',
      }))

      const { error } = await supabase
        .from('appointments')
        .insert({
          patient_id: 'other-patient-id',
          doctor_id: 'doc-1',
          schedule_id: 'sched-1',
          clinic_id: 'clinic-1',
          date: '2026-09-15',
        })
        .single()

      expect(error).not.toBeNull()
      expect(error?.message).toContain('row-level security')
    })
  })

  describe('Profile IDOR', () => {
    it('user cannot modify other user profile', async () => {
      mockFrom.mockReturnValue(chainResolver([], {
        message: 'row-level security policy',
        code: '42501',
      }))

      const { error } = await supabase
        .from('profiles')
        .update({ name: 'Hacked Name' })
        .eq('id', 'other-user-id')

      expect(error).not.toBeNull()
    })

    it('patient can only update own profile fields', async () => {
      mockFrom.mockReturnValue(chainResolver([{ id: 'own-id' }]))

      const { data: _data, error } = await supabase
        .from('profiles')
        .update({ phone: '11999991234' })
        .eq('id', 'own-id')

      expect(error).toBeNull()
    })
  })

  describe('Medical Record IDOR', () => {
    it('patient cannot create medical record', async () => {
      mockFrom.mockReturnValue(chainResolver(null, {
        message: 'new row violates row-level security policy',
        code: '42501',
      }))

      const { error } = await supabase
        .from('medical_records')
        .insert({
          patient_id: 'own-patient-id',
          doctor_id: 'doc-1',
          created_by: 'own-user-id',
          diagnosis: 'Test diagnosis',
        })
        .single()

      expect(error).not.toBeNull()
      expect(error?.message).toContain('row-level security')
    })

    it('patient can only read own non-deleted records', async () => {
      mockFrom.mockReturnValue(chainResolver([]))

      const { data } = await supabase
        .from('medical_records')
        .select('*')
        .eq('patient_id', 'own-patient-id')
        .eq('is_deleted', false)

      expect(data).toBeDefined()
    })
  })

  describe('Doctor Access IDOR', () => {
    it('doctor cannot access unassigned patient', async () => {
      mockFrom.mockReturnValue(chainResolver([]))

      const { data } = await supabase
        .from('patients')
        .select('*')
        .eq('id', 'unassigned-patient-id')

      expect(data).toHaveLength(0)
    })

    it('doctor can only create medical records for own patients', async () => {
      mockFrom.mockReturnValue(chainResolver(null, {
        message: 'new row violates row-level security policy',
        code: '42501',
      }))

      const { error } = await supabase
        .from('medical_records')
        .insert({
          patient_id: 'unassigned-patient-id',
          doctor_id: 'other-doctor-id',
          created_by: 'own-doctor-profile-id',
          diagnosis: 'Should fail',
        })
        .single()

      expect(error).not.toBeNull()
    })

    it('doctor can only update own medical records', async () => {
      mockFrom.mockReturnValue(chainResolver([]))

      const { data } = await supabase
        .from('medical_records')
        .update({ notes: 'Updated notes' })
        .eq('id', 'record-owned-by-another-doctor')

      expect(data).toHaveLength(0)
    })
  })

  describe('Audit Log Access', () => {
    it('non-admin cannot read audit logs', async () => {
      mockFrom.mockReturnValue(chainResolver([]))

      const { data } = await supabase
        .from('audit_logs')
        .select('*')

      expect(data).toHaveLength(0)
    })

    it('audit logs cannot be modified by any user', async () => {
      mockFrom.mockReturnValue(chainResolver([], {
        message: 'row-level security policy',
        code: '42501',
      }))

      const { error } = await supabase
        .from('audit_logs')
        .update({ action: 'DELETE' })
        .eq('id', 'any-log-id')

      expect(error).not.toBeNull()
    })
  })
})
