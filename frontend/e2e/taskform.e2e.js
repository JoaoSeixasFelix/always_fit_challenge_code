/**
 * taskform.e2e.js — E2E Playwright: Fluxo completo de criação e edição de tarefas
 *
 * PROPÓSITO:
 *   Validar que TaskForm.vue e as novas rotas do router funcionam corretamente
 *   no browser real:
 *     - Rota /tasks/create renderiza o formulário em modo CREATE
 *     - Rota /tasks/:id/edit renderiza o formulário em modo EDIT com dados pré-preenchidos
 *     - Submit em CREATE chama POST /tasks e redireciona para /tasks
 *     - Submit em EDIT chama PUT /tasks/:id e redireciona para /tasks
 *     - Cancelar redireciona para /tasks sem chamar a API
 *     - Formulário com título vazio NÃO submete
 *     - Rota /tasks/create NÃO é capturada por /tasks/:id (ordem de rotas correta)
 *     - Guard de autenticação protege /tasks/create e /tasks/:id/edit
 *
 * COMO EXECUTAR:
 *   node frontend/e2e/taskform.e2e.js
 */

import { createRequire } from 'node:module'

const _require = createRequire(import.meta.url)

const PLAYWRIGHT_PATH =
  '/home/joao/.nvm/versions/node/v20.20.2/lib/node_modules/@playwright/mcp/node_modules/playwright'

const FRONTEND_URL    = 'http://localhost:5173'
const BACKEND_URL     = 'http://localhost:8000'
const LOGIN_EMAIL     = 'test@example.com'
const LOGIN_PASSWORD  = 'password'
const TIMEOUT_MS      = 10000

const results = []
let browser, context, page

function assert (condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`)
}

function recordResult (id, severity, description, passed, detail = '') {
  results.push({ id, severity, description, passed, detail })
  const icon = passed ? '✅ PASS' : '❌ FAIL'
  console.log(`  ${icon} [${severity}] ${id}: ${description}`)
  if (!passed && detail) console.log(`         → ${detail}`)
}

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

/** Logs in via browser form and returns the JWT token stored in localStorage */
async function loginAndSetup () {
  await page.goto(FRONTEND_URL + '/', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', LOGIN_EMAIL)
  await page.fill('input[type="password"]', LOGIN_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(`${FRONTEND_URL}/home`, { timeout: TIMEOUT_MS })
  const token = await page.evaluate(() => localStorage.getItem('token'))
  assert(token, 'Token não encontrado no localStorage após login')
  return token
}

/** Creates a task via API and returns its id */
async function createTaskViaApi (token, title, description = 'Descrição E2E') {
  const res = await fetch(`${BACKEND_URL}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ title, description, status: 'pending' })
  })
  assert(res.ok, `Falha ao criar tarefa via API: HTTP ${res.status}`)
  const body = await res.json()
  assert(body.id, `Tarefa criada sem id: ${JSON.stringify(body)}`)
  return body.id
}

/** Deletes a task via API */
async function deleteTaskViaApi (token, id) {
  await fetch(`${BACKEND_URL}/tasks/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// TF-E2E-1: Guard — /tasks/create sem token redireciona para "/"
// ─────────────────────────────────────────────────────────────────────────────
async function testTF1_CreateRouteGuard () {
  try {
    // Criar contexto limpo sem token
    const { chromium } = _require(PLAYWRIGHT_PATH)
    const cleanBrowser  = await chromium.launch({ headless: true })
    const cleanContext  = await cleanBrowser.newContext()
    const cleanPage     = await cleanContext.newPage()
    cleanPage.setDefaultTimeout(TIMEOUT_MS)

    await cleanPage.goto(`${FRONTEND_URL}/tasks/create`, { waitUntil: 'networkidle' })
    const url = cleanPage.url()
    await cleanBrowser.close()

    assert(
      url === `${FRONTEND_URL}/` || url.startsWith(`${FRONTEND_URL}/?`),
      `Esperava redirect para "/", mas URL é: ${url}`
    )
    recordResult('TF-E2E-1', 'P1', 'Guard: /tasks/create sem token redireciona para "/"', true)
  } catch (err) {
    recordResult('TF-E2E-1', 'P1', 'Guard: /tasks/create sem token redireciona para "/"', false, err.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TF-E2E-2: Guard — /tasks/:id/edit sem token redireciona para "/"
// ─────────────────────────────────────────────────────────────────────────────
async function testTF2_EditRouteGuard () {
  try {
    const { chromium } = _require(PLAYWRIGHT_PATH)
    const cleanBrowser  = await chromium.launch({ headless: true })
    const cleanContext  = await cleanBrowser.newContext()
    const cleanPage     = await cleanContext.newPage()
    cleanPage.setDefaultTimeout(TIMEOUT_MS)

    await cleanPage.goto(`${FRONTEND_URL}/tasks/42/edit`, { waitUntil: 'networkidle' })
    const url = cleanPage.url()
    await cleanBrowser.close()

    assert(
      url === `${FRONTEND_URL}/` || url.startsWith(`${FRONTEND_URL}/?`),
      `Esperava redirect para "/", mas URL é: ${url}`
    )
    recordResult('TF-E2E-2', 'P1', 'Guard: /tasks/42/edit sem token redireciona para "/"', true)
  } catch (err) {
    recordResult('TF-E2E-2', 'P1', 'Guard: /tasks/42/edit sem token redireciona para "/"', false, err.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TF-E2E-3: Rota /tasks/create não é capturada por /tasks/:id
// ─────────────────────────────────────────────────────────────────────────────
async function testTF3_CreateRouteNotCapturedByIdRoute (token) {
  try {
    await page.goto(`${FRONTEND_URL}/tasks/create`, { waitUntil: 'networkidle' })
    await page.waitForURL(`${FRONTEND_URL}/tasks/create`, { timeout: TIMEOUT_MS })

    // Deve renderizar TaskForm, não TaskDetail
    // TaskDetail tem "Concluir tarefa" ou "Detalhes"; TaskForm tem inputs de formulário
    const hasFormInputs = await page.locator('input[name="title"], input[id="title"]').count()
    const url = page.url()

    assert(url.endsWith('/tasks/create'), `URL errada — esperava /tasks/create, obteve: ${url}`)
    assert(hasFormInputs > 0, `Formulário não renderizado em /tasks/create (TaskDetail pode ter capturado a rota)`)

    recordResult('TF-E2E-3', 'P1', 'Rota /tasks/create não é capturada por /tasks/:id — TaskForm renderizado', true)
  } catch (err) {
    recordResult('TF-E2E-3', 'P1', 'Rota /tasks/create não é capturada por /tasks/:id — TaskForm renderizado', false, err.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TF-E2E-4: Modo CREATE — formulário inicia vazio com status "pending"
// ─────────────────────────────────────────────────────────────────────────────
async function testTF4_CreateModeFormEmpty () {
  try {
    await page.goto(`${FRONTEND_URL}/tasks/create`, { waitUntil: 'networkidle' })
    await page.waitForURL(`${FRONTEND_URL}/tasks/create`, { timeout: TIMEOUT_MS })

    const titleValue  = await page.inputValue('input[name="title"], #title')
    const statusValue = await page.inputValue('select[name="status"], #status')

    assert(titleValue === '', `Title deveria iniciar vazio, mas tem: "${titleValue}"`)
    assert(statusValue === 'pending', `Status deveria iniciar "pending", mas tem: "${statusValue}"`)

    recordResult('TF-E2E-4', 'P1', 'Modo CREATE: formulário inicia com title="" e status="pending"', true)
  } catch (err) {
    recordResult('TF-E2E-4', 'P1', 'Modo CREATE: formulário inicia com title="" e status="pending"', false, err.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TF-E2E-5: Modo CREATE — título vazio NÃO submete
// ─────────────────────────────────────────────────────────────────────────────
async function testTF5_CreateEmptyTitleDoesNotSubmit () {
  try {
    await page.goto(`${FRONTEND_URL}/tasks/create`, { waitUntil: 'networkidle' })
    await page.waitForURL(`${FRONTEND_URL}/tasks/create`, { timeout: TIMEOUT_MS })

    // Não preenche título — submete com campo vazio
    const apiCallPromise = page.waitForRequest(
      req => req.url().includes('/tasks') && req.method() === 'POST',
      { timeout: 2000 }
    ).catch(() => null)

    await page.click('button[type="submit"]')
    const apiCall = await apiCallPromise

    const currentUrl = page.url()
    assert(apiCall === null, 'API POST /tasks foi chamada com título vazio!')
    assert(
      currentUrl.endsWith('/tasks/create'),
      `URL mudou para "${currentUrl}" — formulário com título vazio não deveria redirecionar`
    )

    recordResult('TF-E2E-5', 'P2', 'Modo CREATE: título vazio NÃO chama API e não redireciona', true)
  } catch (err) {
    recordResult('TF-E2E-5', 'P2', 'Modo CREATE: título vazio NÃO chama API e não redireciona', false, err.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TF-E2E-6: Modo CREATE — submit bem-sucedido chama POST /tasks e redireciona
// ─────────────────────────────────────────────────────────────────────────────
async function testTF6_CreateSubmitCallsPostAndRedirects () {
  const createdTaskTitle = `E2E-TF6-${Date.now()}`
  let postCalled = false
  let postPayload = null

  try {
    await page.goto(`${FRONTEND_URL}/tasks/create`, { waitUntil: 'networkidle' })
    await page.waitForURL(`${FRONTEND_URL}/tasks/create`, { timeout: TIMEOUT_MS })

    // Intercepta a request POST
    const postRequestPromise = page.waitForRequest(
      req => req.url().includes('/tasks') && req.method() === 'POST',
      { timeout: TIMEOUT_MS }
    )

    await page.fill('input[name="title"], #title', createdTaskTitle)
    await page.fill('textarea[name="description"], #description', 'Descrição criada via E2E')
    await page.click('button[type="submit"]')

    const postRequest = await postRequestPromise
    postCalled = true
    try { postPayload = JSON.parse(postRequest.postData() || '{}') } catch { postPayload = {} }

    // Deve redirecionar para /tasks
    await page.waitForURL(`${FRONTEND_URL}/tasks`, { timeout: TIMEOUT_MS })

    assert(postCalled, 'POST /tasks não foi chamado')
    assert(
      postPayload.title === createdTaskTitle,
      `Payload title errado: "${postPayload.title}" vs "${createdTaskTitle}"`
    )

    recordResult('TF-E2E-6', 'P1', 'Modo CREATE: submit chama POST /tasks com payload correto e redireciona para /tasks', true,
      `POST /tasks chamado com title="${postPayload.title}"`)
  } catch (err) {
    recordResult('TF-E2E-6', 'P1', 'Modo CREATE: submit chama POST /tasks com payload correto e redireciona para /tasks', false, err.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TF-E2E-7: Modo CREATE — botão cancelar redireciona para /tasks sem chamar API
// ─────────────────────────────────────────────────────────────────────────────
async function testTF7_CancelRedirectsWithoutApiCall () {
  try {
    await page.goto(`${FRONTEND_URL}/tasks/create`, { waitUntil: 'networkidle' })
    await page.waitForURL(`${FRONTEND_URL}/tasks/create`, { timeout: TIMEOUT_MS })

    await page.fill('input[name="title"], #title', 'Tarefa que não deve ser salva')

    // Verifica que nenhuma requisição API é feita ao cancelar
    const apiCallPromise = page.waitForRequest(
      req => (req.url().includes('/tasks') && (req.method() === 'POST' || req.method() === 'PUT')),
      { timeout: 2000 }
    ).catch(() => null)

    await page.click('button[type="button"]') // botão Cancelar
    const apiCall = await apiCallPromise

    await page.waitForURL(`${FRONTEND_URL}/tasks`, { timeout: TIMEOUT_MS })

    assert(apiCall === null, `API foi chamada ao cancelar: ${apiCall?.method()} ${apiCall?.url()}`)

    recordResult('TF-E2E-7', 'P2', 'Modo CREATE: cancelar redireciona para /tasks sem chamar API', true)
  } catch (err) {
    recordResult('TF-E2E-7', 'P2', 'Modo CREATE: cancelar redireciona para /tasks sem chamar API', false, err.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TF-E2E-8: Modo EDIT — rota /tasks/:id/edit renderiza formulário com dados pré-preenchidos
// ─────────────────────────────────────────────────────────────────────────────
async function testTF8_EditModePrefillsForm (token) {
  const testTitle = `E2E-TF8-Edit-${Date.now()}`
  let createdId = null

  try {
    // Cria uma tarefa via API para editar
    createdId = await createTaskViaApi(token, testTitle, 'Descrição original')

    await page.goto(`${FRONTEND_URL}/tasks/${createdId}/edit`, { waitUntil: 'networkidle' })
    await page.waitForURL(`${FRONTEND_URL}/tasks/${createdId}/edit`, { timeout: TIMEOUT_MS })

    // Aguarda o formulário ser preenchido (mounted() → fetchTask())
    await page.waitForFunction(
      (expectedTitle) => {
        const input = document.querySelector('input[name="title"], #title')
        return input && input.value === expectedTitle
      },
      testTitle,
      { timeout: TIMEOUT_MS }
    )

    const titleValue = await page.inputValue('input[name="title"], #title')
    const descValue  = await page.inputValue('textarea[name="description"], #description')

    assert(titleValue === testTitle, `Title não pré-preenchido: "${titleValue}" vs "${testTitle}"`)
    assert(descValue  === 'Descrição original', `Descrição não pré-preenchida: "${descValue}"`)

    recordResult('TF-E2E-8', 'P1', 'Modo EDIT: formulário pré-preenchido com dados da API', true,
      `title="${titleValue}", description="${descValue}"`)
  } catch (err) {
    recordResult('TF-E2E-8', 'P1', 'Modo EDIT: formulário pré-preenchido com dados da API', false, err.message)
  } finally {
    if (createdId) await deleteTaskViaApi(token, createdId).catch(() => {})
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TF-E2E-9: Modo EDIT — submit chama PUT /tasks/:id e redireciona para /tasks
// ─────────────────────────────────────────────────────────────────────────────
async function testTF9_EditSubmitCallsPutAndRedirects (token) {
  const originalTitle = `E2E-TF9-Original-${Date.now()}`
  const updatedTitle  = `E2E-TF9-Updated-${Date.now()}`
  let createdId = null

  try {
    createdId = await createTaskViaApi(token, originalTitle)

    await page.goto(`${FRONTEND_URL}/tasks/${createdId}/edit`, { waitUntil: 'networkidle' })
    await page.waitForURL(`${FRONTEND_URL}/tasks/${createdId}/edit`, { timeout: TIMEOUT_MS })

    // Aguarda pré-preenchimento
    await page.waitForFunction(
      (expectedTitle) => {
        const input = document.querySelector('input[name="title"], #title')
        return input && input.value === expectedTitle
      },
      originalTitle,
      { timeout: TIMEOUT_MS }
    )

    // Intercepta PUT
    const putRequestPromise = page.waitForRequest(
      req => req.url().includes(`/tasks/${createdId}`) && req.method() === 'PUT',
      { timeout: TIMEOUT_MS }
    )

    // Altera o título e submete
    await page.fill('input[name="title"], #title', updatedTitle)
    await page.click('button[type="submit"]')

    const putRequest = await putRequestPromise
    let putPayload = {}
    try { putPayload = JSON.parse(putRequest.postData() || '{}') } catch { putPayload = {} }

    await page.waitForURL(`${FRONTEND_URL}/tasks`, { timeout: TIMEOUT_MS })

    assert(putPayload.title === updatedTitle, `PUT payload title errado: "${putPayload.title}"`)

    recordResult('TF-E2E-9', 'P1', 'Modo EDIT: submit chama PUT /tasks/:id com novo título e redireciona', true,
      `PUT /tasks/${createdId} com title="${putPayload.title}"`)
  } catch (err) {
    recordResult('TF-E2E-9', 'P1', 'Modo EDIT: submit chama PUT /tasks/:id com novo título e redireciona', false, err.message)
  } finally {
    if (createdId) await deleteTaskViaApi(token, createdId).catch(() => {})
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TF-E2E-10: TaskList "Adicionar Tarefa" navega para /tasks/create
// ─────────────────────────────────────────────────────────────────────────────
async function testTF10_TaskListCreateButtonNavigates () {
  try {
    await page.goto(`${FRONTEND_URL}/tasks`, { waitUntil: 'networkidle' })
    await page.waitForURL(`${FRONTEND_URL}/tasks`, { timeout: TIMEOUT_MS })

    await page.click('button:has-text("Adicionar Tarefa")')
    await page.waitForURL(`${FRONTEND_URL}/tasks/create`, { timeout: TIMEOUT_MS })

    const url = page.url()
    assert(url.endsWith('/tasks/create'), `URL esperada /tasks/create, obtida: ${url}`)

    recordResult('TF-E2E-10', 'P1', 'TaskList: botão "Adicionar Tarefa" navega para /tasks/create', true)
  } catch (err) {
    recordResult('TF-E2E-10', 'P1', 'TaskList: botão "Adicionar Tarefa" navega para /tasks/create', false, err.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TF-E2E-11: TaskList botão "Editar" navega para /tasks/:id/edit
// ─────────────────────────────────────────────────────────────────────────────
async function testTF11_TaskListEditButtonNavigates (token) {
  let createdId = null
  try {
    createdId = await createTaskViaApi(token, `E2E-TF11-EditBtn-${Date.now()}`)

    await page.goto(`${FRONTEND_URL}/tasks`, { waitUntil: 'networkidle' })
    await page.waitForURL(`${FRONTEND_URL}/tasks`, { timeout: TIMEOUT_MS })

    // Aguarda a tarefa aparecer na tabela
    await page.waitForFunction(
      (id) => document.querySelector(`tr td:first-child`)?.textContent?.trim() !== '',
      createdId,
      { timeout: TIMEOUT_MS }
    )

    // Clica no primeiro botão Editar visível
    await page.click('button:has-text("Editar")')
    await page.waitForURL(new RegExp(`/tasks/\\d+/edit`), { timeout: TIMEOUT_MS })

    const url = page.url()
    assert(/\/tasks\/\d+\/edit$/.test(url), `URL esperada /tasks/:id/edit, obtida: ${url}`)

    recordResult('TF-E2E-11', 'P1', 'TaskList: botão "Editar" navega para /tasks/:id/edit', true, `→ ${url}`)
  } catch (err) {
    recordResult('TF-E2E-11', 'P1', 'TaskList: botão "Editar" navega para /tasks/:id/edit', false, err.message)
  } finally {
    if (createdId) await deleteTaskViaApi(token, createdId).catch(() => {})
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RUNNER PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
async function main () {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' E2E TaskForm — Criação e Edição de Tarefas (TaskForm.vue)')
  console.log(` Frontend: ${FRONTEND_URL}  |  Backend: ${BACKEND_URL}`)
  console.log('═══════════════════════════════════════════════════════════════')
  console.log()

  await setup()

  let token = null

  try {
    // Testes de guard (sem login — contextos limpos isolados)
    console.log('[FASE 1] Testes de guard de autenticação...')
    await testTF1_CreateRouteGuard()
    await testTF2_EditRouteGuard()

    // Login para os demais testes
    console.log('[FASE 2] Login e testes funcionais...')
    token = await loginAndSetup()
    console.log(`[SETUP] Token obtido: ${token.substring(0, 30)}...`)

    await testTF3_CreateRouteNotCapturedByIdRoute(token)
    await testTF4_CreateModeFormEmpty()
    await testTF5_CreateEmptyTitleDoesNotSubmit()
    await testTF6_CreateSubmitCallsPostAndRedirects()
    await testTF7_CancelRedirectsWithoutApiCall()
    await testTF8_EditModePrefillsForm(token)
    await testTF9_EditSubmitCallsPutAndRedirects(token)
    await testTF10_TaskListCreateButtonNavigates()
    await testTF11_TaskListEditButtonNavigates(token)
  } finally {
    await teardown()
  }

  // ─── Sumário ──────────────────────────────────────────────────────────────
  const total   = results.length
  const passed  = results.filter(r => r.passed).length
  const failed  = results.filter(r => !r.passed).length
  const failP1  = results.filter(r => !r.passed && r.severity === 'P1')

  console.log()
  console.log('───────────────────────────────────────────────────────────────')
  console.log(' SUMÁRIO')
  console.log('───────────────────────────────────────────────────────────────')
  console.log(` Total: ${total} | ✅ PASS: ${passed} | ❌ FAIL: ${failed}`)
  console.log(` Falhas P1 (bloqueantes): ${failP1.length}`)

  if (failP1.length > 0) {
    console.log()
    console.log(' ⛔  TESTES P1 FALHARAM:')
    failP1.forEach(r => {
      console.log(`   • ${r.id} [${r.severity}]: ${r.description}`)
      if (r.detail) console.log(`     → ${r.detail}`)
    })
  }

  console.log('═══════════════════════════════════════════════════════════════')
  const status = failP1.length > 0 ? '❌ FAIL' : (failed > 0 ? '⚠️  PARTIAL' : '✅ PASS')
  console.log(` STATUS FINAL: ${status}`)
  console.log('═══════════════════════════════════════════════════════════════')

  process.exit(failP1.length > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Erro fatal no runner E2E:', err)
  process.exit(1)
})
