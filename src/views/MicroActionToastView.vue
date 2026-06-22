<template>
  <div class="micro">
    <div class="micro__card">
      <div class="micro__header">
        <span class="micro__emoji">{{ action.emoji }}</span>
        <span class="micro__title">{{ action.title }}</span>
      </div>
      <p class="micro__body">{{ action.body }}</p>
      <button class="micro__btn" @click="handleDone">完成了</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive } from 'vue'

const action = reactive({
  id: 'neck',
  emoji: '🔄',
  title: '转一下脖子',
  body: '左右各转一下，只要 3 秒'
})

let unsubscribe: (() => void) | null = null

onMounted(() => {
  unsubscribe = window.standUp.onMicroActionContext((ctx) => {
    Object.assign(action, ctx)
  })
})

onUnmounted(() => {
  unsubscribe?.()
})

async function handleDone(): Promise<void> {
  await window.standUp.dismissMicroAction()
}
</script>

<style lang="scss" scoped>
.micro {
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

.micro__card {
  width: 100%;
  box-sizing: border-box;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(30, 41, 59, 0.94);
  border: 1px solid rgba(148, 163, 184, 0.2);
  backdrop-filter: blur(12px);
  color: #f8fafc;
}

.micro__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.micro__emoji {
  font-size: 18px;
}

.micro__title {
  font-size: 15px;
  font-weight: 700;
}

.micro__body {
  margin: 0 0 12px;
  font-size: 13px;
  color: #94a3b8;
  line-height: 1.5;
}

.micro__btn {
  width: 100%;
  padding: 9px;
  border: none;
  border-radius: 10px;
  background: rgba(34, 197, 94, 0.9);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background: #22c55e;
  }
}
</style>
