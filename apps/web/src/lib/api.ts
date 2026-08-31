import { supabase } from './supabase'
import type {
  Appointment,
  AppointmentStatus,
  AuditAction,
  AuditLog,
  Clinic,
  Doctor,
  HealthPlan,
  MedicalRecord,
  Patient,
  Profile,
  Schedule,
  Specialty,
  CreateAppointmentInput,
  CreateMedicalRecordInput,
} from '@clinica/shared'

export interface PatientFilters {
  search?: string
  is_active?: boolean
}

export interface DoctorFilters {
  search?: string
  specialty_id?: string
  is_active?: boolean
}

export interface AppointmentFilters {
  status?: AppointmentStatus
  dateFrom?: string
  dateTo?: string
  doctorId?: string
  patientId?: string
}

export interface ScheduleFilters {
  doctorId?: string
  clinicId?: string
  date?: string
  availableOnly?: boolean
}

export interface MedicalRecordFilters {
  patientId?: string
  doctorId?: string
}

export interface AuditLogFilters {
  tableName?: string
  action?: AuditAction
  createdFrom?: string
  createdTo?: string
}

const PROFILE_SELECT = 'id, name, cpf, email, phone, role, is_active, created_at, updated_at'
const DOCTOR_SELECT =
  '*, profile:profiles(*), doctor_specialties(*, specialty:specialties(*))'
const APPOINTMENT_SELECT =
  '*, patient:patients(*, profile:profiles(*)), doctor:doctors(*, profile:profiles(*)), schedule:schedules(*), clinic:clinics(*)'
const MEDICAL_RECORD_SELECT =
  '*, patient:patients(*, profile:profiles(*)), doctor:doctors(*, profile:profiles(*)), appointment:appointments(*)'

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}

export async function fetchPatients(filters: PatientFilters = {}): Promise<Patient[]> {
  let query = supabase.from('patients').select('*, profile:profiles(*)')

  if (filters.search) {
    query = query.or(`profile.name.ilike.%${filters.search}%,profile.cpf.ilike.%${filters.search}%`)
  }
  if (filters.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active)
  }

  query = query.order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function fetchDoctors(filters: DoctorFilters = {}): Promise<Doctor[]> {
  let query = supabase.from('doctors').select(DOCTOR_SELECT)

  if (filters.specialty_id) {
    query = query.eq('doctor_specialties.specialty_id', filters.specialty_id)
  }
  if (filters.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active)
  }

  query = query.order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function fetchAppointments(filters: AppointmentFilters = {}): Promise<Appointment[]> {
  let query = supabase.from('appointments').select(APPOINTMENT_SELECT)

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.dateFrom) query = query.gte('date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('date', filters.dateTo)
  if (filters.doctorId) query = query.eq('doctor_id', filters.doctorId)
  if (filters.patientId) query = query.eq('patient_id', filters.patientId)

  query = query.order('date', { ascending: false })

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function fetchSchedules(filters: ScheduleFilters = {}): Promise<Schedule[]> {
  let query = supabase.from('schedules').select('*, clinic:clinics(*)')

  if (filters.doctorId) query = query.eq('doctor_id', filters.doctorId)
  if (filters.clinicId) query = query.eq('clinic_id', filters.clinicId)
  if (filters.date) query = query.eq('date', filters.date)
  if (filters.availableOnly) query = query.gt('available_slots', 0)

  query = query.order('date', { ascending: true })

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function fetchMedicalRecords(filters: MedicalRecordFilters = {}): Promise<MedicalRecord[]> {
  let query = supabase.from('medical_records').select(MEDICAL_RECORD_SELECT).eq('is_deleted', false)

  if (filters.patientId) query = query.eq('patient_id', filters.patientId)
  if (filters.doctorId) query = query.eq('doctor_id', filters.doctorId)

  query = query.order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function fetchSpecialties(): Promise<Specialty[]> {
  const { data, error } = await supabase
    .from('specialties')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function fetchClinics(): Promise<Clinic[]> {
  const { data, error } = await supabase
    .from('clinics')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function fetchHealthPlans(): Promise<HealthPlan[]> {
  const { data, error } = await supabase
    .from('health_plans')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function createAppointment(data: CreateAppointmentInput): Promise<Appointment> {
  const { data: result, error } = await supabase.functions.invoke<Appointment>('book-appointment', {
    body: data,
  })

  if (error) throw error
  return result as Appointment
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<Appointment | null> {
  const { data, error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function createMedicalRecord(
  data: CreateMedicalRecordInput
): Promise<MedicalRecord> {
  const { data: result, error } = await supabase.functions.invoke<MedicalRecord>(
    'create-medical-record',
    { body: data }
  )

  if (error) throw error
  return result as MedicalRecord
}

export async function fetchAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLog[]> {
  let query = supabase.from('audit_logs').select('*, user:profiles(name)')

  if (filters.tableName) query = query.eq('table_name', filters.tableName)
  if (filters.action) query = query.eq('action', filters.action)
  if (filters.createdFrom) query = query.gte('created_at', filters.createdFrom)
  if (filters.createdTo) query = query.lte('created_at', filters.createdTo)

  query = query.order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}
