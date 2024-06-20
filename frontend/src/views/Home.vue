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
  export default {
    data() {
      return {
        tasks: [
          { id: 1, title: 'Tarefa 1', description: 'Descrição da tarefa 1' },
          { id: 2, title: 'Tarefa 2', description: 'Descrição da tarefa 2' }
        ],
        newTask: {
          title: '',
          description: ''
        },
        showForm: false
      };
    },
    methods: {
      addTask() {
        // Simular adição de tarefa (implemente a lógica real conforme necessário)
        this.tasks.push({
          id: this.tasks.length + 1,
          title: this.newTask.title,
          description: this.newTask.description
        });
        // Limpar campos do formulário
        this.newTask.title = '';
        this.newTask.description = '';
        // Fechar o formulário após adicionar a tarefa
        this.showForm = false;
      },
      editTask(task) {
        // Implementar lógica para editar a tarefa
        console.log('Editar tarefa:', task);
      },
      deleteTask(taskId) {
        // Implementar lógica para excluir a tarefa com o ID taskId
        console.log('Excluir tarefa com ID:', taskId);
        this.tasks = this.tasks.filter(task => task.id !== taskId);
      }
    }
  };
  </script>
  
  <style scoped>
  /* Estilos específicos para este componente */
  </style>