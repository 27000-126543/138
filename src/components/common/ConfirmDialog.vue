<script setup lang="ts">
import { watch } from 'vue';
import { X, AlertTriangle, Info, CheckCircle, AlertCircle } from 'lucide-vue-next';

type DialogType = 'warning' | 'danger' | 'info' | 'success';

interface Props {
  modelValue: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: DialogType;
  showCancel?: boolean;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  confirmLabel: '确认',
  cancelLabel: '取消',
  type: 'warning',
  showCancel: true,
  loading: false
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [];
  cancel: [];
}>();

const typeConfig = {
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-warning-100 dark:bg-warning-900/30',
    iconColor: 'text-warning-600 dark:text-warning-400',
    confirmBtn: 'btn-warning'
  },
  danger: {
    icon: AlertCircle,
    iconBg: 'bg-danger-100 dark:bg-danger-900/30',
    iconColor: 'text-danger-600 dark:text-danger-400',
    confirmBtn: 'btn-danger'
  },
  info: {
    icon: Info,
    iconBg: 'bg-info-100 dark:bg-info-900/30',
    iconColor: 'text-info-600 dark:text-info-400',
    confirmBtn: 'btn-primary'
  },
  success: {
    icon: CheckCircle,
    iconBg: 'bg-success-100 dark:bg-success-900/30',
    iconColor: 'text-success-600 dark:text-success-400',
    confirmBtn: 'btn-success'
  }
};

const handleConfirm = () => {
  emit('confirm');
};

const handleCancel = () => {
  emit('cancel');
  emit('update:modelValue', false);
};

const handleClose = () => {
  emit('update:modelValue', false);
};

watch(() => props.modelValue, (value) => {
  if (value) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
});
</script>

<template>
  <Teleport to="body">
    <transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        @click.self="handleClose"
      >
        <transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 scale-95 translate-y-4"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition-all duration-150 ease-in"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-95 translate-y-4"
        >
          <div
            v-if="modelValue"
            class="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-modal overflow-hidden animate-scale-in"
          >
            <div class="p-6">
              <div class="flex items-start gap-4">
                <div
                  class="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                  :class="typeConfig[type].iconBg"
                >
                  <component
                    :is="typeConfig[type].icon"
                    class="w-6 h-6"
                    :class="typeConfig[type].iconColor"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    {{ title }}
                  </h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-line">
                    {{ message }}
                  </p>
                </div>
                <button
                  @click="handleClose"
                  class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                >
                  <X class="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-end gap-3">
              <button
                v-if="showCancel"
                @click="handleCancel"
                class="btn-secondary"
                :disabled="loading"
              >
                {{ cancelLabel }}
              </button>
              <button
                @click="handleConfirm"
                class="btn-danger"
                :class="{
                  'btn-primary': type === 'info',
                  'btn-success': type === 'success'
                }"
                :disabled="loading"
              >
                <span v-if="loading" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {{ confirmLabel }}
              </button>
            </div>
          </div>
        </transition>
      </div>
    </transition>
  </Teleport>
</template>
