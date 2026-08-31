import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mockSignIn = vi.fn()
const mockSignUp = vi.fn()
const mockSignOut = vi.fn()
const mockGetSession = vi.fn()
const mockOnAuthStateChange = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: any[]) => mockSignIn(...args),
      signUp: (...args: any[]) => mockSignUp(...args),
      signOut: (...args: any[]) => mockSignOut(...args),
      getSession: (...args: any[]) => mockGetSession(...args),
      onAuthStateChange: (...args: any[]) => mockOnAuthStateChange(...args),
    },
    from: (...args: any[]) => mockFrom(...args),
  },
}))

import { useAuthStore } from '@/stores/auth.store'

function mockProfileQuery(profileData: any) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: profileData, error: null }),
  }
  mockFrom.mockReturnValue(chain)
  return chain
}

describe('useAuthStore', () => {
  let store: ReturnType<typeof useAuthStore>

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())

    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })

    store = useAuthStore()
  })

  describe('initial state', () => {
    it('starts unauthenticated', () => {
      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
    })

    it('has null userRole', () => {
      expect(store.userRole).toBeNull()
    })

    it('has loading as false', () => {
      expect(store.loading).toBe(false)
    })

    it('has initialized as false', () => {
      expect(store.initialized).toBe(false)
    })

    it('has all role getters as false', () => {
      expect(store.isPatient).toBe(false)
      expect(store.isEmployee).toBe(false)
      expect(store.isDoctor).toBe(false)
      expect(store.isAdmin).toBe(false)
    })
  })

  describe('login', () => {
    it('sets user on successful login', async () => {
      const mockProfile = {
        id: 'user-123',
        name: 'João Silva',
        cpf: '123.456.789-09',
        email: 'joao@email.com',
        phone: null,
        role: 'patient',
        is_active: true,
      }

      mockSignIn.mockResolvedValue({
        data: {
          user: { id: 'user-123' },
          session: { access_token: 'token' },
        },
        error: null,
      })

      mockProfileQuery(mockProfile)

      await store.login('joao@email.com', 'SecurePass1')

      expect(store.isAuthenticated).toBe(true)
      expect(store.user?.id).toBe('user-123')
      expect(store.user?.role).toBe('patient')
      expect(store.user?.name).toBe('João Silva')
    })

    it('throws error on bad credentials', async () => {
      mockSignIn.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      })

      await expect(store.login('wrong@email.com', 'WrongPass1')).rejects.toThrow(
        'Email ou senha inválidos',
      )
      expect(store.isAuthenticated).toBe(false)
    })

    it('throws error for unconfirmed email', async () => {
      mockSignIn.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Email not confirmed' },
      })

      await expect(store.login('user@email.com', 'Pass1')).rejects.toThrow(
        'Confirme seu email',
      )
    })

    it('sets loading during login', async () => {
      let resolveLogin: any
      mockSignIn.mockImplementation(
        () => new Promise((resolve) => { resolveLogin = resolve }),
      )

      const promise = store.login('joao@email.com', 'SecurePass1')
      expect(store.loading).toBe(true)

      resolveLogin({ data: { user: null, session: null }, error: { message: 'error' } })
      await expect(promise).rejects.toThrow()
      expect(store.loading).toBe(false)
    })

    it('throws when profile is inactive', async () => {
      mockSignIn.mockResolvedValue({
        data: { user: { id: 'user-123' }, session: { access_token: 'token' } },
        error: null,
      })

      mockProfileQuery({
        id: 'user-123',
        name: 'Inactive',
        email: 'x@x.com',
        role: 'patient',
        is_active: false,
        cpf: null,
        phone: null,
      })

      mockSignOut.mockResolvedValue({ error: null })

      await expect(store.login('x@x.com', 'Pass1')).rejects.toThrow('desativada')
    })
  })

  describe('register', () => {
    it('returns data on successful registration', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: { id: 'new-user' }, session: { access_token: 'token' } },
        error: null,
      })

      const result = await store.register({
        email: 'joao@email.com',
        password: 'SecurePass1',
        name: 'João Silva',
        cpf: '123.456.789-09',
      })

      expect(result.user).toBeDefined()
      expect(result.user?.id).toBe('new-user')
    })

    it('throws for already registered email', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered' },
      })

      await expect(
        store.register({
          email: 'existing@email.com',
          password: 'SecurePass1',
          name: 'João',
          cpf: '123.456.789-09',
        }),
      ).rejects.toThrow('Já existe uma conta com este email')
    })

    it('sets loading during registration', async () => {
      let resolveSignUp: any
      mockSignUp.mockImplementation(
        () => new Promise((resolve) => { resolveSignUp = resolve }),
      )

      const promise = store.register({
        email: 'joao@email.com',
        password: 'SecurePass1',
        name: 'João',
        cpf: '123.456.789-09',
      })
      expect(store.loading).toBe(true)

      resolveSignUp({ data: { user: null, session: null }, error: null })
      await promise
      expect(store.loading).toBe(false)
    })
  })

  describe('logout', () => {
    it('clears user', async () => {
      store.user = {
        id: 'user-123',
        email: 'joao@email.com',
        role: 'patient',
        name: 'João',
      }

      mockSignOut.mockResolvedValue({ error: null })

      await store.logout()

      expect(store.user).toBeNull()
      expect(store.isAuthenticated).toBe(false)
    })

    it('calls supabase signOut', async () => {
      mockSignOut.mockResolvedValue({ error: null })
      await store.logout()
      expect(mockSignOut).toHaveBeenCalled()
    })
  })

  describe('role-based getters', () => {
    it('isPatient true when role is patient', () => {
      store.user = { id: '1', email: 'a@b.com', role: 'patient', name: 'A' }
      expect(store.isPatient).toBe(true)
      expect(store.isEmployee).toBe(false)
      expect(store.isDoctor).toBe(false)
      expect(store.isAdmin).toBe(false)
    })

    it('isEmployee true when role is employee', () => {
      store.user = { id: '1', email: 'a@b.com', role: 'employee', name: 'A' }
      expect(store.isEmployee).toBe(true)
      expect(store.isPatient).toBe(false)
    })

    it('isDoctor true when role is doctor', () => {
      store.user = { id: '1', email: 'a@b.com', role: 'doctor', name: 'A' }
      expect(store.isDoctor).toBe(true)
      expect(store.isPatient).toBe(false)
    })

    it('isAdmin true when role is admin', () => {
      store.user = { id: '1', email: 'a@b.com', role: 'admin', name: 'A' }
      expect(store.isAdmin).toBe(true)
      expect(store.isPatient).toBe(false)
    })
  })
})
