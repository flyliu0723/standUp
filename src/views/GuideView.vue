<template>
  <div class="guide">
    <section v-for="section in sections" :key="section.title" class="guide__section">
      <h3>{{ section.title }}</h3>
      <ul>
        <li v-for="(item, i) in section.items" :key="i">{{ item }}</li>
      </ul>
    </section>

    <section class="guide__section guide__section--stretch">
      <h3>站立时可以试试</h3>
      <div class="guide__stretch-list">
        <div v-for="item in stretchTips" :key="item.name" class="guide__stretch-item">
          <strong>{{ item.name }}</strong>
          <span>{{ item.desc }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { STRETCH_TIPS } from '@/constants/stretchTips'

const stretchTips = STRETCH_TIPS

const sections = [
  {
    title: '无感操作',
    items: [
      '全局快捷键 Ctrl+Alt+S：快捷上班 / 起立 / 坐下。',
      '计时到期后立即弹出全屏提醒，同时发送系统通知。',
      '提醒弹出后若离开电脑 2 分钟（可调），自动判定为「已起立」。',
      '自动起立后，回到电脑前动一下鼠标，自动恢复「坐下」计时。'
    ]
  },
  {
    title: '快速上手',
    items: [
      '左键点击托盘图标打开主面板，查看当前状态和今日数据。',
      '右键托盘可快速操作：上班、坐下、起立、下班、暂停提醒。',
      '点击「上班」或「坐下」后，开始久坐计时。',
      '休息完毕后点「坐下」，开始新一轮计时。'
    ]
  },
  {
    title: '空闲检测',
    items: [
      '超过设定时间无键鼠操作，自动暂停久坐计时（状态显示「已离开」）。',
      '回到电脑前继续操作，或手动点「坐下」，恢复计时。',
      '可在「设置」中调整空闲检测阈值。'
    ]
  },
  {
    title: '上下班提醒',
    items: [
      '在「设置」中配置上班、下班时间，可开启自动提醒。',
      '到达上班时间若未手动点「上班」，会弹窗询问；无回应则自动开始计时。',
      '到达下班时间若仍在计时，会弹窗询问是否下班；无回应则自动结束。',
      '开启「法定节假日休息」后，节假日和周末不触发上下班提醒（含调休判断）。'
    ]
  },
  {
    title: '使用建议',
    items: [
      '建议间隔设为 30～45 分钟，给专注留空间，也给身体留喘息。',
      '开会或演示前，可在设置或托盘菜单暂停提醒 1 小时。',
      '每天查看「报告」页，关注总坐时、达标率和趋势图。',
      '应用关闭窗口后仍在托盘运行，不会退出。'
    ]
  }
]
</script>

<style lang="scss" scoped>
@use '@/styles/tokens.scss' as *;

.guide {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.guide__section {
  h3 {
    margin: 0 0 10px;
    font-size: 15px;
    color: #0f172a;
    font-weight: 600;
  }

  ul {
    margin: 0;
    padding-left: 20px;
    color: #475569;
    font-size: 14px;
    line-height: 1.8;
  }
}

.guide__section--stretch {
  padding: 16px;
  border-radius: var(--radius-md);
  @include glass-surface;
  box-shadow: var(--shadow-card);
  background: rgba(240, 253, 244, 0.85);
}

.guide__stretch-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.guide__stretch-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
  color: #166534;

  strong {
    font-size: 14px;
  }
}
</style>
