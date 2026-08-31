import { describe, it, expect } from 'vitest'
import {
  loginSchema,
  registerSchema,
  passwordSchema,
  cpfSchema,
  emailSchema,
  nameSchema,
  validateCpfChecksum,
} from '@clinica/shared/schemas/auth.schema'

describe('passwordSchema', () => {
  it('accepts strong password', () => {
    expect(passwordSchema.safeParse('SecurePass1').success).toBe(true)
  })

  it('accepts password with 8+ chars, upper, lower, number', () => {
    expect(passwordSchema.safeParse('Abcdefg1').success).toBe(true)
  })

  it('rejects password shorter than 8 characters', () => {
    const result = passwordSchema.safeParse('Sec1')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('8 caracteres')
    }
  })

  it('rejects password without uppercase', () => {
    const result = passwordSchema.safeParse('securepass1')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('maiúscula')
    }
  })

  it('rejects password without lowercase', () => {
    const result = passwordSchema.safeParse('SECUREPASS1')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('minúscula')
    }
  })

  it('rejects password without number', () => {
    const result = passwordSchema.safeParse('SecurePass')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('número')
    }
  })

  it('rejects empty password', () => {
    expect(passwordSchema.safeParse('').success).toBe(false)
  })

  it('rejects whitespace-only password', () => {
    expect(passwordSchema.safeParse('        ').success).toBe(false)
  })
})

describe('cpfSchema', () => {
  it('accepts valid formatted CPF', () => {
    expect(cpfSchema.safeParse('123.456.789-09').success).toBe(true)
  })

  it('accepts valid unformatted CPF (11 digits)', () => {
    expect(cpfSchema.safeParse('12345678909').success).toBe(true)
  })

  it('accepts another valid CPF', () => {
    expect(cpfSchema.safeParse('529.982.247-25').success).toBe(true)
  })

  it('rejects invalid checksum CPF', () => {
    expect(cpfSchema.safeParse('123.456.789-00').success).toBe(false)
  })

  it('rejects all-same-digit CPFs', () => {
    expect(cpfSchema.safeParse('111.111.111-11').success).toBe(false)
    expect(cpfSchema.safeParse('000.000.000-00').success).toBe(false)
    expect(cpfSchema.safeParse('999.999.999-99').success).toBe(false)
  })

  it('rejects wrong format - too short', () => {
    expect(cpfSchema.safeParse('123.456.789-0').success).toBe(false)
  })

  it('rejects wrong format - letters', () => {
    expect(cpfSchema.safeParse('abc.def.ghi-jk').success).toBe(false)
  })

  it('rejects empty string', () => {
    expect(cpfSchema.safeParse('').success).toBe(false)
  })
})

describe('validateCpfChecksum', () => {
  it('returns true for valid CPFs', () => {
    expect(validateCpfChecksum('123.456.789-09')).toBe(true)
    expect(validateCpfChecksum('529.982.247-25')).toBe(true)
    expect(validateCpfChecksum('111.444.777-35')).toBe(true)
    expect(validateCpfChecksum('12345678909')).toBe(true)
  })

  it('returns false for invalid checksum', () => {
    expect(validateCpfChecksum('123.456.789-00')).toBe(false)
    expect(validateCpfChecksum('111.111.111-11')).toBe(false)
  })

  it('returns false for all-same-digit CPFs', () => {
    expect(validateCpfChecksum('000.000.000-00')).toBe(false)
    expect(validateCpfChecksum('222.222.222-22')).toBe(false)
    expect(validateCpfChecksum('999.999.999-99')).toBe(false)
  })

  it('returns false for wrong length', () => {
    expect(validateCpfChecksum('123.456.789-0')).toBe(false)
    expect(validateCpfChecksum('123456789')).toBe(false)
    expect(validateCpfChecksum('')).toBe(false)
    expect(validateCpfChecksum('123456789012')).toBe(false)
  })

  it('returns false for strings with non-digits that dont match', () => {
    expect(validateCpfChecksum('abcdefghijk')).toBe(false)
  })
})

describe('emailSchema', () => {
  it('accepts valid email', () => {
    expect(emailSchema.safeParse('user@example.com').success).toBe(true)
  })

  it('accepts email with subdomain', () => {
    expect(emailSchema.safeParse('user@sub.domain.com').success).toBe(true)
  })

  it('rejects email without @', () => {
    expect(emailSchema.safeParse('userexample.com').success).toBe(false)
  })

  it('rejects email without domain', () => {
    expect(emailSchema.safeParse('user@').success).toBe(false)
  })

  it('rejects email without TLD', () => {
    expect(emailSchema.safeParse('user@example').success).toBe(false)
  })

  it('rejects empty string', () => {
    expect(emailSchema.safeParse('').success).toBe(false)
  })
})

describe('nameSchema', () => {
  it('accepts valid name', () => {
    expect(nameSchema.safeParse('João Silva').success).toBe(true)
  })

  it('accepts name with 2 characters', () => {
    expect(nameSchema.safeParse('Jo').success).toBe(true)
  })

  it('rejects single character name', () => {
    expect(nameSchema.safeParse('J').success).toBe(false)
  })

  it('rejects name longer than 200 characters', () => {
    expect(nameSchema.safeParse('A'.repeat(201)).success).toBe(false)
  })

  it('accepts name with exactly 200 characters', () => {
    expect(nameSchema.safeParse('A'.repeat(200)).success).toBe(true)
  })

  it('rejects name with HTML characters - angle brackets', () => {
    expect(nameSchema.safeParse('João <script>alert("xss")</script>').success).toBe(false)
  })

  it('rejects name with ampersand', () => {
    expect(nameSchema.safeParse('João & Maria').success).toBe(false)
  })

  it('rejects name with double quotes', () => {
    expect(nameSchema.safeParse('João "Silva"').success).toBe(false)
  })

  it('accepts name with special chars not in blocklist', () => {
    const result = nameSchema.safeParse("'; DROP TABLE users; --")
    expect(result.success).toBe(true)
  })

  it('rejects empty string', () => {
    expect(nameSchema.safeParse('').success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('accepts valid email and password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'SecurePass1',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'SecurePass1',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing email', () => {
    const result = loginSchema.safeParse({
      password: 'SecurePass1',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
    })
    expect(result.success).toBe(false)
  })
})

describe('registerSchema', () => {
  const validRegistration = {
    name: 'João Silva',
    email: 'joao@email.com',
    cpf: '123.456.789-09',
    password: 'SecurePass1',
  }

  it('accepts valid registration data', () => {
    const result = registerSchema.safeParse(validRegistration)
    expect(result.success).toBe(true)
  })

  it('rejects invalid CPF', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      cpf: '111.111.111-11',
    })
    expect(result.success).toBe(false)
  })

  it('rejects weak password', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      password: 'weak',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      email: 'not-an-email',
    })
    expect(result.success).toBe(false)
  })

  it('rejects XSS in name', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      name: '<script>alert("xss")</script>',
    })
    expect(result.success).toBe(false)
  })

  it('rejects HTML characters in name', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      name: 'João <b>Bold</b>',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      name: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing all fields', () => {
    const result = registerSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})
