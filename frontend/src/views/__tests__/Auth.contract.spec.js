/**
 * Auth.contract.spec.js — Testes de contrato Auth.vue ↔ AuthController
 *
 * PROPÓSITO:
 *   Validar que Auth.vue funciona corretamente com a resposta REAL do backend.
 *
 * CONTRATO DO BUG:
 *   Auth.vue linha ~72 verifica:  if (response.data.success) { ... }
 *   AuthController retorna:       { "token": "eyJ..." }   ← sem campo "success"
 *   Resultado:                    response.data.success === undefined → falsy
 *                                 redirect NUNCA executa
 *
 * COMPORTAMENTO ESPERADO APÓS O FIX:
 *   O componente deve detectar o login bem-sucedido pela presença do campo
 *   "token" na resposta (ex: if (response.data.token)) e redirecionar para /home.
 *
 * ESTADO DOS TESTES ANTES DO FIX:
 *   - AC-CONTRACT-1: FALHA — mockRouterPush nunca chamado (success === undefined)
 *   - AC-CONTRACT-2: FALHA — error !== null (cai no else: "Erro desconhecido...")
 *   - AC-CONTRACT-3: FALHA — mockRouterPush nunca chamado
 *   - AC-CONTRACT-4: PASSA  — comportamento de erro não depende do bug
 *   - AC-CONTRACT-5: FALHA — mockRouterPush nunca chamado (confirma ausência de success)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Auth from '../Auth.vue'

// ─── Mock do módulo axios (mesmo caminho resolvido que Auth.vue usa) ─────────
vi.mock('../../config/api', () => ({
  default: {
    post: vi.fn(),
    interceptors: {
      request:  { use: vi.fn() },
      response: { use: vi.fn() }
    }
  }
}))

import axiosMock from '../../config/api'

// ─── Helper: monta Auth com $router simulado ─────────────────────────────────
function mountAuth () {
  const mockRouterPush = vi.fn()
  const wrapper = mount(Auth, {
    global: {
      mocks: {
        $router: { push: mockRouterPush }
      }
    }
  })
  return { wrapper, mockRouterPush }
}

// ─── Constante: resposta REAL do AuthController ───────────────────────────────
const REAL_BACKEND_RESPONSE = {
  data: {
    token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.faketoken'
    // NOTA: campo "success" AUSENTE — este é o contrato atual do backend
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Auth.vue › Contrato real com AuthController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  // ── AC-CONTRACT-1 [P1] ────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: response.data.success === undefined → if falsy
  // PASSARÁ após o fix: detecção via response.data.token
  it(
    'AC-CONTRACT-1 [P1] resposta real do backend { token } deve redirecionar para /home',
    async () => {
      // Simula EXATAMENTE o que AuthController.login() retorna
      axiosMock.post.mockResolvedValue(REAL_BACKEND_RESPONSE)
      const { wrapper, mockRouterPush } = mountAuth()

      await wrapper.find('input[type="email"]').setValue('test@example.com')
      await wrapper.find('input[type="password"]').setValue('password')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      // Axios deve ter sido chamado com as credenciais corretas
      expect(axiosMock.post).toHaveBeenCalledWith('/login', {
        email:    'test@example.com',
        password: 'password'
      })

      // Redirect DEVE acontecer para /home — FALHA com código atual (success === undefined)
      expect(mockRouterPush).toHaveBeenCalledTimes(1)
      expect(mockRouterPush).toHaveBeenCalledWith('/home')
    }
  )

  // ── AC-CONTRACT-2 [P1] ────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: cai no else → error = "Erro desconhecido..."
  // PASSARÁ após o fix: sem error, sem mensagem de erro no DOM
  it(
    'AC-CONTRACT-2 [P1] resposta real { token } não deve exibir mensagem de erro',
    async () => {
      axiosMock.post.mockResolvedValue(REAL_BACKEND_RESPONSE)
      const { wrapper } = mountAuth()

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      // FALHA com código atual: error é setado para "Erro desconhecido..."
      expect(wrapper.vm.error).toBeNull()

      // Parágrafo de erro não deve estar no DOM
      const errorParagraph = wrapper.find('p.text-red-500')
      expect(errorParagraph.exists()).toBe(false)
    }
  )

  // ── AC-CONTRACT-3 [P1] ────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: a lógica nem chega na parte de tratar o token
  // PASSARÁ após o fix: token é salvo para uso nas próximas requisições
  it(
    'AC-CONTRACT-3 [P1] token JWT recebido deve ser persistido no localStorage',
    async () => {
      axiosMock.post.mockResolvedValue(REAL_BACKEND_RESPONSE)
      const { wrapper } = mountAuth()

      await wrapper.find('input[type="email"]').setValue('test@example.com')
      await wrapper.find('input[type="password"]').setValue('password')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      // Token deve estar armazenado para uso nas requisições autenticadas
      // FALHA com código atual: nunca entra no if → token nunca é salvo
      expect(localStorage.getItem('token')).toBe(REAL_BACKEND_RESPONSE.data.token)
    }
  )

  // ── AC-CONTRACT-4 [P1] ────────────────────────────────────────────────────
  // Verifica que credenciais inválidas (HTTP 401) NÃO redirecionam
  // Este teste PASSA mesmo com o código bugado (catch é acionado)
  it(
    'AC-CONTRACT-4 [P1] credenciais inválidas (HTTP 401) não devem redirecionar e devem exibir erro',
    async () => {
      // Backend retorna 401: { "error": "Invalid credentials" }
      axiosMock.post.mockRejectedValue(
        Object.assign(new Error('Request failed with status code 401'), {
          response: { status: 401, data: { error: 'Invalid credentials' } }
        })
      )
      const { wrapper, mockRouterPush } = mountAuth()

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      // Sem redirecionamento em caso de erro
      expect(mockRouterPush).not.toHaveBeenCalled()

      // Mensagem de erro deve ser exibida
      expect(wrapper.vm.error).not.toBeNull()
      const errorParagraph = wrapper.find('p.text-red-500')
      expect(errorParagraph.exists()).toBe(true)
      expect(errorParagraph.text().length).toBeGreaterThan(0)
    }
  )

  // ── AC-CONTRACT-5 [P2] ────────────────────────────────────────────────────
  // Documenta e valida que "success" é AUSENTE na resposta real do backend.
  // O frontend NÃO deve depender de um campo que nunca é enviado.
  // DEVE FALHAR antes do fix: mesmo sem success, redirect deve acontecer
  it(
    'AC-CONTRACT-5 [P2] campo "success" está ausente da resposta real — frontend não deve depender dele',
    async () => {
      axiosMock.post.mockResolvedValue(REAL_BACKEND_RESPONSE)
      const { wrapper, mockRouterPush } = mountAuth()

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      // Documentação do contrato: "success" não existe na resposta real
      expect(REAL_BACKEND_RESPONSE.data.success).toBeUndefined()

      // Apesar da ausência de "success", o redirect DEVE acontecer
      // (detectado via response.data.token)
      // FALHA com código atual que checa response.data.success
      expect(mockRouterPush).toHaveBeenCalledWith('/home')
    }
  )

  // ── AC-CONTRACT-6 [P2] ────────────────────────────────────────────────────
  // Regressão: o comportamento de erro HTTP (throw) não deve ser afetado pelo fix
  it(
    'AC-CONTRACT-6 [P2] erro de rede (sem resposta HTTP) deve exibir mensagem genérica e não redirecionar',
    async () => {
      axiosMock.post.mockRejectedValue(new Error('Network Error'))
      const { wrapper, mockRouterPush } = mountAuth()

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(mockRouterPush).not.toHaveBeenCalled()
      expect(wrapper.vm.error).toBeTruthy()
      const errorParagraph = wrapper.find('p.text-red-500')
      expect(errorParagraph.exists()).toBe(true)
    }
  )

  // ── AC-CONTRACT-7 [P3] ────────────────────────────────────────────────────
  // Edge case: resposta com token vazio/nulo NÃO deve redirecionar
  it(
    'AC-CONTRACT-7 [P3] token vazio na resposta não deve redirecionar (prevenção de sessão inválida)',
    async () => {
      axiosMock.post.mockResolvedValue({ data: { token: '' } })
      const { wrapper, mockRouterPush } = mountAuth()

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      // Token vazio não é uma autenticação válida
      expect(mockRouterPush).not.toHaveBeenCalled()
    }
  )

  // ── AC-CONTRACT-8 [P3] ────────────────────────────────────────────────────
  // Edge case: resposta completamente vazia não deve causar crash nem redirecionar
  it(
    'AC-CONTRACT-8 [P3] resposta vazia {} não deve redirecionar nem lançar exceção não tratada',
    async () => {
      axiosMock.post.mockResolvedValue({ data: {} })
      const { wrapper, mockRouterPush } = mountAuth()

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(mockRouterPush).not.toHaveBeenCalled()
      // Componente não deve ter crashado — ainda renderiza
      expect(wrapper.exists()).toBe(true)
    }
  )
})
