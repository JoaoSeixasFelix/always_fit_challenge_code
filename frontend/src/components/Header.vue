<!-- src/components/Header.vue -->
<template>
  <header v-if="isLoggedIn" data-testid="main-header" class="bg-gray-800 text-white p-4">
    <nav class="container mx-auto flex justify-between">
      <div>
        <RouterLink to="/home" class="mr-4">Home</RouterLink>
        <RouterLink to="/tasks" class="mr-4">Tarefas</RouterLink>
      </div>
      <button data-testid="logout-btn" @click="logout">Logout</button>
    </nav>
  </header>
</template>

<script>
export default {
  name: 'Header',
  data () {
    return {
      isLoggedIn: !!localStorage.getItem('token')
    }
  },
  mounted () {
    window.addEventListener('auth-changed', this._syncToken)
  },
  beforeUnmount () {
    window.removeEventListener('auth-changed', this._syncToken)
  },
  methods: {
    _syncToken () {
      this.isLoggedIn = !!localStorage.getItem('token')
    },
    logout () {
      localStorage.removeItem('token')
      this.isLoggedIn = false
      window.dispatchEvent(new Event('auth-changed'))
      this.$router.push('/')
    }
  }
}
</script>

<style scoped>
a {
  text-decoration: none;
}

a.router-link-active {
  font-weight: bold;
}
</style>