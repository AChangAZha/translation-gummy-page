import { createRouter, createWebHistory } from 'vue-router'
import Home from './components/Home.vue'
import Admin from './components/Admin.vue'

export default createRouter({
    history: createWebHistory(import.meta.env.VITE_BASE_URL),
    routes: [
        {
            path: '/',
            component: Home
        },
        {
            path: '/admin',
            component: Admin
        },
    ]
})