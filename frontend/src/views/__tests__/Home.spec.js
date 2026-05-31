/**
 * Home.spec.js — Testes unitários para Home.vue + interceptador JWT de config/api.js
 *
 * PROBLEMAS DOCUMENTADOS:
 *   1. Home.vue usa array hardcoded em data.tasks → nunca chama a API
 *   2. addTask() faz apenas this.tasks.push() → não chama POST /tasks
 *   3. deleteTask() faz apenas this.tasks.filter() → não chama DELETE /tasks/{id}
 *   4. editTask() faz apenas console.log() → não chama PUT /tasks/{id}
 *   5. config/api.js interceptor NÃO adiciona Authorization: Bearer <token>
 *
 * COMPORTAMENTO ESPERADO APÓS O FIX:
 *   1. created() deve chamar api.get('/tasks') e popular tasks com a resposta
 *   2. addTask() deve chamar api.post('/tasks', { title, description, status })
 *   3. deleteTask(id) deve chamar api.delete('/tasks/{id}')
 *   4. editTask(task) deve chamar api.put('/tasks/{id}') ou navegar para edição
 *   5. config/api.js deve adicionar Authorization: Bearer <token> do localStorage
 *
 * ESTADO ANTES DO FIX:
 *   AC-H1  → FALHA: api.get nunca chamado (dados hardcoded)
 *   AC-H2  → FALHA: tasks exibe "Tarefa 1" / "Tarefa 2" ao invés de dados da API
 *   AC-H3  → FALHA: api.post nunca chamado ao criar tarefa
 *   AC-H4  → FALHA: api.delete nunca chamado ao excluir tarefa
 *   AC-H5  → FALHA: tasks começa com 2 itens hardcoded em vez de [] vazio
 *   AC-H6  → FALHA: api.put nunca chamado ao editar tarefa
 *   AC-JWT1 → FALHA: interceptor não adiciona Authorization header
 *   AC-JWT2 → PASSA: sem token, nenhum header Authorization deve ser adicionado
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Home from '../Home.vue'

// ─── Mock do módulo axios configurado (hoisted — aplica-se a todos os testes de componente) ───
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

// ─── Helper: monta Home.vue com $router simulado ───────────────────────────────
function mountHome () {
  const mockRouterPush = vi.fn()
  const wrapper = mount(Home, {
    global: {
      mocks: { $router: { push: mockRouterPush } }
    }
  })
  return { wrapper, mockRouterPush }
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 1 — Comportamento do componente Home.vue
// ─────────────────────────────────────────────────────────────────────────────

describe('Home.vue › integração com a API', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    // Simula lista de tarefas retornada pela API
    axiosMock.get.mockResolvedValue({
      data: [
        { id: 10, title: 'Tarefa da API', description: 'Vinda do backend' },
        { id: 11, title: 'Outra Tarefa API', description: 'Também do backend' }
      ]
    })

    axiosMock.post.mockResolvedValue({
      data: { id: 99, title: 'Nova Tarefa', description: 'Criada via POST', status: 'pending' }
    })

    axiosMock.delete.mockResolvedValue({ data: null })
    axiosMock.put.mockResolvedValue({ data: { id: 10, title: 'Editada', description: 'Atualizada', status: 'in progress' } })
  })

  // ── AC-H1 [P1] ─────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: created() não chama api.get
  // PASSARÁ após o fix: created() chama api.get('/tasks')
  it(
    'AC-H1 [P1] created() deve chamar GET /tasks para buscar a lista de tarefas da API',
    async () => {
      const { wrapper } = mountHome()
      await flushPromises()

      // Deve ter chamado api.get pelo menos uma vez com o endpoint correto
      expect(axiosMock.get).toHaveBeenCalledTimes(1)
      expect(axiosMock.get).toHaveBeenCalledWith('/tasks')
    }
  )

  // ── AC-H2 [P1] ─────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: tasks contém dados hardcoded ("Tarefa 1", "Tarefa 2")
  // PASSARÁ após o fix: tasks contém dados da API (ids 10 e 11)
  it(
    'AC-H2 [P1] tasks deve ser populado com os dados retornados pela API (não hardcoded)',
    async () => {
      const { wrapper } = mountHome()
      await flushPromises()

      const tasks = wrapper.vm.tasks

      // Deve ter exatamente os itens da API (sem "Tarefa 1" / "Tarefa 2" hardcoded)
      expect(tasks).toHaveLength(2)
      expect(tasks[0].id).toBe(10)
      expect(tasks[0].title).toBe('Tarefa da API')
      expect(tasks[1].id).toBe(11)

      // Garante que o título hardcoded NÃO aparece
      const titles = tasks.map(t => t.title)
      expect(titles).not.toContain('Tarefa 1')
      expect(titles).not.toContain('Tarefa 2')
    }
  )

  // ── AC-H3 [P1] ─────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: addTask() apenas faz this.tasks.push(), sem chamar API
  // PASSARÁ após o fix: addTask() chama api.post('/tasks', {...})
  it(
    'AC-H3 [P1] addTask() deve chamar POST /tasks com título e descrição da nova tarefa',
    async () => {
      const { wrapper } = mountHome()
      await flushPromises()
      vi.clearAllMocks()

      // O formulário usa v-if="showForm" — precisa abrir antes de preencher
      await wrapper.find('button').trigger('click')
      await wrapper.vm.$nextTick()

      // Preenche o formulário
      await wrapper.find('#title').setValue('Minha Nova Tarefa')
      await wrapper.find('#description').setValue('Descrição da nova tarefa')

      // Submete o formulário
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      // Deve ter chamado api.post com os dados do formulário
      expect(axiosMock.post).toHaveBeenCalledTimes(1)
      expect(axiosMock.post).toHaveBeenCalledWith(
        '/tasks',
        expect.objectContaining({
          title:       'Minha Nova Tarefa',
          description: 'Descrição da nova tarefa'
        })
      )
    }
  )

  // ── AC-H4 [P1] ─────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: deleteTask() apenas filtra o array local, sem chamar API
  // PASSARÁ após o fix: deleteTask() chama api.delete('/tasks/10')
  it(
    'AC-H4 [P1] deleteTask(id) deve chamar DELETE /tasks/{id} na API',
    async () => {
      const { wrapper } = mountHome()
      await flushPromises()
      vi.clearAllMocks()

      // Chama deleteTask com o id da primeira tarefa da API (id=10)
      await wrapper.vm.deleteTask(10)
      await flushPromises()

      // Deve ter chamado api.delete com o endpoint correto
      expect(axiosMock.delete).toHaveBeenCalledTimes(1)
      expect(axiosMock.delete).toHaveBeenCalledWith('/tasks/10')
    }
  )

  // ── AC-H5 [P1] ─────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: tasks inicia com 2 itens hardcoded (antes da API responder)
  // PASSARÁ após o fix: tasks inicia como [] (vazio) antes da API responder
  it(
    'AC-H5 [P1] tasks deve iniciar como array vazio antes da resposta da API (sem hardcode)',
    async () => {
      // Simula API que nunca resolve (pending)
      axiosMock.get.mockReturnValue(new Promise(() => {}))

      const { wrapper } = mountHome()

      // Antes da resposta da API, tasks deve ser vazio
      expect(wrapper.vm.tasks).toHaveLength(0)

      // Não deve exibir "Tarefa 1" ou "Tarefa 2" antes da API responder
      const html = wrapper.html()
      expect(html).not.toContain('Tarefa 1')
      expect(html).not.toContain('Tarefa 2')
    }
  )

  // ── AC-H6 [P2] ─────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: editTask() apenas faz console.log, sem chamar API
  // PASSARÁ após o fix: editTask() chama api.put ou navega para /tasks/{id}/edit
  it(
    'AC-H6 [P2] editTask(task) deve chamar PUT /tasks/{id} ou navegar para a rota de edição',
    async () => {
      const { wrapper, mockRouterPush } = mountHome()
      await flushPromises()
      vi.clearAllMocks()

      const taskToEdit = { id: 10, title: 'Tarefa da API', description: 'Vinda do backend' }
      await wrapper.vm.editTask(taskToEdit)
      await flushPromises()

      // Deve ter chamado api.put OU navegado para a rota de edição
      const calledApiPut = axiosMock.put.mock.calls.length > 0
      const navigatedToEdit = mockRouterPush.mock.calls.some(
        call => String(call[0]).includes('10')
      )

      expect(calledApiPut || navigatedToEdit).toBe(true)
    }
  )

  // ── AC-H7 [P2] ─────────────────────────────────────────────────────────────
  // Após addTask bem-sucedido, a lista deve conter o item retornado pela API (id=99)
  // DEVE FALHAR antes do fix: addTask() faz push local com id calculado (ex: id=3),
  //   não com o id real retornado pela API (id=99)
  // PASSARÁ após o fix: a tarefa criada pela API (id=99) aparece na lista
  it(
    'AC-H7 [P2] após addTask() bem-sucedido, a lista deve conter o item retornado pela API',
    async () => {
      const { wrapper } = mountHome()
      await flushPromises()

      // Simula retorno do POST com id=99 (id vindo da API)
      axiosMock.post.mockResolvedValue({
        data: { id: 99, title: 'Nova Tarefa', description: 'Nova', status: 'pending' }
      })
      // Simula refetch após POST
      axiosMock.get.mockResolvedValue({
        data: [
          { id: 10, title: 'Tarefa da API', description: 'Vinda do backend' },
          { id: 11, title: 'Outra Tarefa API', description: 'Também do backend' },
          { id: 99, title: 'Nova Tarefa', description: 'Nova' }
        ]
      })

      // Abre o formulário (v-if="showForm")
      await wrapper.find('button').trigger('click')
      await wrapper.vm.$nextTick()

      await wrapper.find('#title').setValue('Nova Tarefa')
      await wrapper.find('#description').setValue('Nova')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      // Deve ter chamado api.post
      expect(axiosMock.post).toHaveBeenCalledTimes(1)

      // A lista deve conter a tarefa com id=99 (retornada pela API / refetch)
      // FALHA com código atual: addTask() faz push local com id=3 (length+1), não id=99
      const hasApiTask = wrapper.vm.tasks.some(t => t.id === 99)
      expect(hasApiTask).toBe(true)
    }
  )

  // ── AC-H8 [P2] ─────────────────────────────────────────────────────────────
  // Edge case: erro da API ao carregar tarefas não deve crashar o componente
  it(
    'AC-H8 [P2] erro na API ao carregar tarefas não deve fazer o componente crashar',
    async () => {
      axiosMock.get.mockRejectedValue(new Error('Network Error'))

      const { wrapper } = mountHome()
      await flushPromises()

      // O componente deve continuar renderizando
      expect(wrapper.exists()).toBe(true)
      // A lista deve ficar vazia ou com mensagem de erro — nunca com dados hardcoded
      const tasks = wrapper.vm.tasks
      expect(Array.isArray(tasks)).toBe(true)
    }
  )

  // ── AC-H9 [P3] ─────────────────────────────────────────────────────────────
  // Edge case: deleteTask com ID inexistente (API retorna 404) → não deve crashar
  it(
    'AC-H9 [P3] deleteTask com ID inexistente (API 404) não deve crashar o componente',
    async () => {
      axiosMock.delete.mockRejectedValue(
        Object.assign(new Error('Not Found'), { response: { status: 404 } })
      )

      const { wrapper } = mountHome()
      await flushPromises()

      // Tenta deletar ID inexistente
      await wrapper.vm.deleteTask(9999)
      await flushPromises()

      // Componente deve continuar renderizando
      expect(wrapper.exists()).toBe(true)
    }
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 2 — Interceptador JWT em config/api.js
// Usa vi.doMock para contornar o mock hoisted e importar o módulo real
// ─────────────────────────────────────────────────────────────────────────────

describe('config/api.js › interceptador JWT (módulo real)', () => {
  let capturedRequestHandler = null

  beforeAll(async () => {
    // Remove o mock hoisted de api.js para este bloco
    vi.doUnmock('../../config/api')

    // Mocka axios para capturar a função registrada como interceptador de request
    vi.doMock('axios', () => {
      const mockInstance = {
        interceptors: {
          request: {
            use: vi.fn((handler) => {
              capturedRequestHandler = handler
            })
          },
          response: { use: vi.fn() }
        }
      }
      return {
        default: {
          create: vi.fn(() => mockInstance)
        }
      }
    })

    // Limpa o cache de módulos e importa api.js com o axios mockado acima
    vi.resetModules()
    await import('../../config/api')
  })

  afterAll(() => {
    vi.doUnmock('axios')
    vi.resetModules()
  })

  beforeEach(() => {
    localStorage.clear()
  })

  // ── AC-JWT1 [P1] ───────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: interceptor não lê localStorage.token nem seta Authorization
  // PASSARÁ após o fix: config.headers['Authorization'] = `Bearer ${localStorage.getItem('token')}`
  it(
    'AC-JWT1 [P1] interceptor de request deve adicionar Authorization: Bearer <token> quando localStorage.token está definido',
    () => {
      expect(capturedRequestHandler).not.toBeNull()

      const jwtToken = 'eyJhbGciOiJIUzI1NiJ9.payload.signature'
      localStorage.setItem('token', jwtToken)

      const config = { headers: {} }
      const result = capturedRequestHandler(config)

      // FALHA com código atual: interceptor não lê localStorage nem seta Authorization
      expect(result.headers['Authorization']).toBe(`Bearer ${jwtToken}`)
    }
  )

  // ── AC-JWT2 [P2] ───────────────────────────────────────────────────────────
  // Deve passar mesmo com o código atual (sem token, sem header)
  // Continua passando após o fix
  it(
    'AC-JWT2 [P2] interceptor NÃO deve adicionar Authorization quando localStorage.token está ausente',
    () => {
      expect(capturedRequestHandler).not.toBeNull()

      // Garante que localStorage está limpo
      localStorage.removeItem('token')

      const config = { headers: {} }
      capturedRequestHandler(config)

      expect(config.headers['Authorization']).toBeUndefined()
    }
  )

  // ── AC-JWT3 [P3] ───────────────────────────────────────────────────────────
  // Edge case: localStorage.token = '' (string vazia) → não deve adicionar Authorization
  it(
    'AC-JWT3 [P3] interceptor NÃO deve adicionar Authorization quando token é string vazia',
    () => {
      expect(capturedRequestHandler).not.toBeNull()

      localStorage.setItem('token', '')

      const config = { headers: {} }
      capturedRequestHandler(config)

      // Token vazio não é uma credencial válida
      expect(config.headers['Authorization']).toBeUndefined()
    }
  )
})
