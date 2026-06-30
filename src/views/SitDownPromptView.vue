<template>
  <div class="prompt">
    <div class="prompt__card">
      <div class="prompt__header">
        <span class="prompt__emoji">🪑</span>
        <span class="prompt__title">检测到键鼠活动</span>
      </div>
      <p class="prompt__body">你已经回到座位了吗？</p>
      <div class="prompt__actions">
        <button class="prompt__btn prompt__btn--primary" :disabled="loading" @click="handleSitDown">
          {{ loading ? '…' : '坐下了' }}
        </button>
        <button class="prompt__btn prompt__btn--ghost" :disabled="loading" @click="handleStillStanding">
          还在站着
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const loading = ref(false)

async function handleSitDown(): Promise<void> {
  if (loading.value) return
  loading.value = true
  try {
    await window.standUp.confirmSitDownPrompt()
  } finally {
    loading.value = false
  }
}

async function handleStillStanding(): Promise<void> {
  if (loading.value) return
  loading.value = true
  try {
    await window.standUp.dismissSitDownPrompt()
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.prompt {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  background: transparent;
  animation: slide-in 0.3s ease-out;
}

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.prompt__card {
  width: 100%;
  box-sizing: border-box;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.94);
  border: 1px solid rgba(74, 222, 128, 0.35);
  backdrop-filter: blur(12px);
  color: #f8fafc;
}

.prompt__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.prompt__emoji {
  font-size: 18px;
}

.prompt__title {
  font-size: 15px;
  font-weight: 700;
}

.prompt__body {
  margin: 0 0 12px;
  font-size: 13px;
  color: #94a3b8;
  line-height: 1.5;
}

.prompt__actions {
  display: flex;
  gap: 8px;
}

.prompt__btn {
  flex: 1;
  padding: 9px 10px;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: wait;
  }
}

.prompt__btn--primary {
  background: #22c55e;
  color: #fff;
}

.prompt__btn--ghost {
  background: rgba(148, 163, 184, 0.15);
  color: #e2e8f0;
  border: 1px solid rgba(148, 163, 184, 0.25);
}
</style>
