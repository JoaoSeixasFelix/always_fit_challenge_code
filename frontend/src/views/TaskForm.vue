<template>
  <div class="container mx-auto max-w-lg p-4">
    <h1 class="text-2xl font-bold mb-6">{{ id ? 'Editar Tarefa' : 'Nova Tarefa' }}</h1>

    <form @submit.prevent="submitForm">
      <div class="mb-4">
        <label for="title" class="block text-sm font-medium text-gray-700 mb-1">Título</label>
        <input
          id="title"
          type="text"
          name="title"
          v-model="title"
          placeholder="Título da tarefa"
          class="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <div class="mb-4">
        <label for="description" class="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
        <textarea
          id="description"
          name="description"
          v-model="description"
          placeholder="Descrição da tarefa"
          class="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          rows="4"
        ></textarea>
      </div>

      <div class="mb-6">
        <label for="status" class="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select
          id="status"
          name="status"
          v-model="status"
          class="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="pending">Pendente</option>
          <option value="in_progress">Em andamento</option>
          <option value="completed">Concluída</option>
        </select>
      </div>

      <div class="flex gap-3">
        <button
          type="submit"
          class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >{{ id ? 'Salvar' : 'Criar' }}</button>
        <button
          type="button"
          @click="cancel"
          class="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
        >Cancelar</button>
      </div>
    </form>
  </div>
</template>

<script>
import api from '../config/api'

export default {
  name: 'TaskForm',

  props: {
    id: {
      type: String,
      default: null
    }
  },

  data () {
    return {
      title: '',
      description: '',
      status: 'pending'
    }
  },

  mounted () {
    if (this.id) {
      this.fetchTask()
    }
  },

  methods: {
    async fetchTask () {
      try {
        const response = await api.get('/tasks/' + this.id)
        this.title = response.data.title
        this.description = response.data.description
        this.status = response.data.status
      } catch (error) {
        // Erro ao buscar tarefa — não propaga para não crashar o componente
      }
    },

    async submitForm () {
      if (!this.title) {
        return
      }

      const payload = {
        title: this.title,
        description: this.description,
        status: this.status
      }

      try {
        if (this.id) {
          await api.put('/tasks/' + this.id, payload)
        } else {
          await api.post('/tasks', payload)
        }
        this.$router.push('/tasks')
      } catch (error) {
        // Erro ao salvar — não propaga para não crashar o componente
      }
    },

    cancel () {
      this.$router.push('/tasks')
    }
  }
}
</script>
