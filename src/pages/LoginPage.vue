<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Eye, EyeOff, Atom, Loader2 } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const showPassword = ref(false)
const error = ref('')
const loading = ref(false)

const canvasRef = ref<HTMLCanvasElement | null>(null)
let animationId: number | null = null

interface Molecule {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
  bonds: number[]
}

const molecules: Molecule[] = []
const atomColors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b']

const initMolecules = (width: number, height: number) => {
  molecules.length = 0
  const count = 30
  for (let i = 0; i < count; i++) {
    molecules.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      radius: 4 + Math.random() * 6,
      color: atomColors[Math.floor(Math.random() * atomColors.length)],
      bonds: []
    })
  }
  for (let i = 0; i < count; i++) {
    const bondCount = Math.floor(Math.random() * 3) + 1
    for (let j = 0; j < bondCount; j++) {
      const target = Math.floor(Math.random() * count)
      if (target !== i && !molecules[i].bonds.includes(target)) {
        molecules[i].bonds.push(target)
      }
    }
  }
}

const animate = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.width
  const height = canvas.height

  ctx.fillStyle = 'rgba(15, 23, 42, 0.1)'
  ctx.fillRect(0, 0, width, height)

  molecules.forEach((mol, i) => {
    mol.x += mol.vx
    mol.y += mol.vy
    if (mol.x < 0 || mol.x > width) mol.vx *= -1
    if (mol.y < 0 || mol.y > height) mol.vy *= -1

    mol.bonds.forEach(bondIdx => {
      const target = molecules[bondIdx]
      const dist = Math.sqrt((mol.x - target.x) ** 2 + (mol.y - target.y) ** 2)
      if (dist < 150) {
        ctx.beginPath()
        ctx.moveTo(mol.x, mol.y)
        ctx.lineTo(target.x, target.y)
        ctx.strokeStyle = `rgba(59, 130, 246, ${0.3 - dist / 500})`
        ctx.lineWidth = 1
        ctx.stroke()
      }
    })

    const gradient = ctx.createRadialGradient(mol.x, mol.y, 0, mol.x, mol.y, mol.radius * 2)
    gradient.addColorStop(0, mol.color)
    gradient.addColorStop(1, 'transparent')
    ctx.beginPath()
    ctx.arc(mol.x, mol.y, mol.radius * 2, 0, Math.PI * 2)
    ctx.fillStyle = gradient
    ctx.fill()

    ctx.beginPath()
    ctx.arc(mol.x, mol.y, mol.radius, 0, Math.PI * 2)
    ctx.fillStyle = mol.color
    ctx.fill()
  })

  animationId = requestAnimationFrame(animate)
}

const handleResize = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  initMolecules(canvas.width, canvas.height)
}

const handleLogin = async () => {
  if (!username.value || !password.value) {
    error.value = '请输入用户名和密码'
    return
  }
  error.value = ''
  loading.value = true
  try {
    await authStore.login(username.value, password.value)
    const redirect = route.query.redirect as string || '/dashboard'
    router.push(redirect)
  } catch (e) {
    error.value = '用户名或密码错误，请重试'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  handleResize()
  window.addEventListener('resize', handleResize)
  animate()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
})
</script>

<template>
  <div class="min-h-screen w-full relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
    <canvas
      ref="canvasRef"
      class="absolute inset-0 w-full h-full"
    />

    <div class="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-slate-900/50" />

    <div class="relative z-10 min-h-screen flex items-center justify-center p-4">
      <div class="w-full max-w-md">
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/20 backdrop-blur-sm mb-4">
            <Atom class="w-8 h-8 text-blue-400" />
          </div>
          <h1 class="text-3xl font-bold text-white mb-2">
            蛋白质-配体结合自由能预测平台
          </h1>
          <p class="text-slate-400">
            Protein-Ligand Binding Free Energy Prediction
          </p>
        </div>

        <div class="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl">
          <h2 class="text-xl font-semibold text-white mb-6 text-center">账户登录</h2>

          <form @submit.prevent="handleLogin" class="space-y-5">
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-2">用户名</label>
              <input
                v-model="username"
                type="text"
                class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="请输入用户名"
                autocomplete="username"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-300 mb-2">密码</label>
              <div class="relative">
                <input
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-12"
                  placeholder="请输入密码"
                  autocomplete="current-password"
                />
                <button
                  type="button"
                  @click="showPassword = !showPassword"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  <Eye v-if="!showPassword" class="w-5 h-5" />
                  <EyeOff v-else class="w-5 h-5" />
                </button>
              </div>
            </div>

            <div
              v-if="error"
              class="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm"
            >
              {{ error }}
            </div>

            <button
              type="submit"
              :disabled="loading"
              class="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold hover:from-blue-600 hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              <Loader2 v-if="loading" class="w-5 h-5 animate-spin" />
              {{ loading ? '登录中...' : '登 录' }}
            </button>
          </form>

          <div class="mt-6 text-center text-sm text-slate-400">
            <p>测试账号: admin / admin123</p>
          </div>
        </div>

        <p class="text-center text-slate-500 text-sm mt-6">
          © 2024 计算化学平台. All rights reserved.
        </p>
      </div>
    </div>
  </div>
</template>
