<script setup lang="ts">
interface SelectOption {
  value: string | number
  label: string
}

interface Props {
  modelValue?: string | number
  label?: string
  options: SelectOption[]
  placeholder?: string
  error?: string
  disabled?: boolean
  required?: boolean
}

defineProps<Props>()
defineEmits<{ 'update:modelValue': [value: string | number] }>()
</script>

<template>
  <div class="space-y-1">
    <label v-if="label" class="block text-sm font-medium text-gray-700">
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
    </label>
    <select
      :value="modelValue"
      :disabled="disabled"
      :required="required"
      class="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
      :class="{ 'border-red-500 focus:border-red-500 focus:ring-red-500/20': error }"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option v-for="opt in options" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>
    <p v-if="error" class="text-xs text-red-600">{{ error }}</p>
  </div>
</template>
