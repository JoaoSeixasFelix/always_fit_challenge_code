/**
 * TaskDetail.spec.js — Testes unitários para TaskDetail.vue
 *
 * PROBLEMAS DOCUMENTADOS:
 *   1. fetchTask() apenas hardcoda:
 *      this.task = { id: this.id, title: 'Tarefa Exemplo', description: 'Descrição da tarefa exemplo' }
 *      → nunca chama api.get('/tasks/{id}')
 *   2. markAsCompleted() não tem implementação → não chama api.put('/tasks/{id}')
 *
 * COMPORTAMENTO ESPERADO APÓS O FIX:
 *   1. fetchTask() deve chamar api.get('/tasks/{id}') com o id do prop
 *   2. task deve ser populado com os dados reais da API (não hardcoded)
 *   3. Enquanto carregando, exibe "Carregando..." (estado loading)
 *   4. markAsCompleted() deve chamar api.put('/tasks/{id}', { status: 'completed' })
 *
 * ESTADO ANTES DO FIX:
 *   AC-TD1 → FALHA: api.get nunca chamado (dados hardcoded)
 *   AC-TD2 → FALHA: task.title é sempre 'Tarefa Exemplo' (hardcoded)
 *   AC-TD3 → FALHA: task.id é o prop mas title/description são hardcoded
 *   AC-TD4 → FALHA: api.put nunca chamado ao marcar como concluída
 *   AC-TD5 → DEPENDE: "Carregando..." aparece se task === null inicialmente
 *   AC-TD6 → FALHA: componente exibe dado hardcoded ao invés de dados da API
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TaskDetail from '../TaskDetail.vue'

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

// ─── Constante: resposta simulada da API para GET /tasks/42 ──────────────────
const MOCK_TASK_FROM_API = {
  id:          42,
  title:       'Tarefa Real da API',
  description: 'Esta descrição vem do backend, não é hardcoded',
  status:      'pending'
}

// ─── Helper: monta TaskDetail.vue com props e $router simulados ──────────────
function mountTaskDetail (id = '42') {
  const mockRouterPush = vi.fn()
  const wrapper = mount(TaskDetail, {
    props: { id },
    global: {
      mocks: { $router: { push: mockRouterPush } }
    }
  })
  return { wrapper, mockRouterPush }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('TaskDetail.vue › integração com a API', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    // Resposta padrão da API para o detalhe da tarefa
    axiosMock.get.mockResolvedValue({ data: MOCK_TASK_FROM_API })
    axiosMock.put.mockResolvedValue({
      data: { ...MOCK_TASK_FROM_API, status: 'completed' }
    })
  })

  // ── AC-TD1 [P1] ────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: fetchTask() não chama api.get
  // PASSARÁ após o fix: fetchTask() chama api.get('/tasks/42')
  it(
    'AC-TD1 [P1] fetchTask() deve chamar GET /tasks/{id} com o id recebido via prop',
    async () => {
      const { wrapper } = mountTaskDetail('42')
      await flushPromises()

      expect(axiosMock.get).toHaveBeenCalledTimes(1)
      expect(axiosMock.get).toHaveBeenCalledWith('/tasks/42')
    }
  )

  // ── AC-TD2 [P1] ────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: task.title é sempre 'Tarefa Exemplo' (hardcoded)
  // PASSARÁ após o fix: task.title vem da API ('Tarefa Real da API')
  it(
    'AC-TD2 [P1] task deve ser populado com os dados reais da API (não "Tarefa Exemplo")',
    async () => {
      const { wrapper } = mountTaskDetail('42')
      await flushPromises()

      const task = wrapper.vm.task

      expect(task).not.toBeNull()
      // FALHA com código atual: title é 'Tarefa Exemplo' (hardcoded)
      expect(task.title).toBe('Tarefa Real da API')
      expect(task.description).toBe('Esta descrição vem do backend, não é hardcoded')

      // Garante que o título hardcoded NÃO aparece
      expect(task.title).not.toBe('Tarefa Exemplo')
      expect(task.description).not.toBe('Descrição da tarefa exemplo')
    }
  )

  // ── AC-TD3 [P1] ────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: task.title é 'Tarefa Exemplo' — não vem da API
  // PASSARÁ após o fix: o título real da API é renderizado no DOM
  it(
    'AC-TD3 [P1] o título real da tarefa (vindo da API) deve ser exibido no DOM',
    async () => {
      const { wrapper } = mountTaskDetail('42')
      await flushPromises()

      const html = wrapper.html()

      // Título real da API deve estar visível
      expect(html).toContain('Tarefa Real da API')

      // Título hardcoded NÃO deve aparecer
      expect(html).not.toContain('Tarefa Exemplo')
    }
  )

  // ── AC-TD4 [P1] ────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: fetchTask() usa id diferente para cada prop
  // PASSARÁ após o fix: api.get é chamado com o id correto do prop
  it(
    'AC-TD4 [P1] fetchTask() deve usar o id do prop (não um id fixo)',
    async () => {
      axiosMock.get.mockResolvedValue({
        data: { id: 99, title: 'Tarefa ID 99', description: 'Outra tarefa', status: 'completed' }
      })

      const { wrapper } = mountTaskDetail('99')
      await flushPromises()

      // Deve ter chamado com o id 99 (do prop), não com outro id fixo
      expect(axiosMock.get).toHaveBeenCalledWith('/tasks/99')
      expect(wrapper.vm.task.id).toBe(99)
      expect(wrapper.vm.task.title).toBe('Tarefa ID 99')
    }
  )

  // ── AC-TD5 [P2] ────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: markAsCompleted() não tem implementação
  // PASSARÁ após o fix: markAsCompleted() chama api.put('/tasks/42', { status: 'completed' })
  it(
    'AC-TD5 [P2] markAsCompleted() deve chamar PUT /tasks/{id} com status "completed"',
    async () => {
      const { wrapper } = mountTaskDetail('42')
      await flushPromises()
      vi.clearAllMocks()

      // Dispara markAsCompleted
      await wrapper.vm.markAsCompleted()
      await flushPromises()

      expect(axiosMock.put).toHaveBeenCalledTimes(1)
      expect(axiosMock.put).toHaveBeenCalledWith(
        '/tasks/42',
        expect.objectContaining({ status: 'completed' })
      )
    }
  )

  // ── AC-TD6 [P2] ────────────────────────────────────────────────────────────
  // Estado inicial: task === null → deve mostrar "Carregando..."
  it(
    'AC-TD6 [P2] deve exibir texto de carregamento enquanto aguarda resposta da API',
    async () => {
      // API que nunca resolve (simula loading)
      axiosMock.get.mockReturnValue(new Promise(() => {}))

      const { wrapper } = mountTaskDetail('42')

      // Antes da API responder, task é null → deve mostrar "Carregando..."
      const html = wrapper.html()
      expect(html).toContain('Carregando')
    }
  )

  // ── AC-TD7 [P3] ────────────────────────────────────────────────────────────
  // Edge case: API retorna 404 → componente não deve crashar
  it(
    'AC-TD7 [P3] erro 404 da API não deve crashar o componente',
    async () => {
      axiosMock.get.mockRejectedValue(
        Object.assign(new Error('Not Found'), { response: { status: 404 } })
      )

      const { wrapper } = mountTaskDetail('9999')
      await flushPromises()

      expect(wrapper.exists()).toBe(true)
    }
  )

  // ── AC-TD8 [P3] ────────────────────────────────────────────────────────────
  // Edge case: prop id como número string → api deve ser chamado com o valor correto
  it(
    'AC-TD8 [P3] prop id como string numérica deve ser usado corretamente na chamada da API',
    async () => {
      const { wrapper } = mountTaskDetail('7')
      await flushPromises()

      // O caminho na URL deve conter o id
      const callArg = axiosMock.get.mock.calls[0]?.[0]
      expect(callArg).toContain('7')
    }
  )
})
