/**
 * navbar-auth.spec.js — E2E Playwright: Navbar condicional + Guards de autenticação
 *
 * PROPÓSITO:
 *   Validar no browser real que a navbar respeita o estado de autenticação
 *   e que as rotas protegidas redirecionam corretamente usuários deslogados.
 *
 * COMPORTAMENTO ESPERADO (após o fix):
 *   - Usuário deslogado em "/": navbar ausente
 *   - Usuário logado em "/home": navbar presente com "Home", "Tarefas", "Logout"
 *   - Usuário logado em "/home": "Login" NÃO aparece na navbar
 *   - Acesso direto a "/home" sem token → redireciona para "/"
 *   - Acesso direto a "/tasks" sem token → redireciona para "/"
 *   - Usuário logado acessando "/" → redireciona para "/home"
 *   - Clique em "Logout": limpa localStorage.token, redireciona para "/"
 *
 * ESTADO ATUAL (antes do fix — todos os testes abaixo devem FALHAR):
 *   - NAV-E2E-1: FALHA — navbar APARECE em "/" sem token (deveria estar oculta)
 *   - NAV-E2E-2: FALHA — navbar mostra "Login" em vez de "Logout" em "/home"
 *   - NAV-E2E-3: FALHA — "Login" visível quando logado (deveria ser "Logout")
 *   - NAV-E2E-4: FALHA — sem guard, "/home" acessível sem token (não redireciona)
 *   - NAV-E2E-5: FALHA — sem guard, "/tasks" acessível sem token (não redireciona)
 *   - NAV-E2E-6: FALHA — sem guard, "/" não redireciona logado para "/home"
 *   - NAV-E2E-7: FALHA — botão Logout não existe, token permanece após tentativa
 *
 * COMO EXECUTAR:
 *   node frontend/e2e/navbar-auth.spec.js
 *
 * SAÍDA:
 *   PASS → exit code 0
 *   FAIL → exit code 1 + descrição dos erros
 */

import { createRequire } from 'node:module'

const _require = createRequire(import.meta.url)

const PLAYWRIGHT_PATH =
  '/home/joao/.nvm/versions/node/v20.20.2/lib/node_modules/@playwright/mcp/node_modules/playwright'

const FRONTEND_URL    = 'http://localhost:5173'
const LOGIN_EMAIL     = 'test@example.com'
const LOGIN_PASSWORD  = 'password'
const TIMEOUT_MS      = 8000

// ─── Estado global do runner ──────────────────────────────────────────────────
const results = []
let browser, context, page

// ─── Helpers ──────────────────────────────────────────────────────────────────
function assert (condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`)
}

function recordResult (id, severity, description, passed, detail = '') {
  results.push({ id, severity, description, passed, detail })
  const icon = passed ? '✅ PASS' : '❌ FAIL'
  console.log(`  ${icon} [${severity}] ${id}: ${description}`)
  if (!passed && detail) console.log(`         → ${detail}`)
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────
async function setup () {
  const { chromium } = _require(PLAYWRIGHT_PATH)
  browser = await chromium.launch({ headless: true })
  context = await browser.newContext()
  page    = await context.newPage()
  page.setDefaultTimeout(TIMEOUT_MS)
}

async function teardown () {
  if (browser) await browser.close()
}

// ─── Utilitários de sessão ────────────────────────────────────────────────────

/**
 * Abre "/" com contexto limpo (sem token).
 * NOTA: navega uma vez antes de limpar localStorage para garantir contexto de página válido.
 */
async function openLoginPage () {
  await context.clearCookies()
  // Garante que temos uma página válida antes de acessar localStorage
  await page.goto(FRONTEND_URL + '/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => localStorage.clear())
  // Segunda navegação para garantir estado limpo (sem token)
  await page.goto(FRONTEND_URL + '/', { waitUntil: 'networkidle' })
}

/**
 * Faz login via UI e retorna o token salvo no localStorage.
 * @returns {string} token JWT
 */
async function loginViaUI () {
  await openLoginPage()
  await page.fill('input[type="email"]', LOGIN_EMAIL)
  await page.fill('input[type="password"]', LOGIN_PASSWORD)

  const responsePromise = page.waitForResponse(
    resp => resp.url().includes('/login') && resp.request().method() === 'POST',
    { timeout: TIMEOUT_MS }
  )

  await page.click('button[type="submit"]')
  await responsePromise
  await page.waitForTimeout(500) // aguarda Vue processar + redirecionar

  return page.evaluate(() => localStorage.getItem('token'))
}

/**
 * Injeta token diretamente no localStorage sem passar pelo fluxo de login.
 * Útil para testar rotas protegidas em isolamento.
 * @param {string} token
 */
async function injectToken (token) {
  await page.goto(FRONTEND_URL + '/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(t => localStorage.setItem('token', t), token)
}

/**
 * Remove token do localStorage (simula estado deslogado).
 * Garante que há uma página válida antes de acessar localStorage.
 */
async function clearToken () {
  const currentUrl = page.url()
  if (!currentUrl || currentUrl === 'about:blank') {
    await page.goto(FRONTEND_URL + '/', { waitUntil: 'domcontentloaded' })
  }
  await page.evaluate(() => localStorage.removeItem('token'))
}

/**
 * Retorna o texto completo do elemento de navegação ou string vazia se ausente.
 */
async function getNavText () {
  const nav = await page.locator('header nav, nav').first()
  if (await nav.count() === 0) return ''
  return nav.textContent().catch(() => '')
}

/**
 * Verifica se algum elemento de navbar (header, nav) está visível na página.
 * @returns {boolean}
 */
async function isNavbarVisible () {
  const headerCount = await page.locator('header').count()
  const navCount    = await page.locator('nav').count()
  return (headerCount + navCount) > 0
}

// ─────────────────────────────────────────────────────────────────────────────
// NAV-E2E-1: Navbar ausente na página de login (sem token)
// DEVE FALHAR com código atual: <Header /> é renderizado incondicionalmente
// ─────────────────────────────────────────────────────────────────────────────
async function testNAV1_NavbarAbsentOnLoginPage () {
  try {
    await openLoginPage()
    await page.waitForTimeout(300)

    const navVisible = await isNavbarVisible()

    assert(
      !navVisible,
      'Navbar (header/nav) está visível na página "/" para usuário deslogado — deveria estar oculta'
    )

    recordResult(
      'NAV-E2E-1', 'P1',
      'Usuário deslogado em "/": navbar deve estar completamente ausente do DOM',
      true
    )
  } catch (err) {
    const navText = await getNavText()
    recordResult(
      'NAV-E2E-1', 'P1',
      'Usuário deslogado em "/": navbar deve estar completamente ausente do DOM',
      false,
      `Navbar encontrada com texto: "${navText}". ${err.message}`
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NAV-E2E-2: Navbar presente em /home após login
// DEVE FALHAR com código atual: navbar mostra "Login" em vez de "Logout"
// ─────────────────────────────────────────────────────────────────────────────
async function testNAV2_NavbarPresentAfterLogin () {
  try {
    const token = await loginViaUI()

    // Confirma que estamos em /home após login
    const currentUrl = page.url()
    assert(
      currentUrl.includes('/home'),
      `Esperava estar em /home após login, mas URL é: ${currentUrl}`
    )

    const navVisible = await isNavbarVisible()
    assert(navVisible, 'Navbar ausente em /home após login bem-sucedido')

    const navText = await getNavText()
    assert(
      navText !== null && navText.length > 0,
      'Navbar presente mas sem texto visível'
    )

    recordResult(
      'NAV-E2E-2', 'P1',
      'Usuário logado em "/home": navbar deve estar presente e visível',
      true,
      `Navbar text: "${navText?.trim()}"`
    )
  } catch (err) {
    recordResult(
      'NAV-E2E-2', 'P1',
      'Usuário logado em "/home": navbar deve estar presente e visível',
      false,
      err.message
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NAV-E2E-3: Navbar mostra "Logout" (não "Login") quando logado
// DEVE FALHAR com código atual: "Login" sempre aparece, "Logout" nunca
// ─────────────────────────────────────────────────────────────────────────────
async function testNAV3_NavbarShowsLogoutNotLogin () {
  try {
    // Garante que estamos logados (token já deve estar do teste anterior)
    const token = await page.evaluate(() => localStorage.getItem('token'))
    if (!token) {
      await loginViaUI()
    } else {
      // Renavega para /home para garantir o estado correto
      await page.goto(FRONTEND_URL + '/home', { waitUntil: 'networkidle' })
    }

    await page.waitForTimeout(300)

    const navText = (await getNavText()) || ''
    const pageText = await page.textContent('body')

    // "Logout" deve estar visível
    assert(
      /logout/i.test(navText) || /logout/i.test(pageText),
      `Texto "Logout" não encontrado. Texto da navbar: "${navText}"`
    )

    // "Login" NÃO deve estar na navbar
    assert(
      !/\blogin\b/i.test(navText),
      `Texto "Login" encontrado na navbar quando usuário está logado. Navbar: "${navText}"`
    )

    recordResult(
      'NAV-E2E-3', 'P1',
      'Navbar logada: deve exibir "Logout" e NÃO exibir "Login"',
      true
    )
  } catch (err) {
    recordResult(
      'NAV-E2E-3', 'P1',
      'Navbar logada: deve exibir "Logout" e NÃO exibir "Login"',
      false,
      err.message
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NAV-E2E-4: Acesso direto a /home sem token → redireciona para /
// DEVE FALHAR com código atual: sem guards, /home acessível sem autenticação
// ─────────────────────────────────────────────────────────────────────────────
async function testNAV4_ProtectedRouteHomeRedirectsWhenLoggedOut () {
  try {
    // Limpa token e tenta navegar diretamente para /home
    await clearToken()
    await page.goto(FRONTEND_URL + '/home', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)

    const finalUrl = page.url()
    assert(
      finalUrl === `${FRONTEND_URL}/` || finalUrl.endsWith('/'),
      `Esperava redirecionamento para "/", mas URL final é: "${finalUrl}"`
    )

    // Confirma que está na página de login (tem o formulário de login)
    const emailInputCount = await page.locator('input[type="email"]').count()
    assert(
      emailInputCount > 0,
      `Sem redirecionamento para login — formulário de email não encontrado em: ${finalUrl}`
    )

    recordResult(
      'NAV-E2E-4', 'P1',
      'Guard: acesso direto a "/home" sem token redireciona para "/"',
      true
    )
  } catch (err) {
    recordResult(
      'NAV-E2E-4', 'P1',
      'Guard: acesso direto a "/home" sem token redireciona para "/"',
      false,
      err.message
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NAV-E2E-5: Acesso direto a /tasks sem token → redireciona para /
// DEVE FALHAR com código atual: sem guards
// ─────────────────────────────────────────────────────────────────────────────
async function testNAV5_ProtectedRouteTasksRedirectsWhenLoggedOut () {
  try {
    await clearToken()
    await page.goto(FRONTEND_URL + '/tasks', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)

    const finalUrl = page.url()
    assert(
      finalUrl === `${FRONTEND_URL}/` || finalUrl.endsWith('/'),
      `Esperava redirecionamento para "/", mas URL final é: "${finalUrl}"`
    )

    const emailInputCount = await page.locator('input[type="email"]').count()
    assert(
      emailInputCount > 0,
      `Formulário de login não encontrado após redirecionamento. URL: ${finalUrl}`
    )

    recordResult(
      'NAV-E2E-5', 'P1',
      'Guard: acesso direto a "/tasks" sem token redireciona para "/"',
      true
    )
  } catch (err) {
    recordResult(
      'NAV-E2E-5', 'P1',
      'Guard: acesso direto a "/tasks" sem token redireciona para "/"',
      false,
      err.message
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NAV-E2E-6: Usuário logado acessando "/" é redirecionado para /home
// DEVE FALHAR com código atual: sem guard reverso
// ─────────────────────────────────────────────────────────────────────────────
async function testNAV6_LoggedInUserRedirectedFromLoginPage () {
  try {
    // Injeta token sem passar pelo login para isolamento
    await page.goto(FRONTEND_URL + '/', { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => localStorage.setItem('token', 'injected-valid-token'))

    // Agora acessa "/" com token presente
    await page.goto(FRONTEND_URL + '/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)

    const finalUrl = page.url()
    assert(
      finalUrl.includes('/home'),
      `Usuário logado acessando "/" deveria ser redirecionado para "/home", mas URL é: "${finalUrl}"`
    )

    recordResult(
      'NAV-E2E-6', 'P1',
      'Guard reverso: usuário logado acessando "/" é redirecionado para "/home"',
      true
    )
  } catch (err) {
    recordResult(
      'NAV-E2E-6', 'P1',
      'Guard reverso: usuário logado acessando "/" é redirecionado para "/home"',
      false,
      err.message
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NAV-E2E-7: Botão Logout limpa token e redireciona para /
// DEVE FALHAR com código atual: botão Logout não existe
// ─────────────────────────────────────────────────────────────────────────────
async function testNAV7_LogoutButtonClearsSessionAndRedirects () {
  try {
    // Faz login real via UI
    const token = await loginViaUI()
    assert(token && token.length > 0, 'Login falhou — token não obtido')

    // Confirma que está em /home com token
    const urlBeforeLogout = page.url()
    assert(urlBeforeLogout.includes('/home'), `Esperava /home após login, mas está em: ${urlBeforeLogout}`)

    // Localiza e clica no botão/link de Logout
    const logoutLocator = page.locator('button, a').filter({ hasText: /logout/i }).first()
    const logoutCount   = await logoutLocator.count()
    assert(logoutCount > 0, 'Botão/link "Logout" não encontrado na navbar')

    await logoutLocator.click()
    await page.waitForTimeout(500)

    // Verifica que token foi removido do localStorage
    const tokenAfterLogout = await page.evaluate(() => localStorage.getItem('token'))
    assert(
      tokenAfterLogout === null || tokenAfterLogout === '',
      `Token deveria ter sido removido após logout, mas é: "${tokenAfterLogout}"`
    )

    // Verifica que foi redirecionado para /
    const urlAfterLogout = page.url()
    assert(
      urlAfterLogout === `${FRONTEND_URL}/` || urlAfterLogout.endsWith('/'),
      `Após logout, URL deveria ser "/", mas é: "${urlAfterLogout}"`
    )

    // Verifica que formulário de login está visível
    const emailInput = await page.locator('input[type="email"]').count()
    assert(emailInput > 0, 'Formulário de login não encontrado após logout')

    recordResult(
      'NAV-E2E-7', 'P1',
      'Logout: clique remove token do localStorage e redireciona para "/"',
      true
    )
  } catch (err) {
    const tokenState = await page.evaluate(() => localStorage.getItem('token')).catch(() => 'N/A')
    recordResult(
      'NAV-E2E-7', 'P1',
      'Logout: clique remove token do localStorage e redireciona para "/"',
      false,
      `Token após logout: "${tokenState}". URL: "${page.url()}". ${err.message}`
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NAV-E2E-8: Navbar ausente em /tasks/:id sem token (guard em rota dinâmica)
// DEVE FALHAR com código atual: sem guards
// ─────────────────────────────────────────────────────────────────────────────
async function testNAV8_ProtectedRouteTaskDetailRedirectsWhenLoggedOut () {
  try {
    await clearToken()
    await page.goto(FRONTEND_URL + '/tasks/1', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)

    const finalUrl = page.url()
    assert(
      finalUrl === `${FRONTEND_URL}/` || finalUrl.endsWith('/'),
      `Acesso a "/tasks/1" sem token deveria redirecionar para "/", mas URL é: "${finalUrl}"`
    )

    recordResult(
      'NAV-E2E-8', 'P2',
      'Guard: acesso a "/tasks/:id" sem token redireciona para "/"',
      true
    )
  } catch (err) {
    recordResult(
      'NAV-E2E-8', 'P2',
      'Guard: acesso a "/tasks/:id" sem token redireciona para "/"',
      false,
      err.message
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NAV-E2E-9: Navbar contém links Home e Tarefas quando logado
// ─────────────────────────────────────────────────────────────────────────────
async function testNAV9_NavbarLinksWhenLoggedIn () {
  try {
    // Injeta token e navega para /home
    await page.goto(FRONTEND_URL + '/', { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => localStorage.setItem('token', 'valid-token-for-nav-test'))
    await page.goto(FRONTEND_URL + '/home', { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)

    const navText = (await getNavText()) || ''

    assert(/home/i.test(navText), `Link "Home" não encontrado na navbar. Texto: "${navText}"`)
    assert(/tarefas/i.test(navText), `Link "Tarefas" não encontrado na navbar. Texto: "${navText}"`)

    recordResult(
      'NAV-E2E-9', 'P2',
      'Navbar logada contém links "Home" e "Tarefas"',
      true,
      `Texto da navbar: "${navText.trim()}"`
    )
  } catch (err) {
    recordResult(
      'NAV-E2E-9', 'P2',
      'Navbar logada contém links "Home" e "Tarefas"',
      false,
      err.message
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Runner principal
// ─────────────────────────────────────────────────────────────────────────────
async function main () {
  console.log('═══════════════════════════════════════════════════════════════════')
  console.log(' E2E Navbar Auth — Testes de Navbar Condicional + Guards de Rota')
  console.log(` Frontend: ${FRONTEND_URL}`)
  console.log('═══════════════════════════════════════════════════════════════════')

  try {
    await setup()

    await testNAV1_NavbarAbsentOnLoginPage()
    await testNAV2_NavbarPresentAfterLogin()
    await testNAV3_NavbarShowsLogoutNotLogin()
    await testNAV4_ProtectedRouteHomeRedirectsWhenLoggedOut()
    await testNAV5_ProtectedRouteTasksRedirectsWhenLoggedOut()
    await testNAV6_LoggedInUserRedirectedFromLoginPage()
    await testNAV7_LogoutButtonClearsSessionAndRedirects()
    await testNAV8_ProtectedRouteTaskDetailRedirectsWhenLoggedOut()
    await testNAV9_NavbarLinksWhenLoggedIn()

  } finally {
    await teardown()
  }

  // ─── Sumário ─────────────────────────────────────────────────────────────────
  console.log('')
  console.log('─────────────────────────────────────────────────────────────────────')
  console.log(' SUMÁRIO')
  console.log('─────────────────────────────────────────────────────────────────────')

  const p1Failures = results.filter(r => r.severity === 'P1' && !r.passed)
  const total      = results.length
  const passed     = results.filter(r => r.passed).length
  const failed     = total - passed
  const allPassed  = failed === 0

  console.log(` Total: ${total} | ✅ PASS: ${passed} | ❌ FAIL: ${failed}`)
  console.log(` Falhas P1 (bloqueantes): ${p1Failures.length}`)

  if (p1Failures.length > 0) {
    console.log('')
    console.log(' ⛔  TESTES P1 FALHARAM:')
    p1Failures.forEach(r => {
      console.log(`   • ${r.id} [${r.severity}]: ${r.description}`)
      if (r.detail) console.log(`     → ${r.detail}`)
    })
  }

  console.log('═══════════════════════════════════════════════════════════════════')
  console.log(` STATUS FINAL: ${allPassed ? '✅ PASS' : '❌ FAIL'}`)
  console.log('═══════════════════════════════════════════════════════════════════')

  process.exit(allPassed ? 0 : 1)
}

main().catch(err => {
  console.error('ERRO FATAL no runner E2E:', err)
  process.exit(1)
})
