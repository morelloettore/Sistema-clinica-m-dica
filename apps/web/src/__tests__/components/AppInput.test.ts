import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'

const AppInput = defineComponent({
  name: 'AppInput',
  props: {
    modelValue: { type: String, default: '' },
    label: { type: String, default: '' },
    error: { type: String, default: '' },
    required: { type: Boolean, default: false },
    type: { type: String, default: 'text' },
    placeholder: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  setup(_props, { emit }) {
    function onInput(event: Event) {
      const target = event.target as HTMLInputElement
      emit('update:modelValue', target.value)
    }
    return { onInput }
  },
  template: `
    <div class="form-group">
      <label v-if="label" class="form-label">
        {{ label }}
        <span v-if="required" class="required-indicator">*</span>
      </label>
      <input
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :class="['form-input', { 'input-error': error }]"
        @input="onInput"
      />
      <span v-if="error" class="error-message">{{ error }}</span>
    </div>
  `,
})

describe('AppInput', () => {
  it('renders label text', () => {
    const wrapper = mount(AppInput, {
      props: { label: 'Nome completo' },
    })
    expect(wrapper.text()).toContain('Nome completo')
  })

  it('shows required indicator when required', () => {
    const wrapper = mount(AppInput, {
      props: { label: 'Email', required: true },
    })
    expect(wrapper.find('.required-indicator').exists()).toBe(true)
    expect(wrapper.find('.required-indicator').text()).toBe('*')
  })

  it('does not show required indicator by default', () => {
    const wrapper = mount(AppInput, {
      props: { label: 'Email' },
    })
    expect(wrapper.find('.required-indicator').exists()).toBe(false)
  })

  it('shows error message', () => {
    const wrapper = mount(AppInput, {
      props: { error: 'Email inválido' },
    })
    expect(wrapper.find('.error-message').exists()).toBe(true)
    expect(wrapper.find('.error-message').text()).toBe('Email inválido')
  })

  it('does not show error message when empty', () => {
    const wrapper = mount(AppInput, {
      props: { error: '' },
    })
    expect(wrapper.find('.error-message').exists()).toBe(false)
  })

  it('applies error class to input', () => {
    const wrapper = mount(AppInput, {
      props: { error: 'Campo obrigatório' },
    })
    expect(wrapper.find('input').classes()).toContain('input-error')
  })

  it('binds v-model correctly', async () => {
    const wrapper = mount(AppInput, {
      props: {
        modelValue: 'initial',
        'onUpdate:modelValue': (val: string) => wrapper.setProps({ modelValue: val }),
      },
    })

    const input = wrapper.find('input')
    expect(input.element.value).toBe('initial')

    await input.setValue('updated')
    expect(wrapper.props('modelValue')).toBe('updated')
  })

  it('renders placeholder', () => {
    const wrapper = mount(AppInput, {
      props: { placeholder: 'Digite seu email' },
    })
    expect(wrapper.find('input').attributes('placeholder')).toBe('Digite seu email')
  })

  it('renders correct input type', () => {
    const wrapper = mount(AppInput, {
      props: { type: 'email' },
    })
    expect(wrapper.find('input').attributes('type')).toBe('email')
  })

  it('disables input when disabled', () => {
    const wrapper = mount(AppInput, {
      props: { disabled: true },
    })
    expect(wrapper.find('input').attributes('disabled')).toBeDefined()
  })

  it('emits update:modelValue on input', async () => {
    const wrapper = mount(AppInput)

    await wrapper.find('input').setValue('hello')
    expect(wrapper.emitted('update:modelValue')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['hello'])
  })
})
