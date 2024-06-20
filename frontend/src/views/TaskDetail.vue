<!-- src/views/TaskDetail.vue -->
<template>
    <div class="container mx-auto p-4">
        <h1 class="text-2xl font-bold mb-4">Detalhes da Tarefa</h1>
        <div v-if="task" class="border p-4 rounded">
            <h2 class="text-xl font-semibold">{{ task.title }}</h2>
            <p class="mt-2">{{ task.description }}</p>
            <button @click="markAsCompleted" class="bg-green-500 text-white px-4 py-2 rounded mt-4">Marcar como
                Concluída</button>
        </div>
        <div v-else>
            <p>Carregando...</p>
        </div>
    </div>
</template>

<script>
export default {
    props: ['id'],
    data() {
        return {
            task: null
        }
    },
    created() {
        this.fetchTask()
    },
    methods: {
        fetchTask() {
            // Lógica para buscar os detalhes da tarefa do backend
            this.task = { id: this.id, title: 'Tarefa Exemplo', description: 'Descrição da tarefa exemplo' }
        },
        markAsCompleted() {
            // Lógica para marcar a tarefa como concluída
        }
    }
}
</script>

<style scoped></style>