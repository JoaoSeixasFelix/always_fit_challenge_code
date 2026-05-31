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
import api from '../config/api';

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
        async fetchTask() {
            try {
                const response = await api.get('/tasks/' + this.id);
                this.task = response.data;
            } catch (error) {
                // manter task como null em caso de erro
            }
        },
        async markAsCompleted() {
            try {
                await api.put('/tasks/' + this.id, { status: 'completed' });
            } catch (error) {
                // manter estado atual em caso de erro
            }
        }
    }
}
</script>

<style scoped></style>