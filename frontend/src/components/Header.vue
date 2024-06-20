<!-- src/components/Header.vue -->
<template>
  <header class="bg-gray-800 text-white p-4">
    <nav class="container mx-auto flex justify-between">
      <div>
        <router-link to="/" class="mr-4">Home</router-link>
        <router-link to="/tasks" class="mr-4">Tarefas</router-link>
        <router-link to="/auth" class="mr-4">Login</router-link>
      </div>
    </nav>
  </header>
</template>

<script>
export default {
  name: 'Header'
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