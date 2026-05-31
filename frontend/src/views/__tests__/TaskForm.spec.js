/**
 * TaskForm.spec.js — Testes unitários para TaskForm.vue
 *
 * BUGS DOCUMENTADOS QUE MOTIVAM ESTES TESTES:
 *   Bug 1 — Rota /tasks/:id/edit inexistente no router
 *     Home.vue linha 100:     editTask(task)   → this.$router.push('/tasks/' + task.id + '/edit')
 *     TaskList.vue linha 67:  editTask(taskId) → this.$router.push('/tasks/' + taskId + '/edit')
 *     Router NÃO tem essa rota → [Vue Router warn]: No match found
 *
 *   Bug 2 — Rota /tasks/create inexistente + conflito com /tasks/:id
 *     TaskList.vue linha 64: createTask() → this.$router.push('/tasks/create')
 *     Vue Router trata '/tasks/create' como '/tasks/:id' com id="create"
 *     TaskDetail.vue então faz GET /tasks/create → HTTP 404
 *
 * COMPORTAMENTO ESPERADO APÓS O FIX:
 *   1. TaskForm.vue criado em src/views/TaskForm.vue
 *   2. Router registra /tasks/create (ANTES de /tasks/:id) e /tasks/:id/edit
 *   3. No modo CREATE (sem prop id):
 *        - formulário inicia vazio: title='', description='', status='pending'
 *        - submit chama api.post('/tasks', payload) e redireciona para /tasks
 *        - cancelar redireciona para /tasks sem chamar a API
 *   4. No modo EDIT (com prop id):
 *        - mounted() chama api.get('/tasks/:id') e preenche o formulário
 *        - submit chama api.put('/tasks/:id', payload) e redireciona para /tasks
 *        - cancelar redireciona para /tasks sem chamar a API
 *
 * ESTADO ANTES DO FIX:
 *   AC-1  → FALHA: TaskForm.vue não existe → import falha / componente inexistente
 *   AC-2  → FALHA: TaskForm.vue não existe → sem estado de formulário
 *   AC-3  → FALHA: TaskForm.vue não existe → nenhuma chamada GET na montagem
 *   AC-4  → FALHA: TaskForm.vue não existe → nenhuma chamada PUT no submit
 *   AC-5  → FALHA: TaskForm.vue não existe → sem validação de campo obrigatório
 *   AC-6  → FALHA: TaskForm.vue não existe → sem detecção de modo via prop id
 *   AC-7  → FALHA: TaskForm.vue não existe → sem botão cancelar
 *   AC-8  → FALHA: TaskForm.vue não existe → sem redirect após criação
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TaskForm from '../TaskForm.vue'

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

// ─── Constantes: dados de tarefa simulados para testes de EDIT ───────────────
const MOCK_TASK = {
  id:          5,
  title:       'Tarefa Existente',
  description: 'Descrição da tarefa existente',
  status:      'in_progress'
}

// ─── Helper: monta TaskForm no modo CREATE (sem prop id) ─────────────────────
function mountCreateMode () {
  const mockRouterPush = vi.fn()
  const wrapper = mount(TaskForm, {
    global: {
      mocks: { $router: { push: mockRouterPush } }
    }
    // sem props → modo CREATE
  })
  return { wrapper, mockRouterPush }
}

// ─── Helper: monta TaskForm no modo EDIT (com prop id) ───────────────────────
function mountEditMode (id = '5') {
  const mockRouterPush = vi.fn()
  const wrapper = mount(TaskForm, {
    props: { id },
    global: {
      mocks: { $router: { push: mockRouterPush } }
    }
  })
  return { wrapper, mockRouterPush }
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 1 — Modo CREATE
// ─────────────────────────────────────────────────────────────────────────────

describe('TaskForm.vue › modo CREATE (sem prop id)', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    axiosMock.post.mockResolvedValue({
      data: { id: 99, title: 'Nova Tarefa', description: 'Criada via POST', status: 'pending' }
    })
  })

  // ── AC-2 [P1] ──────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: TaskForm.vue não existe
  // PASSARÁ após o fix: formulário inicia com campos em branco / padrão
  it(
    'AC-2 [P1] modo CREATE: formulário deve iniciar com title="", description="" e status="pending"',
    async () => {
      const { wrapper } = mountCreateMode()
      await flushPromises()

      // title e description devem estar vazios
      expect(wrapper.vm.title).toBe('')
      expect(wrapper.vm.description).toBe('')

      // status deve ter valor padrão 'pending'
      expect(wrapper.vm.status).toBe('pending')

      // A API NÃO deve ter sido chamada ao montar no modo CREATE
      expect(axiosMock.get).not.toHaveBeenCalled()
    }
  )

  // ── AC-1 [P1] ──────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: TaskForm.vue não existe
  // PASSARÁ após o fix: submit no modo CREATE chama POST /tasks e redireciona
  it(
    'AC-1 [P1] modo CREATE: submit deve chamar api.post("/tasks", payload) e redirecionar para /tasks',
    async () => {
      const { wrapper, mockRouterPush } = mountCreateMode()
      await flushPromises()

      // Preenche os campos do formulário
      wrapper.vm.title       = 'Minha Nova Tarefa'
      wrapper.vm.description = 'Descrição da nova tarefa'
      wrapper.vm.status      = 'pending'
      await wrapper.vm.$nextTick()

      // Submete o formulário
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      // Deve ter chamado api.post com o endpoint e os dados corretos
      expect(axiosMock.post).toHaveBeenCalledTimes(1)
      expect(axiosMock.post).toHaveBeenCalledWith(
        '/tasks',
        expect.objectContaining({
          title:       'Minha Nova Tarefa',
          description: 'Descrição da nova tarefa'
        })
      )

      // Deve ter redirecionado para /tasks após o POST bem-sucedido
      expect(mockRouterPush).toHaveBeenCalledWith('/tasks')
    }
  )

  // ── AC-1b [P1] — variante via interação com inputs do DOM ──────────────────
  // Garante que o submit funciona também via inputs do template, não apenas vm direto
  it(
    'AC-1b [P1] modo CREATE: preenchendo inputs e submetendo form deve chamar api.post e redirecionar',
    async () => {
      const { wrapper, mockRouterPush } = mountCreateMode()
      await flushPromises()

      // Preenche via DOM
      const titleInput = wrapper.find('input[name="title"], input#title, input[placeholder*="ítulo"], input[placeholder*="itulo"]')
        || wrapper.find('input')
      if (titleInput.exists()) {
        await titleInput.setValue('Tarefa via DOM')
      } else {
        // fallback: define direto no vm
        wrapper.vm.title = 'Tarefa via DOM'
        await wrapper.vm.$nextTick()
      }

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      // api.post deve ter sido chamado (modo CREATE)
      expect(axiosMock.post).toHaveBeenCalledTimes(1)
      // api.put NÃO deve ter sido chamado (não é modo EDIT)
      expect(axiosMock.put).not.toHaveBeenCalled()
    }
  )

  // ── AC-8 [P3] ──────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: TaskForm.vue não existe
  // PASSARÁ após o fix: após criar, formulário é limpo ou redireciona para /tasks
  it(
    'AC-8 [P3] modo CREATE: após submit bem-sucedido, deve redirecionar para /tasks (campos limpos ou redirect)',
    async () => {
      const { wrapper, mockRouterPush } = mountCreateMode()
      await flushPromises()

      wrapper.vm.title       = 'Tarefa Para Criar'
      wrapper.vm.description = 'Qualquer descrição'
      wrapper.vm.status      = 'pending'
      await wrapper.vm.$nextTick()

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      // Deve ter chamado api.post
      expect(axiosMock.post).toHaveBeenCalledTimes(1)

      // Após o POST: ou redireciona (esperado) OU limpa o formulário
      const redirected = mockRouterPush.mock.calls.some(call => call[0] === '/tasks')
      const formCleared = wrapper.vm.title === '' && wrapper.vm.description === ''

      expect(redirected || formCleared).toBe(true)
    }
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 2 — Modo EDIT
// ─────────────────────────────────────────────────────────────────────────────

describe('TaskForm.vue › modo EDIT (com prop id)', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    axiosMock.get.mockResolvedValue({ data: MOCK_TASK })
    axiosMock.put.mockResolvedValue({
      data: { ...MOCK_TASK, title: 'Tarefa Atualizada' }
    })
  })

  // ── AC-6 [P2] ──────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: TaskForm.vue não existe
  // PASSARÁ após o fix: componente detecta modo EDIT via prop id e entra em modo correto
  it(
    'AC-6 [P2] modo EDIT: componente deve detectar modo edit quando prop id está presente',
    async () => {
      const { wrapper } = mountEditMode('5')
      await flushPromises()

      // O componente deve expor alguma flag indicando modo EDIT
      // OU deve ter chamado GET (o que já implica detecção do modo)
      const isEditMode =
        wrapper.vm.isEdit === true ||
        wrapper.vm.mode === 'edit' ||
        wrapper.vm.editMode === true ||
        axiosMock.get.mock.calls.length > 0

      expect(isEditMode).toBe(true)
    }
  )

  // ── AC-3 [P1] ──────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: TaskForm.vue não existe
  // PASSARÁ após o fix: mounted() chama api.get('/tasks/5') e preenche o formulário
  it(
    'AC-3 [P1] modo EDIT: ao montar deve chamar api.get("/tasks/:id") e preencher o formulário',
    async () => {
      const { wrapper } = mountEditMode('5')
      await flushPromises()

      // Deve ter chamado GET /tasks/5 exatamente uma vez
      expect(axiosMock.get).toHaveBeenCalledTimes(1)
      expect(axiosMock.get).toHaveBeenCalledWith('/tasks/5')

      // O formulário deve estar preenchido com os dados da API
      expect(wrapper.vm.title).toBe(MOCK_TASK.title)
      expect(wrapper.vm.description).toBe(MOCK_TASK.description)
      expect(wrapper.vm.status).toBe(MOCK_TASK.status)
    }
  )

  // ── AC-3b [P1] — ID diferente ───────────────────────────────────────────────
  // Garante que o id correto do prop é usado na chamada GET (não um id fixo)
  it(
    'AC-3b [P1] modo EDIT: GET deve usar o id do prop, não um id hardcoded',
    async () => {
      axiosMock.get.mockResolvedValue({
        data: { id: 42, title: 'Tarefa 42', description: 'Outra tarefa', status: 'completed' }
      })

      const { wrapper } = mountEditMode('42')
      await flushPromises()

      // Deve ter chamado GET com id=42 (vindo do prop)
      expect(axiosMock.get).toHaveBeenCalledWith('/tasks/42')
      expect(wrapper.vm.title).toBe('Tarefa 42')
    }
  )

  // ── AC-4 [P1] ──────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: TaskForm.vue não existe
  // PASSARÁ após o fix: submit no modo EDIT chama PUT /tasks/:id e redireciona
  it(
    'AC-4 [P1] modo EDIT: submit deve chamar api.put("/tasks/:id", payload) e redirecionar para /tasks',
    async () => {
      const { wrapper, mockRouterPush } = mountEditMode('5')
      await flushPromises()
      vi.clearAllMocks()

      // Altera o título no formulário
      wrapper.vm.title       = 'Tarefa Editada'
      wrapper.vm.description = 'Descrição atualizada'
      wrapper.vm.status      = 'in_progress'
      await wrapper.vm.$nextTick()

      // Submete o formulário
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      // Deve ter chamado api.put com o endpoint e os dados corretos
      expect(axiosMock.put).toHaveBeenCalledTimes(1)
      expect(axiosMock.put).toHaveBeenCalledWith(
        '/tasks/5',
        expect.objectContaining({
          title:       'Tarefa Editada',
          description: 'Descrição atualizada'
        })
      )

      // api.post NÃO deve ter sido chamado (não é modo CREATE)
      expect(axiosMock.post).not.toHaveBeenCalled()

      // Deve ter redirecionado para /tasks após o PUT bem-sucedido
      expect(mockRouterPush).toHaveBeenCalledWith('/tasks')
    }
  )

  // ── AC-4b [P1] — ID diferente no PUT ───────────────────────────────────────
  it(
    'AC-4b [P1] modo EDIT: api.put deve usar o id do prop na URL, não um id fixo',
    async () => {
      axiosMock.get.mockResolvedValue({
        data: { id: 77, title: 'Tarefa 77', description: 'Desc 77', status: 'pending' }
      })
      axiosMock.put.mockResolvedValue({
        data: { id: 77, title: 'Editada 77', description: 'Desc 77', status: 'pending' }
      })

      const { wrapper } = mountEditMode('77')
      await flushPromises()
      vi.clearAllMocks()

      wrapper.vm.title = 'Editada 77'
      await wrapper.vm.$nextTick()

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      // PUT deve usar o id 77 do prop
      expect(axiosMock.put).toHaveBeenCalledTimes(1)
      const putCallUrl = axiosMock.put.mock.calls[0][0]
      expect(putCallUrl).toContain('77')
      expect(putCallUrl).not.toContain('5') // não pode usar id hardcoded de outro teste
    }
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 3 — Comportamentos compartilhados (CREATE e EDIT)
// ─────────────────────────────────────────────────────────────────────────────

describe('TaskForm.vue › comportamentos compartilhados', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    axiosMock.get.mockResolvedValue({ data: MOCK_TASK })
    axiosMock.post.mockResolvedValue({ data: { id: 99, title: 'Nova', description: '', status: 'pending' } })
    axiosMock.put.mockResolvedValue({ data: { ...MOCK_TASK } })
  })

  // ── AC-5 [P2] ──────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: TaskForm.vue não existe
  // PASSARÁ após o fix: formulário não submete se title estiver vazio
  it(
    'AC-5 [P2] formulário não deve submeter (não chamar API) se o campo title estiver vazio — modo CREATE',
    async () => {
      const { wrapper } = mountCreateMode()
      await flushPromises()

      // title permanece vazio (valor padrão '')
      wrapper.vm.title       = ''
      wrapper.vm.description = 'Descrição sem título'
      await wrapper.vm.$nextTick()

      // Tenta submeter com title vazio
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      // api.post NÃO deve ter sido chamado (validação deve bloquear)
      expect(axiosMock.post).not.toHaveBeenCalled()
    }
  )

  it(
    'AC-5b [P2] formulário não deve submeter (não chamar API) se o campo title estiver vazio — modo EDIT',
    async () => {
      const { wrapper } = mountEditMode('5')
      await flushPromises()
      vi.clearAllMocks()

      // Limpa o título após o preenchimento via GET
      wrapper.vm.title = ''
      await wrapper.vm.$nextTick()

      // Tenta submeter com title vazio
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      // api.put NÃO deve ter sido chamado (validação deve bloquear)
      expect(axiosMock.put).not.toHaveBeenCalled()
    }
  )

  // ── AC-7 [P2] ──────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: TaskForm.vue não existe
  // PASSARÁ após o fix: botão cancelar redireciona para /tasks sem chamar API
  it(
    'AC-7 [P2] botão cancelar deve redirecionar para /tasks sem chamar a API — modo CREATE',
    async () => {
      const { wrapper, mockRouterPush } = mountCreateMode()
      await flushPromises()

      // Preenche o formulário mas vai cancelar
      wrapper.vm.title       = 'Tarefa que será cancelada'
      wrapper.vm.description = 'Descrição qualquer'
      await wrapper.vm.$nextTick()

      // Encontra e clica no botão de cancelar
      // O botão pode ter texto "Cancelar", "Cancel", ou type="button" dentro do form
      const cancelButton = wrapper.find(
        'button[type="button"], button.cancel, [data-testid="cancel"]'
      )

      if (cancelButton.exists()) {
        await cancelButton.trigger('click')
      } else {
        // Fallback: chama o método diretamente
        if (typeof wrapper.vm.cancel === 'function') {
          await wrapper.vm.cancel()
        } else if (typeof wrapper.vm.cancelForm === 'function') {
          await wrapper.vm.cancelForm()
        } else if (typeof wrapper.vm.goBack === 'function') {
          await wrapper.vm.goBack()
        }
      }
      await flushPromises()

      // A API NÃO deve ter sido chamada (nem POST nem PUT)
      expect(axiosMock.post).not.toHaveBeenCalled()
      expect(axiosMock.put).not.toHaveBeenCalled()

      // Deve ter redirecionado para /tasks
      expect(mockRouterPush).toHaveBeenCalledWith('/tasks')
    }
  )

  it(
    'AC-7b [P2] botão cancelar deve redirecionar para /tasks sem chamar a API — modo EDIT',
    async () => {
      const { wrapper, mockRouterPush } = mountEditMode('5')
      await flushPromises()
      vi.clearAllMocks()

      // Encontra e clica no botão de cancelar
      const cancelButton = wrapper.find(
        'button[type="button"], button.cancel, [data-testid="cancel"]'
      )

      if (cancelButton.exists()) {
        await cancelButton.trigger('click')
      } else {
        // Fallback: chama o método diretamente
        if (typeof wrapper.vm.cancel === 'function') {
          await wrapper.vm.cancel()
        } else if (typeof wrapper.vm.cancelForm === 'function') {
          await wrapper.vm.cancelForm()
        } else if (typeof wrapper.vm.goBack === 'function') {
          await wrapper.vm.goBack()
        }
      }
      await flushPromises()

      // A API NÃO deve ter sido chamada (nem POST nem PUT)
      expect(axiosMock.post).not.toHaveBeenCalled()
      expect(axiosMock.put).not.toHaveBeenCalled()

      // Deve ter redirecionado para /tasks
      expect(mockRouterPush).toHaveBeenCalledWith('/tasks')
    }
  )

  // ── Edge Case [P3]: erro da API no modo CREATE não deve crashar o componente ─
  it(
    'Edge [P3] erro na API ao submeter (POST) não deve crashar o componente — modo CREATE',
    async () => {
      axiosMock.post.mockRejectedValue(new Error('Network Error'))

      const { wrapper } = mountCreateMode()
      await flushPromises()

      wrapper.vm.title       = 'Tarefa com erro'
      wrapper.vm.description = 'Vai dar erro'
      await wrapper.vm.$nextTick()

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      // O componente deve continuar existindo (sem crash)
      expect(wrapper.exists()).toBe(true)
      // api.post foi chamado (tentativa aconteceu)
      expect(axiosMock.post).toHaveBeenCalledTimes(1)
    }
  )

  // ── Edge Case [P3]: erro da API no modo EDIT (GET) não deve crashar o componente ─
  it(
    'Edge [P3] erro na API ao buscar tarefa (GET) no modo EDIT não deve crashar o componente',
    async () => {
      axiosMock.get.mockRejectedValue(
        Object.assign(new Error('Not Found'), { response: { status: 404 } })
      )

      const { wrapper } = mountEditMode('9999')
      await flushPromises()

      // O componente deve continuar existindo (sem crash)
      expect(wrapper.exists()).toBe(true)
    }
  )

  // ── Edge Case [P3]: modo CREATE não chama GET ao montar ─────────────────────
  it(
    'Edge [P3] modo CREATE não deve chamar api.get ao montar (sem prop id, sem fetch)',
    async () => {
      const { wrapper } = mountCreateMode()
      await flushPromises()

      // No modo CREATE, GET nunca deve ser chamado
      expect(axiosMock.get).not.toHaveBeenCalled()
    }
  )
})
