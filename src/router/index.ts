import { createRouter, createWebHashHistory } from 'vue-router'
import ReminderView from '@/views/ReminderView.vue'
import ReminderToastView from '@/views/ReminderToastView.vue'
import ReminderOverlayView from '@/views/ReminderOverlayView.vue'
import IdeDeferView from '@/views/IdeDeferView.vue'
import StatusBarView from '@/views/StatusBarView.vue'
import DesktopPetView from '@/views/DesktopPetView.vue'
import MicroActionToastView from '@/views/MicroActionToastView.vue'
import SitDownPromptView from '@/views/SitDownPromptView.vue'
import MainView from '@/views/MainView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/main' },
    { path: '/main', name: 'main', component: MainView },
    { path: '/reminder', name: 'reminder', component: ReminderView },
    { path: '/reminder-toast', name: 'reminder-toast', component: ReminderToastView },
    { path: '/reminder-overlay', name: 'reminder-overlay', component: ReminderOverlayView },
    { path: '/ide-defer', name: 'ide-defer', component: IdeDeferView },
    { path: '/status-bar', name: 'status-bar', component: StatusBarView },
    { path: '/desktop-pet', name: 'desktop-pet', component: DesktopPetView },
    { path: '/micro-action', name: 'micro-action', component: MicroActionToastView },
    { path: '/sit-down-prompt', name: 'sit-down-prompt', component: SitDownPromptView },
    { path: '/report', redirect: { path: '/main', query: { tab: 'report' } } },
    { path: '/settings', redirect: { path: '/main', query: { tab: 'settings' } } }
  ]
})

export default router
