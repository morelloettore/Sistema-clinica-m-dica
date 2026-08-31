import { supabase } from '@/lib/supabase'
import type {
  Appointment,
  Schedule,
  AppointmentStatus,
} from '@clinica/shared'
import { canTransition } from '@clinica/shared'

export type BookingParams = {
  patientId: string
  doctorId: string
  scheduleId: string
  clinicId: string
  notes?: string
}

export type AppointmentFilters = {
  patientId?: string
  doctorId?: string
  clinicId?: string
  startDate?: string
  endDate?: string
  status?: AppointmentStatus
}

/**
 * Get available time slots for a doctor on a specific date.
 * Returns slots where available_slots > 0.
 */
export async function getAvailableSlots(
  doctorId: string,
  date: string,
  clinicId?: string
): Promise<Schedule[]> {
  let query = supabase
    .from('schedules')
    .select('*')
    .eq('doctor_id', doctorId)
    .eq('date', date)
    .eq('is_active', true)
    .gt('available_slots', 0)

  if (clinicId) {
    query = query.eq('clinic_id', clinicId)
  }

  const { data, error } = await query.order('start_time')
  if (error) throw error
  return data || []
}

/**
 * Check if a specific slot is still available.
 * Critical for preventing race conditions.
 */
export async function isSlotAvailable(scheduleId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('schedules')
    .select('available_slots, is_active')
    .eq('id', scheduleId)
    .single()

  if (error || !data) return false
  return data.is_active && data.available_slots > 0
}

/**
 * Book an appointment with conflict prevention.
 * Uses database-level constraints to prevent race conditions.
 * The booking should use an Edge Function or database transaction.
 */
export async function bookAppointment(params: BookingParams): Promise<Appointment> {
  // 1. Verify slot availability
  const available = await isSlotAvailable(params.scheduleId)
  if (!available) {
    throw new Error('This time slot is no longer available')
  }

  // 2. Check doctor is active
  const { data: doctor } = await supabase
    .from('doctors')
    .select('is_active')
    .eq('id', params.doctorId)
    .single()

  if (!doctor?.is_active) {
    throw new Error('Doctor is not available')
  }

  // 3. Check no duplicate appointment for this patient at same time
  const schedule = await supabase
    .from('schedules')
    .select('date')
    .eq('id', params.scheduleId)
    .single()

  if (schedule.data) {
    const { data: existing } = await supabase
      .from('appointments')
      .select('id')
      .eq('patient_id', params.patientId)
      .eq('date', schedule.data.date)
      .eq('status', 'scheduled')
      .single()

    if (existing) {
      throw new Error('You already have an appointment scheduled at this time')
    }
  }

  // 4. Insert appointment (database trigger handles slot decrement)
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      patient_id: params.patientId,
      doctor_id: params.doctorId,
      schedule_id: params.scheduleId,
      clinic_id: params.clinicId,
      date: schedule.data?.date || '',
      status: 'scheduled',
      notes: params.notes || null,
      created_by: params.patientId,
    })
    .select()
    .single()

  if (error) {
    // Handle specific database errors
    if (error.message.includes('Schedule slot not available')) {
      throw new Error('This time slot was just booked by someone else. Please choose another time.')
    }
    if (error.message.includes('Doctor is not active')) {
      throw new Error('Doctor is not available')
    }
    throw error
  }

  return data
}

/**
 * Cancel an appointment.
 * Only allowed for scheduled or confirmed appointments.
 */
export async function cancelAppointment(
  appointmentId: string,
  userId: string
): Promise<Appointment> {
  // 1. Fetch appointment
  const { data: appointment, error: fetchError } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', appointmentId)
    .single()

  if (fetchError || !appointment) {
    throw new Error('Appointment not found')
  }

  // 2. Verify ownership or permission
  // (RLS also enforces this, but we check here for better error messages)
  const { data: patient } = await supabase
    .from('patients')
    .select('id')
    .eq('profile_id', userId)
    .single()

  const isOwner = patient?.id === appointment.patient_id
  if (!isOwner) {
    throw new Error('You can only cancel your own appointments')
  }

  // 3. Check status allows cancellation
  if (!['scheduled', 'confirmed'].includes(appointment.status)) {
    throw new Error(`Cannot cancel appointment with status: ${appointment.status}`)
  }

  // 4. Update status (database trigger handles slot increment)
  const { data, error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', appointmentId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Update appointment status with transition validation.
 */
export async function updateAppointmentStatus(
  appointmentId: string,
  newStatus: AppointmentStatus
): Promise<Appointment> {
  const { data: appointment, error: fetchError } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', appointmentId)
    .single()

  if (fetchError || !appointment) {
    throw new Error('Appointment not found')
  }

  if (!canTransition(appointment.status, newStatus)) {
    throw new Error(`Cannot transition from ${appointment.status} to ${newStatus}`)
  }

  const { data, error } = await supabase
    .from('appointments')
    .update({ status: newStatus })
    .eq('id', appointmentId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Get doctor's schedule for a date range.
 */
export async function getDoctorSchedule(
  doctorId: string,
  startDate: string,
  endDate: string
): Promise<Schedule[]> {
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('doctor_id', doctorId)
    .gte('date', startDate)
    .lte('date', endDate)
    .eq('is_active', true)
    .order('date')
    .order('start_time')

  if (error) throw error
  return data || []
}

/**
 * Get appointments for a date range with filters.
 */
export async function getAppointments(filters: AppointmentFilters): Promise<Appointment[]> {
  let query = supabase.from('appointments').select('*')

  if (filters.patientId) query = query.eq('patient_id', filters.patientId)
  if (filters.doctorId) query = query.eq('doctor_id', filters.doctorId)
  if (filters.clinicId) query = query.eq('clinic_id', filters.clinicId)
  if (filters.startDate) query = query.gte('date', filters.startDate)
  if (filters.endDate) query = query.lte('date', filters.endDate)
  if (filters.status) query = query.eq('status', filters.status)

  const { data, error } = await query.order('date').order('created_at')
  if (error) throw error
  return data || []
}
