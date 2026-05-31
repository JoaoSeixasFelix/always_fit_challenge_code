import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import TaskList from '../views/TaskList.vue'
import TaskDetail from '../views/TaskDetail.vue'
import TaskForm from '../views/TaskForm.vue'
import Auth from '../views/Auth.vue'

const routes = [
  { path: '/home', name: 'Home', component: Home },
  { path: '/tasks', name: 'TaskList', component: TaskList },
  { path: '/tasks/create', name: 'TaskCreate', component: TaskForm },
  { path: '/tasks/:id/edit', name: 'TaskEdit', component: TaskForm, props: true },
  { path: '/tasks/:id', name: 'TaskDetail', component: TaskDetail, props: true },
  { path: '/', name: 'Auth', component: Auth }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const publicRoutes = ['/']
  const isAuthenticated = !!localStorage.getItem('token')

  if (!publicRoutes.includes(to.path) && !isAuthenticated) {
    next('/')
  } else {
    next()
  }
})

router.afterEach((to) => {
  if (to.path === '/' && !!localStorage.getItem('token')) {
    router.push('/home').catch(() => {})
  }
})

export default router