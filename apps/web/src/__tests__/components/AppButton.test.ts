import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppButton from '@/components/common/AppButton.vue'

describe('AppButton', () => {
  it('renders with correct text', () => {
    const wrapper = mount(AppButton, {
      slots: { default: 'Salvar' },
    })
    expect(wrapper.text()).toContain('Salvar')
  })

  it('emits click event on click', async () => {
    const wrapper = mount(AppButton, {
      slots: { default: 'Clique aqui' },
    })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('shows loading spinner when loading', () => {
    const wrapper = mount(AppButton, {
      props: { loading: true },
      slots: { default: 'Salvar' },
    })
    expect(wrapper.find('svg.animate-spin').exists()).toBe(true)
    expect(wrapper.text()).toContain('Salvar')
  })

  it('disables button during loading', () => {
    const wrapper = mount(AppButton, {
      props: { loading: true },
      slots: { default: 'Salvar' },
    })
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('does not emit click when loading', async () => {
    const wrapper = mount(AppButton, {
      props: { loading: true },
      slots: { default: 'Salvar' },
    })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('disables button when disabled prop is true', () => {
    const wrapper = mount(AppButton, {
      props: { disabled: true },
      slots: { default: 'Salvar' },
    })
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('applies primary variant classes by default', () => {
    const wrapper = mount(AppButton, {
      slots: { default: 'Salvar' },
    })
    const classStr = wrapper.find('button').attributes('class')
    expect(classStr).toContain('bg-blue-600')
    expect(classStr).toContain('text-white')
  })

  it('applies secondary variant classes', () => {
    const wrapper = mount(AppButton, {
      props: { variant: 'secondary' },
      slots: { default: 'Cancelar' },
    })
    const classStr = wrapper.find('button').attributes('class')
    expect(classStr).toContain('bg-gray-100')
    expect(classStr).toContain('text-gray-700')
  })

  it('applies danger variant classes', () => {
    const wrapper = mount(AppButton, {
      props: { variant: 'danger' },
      slots: { default: 'Excluir' },
    })
    const classStr = wrapper.find('button').attributes('class')
    expect(classStr).toContain('bg-red-600')
    expect(classStr).toContain('text-white')
  })

  it('applies ghost variant classes', () => {
    const wrapper = mount(AppButton, {
      props: { variant: 'ghost' },
      slots: { default: 'Ação' },
    })
    const classStr = wrapper.find('button').attributes('class')
    expect(classStr).toContain('bg-transparent')
    expect(classStr).toContain('text-gray-600')
  })

  it('applies size classes correctly', () => {
    const sm = mount(AppButton, {
      props: { size: 'sm' },
      slots: { default: 'Small' },
    })
    expect(sm.find('button').attributes('class')).toContain('px-3')

    const lg = mount(AppButton, {
      props: { size: 'lg' },
      slots: { default: 'Large' },
    })
    expect(lg.find('button').attributes('class')).toContain('px-6')
  })

  it('sets button type attribute', () => {
    const wrapper = mount(AppButton, {
      props: { type: 'submit' },
      slots: { default: 'Enviar' },
    })
    expect(wrapper.find('button').attributes('type')).toBe('submit')
  })

  it('defaults to type button', () => {
    const wrapper = mount(AppButton, {
      slots: { default: 'Enviar' },
    })
    expect(wrapper.find('button').attributes('type')).toBe('button')
  })
})
