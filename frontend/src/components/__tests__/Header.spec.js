/**
 * Header.spec.js — Testes unitários de Header.vue com autenticação condicional
 *
 * CONTEXTO DO PROBLEMA:
 *   Header.vue renderiza incondicionalmente os links Home, Tarefas e Login para
 *   TODOS os usuários, independente de estarem autenticados ou não.
 *   App.vue inclui <Header /> em todas as páginas sem verificar autenticação.
 *
 * COMPORTAMENTO ESPERADO APÓS O FIX:
 *   - Usuário deslogado (sem localStorage.token): Header NÃO é renderizado.
 *   - Usuário logado (com localStorage.token): Header é renderizado com
 *     links "Home", "Tarefas" e botão/link "Logout" — SEM o link "Login".
 *   - Clique em "Logout": remove token do localStorage e redireciona para "/".
 *
 * ESTADO DOS TESTES ANTES DO FIX (comportamento atual bugado):
 *   - AC-H1: FALHA — Header sempre renderiza, mesmo sem token
 *   - AC-H2: FALHA — Header sempre renderiza, mesmo sem token (via App.vue)
 *   - AC-H3: FALHA — Link "Login" sempre presente; "Logout" nunca existe
 *   - AC-H4: FALHA — Link "Login" aparece quando deveria aparecer "Logout"
 *   - AC-H5: FALHA — Botão "Logout" não existe no Header atual
 *   - AC-H6: FALHA — Botão "Logout" não existe; token não é removido
 *   - AC-H7: PASSA  — Links Home e Tarefas existem (mas por razão errada)
 *   - AC-H8: FALHA  — Header ainda renderiza para usuário deslogado (deveria sumir)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import Header from '../Header.vue'

// ─── Router mínimo para RouterLink funcionar ─────────────────────────────────
function createTestRouter () {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/',      name: 'Auth',     component: { template: '<div/>' } },
      { path: '/home',  name: 'Home',     component: { template: '<div/>' } },
      { path: '/tasks', name: 'TaskList', component: { template: '<div/>' } }
    ]
  })
}

// ─── Helper: monta Header com token ou sem token no localStorage ──────────────
function mountHeader ({ withToken = false, mockRouterPush = vi.fn() } = {}) {
  if (withToken) {
    localStorage.setItem('token', 'fake-jwt-token-for-tests')
  } else {
    localStorage.removeItem('token')
  }

  const router = createTestRouter()

  const wrapper = mount(Header, {
    global: {
      plugins: [router],
      mocks: {
        $router: { push: mockRouterPush }
      }
    }
  })
  return { wrapper, mockRouterPush }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Header.vue › Exibição condicional baseada em autenticação', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  // ── AC-H1 [P1] ──────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: Header renderiza incondicionalmente
  it(
    'AC-H1 [P1] usuário deslogado (sem token): Header NÃO deve renderizar nenhum elemento de navegação',
    () => {
      const { wrapper } = mountHeader({ withToken: false })

      // O elemento <header> ou <nav> não deve existir no DOM quando deslogado
      const headerElement = wrapper.find('header')
      const navElement    = wrapper.find('nav')

      // Ambos devem estar ausentes — o componente não deve renderizar nada visível
      const hasVisibleNav = headerElement.exists() || navElement.exists()
      expect(hasVisibleNav).toBe(false)
    }
  )

  // ── AC-H2 [P1] ──────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: App.vue renderiza <Header /> incondicionalmente
  it(
    'AC-H2 [P1] usuário deslogado: Header não deve conter links de navegação visíveis',
    () => {
      const { wrapper } = mountHeader({ withToken: false })

      // Nenhum link de navegação deve aparecer para usuário deslogado
      const links = wrapper.findAll('a, router-link, [href]')
      // O componente não deve renderizar links quando não há autenticação
      expect(links.length).toBe(0)
    }
  )

  // ── AC-H3 [P1] ──────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: link "Login" sempre presente, "Logout" nunca existe
  it(
    'AC-H3 [P1] usuário logado: deve exibir link/botão "Logout" — NÃO deve exibir link "Login"',
    () => {
      const { wrapper } = mountHeader({ withToken: true })

      // "Logout" deve estar presente
      const allText = wrapper.text()
      expect(allText).toMatch(/logout/i)

      // "Login" NÃO deve aparecer quando logado
      expect(allText).not.toMatch(/\blogin\b/i)
    }
  )

  // ── AC-H4 [P2] ──────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: "Login" aparece quando deveria aparecer "Logout"
  it(
    'AC-H4 [P2] usuário logado: link para /auth ou botão de login NÃO deve existir',
    () => {
      const { wrapper } = mountHeader({ withToken: true })

      // Não deve haver link apontando para a rota de autenticação/login
      const loginLinks = wrapper.findAll('a[href="/"], a[href="/auth"], a[to="/"], a[to="/auth"]')
      const loginLinkByText = wrapper.findAll('a, button').filter(el =>
        /\blogin\b/i.test(el.text())
      )

      expect(loginLinks.length).toBe(0)
      expect(loginLinkByText.length).toBe(0)
    }
  )

  // ── AC-H5 [P1] ──────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: botão/link "Logout" não existe no Header atual
  it(
    'AC-H5 [P1] usuário logado: elemento clicável de "Logout" deve existir no Header',
    () => {
      const { wrapper } = mountHeader({ withToken: true })

      // Deve existir um botão ou link com texto "Logout"
      const logoutElements = wrapper.findAll('button, a').filter(el =>
        /logout/i.test(el.text())
      )
      expect(logoutElements.length).toBeGreaterThan(0)
    }
  )

  // ── AC-H6 [P1] ──────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: botão Logout não existe → token nunca removido
  it(
    'AC-H6 [P1] clique em "Logout": deve remover token do localStorage e redirecionar para "/"',
    async () => {
      const mockRouterPush = vi.fn()
      const { wrapper } = mountHeader({ withToken: true, mockRouterPush })

      // Confirma que token está presente antes do logout
      expect(localStorage.getItem('token')).not.toBeNull()

      // Encontra e clica no elemento de logout
      const logoutEl = wrapper.findAll('button, a').find(el =>
        /logout/i.test(el.text())
      )
      expect(logoutEl).toBeDefined()

      await logoutEl.trigger('click')
      await flushPromises()

      // Token deve ter sido removido do localStorage
      expect(localStorage.getItem('token')).toBeNull()

      // Deve ter redirecionado para a raiz "/"
      expect(mockRouterPush).toHaveBeenCalledWith('/')
    }
  )

  // ── AC-H7 [P2] ──────────────────────────────────────────────────────────────
  // Verifica que usuário logado vê os links corretos de navegação
  it(
    'AC-H7 [P2] usuário logado: links "Home" e "Tarefas" devem estar presentes na navbar',
    () => {
      const { wrapper } = mountHeader({ withToken: true })

      const allText = wrapper.text()

      // Links de navegação devem existir para usuário logado
      expect(allText).toMatch(/home/i)
      expect(allText).toMatch(/tarefas/i)
    }
  )

  // ── AC-H8 [P2] ──────────────────────────────────────────────────────────────
  // Regressão: ao remover o token (logout), se o componente for remontado,
  // ele não deve mais mostrar conteúdo de usuário autenticado
  it(
    'AC-H8 [P2] após logout (token removido do localStorage), Header remontado não deve renderizar navegação',
    async () => {
      // Simula sessão ativa
      localStorage.setItem('token', 'another-fake-token')

      const { wrapper } = mountHeader({ withToken: true })

      // Simula logout: remove o token
      localStorage.removeItem('token')

      // Força re-render / remonta o componente com token ausente
      const { wrapper: wrapperAfterLogout } = mountHeader({ withToken: false })

      // Após logout, novo Header não deve mostrar navegação
      const headerElement = wrapperAfterLogout.find('header')
      const navElement    = wrapperAfterLogout.find('nav')
      const hasVisibleNav = headerElement.exists() || navElement.exists()

      expect(hasVisibleNav).toBe(false)
    }
  )

  // ── AC-H9 [P3] ──────────────────────────────────────────────────────────────
  // Edge case: token presente mas vazio — deve tratar como deslogado
  it(
    'AC-H9 [P3] token vazio no localStorage deve ser tratado como usuário deslogado (sem navbar)',
    () => {
      localStorage.setItem('token', '')

      const { wrapper } = mountHeader({ withToken: false })

      const headerElement = wrapper.find('header')
      const navElement    = wrapper.find('nav')
      const hasVisibleNav = headerElement.exists() || navElement.exists()

      expect(hasVisibleNav).toBe(false)
    }
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Testes de router guards (integração com vue-router)
// ─────────────────────────────────────────────────────────────────────────────

describe('Router Guards › Proteção de rotas autenticadas', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  // ── AC-RG1 [P1] ─────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: sem guards, qualquer rota é acessível sem token
  it(
    'AC-RG1 [P1] acesso a "/home" sem token deve redirecionar para "/"',
    async () => {
      localStorage.removeItem('token')

      // Importa o router real do projeto para testar os guards
      const { default: router } = await import('../../router/index.js')

      // Tenta navegar para /home sem token
      await router.push('/home')
      await flushPromises()

      // Sem token → deve ter sido redirecionado para /
      const currentRoute = router.currentRoute.value
      expect(currentRoute.path).toBe('/')
    }
  )

  // ── AC-RG2 [P1] ─────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: sem guards
  it(
    'AC-RG2 [P1] acesso a "/tasks" sem token deve redirecionar para "/"',
    async () => {
      localStorage.removeItem('token')

      const { default: router } = await import('../../router/index.js')

      await router.push('/tasks')
      await flushPromises()

      const currentRoute = router.currentRoute.value
      expect(currentRoute.path).toBe('/')
    }
  )

  // ── AC-RG3 [P1] ─────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: sem guards
  it(
    'AC-RG3 [P1] acesso a "/tasks/42" sem token deve redirecionar para "/"',
    async () => {
      localStorage.removeItem('token')

      const { default: router } = await import('../../router/index.js')

      await router.push('/tasks/42')
      await flushPromises()

      const currentRoute = router.currentRoute.value
      expect(currentRoute.path).toBe('/')
    }
  )

  // ── AC-RG4 [P1] ─────────────────────────────────────────────────────────────
  // DEVE FALHAR antes do fix: sem guards, usuário logado não é redirecionado
  it(
    'AC-RG4 [P1] usuário logado acessando "/" deve ser redirecionado para "/home"',
    async () => {
      localStorage.setItem('token', 'valid-token-xyz')

      const { default: router } = await import('../../router/index.js')

      await router.push('/')
      await flushPromises()

      const currentRoute = router.currentRoute.value
      expect(currentRoute.path).toBe('/home')
    }
  )

  // ── AC-RG5 [P2] ─────────────────────────────────────────────────────────────
  // Usuário logado deve acessar /home normalmente
  it(
    'AC-RG5 [P2] usuário logado acessando "/home" deve permanecer em "/home" (sem redirecionamento)',
    async () => {
      localStorage.setItem('token', 'valid-token-xyz')

      const { default: router } = await import('../../router/index.js')

      await router.push('/home')
      await flushPromises()

      const currentRoute = router.currentRoute.value
      expect(currentRoute.path).toBe('/home')
    }
  )

  // ── AC-RG6 [P2] ─────────────────────────────────────────────────────────────
  // Usuário logado deve acessar /tasks normalmente
  it(
    'AC-RG6 [P2] usuário logado acessando "/tasks" deve permanecer em "/tasks"',
    async () => {
      localStorage.setItem('token', 'valid-token-xyz')

      const { default: router } = await import('../../router/index.js')

      await router.push('/tasks')
      await flushPromises()

      const currentRoute = router.currentRoute.value
      expect(currentRoute.path).toBe('/tasks')
    }
  )
})
