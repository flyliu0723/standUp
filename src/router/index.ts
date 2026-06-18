import { createRouter, createWebHashHistory } from 'vue-router'
import ReminderView from '@/views/ReminderView.vue'
import MainView from '@/views/MainView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/main' },
    { path: '/main', name: 'main', component: MainView },
    { path: '/reminder', name: 'reminder', component: ReminderView },
    { path: '/report', redirect: { path: '/main', query: { tab: 'report' } } },
    { path: '/settings', redirect: { path: '/main', query: { tab: 'settings' } } }
  ]
})

export default router
