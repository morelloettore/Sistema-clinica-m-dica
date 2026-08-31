<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import AppToast from '@/components/common/AppToast.vue'
import AppConfirmDialog from '@/components/common/AppConfirmDialog.vue'

const auth = useAuthStore()

onMounted(() => {
  auth.initialize()
})
</script>

<template>
  <RouterView />
  <AppToast />
  <AppConfirmDialog />
</template>
