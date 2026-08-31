import type {
  Appointment,
  AppointmentStatus,
  AuditAction,
  AuditLog,
  Clinic,
  Doctor,
  DoctorClinic,
  DoctorSpecialty,
  Gender,
  HealthPlan,
  MedicalRecord,
  Patient,
  PatientHealthPlan,
  Profile,
  Schedule,
  Specialty,
  UserRole,
} from './index'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: {
          id: string
          name: string
          cpf: string
          email: string
          phone?: string | null
          role: UserRole
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Profile>
        Relationships: []
      }
      patients: {
        Row: Patient
        Insert: {
          id?: string
          profile_id: string
          date_of_birth: string
          gender: Gender
          address?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          blood_type?: import('./index').BloodType | null
          allergies?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Patient>
        Relationships: []
      }
      doctors: {
        Row: Doctor
        Insert: {
          id?: string
          profile_id: string
          crm: string
          bio?: string | null
          consultation_price?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Doctor>
        Relationships: []
      }
      specialties: {
        Row: Specialty
        Insert: {
          id?: string
          name: string
          description?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: Partial<Specialty>
        Relationships: []
      }
      clinics: {
        Row: Clinic
        Insert: {
          id?: string
          name: string
          address?: string | null
          phone?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: Partial<Clinic>
        Relationships: []
      }
      health_plans: {
        Row: HealthPlan
        Insert: {
          id?: string
          name: string
          description?: string | null
          coverage_percentage: number
          monthly_price: number
          is_active?: boolean
          created_at?: string
        }
        Update: Partial<HealthPlan>
        Relationships: []
      }
      schedules: {
        Row: Schedule
        Insert: {
          id?: string
          doctor_id: string
          clinic_id: string
          date: string
          start_time: string
          end_time: string
          max_slots: number
          available_slots?: number
          is_active?: boolean
          created_at?: string
        }
        Update: Partial<Schedule>
        Relationships: []
      }
      appointments: {
        Row: Appointment
        Insert: {
          id?: string
          patient_id: string
          doctor_id: string
          schedule_id: string
          clinic_id: string
          date: string
          status?: AppointmentStatus
          notes?: string | null
          cancellation_reason?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Appointment>
        Relationships: []
      }
      medical_records: {
        Row: MedicalRecord
        Insert: {
          id?: string
          appointment_id?: string | null
          patient_id: string
          doctor_id?: string
          created_by?: string
          chief_complaint?: string | null
          history?: string | null
          examination?: string | null
          diagnosis: string
          treatment_plan?: string | null
          prescription?: string | null
          notes?: string | null
          next_appointment_date?: string | null
          is_deleted?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<MedicalRecord>
        Relationships: []
      }
      audit_logs: {
        Row: AuditLog
        Insert: {
          id?: string
          user_id?: string | null
          action: AuditAction
          table_name: string
          record_id?: string | null
          old_data?: Record<string, unknown> | null
          new_data?: Record<string, unknown> | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: Partial<AuditLog>
        Relationships: []
      }
      doctor_specialties: {
        Row: DoctorSpecialty
        Insert: {
          doctor_id: string
          specialty_id: string
          created_at?: string
        }
        Update: Partial<DoctorSpecialty>
        Relationships: []
      }
      doctor_clinics: {
        Row: DoctorClinic
        Insert: {
          doctor_id: string
          clinic_id: string
          created_at?: string
        }
        Update: Partial<DoctorClinic>
        Relationships: []
      }
      patient_health_plans: {
        Row: PatientHealthPlan
        Insert: {
          id?: string
          patient_id: string
          health_plan_id: string
          start_date: string
          end_date?: string | null
          created_at?: string
        }
        Update: Partial<PatientHealthPlan>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: UserRole
      gender: Gender
      blood_type: import('./index').BloodType
      appointment_status: AppointmentStatus
      audit_action: AuditAction
    }
    CompositeTypes: Record<string, never>
  }
}
