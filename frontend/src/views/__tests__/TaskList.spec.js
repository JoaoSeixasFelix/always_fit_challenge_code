/**
 * TaskList.spec.js — Testes unitários para TaskList.vue
 *
 * PROBLEMAS DOCUMENTADOS:
 *   1. TaskList.vue usa array hardcoded em data.tasks → nunca chama a API
 *   2. deleteTask() apenas faz console.log() → não chama DELETE /tasks/{id}
 *   3. editTask() apenas faz console.log() → não navega nem chama API
 *   4. createTask() apenas faz console.log() → não chama POST /tasks nem navega
 *
 * COMPORTAMENTO ESPERADO APÓS O FIX:
 *   1. created() deve chamar api.get('/tasks') e popular tasks com a resposta
 *   2. deleteTask(id) deve chamar api.delete('/tasks/{id}')
 *   3. editTask(id) deve navegar para /tasks/{id} (edit) ou chamar api.put
 *   4. createTask() deve navegar para criação de tarefa ou abrir formulário
 *
 * ESTADO ANTES DO FIX:
 *   AC-TL1 → FALHA: api.get nunca chamado (dados hardcoded)
 *   AC-TL2 → FALHA: tasks exibe "Tarefa 1" / "Tarefa 2" ao invés de dados da API
 *   AC-TL3 → FALHA: api.delete nunca chamado ao excluir tarefa
 *   AC-TL4 → FALHA: tasks começa com 2 itens hardcoded em vez de [] vazio
 *   AC-TL5 → FALHA: após delete bem-sucedido, item deve ser removido da lista
 *   AC-TL6 → PASSA: verificação básica de que componente renderiza
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TaskList from '../TaskList.vue'

// ─── Mock do módulo axios configurado ────────────────────────────────────────
vi.mock('../../config/api', () => ({
  default: {
    get:    vi.fn(),
    post:   vi.fn(),
    put:    vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request:  { use: vi.fn() },
      response: { use: vi.fn() }
    }
  }
}))

import axiosMock from '../../config/api'

// ─── Helper: monta TaskList.vue com $router simulado ─────────────────────────
function mountTaskList () {
  const mockRouterPush = vi.fn()
  const wrapper = mount(TaskList, {
    global: {
      mocks: { $router: { push: mockRouterPush } }
    }
  })
  return { wrapper, mockRouterPush }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('TaskList.vue › integração com a API', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    // Resposta padrão da API para a listagem
    axiosMock.get.mockResolvedValue({
      data: [
        { id: 20, title: 'Task API 1', description: 'Descrição API 1' },
        { id: 21, title: 'Task API 2', description: 'Descrição API 2' },
        { id: 22, title: 'Task API 3', description: 'Descrição API 3' }
      ]
    })

    axiosMock.delete.mockResolvedValue({ data: null })
  })

  // ── AC-TL1 [P1] ────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: created() não chama api.get
  // PASSARÁ após o fix: created() chama api.get('/tasks')
  it(
    'AC-TL1 [P1] created() deve chamar GET /tasks para buscar a lista de tarefas da API',
    async () => {
      const { wrapper } = mountTaskList()
      await flushPromises()

      expect(axiosMock.get).toHaveBeenCalledTimes(1)
      expect(axiosMock.get).toHaveBeenCalledWith('/tasks')
    }
  )

  // ── AC-TL2 [P1] ────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: tasks contém dados hardcoded
  // PASSARÁ após o fix: tasks contém os dados da API
  it(
    'AC-TL2 [P1] tasks deve ser populado com os dados retornados pela API (não hardcoded)',
    async () => {
      const { wrapper } = mountTaskList()
      await flushPromises()

      const tasks = wrapper.vm.tasks

      expect(tasks).toHaveLength(3)
      expect(tasks[0].id).toBe(20)
      expect(tasks[0].title).toBe('Task API 1')
      expect(tasks[1].id).toBe(21)

      // Títulos hardcoded não devem aparecer
      const titles = tasks.map(t => t.title)
      expect(titles).not.toContain('Tarefa 1')
      expect(titles).not.toContain('Tarefa 2')
    }
  )

  // ── AC-TL3 [P1] ────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: deleteTask() não chama api.delete
  // PASSARÁ após o fix: deleteTask() chama api.delete('/tasks/20')
  it(
    'AC-TL3 [P1] deleteTask(id) deve chamar DELETE /tasks/{id} na API',
    async () => {
      const { wrapper } = mountTaskList()
      await flushPromises()
      vi.clearAllMocks()

      // Dispara a exclusão da tarefa com id=20
      await wrapper.vm.deleteTask(20)
      await flushPromises()

      expect(axiosMock.delete).toHaveBeenCalledTimes(1)
      expect(axiosMock.delete).toHaveBeenCalledWith('/tasks/20')
    }
  )

  // ── AC-TL4 [P1] ────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: tasks inicia com 2 itens hardcoded antes da API
  // PASSARÁ após o fix: tasks inicia como [] vazio
  it(
    'AC-TL4 [P1] tasks deve iniciar como array vazio antes da resposta da API (sem hardcode)',
    async () => {
      // API nunca resolve (simula loading)
      axiosMock.get.mockReturnValue(new Promise(() => {}))

      const { wrapper } = mountTaskList()

      expect(wrapper.vm.tasks).toHaveLength(0)

      // Os títulos hardcoded não devem estar no DOM
      const html = wrapper.html()
      expect(html).not.toContain('Tarefa 1')
      expect(html).not.toContain('Tarefa 2')
    }
  )

  // ── AC-TL5 [P2] ────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: deleteTask não chama a API, então o item é apenas
  //   filtrado localmente (mas a API não é notificada)
  // PASSARÁ após o fix: após API confirmar delete, o item some da lista
  it(
    'AC-TL5 [P2] após deleteTask() bem-sucedido, a tarefa deve ser removida da lista',
    async () => {
      const { wrapper } = mountTaskList()
      await flushPromises()

      // Verifica que a tarefa 20 está na lista inicial
      expect(wrapper.vm.tasks.some(t => t.id === 20)).toBe(true)

      // Simula refetch após delete (API retorna lista sem o item deletado)
      axiosMock.get.mockResolvedValue({
        data: [
          { id: 21, title: 'Task API 2', description: 'Descrição API 2' },
          { id: 22, title: 'Task API 3', description: 'Descrição API 3' }
        ]
      })

      await wrapper.vm.deleteTask(20)
      await flushPromises()

      // A tarefa com id=20 deve ter sido removida da lista
      expect(wrapper.vm.tasks.some(t => t.id === 20)).toBe(false)
    }
  )

  // ── AC-TL6 [P2] ────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: editTask() apenas faz console.log, sem navegar
  // PASSARÁ após o fix: editTask(id) navega para /tasks/{id} ou chama api.put
  it(
    'AC-TL6 [P2] editTask(id) deve navegar para a rota de edição da tarefa',
    async () => {
      const { wrapper, mockRouterPush } = mountTaskList()
      await flushPromises()
      vi.clearAllMocks()

      await wrapper.vm.editTask(20)
      await flushPromises()

      // Deve ter navegado para uma rota relacionada ao id 20
      // OU chamado api.put (ambas são aceitáveis como implementação)
      const calledApiPut = axiosMock.put.mock.calls.length > 0
      const navigatedToEdit = mockRouterPush.mock.calls.some(
        call => String(call[0]).includes('20')
      )

      expect(calledApiPut || navigatedToEdit).toBe(true)
    }
  )

  // ── AC-TL7 [P2] ────────────────────────────────────────────────────────────
  // Os dados da API devem ser exibidos na tabela (rows do DOM)
  it(
    'AC-TL7 [P2] dados da API devem ser renderizados nas linhas da tabela',
    async () => {
      const { wrapper } = mountTaskList()
      await flushPromises()

      const html = wrapper.html()
      expect(html).toContain('Task API 1')
      expect(html).toContain('Task API 2')
      expect(html).toContain('Task API 3')
    }
  )

  // ── AC-TL8 [P3] ────────────────────────────────────────────────────────────
  // Edge case: API retorna lista vazia → tabela deve renderizar sem erros
  it(
    'AC-TL8 [P3] API retornando lista vazia deve renderizar tabela sem crash',
    async () => {
      axiosMock.get.mockResolvedValue({ data: [] })

      const { wrapper } = mountTaskList()
      await flushPromises()

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.vm.tasks).toHaveLength(0)
    }
  )

  // ── AC-TL9 [P3] ────────────────────────────────────────────────────────────
  // Edge case: erro da API não deve crashar o componente
  it(
    'AC-TL9 [P3] erro na API ao carregar tarefas não deve crashar o componente',
    async () => {
      axiosMock.get.mockRejectedValue(new Error('Network Error'))

      const { wrapper } = mountTaskList()
      await flushPromises()

      expect(wrapper.exists()).toBe(true)
      expect(Array.isArray(wrapper.vm.tasks)).toBe(true)
    }
  )
})
