/**
 * login.spec.js — E2E Playwright (Node puro, ESM, sem framework)
 *
 * PROPÓSITO:
 *   Validar o fluxo completo de login no browser real, confirmando que
 *   após autenticação bem-sucedida a URL muda para /home.
 *
 * BUG DOCUMENTADO:
 *   Auth.vue verifica response.data.success, mas AuthController retorna
 *   apenas { token }. Com o código atual:
 *     - POST /login → HTTP 200 + { token: "eyJ..." }
 *     - response.data.success === undefined → redirect NUNCA executa
 *     - URL permanece em "/" após login
 *
 * COMO EXECUTAR:
 *   node frontend/e2e/login.spec.js
 *
 * SAÍDA:
 *   PASS → exit code 0
 *   FAIL → exit code 1 + descrição do erro
 *
 * ESTADO ANTES DO FIX (comportamento atual bugado):
 *   - E2E-1: PASSA  — página carrega corretamente
 *   - E2E-2: FALHA  — URL permanece em "/" (redirect não ocorre)
 *   - E2E-3: FALHA  — exibe "Erro desconhecido..." após login bem-sucedido
 *   - E2E-4: FALHA  — URL deve ser /home, permanece em /
 *   - E2E-5: PASSA  — credenciais inválidas mostram erro (não afetado pelo bug)
 *   - E2E-6: PASSA  — backend retorna { token } sem success (contrato da API)
 */

import { createRequire } from 'node:module'

const _require = createRequire(import.meta.url)

const PLAYWRIGHT_PATH =
  '/home/joao/.nvm/versions/node/v20.20.2/lib/node_modules/@playwright/mcp/node_modules/playwright'

const FRONTEND_URL   = 'http://localhost:5173'
const LOGIN_EMAIL    = 'test@example.com'
const LOGIN_PASSWORD = 'password'
const REDIRECT_PATH  = '/home'
const TIMEOUT_MS     = 8000

// ─── Estado global do runner ──────────────────────────────────────────────────
const results = []
let browser, page

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
  const context = await browser.newContext()
  page = await context.newPage()
  page.setDefaultTimeout(TIMEOUT_MS)
}

async function teardown () {
  if (browser) await browser.close()
}

// ─── Utilitários ──────────────────────────────────────────────────────────────
async function goToLoginPage () {
  await page.goto(FRONTEND_URL + '/', { waitUntil: 'networkidle' })
  await page.waitForURL(FRONTEND_URL + '/', { timeout: TIMEOUT_MS })
}

async function fillAndSubmitLogin (email, password) {
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
}

// ─────────────────────────────────────────────────────────────────────────────
// E2E-1: Página de login carrega com formulário completo
// DEVE PASSAR mesmo com código bugado
// ─────────────────────────────────────────────────────────────────────────────
async function testE2E1_LoginPageLoads () {
  try {
    await goToLoginPage()

    const title = await page.textContent('h2')
    assert(title && title.includes('Sign in'), `título esperado "Sign in", obtido: "${title}"`)

    const emailCount    = await page.locator('input[type="email"]').count()
    const passwordCount = await page.locator('input[type="password"]').count()
    const submitCount   = await page.locator('button[type="submit"]').count()

    assert(emailCount    === 1, 'input[type=email] não encontrado')
    assert(passwordCount === 1, 'input[type=password] não encontrado')
    assert(submitCount   === 1, 'button[type=submit] não encontrado')

    recordResult('E2E-1', 'P2', 'Página de login carrega com formulário completo (email, password, submit)', true)
  } catch (err) {
    recordResult('E2E-1', 'P2', 'Página de login carrega com formulário completo (email, password, submit)', false, err.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// E2E-6: Backend retorna HTTP 200 + { token } sem campo "success"
// Valida o contrato da API antes do fluxo de UI
// DEVE PASSAR mesmo com código bugado (é sobre o backend, não o frontend)
// ─────────────────────────────────────────────────────────────────────────────
async function testE2E6_BackendContractReturnsToken () {
  try {
    await goToLoginPage()

    // Registra o waitForResponse ANTES de submeter o formulário para evitar race condition
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/login') && resp.request().method() === 'POST',
      { timeout: TIMEOUT_MS }
    )

    await fillAndSubmitLogin(LOGIN_EMAIL, LOGIN_PASSWORD)

    // Aguarda e lê a resposta (Playwright garante acesso ao body independente de CORS)
    const resp         = await responsePromise
    const responseBody = await resp.json()
    const responseStatus = resp.status()

    assert(responseStatus === 200, `HTTP status esperado 200, obtido ${responseStatus}`)
    assert(responseBody   !== null, 'corpo da resposta não capturado')
    assert(
      typeof responseBody.token === 'string' && responseBody.token.length > 0,
      `campo "token" ausente ou vazio. Resposta: ${JSON.stringify(responseBody)}`
    )
    assert(
      responseBody.success === undefined,
      `campo "success" NÃO deveria existir — contrato mudou! Resposta: ${JSON.stringify(responseBody)}`
    )

    recordResult(
      'E2E-6', 'P1',
      'Backend retorna HTTP 200 com { token } e sem campo "success" — contrato de AuthController',
      true,
      `token[:30]: ${responseBody.token.substring(0, 30)}...`
    )
  } catch (err) {
    recordResult('E2E-6', 'P1', 'Backend retorna HTTP 200 com { token } e sem campo "success"', false, err.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// E2E-2: Login com credenciais válidas → URL muda para /home
// DEVE FALHAR com código atual (URL permanece em /)
// ─────────────────────────────────────────────────────────────────────────────
async function testE2E2_ValidLoginRedirectsToHome () {
  try {
    await goToLoginPage()
    await fillAndSubmitLogin(LOGIN_EMAIL, LOGIN_PASSWORD)

    // Aguarda navegação — timeout = redirect não ocorreu = bug ativo
    await page.waitForURL(`${FRONTEND_URL}${REDIRECT_PATH}`, { timeout: TIMEOUT_MS })

    const currentUrl = page.url()
    assert(
      currentUrl === `${FRONTEND_URL}${REDIRECT_PATH}` ||
      currentUrl === `${FRONTEND_URL}${REDIRECT_PATH}/`,
      `URL esperada: ${FRONTEND_URL}${REDIRECT_PATH} — obtida: ${currentUrl}`
    )

    recordResult(
      'E2E-2', 'P1',
      `Login com credenciais válidas redireciona para ${REDIRECT_PATH}`,
      true
    )
  } catch (err) {
    const currentUrl = page.url()
    recordResult(
      'E2E-2', 'P1',
      `Login com credenciais válidas redireciona para ${REDIRECT_PATH}`,
      false,
      `URL atual: "${currentUrl}" | esperada: "${FRONTEND_URL}${REDIRECT_PATH}". ${err.message}`
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// E2E-3: Nenhuma mensagem de erro após login bem-sucedido
// DEVE FALHAR com código atual (exibe "Erro desconhecido ao tentar fazer login.")
// ─────────────────────────────────────────────────────────────────────────────
async function testE2E3_NoErrorMessageAfterValidLogin () {
  try {
    await goToLoginPage()
    await fillAndSubmitLogin(LOGIN_EMAIL, LOGIN_PASSWORD)

    // Aguarda resposta da API
    await page.waitForResponse(
      resp => resp.url().includes('/login') && resp.request().method() === 'POST',
      { timeout: TIMEOUT_MS }
    )

    // Breve espera para Vue processar a resposta e re-renderizar
    await page.waitForTimeout(600)

    const errorCount = await page.locator('p.text-red-500').count()
    assert(errorCount === 0, `${errorCount} mensagem(ns) de erro inesperada(s) exibida(s) após login com credenciais válidas`)

    recordResult(
      'E2E-3', 'P1',
      'Nenhuma mensagem de erro exibida após login bem-sucedido com credenciais válidas',
      true
    )
  } catch (err) {
    let errorText = ''
    try { errorText = await page.locator('p.text-red-500').textContent({ timeout: 500 }) } catch (_) { /* ignore */ }

    recordResult(
      'E2E-3', 'P1',
      'Nenhuma mensagem de erro exibida após login bem-sucedido com credenciais válidas',
      false,
      `Mensagem de erro encontrada: "${errorText}". ${err.message}`
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// E2E-4: URL final após login é exatamente /home (não /, /dashboard, etc.)
// DEVE FALHAR com código atual (URL permanece em /)
// ─────────────────────────────────────────────────────────────────────────────
async function testE2E4_FinalUrlIsHome () {
  try {
    await goToLoginPage()
    await fillAndSubmitLogin(LOGIN_EMAIL, LOGIN_PASSWORD)

    // Aguarda possível navegação; se não navegar, documenta URL atual
    try {
      await page.waitForURL(`${FRONTEND_URL}${REDIRECT_PATH}`, { timeout: TIMEOUT_MS })
    } catch (_) {
      // Timeout esperado quando bug está ativo — verificação de URL abaixo falhará
    }

    const finalUrl   = page.url()
    const expectedUrl = `${FRONTEND_URL}${REDIRECT_PATH}`

    assert(
      finalUrl === expectedUrl || finalUrl === expectedUrl + '/',
      `URL final: "${finalUrl}" — deveria ser "${expectedUrl}"`
    )

    recordResult('E2E-4', 'P1', `URL final após login é exatamente ${REDIRECT_PATH}`, true)
  } catch (err) {
    recordResult('E2E-4', 'P1', `URL final após login é exatamente ${REDIRECT_PATH}`, false, err.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// E2E-5: Credenciais inválidas → URL permanece em / + erro exibido
// DEVE PASSAR mesmo com código bugado
// ─────────────────────────────────────────────────────────────────────────────
async function testE2E5_InvalidCredentialsShowError () {
  try {
    await goToLoginPage()
    await fillAndSubmitLogin('wrong@invalid.com', 'wrongpassword123')

    // Aguarda resposta HTTP 401
    await page.waitForResponse(
      resp => resp.url().includes('/login') && resp.status() === 401,
      { timeout: TIMEOUT_MS }
    )

    await page.waitForTimeout(400)

    const currentUrl = page.url()
    assert(
      !currentUrl.includes(REDIRECT_PATH),
      `URL não deveria conter "${REDIRECT_PATH}", mas é "${currentUrl}"`
    )

    const errorCount = await page.locator('p.text-red-500').count()
    assert(errorCount > 0, 'mensagem de erro não foi exibida para credenciais inválidas')

    recordResult('E2E-5', 'P2', 'Credenciais inválidas: URL permanece em / e mensagem de erro é exibida', true)
  } catch (err) {
    recordResult('E2E-5', 'P2', 'Credenciais inválidas: URL permanece em / e mensagem de erro é exibida', false, err.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Runner principal
// ─────────────────────────────────────────────────────────────────────────────
async function main () {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' E2E Login — Auth.vue ↔ AuthController Contract Tests')
  console.log(` Frontend: ${FRONTEND_URL}  |  Redirect: ${REDIRECT_PATH}`)
  console.log('═══════════════════════════════════════════════════════════════')

  try {
    await setup()

    // Ordem: validação estrutural → validação de contrato → fluxo de UI
    await testE2E1_LoginPageLoads()
    await testE2E6_BackendContractReturnsToken()
    await testE2E2_ValidLoginRedirectsToHome()
    await testE2E3_NoErrorMessageAfterValidLogin()
    await testE2E4_FinalUrlIsHome()
    await testE2E5_InvalidCredentialsShowError()

  } finally {
    await teardown()
  }

  // ─── Sumário ───────────────────────────────────────────────────────────────
  console.log('')
  console.log('───────────────────────────────────────────────────────────────')
  console.log(' SUMÁRIO')
  console.log('───────────────────────────────────────────────────────────────')

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

  console.log('═══════════════════════════════════════════════════════════════')
  console.log(` STATUS FINAL: ${allPassed ? '✅ PASS' : '❌ FAIL'}`)
  console.log('═══════════════════════════════════════════════════════════════')

  process.exit(allPassed ? 0 : 1)
}

main().catch(err => {
  console.error('ERRO FATAL no runner E2E:', err)
  process.exit(1)
})
