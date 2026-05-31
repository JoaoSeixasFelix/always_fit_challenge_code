<template>
  <form @submit.prevent="submitForm">
    <div>
      <label for="title">Título</label>
      <input
        id="title"
        type="text"
        name="title"
        v-model="title"
        placeholder="Título da tarefa"
      />
    </div>

    <div>
      <label for="description">Descrição</label>
      <textarea
        id="description"
        name="description"
        v-model="description"
        placeholder="Descrição da tarefa"
      ></textarea>
    </div>

    <div>
      <label for="status">Status</label>
      <select id="status" name="status" v-model="status">
        <option value="pending">Pendente</option>
        <option value="in_progress">Em andamento</option>
        <option value="completed">Concluída</option>
      </select>
    </div>

    <div>
      <button type="submit">{{ id ? 'Salvar' : 'Criar' }}</button>
      <button type="button" @click="cancel">Cancelar</button>
    </div>
  </form>
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
