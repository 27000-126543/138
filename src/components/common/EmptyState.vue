<script setup lang="ts">
import type { LucideIcon } from 'lucide-vue-next';
import { Inbox } from 'lucide-vue-next';

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  actionIcon?: LucideIcon;
}

const props = withDefaults(defineProps<Props>(), {
  icon: Inbox
});

const emit = defineEmits<{
  action: [];
}>();
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
    <div class="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-6">
      <component
        :is="icon"
        class="w-10 h-10 text-gray-400 dark:text-gray-500"
      />
    </div>
    <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
      {{ title }}
    </h3>
    <p
      v-if="description"
      class="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6"
    >
      {{ description }}
    </p>
    <button
      v-if="actionLabel"
      @click="emit('action')"
      class="btn-primary"
    >
      <component
        v-if="actionIcon"
        :is="actionIcon"
        class="w-4 h-4"
      />
      {{ actionLabel }}
    </button>
  </div>
</template>
