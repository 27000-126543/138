import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { User } from '@shared/types';
import { UserRole } from '@shared/types';
import { authApi } from '../api/auth';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'));
  const user = ref<User | null>(null);
  const loading = ref(false);

  const isAuthenticated = computed(() => !!token.value && !!user.value);

  const isAdmin = computed(() => user.value?.role === UserRole.ADMIN);

  const isComputationalChemist = computed(
    () => user.value?.role === UserRole.COMPUTATIONAL_CHEMIST || isAdmin.value
  );

  const isMedicinalChemist = computed(
    () => user.value?.role === UserRole.MEDICINAL_CHEMIST || isAdmin.value
  );

  const login = async (username: string, password: string) => {
    loading.value = true;
    try {
      const response = await authApi.login({ username, password });
      token.value = response.token;
      localStorage.setItem('token', response.token);
      user.value = response.user;
      return response;
    } finally {
      loading.value = false;
    }
  };

  const logout = async () => {
    loading.value = true;
    try {
      await authApi.logout();
    } finally {
      token.value = null;
      user.value = null;
      localStorage.removeItem('token');
      loading.value = false;
    }
  };

  const getCurrentUser = async () => {
    if (!token.value) return null;
    loading.value = true;
    try {
      const response = await authApi.getCurrentUser();
      user.value = response;
      return response;
    } catch (error) {
      token.value = null;
      user.value = null;
      localStorage.removeItem('token');
      throw error;
    } finally {
      loading.value = false;
    }
  };

  return {
    token,
    user,
    isAuthenticated,
    loading,
    isAdmin,
    isComputationalChemist,
    isMedicinalChemist,
    login,
    logout,
    getCurrentUser
  };
});
