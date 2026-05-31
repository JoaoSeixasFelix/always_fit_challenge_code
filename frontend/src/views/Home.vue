<template>
    <div class="min-h-screen bg-gray-100">
      <!-- Cabeçalho -->
      <header class="bg-blue-500 text-white py-4">
        <div class="container mx-auto flex justify-between items-center px-4">
          <h1 class="text-2xl font-bold">Gerenciador de Tarefas</h1>
          <!-- Botão para adicionar tarefa -->
          <button @click="showForm = !showForm"
                  class="bg-white text-blue-500 hover:bg-blue-200 px-4 py-2 rounded">
            {{ showForm ? 'Fechar Formulário' : 'Adicionar Tarefa' }}
          </button>
        </div>
      </header>
  
      <!-- Conteúdo principal -->
      <main class="container mx-auto p-4">
        <!-- Formulário para adicionar tarefa -->
        <form v-if="showForm" @submit.prevent="addTask" class="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
          <div class="mb-4">
            <label for="title" class="block text-gray-700 text-sm font-bold mb-2">Título</label>
            <input v-model="newTask.title" type="text" id="title" placeholder="Digite o título da tarefa"
                   class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
          </div>
          <div class="mb-6">
            <label for="description" class="block text-gray-700 text-sm font-bold mb-2">Descrição</label>
            <textarea v-model="newTask.description" id="description" placeholder="Digite a descrição da tarefa"
                      class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"></textarea>
          </div>
          <div class="flex items-center justify-between">
            <button type="submit" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
              Salvar Tarefa
            </button>
          </div>
        </form>
  
        <!-- Lista de Tarefas -->
        <div class="bg-white shadow-md rounded px-8 pt-6 pb-8">
          <h2 class="text-xl font-bold mb-4">Lista de Tarefas</h2>
          <ul>
            <li v-for="task in tasks" :key="task.id" class="border-b border-gray-200 py-4">
              <h3 class="text-lg font-semibold">{{ task.title }}</h3>
              <p class="text-gray-700">{{ task.description }}</p>
              <div class="mt-2">
                <button @click="editTask(task)" class="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded mr-2">
                  Editar
                </button>
                <button @click="deleteTask(task.id)" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded">
                  Excluir
                </button>
              </div>
            </li>
          </ul>
        </div>
      </main>
    </div>
  </template>
  
  <script>
  import api from '../config/api';

  export default {
    data() {
      return {
        tasks: [],
        newTask: {
          title: '',
          description: ''
        },
        showForm: false
      };
    },
    mounted() {
      this.fetchTasks();
    },
    methods: {
      async fetchTasks() {
        try {
          const response = await api.get('/tasks');
          this.tasks = response.data;
        } catch (error) {
          // manter tasks vazio em caso de erro
        }
      },
      async addTask() {
        try {
          const response = await api.post('/tasks', {
            title: this.newTask.title,
            description: this.newTask.description,
            status: 'pending'
          });
          this.tasks.push(response.data);
          this.newTask.title = '';
          this.newTask.description = '';
          this.showForm = false;
        } catch (error) {
          // manter estado atual em caso de erro
        }
      },
      editTask(task) {
        this.$router.push('/tasks/' + task.id + '/edit');
      },
      async deleteTask(taskId) {
        try {
          await api.delete('/tasks/' + taskId);
          this.tasks = this.tasks.filter(task => task.id !== taskId);
        } catch (error) {
          // manter lista atual em caso de erro
        }
      }
    }
  };
  </script>
  
  <style scoped>
  /* Estilos específicos para este componente */
  </style>