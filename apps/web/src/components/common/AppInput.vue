<script setup lang="ts">
interface Props {
  modelValue?: string | number
  label?: string
  type?: string
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
    <input
      :type="type || 'text'"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
      :class="{ 'border-red-500 focus:border-red-500 focus:ring-red-500/20': error }"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <p v-if="error" class="text-xs text-red-600">{{ error }}</p>
  </div>
</template>
