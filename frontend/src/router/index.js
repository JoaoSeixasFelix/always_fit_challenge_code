import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import TaskList from '../views/TaskList.vue'
import TaskDetail from '../views/TaskDetail.vue'
import Auth from '../views/Auth.vue'

const routes = [
  { path: '/home', name: 'Home', component: Home },
  { path: '/tasks', name: 'TaskList', component: TaskList },
  { path: '/tasks/:id', name: 'TaskDetail', component: TaskDetail, props: true },
  { path: '/', name: 'Auth', component: Auth }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router