<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

watch(
  () => authStore.user,
  (newUser) => {
    if (newUser && route.name === 'login') {
      router.push('/dashboard')
    }
  }
)
</script>

<template>
  <router-view />
</template>
