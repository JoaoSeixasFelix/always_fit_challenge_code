/**
 * Auth.vue — Testes de comportamento pós-login
 *
 * CONTEXTO DO BUG:
 *   Auth.vue chama this.$router.push('/dashboard') após login bem-sucedido,
 *   mas a rota '/dashboard' NÃO existe no router. A rota correta é '/home'.
 *
 * INTENÇÃO:
 *   - AC-1 (P1): DEVE FALHAR antes da correção (prova o bug).
 *                Passará apenas quando router.push('/home') for usado.
 *   - AC-2 (P1): Garante que '/dashboard' nunca é chamado.
 *   - AC-3 (P2): Erro HTTP → mensagem exibida, sem redirecionamento.
 *   - AC-4 (P2): success:false → mensagem exibida, sem redirecionamento.
 *   - AC-5 (P3): success:false sem message → fallback genérico exibido.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Auth from '../Auth.vue'

// ─── Mock do módulo axios configurado (src/config/api.js) ───────────────────
// O caminho é resolvido para o mesmo arquivo absoluto que Auth.vue importa:
//   Auth.vue  (src/views/)          importa '../config/api'  → src/config/api.js
//   Este teste (src/views/__tests__) importa '../../config/api' → src/config/api.js
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

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Monta o componente Auth injetando um $router simulado.
 * @returns {{ wrapper, mockRouterPush }}
 */
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

// ────────────────────────────────────────────────────────────────────────────

describe('Auth.vue › método login()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── AC-1 ─────────────────────────────────────────────────────────────────
  it(
    'AC-1 [P1] login com success:true deve redirecionar para /home',
    async () => {
      axiosMock.post.mockResolvedValue({ data: { success: true } })
      const { wrapper, mockRouterPush } = mountAuth()

      // Preenche credenciais e submete o formulário
      await wrapper.find('input[type="email"]').setValue('usuario@teste.com')
      await wrapper.find('input[type="password"]').setValue('senha123')
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      // axios deve ter sido chamado com o endpoint correto
      expect(axiosMock.post).toHaveBeenCalledWith('/login', {
        email:    'usuario@teste.com',
        password: 'senha123'
      })

      // ROTA CORRETA: /home (este expect FALHARÁ enquanto o bug existir)
      expect(mockRouterPush).toHaveBeenCalledTimes(1)
      expect(mockRouterPush).toHaveBeenCalledWith('/home')
    }
  )

  // ── AC-2 ─────────────────────────────────────────────────────────────────
  it(
    'AC-2 [P1] login com success:true NÃO deve redirecionar para /dashboard',
    async () => {
      axiosMock.post.mockResolvedValue({ data: { success: true } })
      const { wrapper, mockRouterPush } = mountAuth()

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      // '/dashboard' não existe no router — nunca deve ser chamado
      expect(mockRouterPush).not.toHaveBeenCalledWith('/dashboard')
    }
  )

  // ── AC-3 ─────────────────────────────────────────────────────────────────
  it(
    'AC-3 [P2] erro HTTP (catch) deve exibir mensagem de erro e NÃO redirecionar',
    async () => {
      axiosMock.post.mockRejectedValue(new Error('Network Error'))
      const { wrapper, mockRouterPush } = mountAuth()

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      // Sem redirecionamento
      expect(mockRouterPush).not.toHaveBeenCalled()

      // Mensagem de erro visível no DOM
      const errorParagraph = wrapper.find('p.text-red-500')
      expect(errorParagraph.exists()).toBe(true)
      expect(errorParagraph.text().length).toBeGreaterThan(0)

      // Estado interno deve refletir o erro
      expect(wrapper.vm.error).not.toBeNull()
    }
  )

  // ── AC-4 ─────────────────────────────────────────────────────────────────
  it(
    'AC-4 [P2] response.data.success === false deve exibir mensagem e NÃO redirecionar',
    async () => {
      const serverMsg = 'Credenciais inválidas.'
      axiosMock.post.mockResolvedValue({
        data: { success: false, message: serverMsg }
      })
      const { wrapper, mockRouterPush } = mountAuth()

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      // Sem redirecionamento
      expect(mockRouterPush).not.toHaveBeenCalled()

      // Mensagem do servidor visível
      const errorParagraph = wrapper.find('p.text-red-500')
      expect(errorParagraph.exists()).toBe(true)
      expect(errorParagraph.text()).toContain(serverMsg)
    }
  )

  // ── AC-5 ─────────────────────────────────────────────────────────────────
  it(
    'AC-5 [P3] response.data.success === false sem campo message deve exibir fallback genérico',
    async () => {
      axiosMock.post.mockResolvedValue({ data: { success: false } })
      const { wrapper, mockRouterPush } = mountAuth()

      await wrapper.find('form').trigger('submit')
      await flushPromises()

      // Sem redirecionamento
      expect(mockRouterPush).not.toHaveBeenCalled()

      // Deve existir alguma mensagem de erro (fallback genérico)
      expect(wrapper.vm.error).toBeTruthy()
      const errorParagraph = wrapper.find('p.text-red-500')
      expect(errorParagraph.exists()).toBe(true)
    }
  )
})
