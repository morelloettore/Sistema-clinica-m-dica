<script setup lang="ts">
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'
</script>

<template>
  <div class="flex h-screen bg-gray-50">
    <AppSidebar />
    <div class="flex flex-1 flex-col overflow-hidden">
      <AppHeader>
        <template #left>
          <h1 class="text-lg font-semibold text-gray-800">Administração</h1>
        </template>
      </AppHeader>
      <main class="flex-1 overflow-y-auto p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>
