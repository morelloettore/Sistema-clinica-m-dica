export type UserRole = 'patient' | 'employee' | 'doctor' | 'admin'
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE'
export type Gender = 'male' | 'female' | 'other'
export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-'

export type Profile = {
  id: string
  name: string
  cpf: string
  email: string
  phone: string | null
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Patient = {
  id: string
  profile_id: string
  date_of_birth: string
  gender: Gender
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  blood_type: BloodType | null
  allergies: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Doctor = {
  id: string
  profile_id: string
  crm: string
  bio: string | null
  consultation_price: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Specialty = {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

export type Clinic = {
  id: string
  name: string
  address: string | null
  phone: string | null
  is_active: boolean
  created_at: string
}

export type HealthPlan = {
  id: string
  name: string
  description: string | null
  coverage_percentage: number
  monthly_price: number
  is_active: boolean
  created_at: string
}

export type Schedule = {
  id: string
  doctor_id: string
  clinic_id: string
  date: string
  start_time: string
  end_time: string
  max_slots: number
  available_slots: number
  is_active: boolean
  created_at: string
}

export type Appointment = {
  id: string
  patient_id: string
  doctor_id: string
  schedule_id: string
  clinic_id: string
  date: string
  status: AppointmentStatus
  notes: string | null
  cancellation_reason: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type MedicalRecord = {
  id: string
  appointment_id: string | null
  patient_id: string
  doctor_id: string
  created_by: string
  chief_complaint: string | null
  history: string | null
  examination: string | null
  diagnosis: string
  treatment_plan: string | null
  prescription: string | null
  notes: string | null
  next_appointment_date: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export type AuditLog = {
  id: string
  user_id: string | null
  action: AuditAction
  table_name: string
  record_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export type DoctorSpecialty = {
  doctor_id: string
  specialty_id: string
  created_at: string
}

export type DoctorClinic = {
  doctor_id: string
  clinic_id: string
  created_at: string
}

export type PatientHealthPlan = {
  id: string
  patient_id: string
  health_plan_id: string
  start_date: string
  end_date: string | null
  created_at: string
}
