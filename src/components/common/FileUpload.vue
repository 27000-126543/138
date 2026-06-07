<script setup lang="ts">
import { ref, computed } from 'vue';
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-vue-next';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
  file?: File;
}

interface Props {
  accept?: string;
  maxSize?: number;
  multiple?: boolean;
  maxFiles?: number;
  allowedFormats?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  accept: '.pdb,.sdf',
  maxSize: 50 * 1024 * 1024,
  multiple: false,
  maxFiles: 10,
  allowedFormats: () => ['.pdb', '.sdf']
});

const emit = defineEmits<{
  'update:modelValue': [files: UploadedFile[]];
  change: [files: UploadedFile[]];
  error: [message: string];
}>();

const files = ref<UploadedFile[]>([]);
const isDragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileExtension = (filename: string): string => {
  return '.' + filename.split('.').pop()?.toLowerCase();
};

const validateFile = (file: File): string | null => {
  const ext = getFileExtension(file.name);
  
  if (!props.allowedFormats.includes(ext)) {
    return `不支持的文件格式。请上传 ${props.allowedFormats.join(', ')} 格式的文件`;
  }
  
  if (file.size > props.maxSize) {
    return `文件大小超过限制。最大支持 ${formatFileSize(props.maxSize)}`;
  }
  
  return null;
};

const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

const addFile = (file: File) => {
  if (!props.multiple && files.value.length > 0) {
    files.value = [];
  }
  
  if (files.value.length >= props.maxFiles) {
    emit('error', `最多只能上传 ${props.maxFiles} 个文件`);
    return;
  }
  
  const error = validateFile(file);
  const uploadedFile: UploadedFile = {
    id: generateId(),
    name: file.name,
    size: file.size,
    type: file.type || getFileExtension(file.name),
    progress: 0,
    status: error ? 'error' : 'uploading',
    error: error || undefined,
    file
  };
  
  files.value.push(uploadedFile);
  
  if (!error) {
    simulateUpload(uploadedFile);
  }
  
  emitChange();
};

const simulateUpload = (uploadedFile: UploadedFile) => {
  const interval = setInterval(() => {
    const increment = Math.random() * 15 + 5;
    uploadedFile.progress = Math.min(uploadedFile.progress + increment, 100);
    
    if (uploadedFile.progress >= 100) {
      clearInterval(interval);
      uploadedFile.status = 'success';
      uploadedFile.progress = 100;
      emitChange();
    }
  }, 200);
};

const removeFile = (id: string) => {
  files.value = files.value.filter(f => f.id !== id);
  emitChange();
};

const emitChange = () => {
  emit('update:modelValue', files.value);
  emit('change', files.value);
};

const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  isDragging.value = true;
};

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault();
  isDragging.value = false;
};

const handleDrop = (e: DragEvent) => {
  e.preventDefault();
  isDragging.value = false;
  
  const droppedFiles = Array.from(e.dataTransfer?.files || []);
  droppedFiles.forEach(file => addFile(file));
};

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const selectedFiles = Array.from(target.files || []);
  selectedFiles.forEach(file => addFile(file));
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

const openFileDialog = () => {
  fileInput.value?.click();
};

const getFileIcon = (filename: string) => {
  const ext = getFileExtension(filename);
  if (ext === '.pdb') return 'text-blue-600 dark:text-blue-400';
  if (ext === '.sdf') return 'text-purple-600 dark:text-purple-400';
  return 'text-gray-600 dark:text-gray-400';
};

const successfulFiles = computed(() => {
  return files.value.filter(f => f.status === 'success');
});
</script>

<template>
  <div class="w-full">
    <div
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
      @click="openFileDialog"
      class="relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200"
      :class="[
        isDragging
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
          : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-gray-50 dark:hover:bg-gray-800/50'
      ]"
    >
      <input
        ref="fileInput"
        type="file"
        :accept="accept"
        :multiple="multiple"
        class="hidden"
        @change="handleFileSelect"
      />
      
      <div class="flex flex-col items-center">
        <div
          class="w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors"
          :class="[
            isDragging
              ? 'bg-primary-100 dark:bg-primary-900/30'
              : 'bg-gray-100 dark:bg-gray-800'
          ]"
        >
          <Upload
            class="w-8 h-8 transition-colors"
            :class="[
              isDragging
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-gray-400 dark:text-gray-500'
            ]"
          />
        </div>
        <p class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
          {{ isDragging ? '释放文件以上传' : '拖拽文件到此处' }}
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          或 <span class="text-primary-600 dark:text-primary-400 font-medium">点击选择文件</span>
        </p>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-2">
          支持 {{ allowedFormats.join(', ') }} 格式，单个文件最大 {{ formatFileSize(maxSize) }}
        </p>
      </div>
    </div>

    <div v-if="files.length > 0" class="mt-4 space-y-2">
      <div
        v-for="file in files"
        :key="file.id"
        class="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
      >
        <div
          class="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0"
        >
          <FileText class="w-5 h-5" :class="getFileIcon(file.name)" />
        </div>
        
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {{ file.name }}
            </p>
            <span class="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
              {{ formatFileSize(file.size) }}
            </span>
          </div>
          
          <div v-if="file.status === 'uploading'" class="mt-1.5">
            <div class="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                class="h-full bg-primary-500 rounded-full transition-all duration-300"
                :style="{ width: `${file.progress}%` }"
              />
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              上传中 {{ Math.round(file.progress) }}%
            </p>
          </div>
          
          <p
            v-else-if="file.status === 'error'"
            class="text-xs text-danger-600 dark:text-danger-400 mt-1 flex items-center gap-1"
          >
            <AlertCircle class="w-3 h-3" />
            {{ file.error }}
          </p>
          
          <p
            v-else-if="file.status === 'success'"
            class="text-xs text-success-600 dark:text-success-400 mt-1 flex items-center gap-1"
          >
            <CheckCircle class="w-3 h-3" />
            上传成功
          </p>
        </div>
        
        <div class="flex items-center gap-2">
          <Loader2
            v-if="file.status === 'uploading'"
            class="w-4 h-4 text-primary-500 animate-spin"
          />
          <CheckCircle
            v-else-if="file.status === 'success'"
            class="w-5 h-5 text-success-500"
          />
          <AlertCircle
            v-else-if="file.status === 'error'"
            class="w-5 h-5 text-danger-500"
          />
          <button
            @click.stop="removeFile(file.id)"
            class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X class="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
          </button>
        </div>
      </div>
    </div>

    <div v-if="successfulFiles.length > 0" class="mt-4 p-3 bg-success-50 dark:bg-success-900/20 rounded-lg border border-success-200 dark:border-success-800/30">
      <p class="text-sm text-success-700 dark:text-success-400 flex items-center gap-2">
        <CheckCircle class="w-4 h-4" />
        已成功上传 {{ successfulFiles.length }} 个文件
      </p>
    </div>
  </div>
</template>
