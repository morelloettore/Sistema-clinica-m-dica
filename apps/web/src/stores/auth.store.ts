import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { AuthUser, UserRole } from '@/types'
import type { Session } from '@supabase/supabase-js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const session = ref<Session | null>(null)
  const loading = ref(false)
  const initialized = ref(false)

  const isAuthenticated = computed(() => !!user.value)
  const userRole = computed<UserRole | null>(() => user.value?.role ?? null)
  const isPatient = computed(() => userRole.value === 'patient')
  const isEmployee = computed(() => userRole.value === 'employee')
  const isDoctor = computed(() => userRole.value === 'doctor')
  const isAdmin = computed(() => userRole.value === 'admin')

  async function initialize() {
    if (initialized.value) return
    loading.value = true
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (currentSession) {
        session.value = currentSession
        await loadProfile(currentSession.user.id)
      }
    } finally {
      loading.value = false
      initialized.value = true
    }
  }

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, cpf, email, phone, role, is_active')
      .eq('id', userId)
      .single()

    if (error || !data) {
      user.value = null
      return
    }

    const profile = data as {
      id: string
      name: string
      email: string
      phone: string | null
      cpf: string | null
      role: UserRole
      is_active: boolean
    }

    if (!profile.is_active) {
      await logout()
      throw new Error('Sua conta foi desativada. Entre em contato com o suporte.')
    }

    user.value = {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      name: profile.name,
    }
  }

  async function login(email: string, password: string) {
    loading.value = true
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if (error.message.includes('Email not confirmed')) {
          throw new Error('Confirme seu email antes de fazer login.')
        }
        if (error.message.includes('Invalid login')) {
          throw new Error('Email ou senha inválidos.')
        }
        throw new Error('Email ou senha inválidos.')
      }
      session.value = data.session
      await loadProfile(data.user.id)
    } finally {
      loading.value = false
    }
  }

  async function register(payload: {
    email: string
    password: string
    name: string
    cpf: string
    phone?: string
  }) {
    loading.value = true
    try {
      const { data, error } = await supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: {
          data: {
            name: payload.name,
            cpf: payload.cpf,
            phone: payload.phone ?? null,
            role: 'patient',
          },
        },
      })
      if (error) {
        if (error.message.includes('already registered')) {
          throw new Error('Já existe uma conta com este email.')
        }
        throw new Error(error.message)
      }
      return data
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    user.value = null
    session.value = null
  }

  return {
    user,
    session,
    loading,
    initialized,
    isAuthenticated,
    userRole,
    isPatient,
    isEmployee,
    isDoctor,
    isAdmin,
    initialize,
    login,
    register,
    logout,
  }
})
