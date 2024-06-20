<template>
    <div class="container mx-auto p-4">
        <h1 class="text-2xl font-bold mb-4">Lista de Tarefas</h1>

        <!-- Botão para adicionar tarefa -->
        <button @click="createTask" class="bg-blue-500 text-white px-4 py-2 rounded mb-4">Adicionar Tarefa</button>

        <!-- Tabela responsiva -->
        <div class="overflow-x-auto">
            <table class="table-auto min-w-full bg-white border-collapse border border-gray-200">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-gray-700">ID</th>
                        <th class="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-gray-700">Título
                        </th>
                        <th class="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-gray-700">
                            Descrição</th>
                        <th class="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-gray-700">Ações
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <!-- Exemplo de dados de tarefas -->
                    <tr v-for="task in tasks" :key="task.id">
                        <td class="border border-gray-300 px-4 py-2 text-sm text-gray-700">{{ task.id }}</td>
                        <td class="border border-gray-300 px-4 py-2 text-sm text-gray-700">{{ task.title }}</td>
                        <td class="border border-gray-300 px-4 py-2 text-sm text-gray-700">{{ task.description }}</td>
                        <td class="border border-gray-300 px-4 py-2">
                            <button @click="editTask(task.id)"
                                class="bg-yellow-500 text-white px-2 py-1 rounded mr-2">Editar</button>
                            <button @click="deleteTask(task.id)"
                                class="bg-red-500 text-white px-2 py-1 rounded">Excluir</button>
                        </td>
                    </tr>
                    <!-- Fim do exemplo de dados -->
                </tbody>
            </table>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            tasks: [
                { id: 1, title: 'Tarefa 1', description: 'Descrição da tarefa 1' },
                { id: 2, title: 'Tarefa 2', description: 'Descrição da tarefa 2' }
            ]
        };
    },
    methods: {
        createTask() {
            // Implementar lógica para criar uma nova tarefa
            console.log('Criar nova tarefa');
        },
        editTask(taskId) {
            // Implementar lógica para editar a tarefa com o ID taskId
            console.log('Editar tarefa com ID:', taskId);
        },
        deleteTask(taskId) {
            // Implementar lógica para excluir a tarefa com o ID taskId
            console.log('Excluir tarefa com ID:', taskId);
        }
    }
};
</script>

<style scoped>
/* Estilos específicos para este componente */
</style>