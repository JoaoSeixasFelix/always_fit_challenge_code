<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Support\Facades\Route;

/**
 * ApiRoutesGroupTest — QA_WRITER artifact (TASK-002)
 *
 * =====================================================================
 * DEFEITO DOCUMENTADO
 * =====================================================================
 *
 * routes/web.php registra Route::apiResource para projects, tasks,
 * comments e notifications dentro de Route::middleware('auth:api')->group().
 * Como esse group está em web.php, o Laravel aplica AUTOMATICAMENTE o grupo
 * de middleware 'web', que inclui:
 *
 *   - EncryptCookies
 *   - AddQueuedCookiesToResponse
 *   - StartSession
 *   - ShareErrorsFromSession
 *   - VerifyCsrfToken          ← CAUSA RAIZ DO 419
 *   - SubstituteBindings
 *
 * O Vue SPA (front-end separado, rodando em http://localhost:3000) NUNCA
 * envia cookie CSRF — browsers não incluem cookies de sessão em
 * requisições cross-origin a menos que o servidor defina explicitamente
 * esse cookie via Set-Cookie. Como o SPA não faz a handshake CSRF, todo
 * POST/PUT/PATCH/DELETE chega sem o token CSRF e o Laravel retorna:
 *
 *   HTTP 419 Page Expired — CSRF token mismatch.
 *
 * GET é livre de CSRF (VerifyCsrfToken só bloqueia métodos mutantes),
 * por isso GET /projects funciona em desenvolvimento mas POST /projects
 * falha com 419.
 *
 * =====================================================================
 * CORREÇÃO ESPERADA
 * =====================================================================
 *
 * Mover os quatro Route::apiResource() de routes/web.php para
 * routes/api.php, que já está registrado em bootstrap/app.php sob
 * Route::middleware('api') — grupo que NÃO inclui VerifyCsrfToken.
 *
 * =====================================================================
 * LEGENDA DOS TESTES
 * =====================================================================
 *
 *  [FALHA ESPERADA HOJE]  — deve FALHAR antes do fix, PASSAR após.
 *  [REGRESSÃO]            — deve PASSAR hoje e continuar passando após fix.
 *
 * =====================================================================
 * MAPA DE CRITÉRIOS DE ACEITE
 * =====================================================================
 *
 *  AC-1  Rota POST /projects não tem grupo 'web' na pilha de middleware
 *  AC-2  Rota POST /tasks não tem grupo 'web' na pilha de middleware
 *  AC-3  Rota POST /comments não tem grupo 'web' na pilha de middleware
 *  AC-4  Rota POST /notifications não tem grupo 'web' na pilha de middleware
 *  AC-5  POST /projects sem token CSRF retorna ≠ 419
 *  AC-6  PUT /projects/{id} sem token CSRF retorna ≠ 419
 *  AC-7  DELETE /projects/{id} sem token CSRF retorna ≠ 419
 *  AC-8  POST /tasks sem token CSRF retorna ≠ 419
 *  AC-9  POST /comments sem token CSRF retorna ≠ 419
 *  AC-10 POST /notifications sem token CSRF retorna ≠ 419
 *  AC-11 auth:api ainda presente na pilha de middleware dos recursos
 *  AC-12 [REGRESSÃO] GET /test continua respondendo 200
 *  AC-13 [REGRESSÃO] POST /login continua sem grupo 'web' (não regride)
 *  AC-14 [REGRESSÃO] GET /projects sem auth retorna não-200 (rota protegida)
 *  AC-15 [REGRESSÃO] Rota GET /projects existe e é acessível (não some no fix)
 */
class ApiRoutesGroupTest extends TestCase
{
    // =========================================================================
    // BLOCO A — Inspeção de middleware (rota não deve estar no grupo 'web')
    //
    // gatherMiddleware() retorna a lista completa resolvida da rota.
    // Rotas em web.php: contêm 'web' → VerifyCsrfToken ativo.
    // Rotas em api.php: contêm 'api' → sem CSRF.
    // =========================================================================

    /**
     * AC-1 — [FALHA ESPERADA HOJE]
     *
     * A rota POST /projects está em routes/web.php.
     * gatherMiddleware() incluirá 'web', que contém VerifyCsrfToken.
     * Após fix (mover para routes/api.php) o grupo 'web' não aparece.
     */
    public function test_projects_store_route_is_not_in_web_middleware_group(): void
    {
        $route = collect(Route::getRoutes()->getRoutes())->first(
            fn ($r) => $r->uri() === 'projects' && in_array('POST', $r->methods(), true)
        );

        $this->assertNotNull(
            $route,
            'Deve existir uma rota POST /projects registrada.'
        );

        $middleware = $route->gatherMiddleware();

        $this->assertNotContains(
            'web',
            $middleware,
            'POST /projects NÃO deve usar o grupo de middleware "web". '
            . 'O grupo "web" inclui VerifyCsrfToken, que rejeita toda requisição '
            . 'POST/PUT/PATCH/DELETE vinda do Vue SPA (sem cookie CSRF) com '
            . '419 Page Expired. Corrija movendo apiResource("projects") '
            . 'para routes/api.php.'
        );
    }

    /**
     * AC-2 — [FALHA ESPERADA HOJE]
     *
     * A rota POST /tasks está em routes/web.php → grupo 'web' → CSRF ativo.
     */
    public function test_tasks_store_route_is_not_in_web_middleware_group(): void
    {
        $route = collect(Route::getRoutes()->getRoutes())->first(
            fn ($r) => $r->uri() === 'tasks' && in_array('POST', $r->methods(), true)
        );

        $this->assertNotNull(
            $route,
            'Deve existir uma rota POST /tasks registrada.'
        );

        $middleware = $route->gatherMiddleware();

        $this->assertNotContains(
            'web',
            $middleware,
            'POST /tasks NÃO deve usar o grupo de middleware "web" (inclui CSRF). '
            . 'Mova apiResource("tasks") para routes/api.php.'
        );
    }

    /**
     * AC-3 — [FALHA ESPERADA HOJE]
     *
     * A rota POST /comments está em routes/web.php → grupo 'web' → CSRF ativo.
     */
    public function test_comments_store_route_is_not_in_web_middleware_group(): void
    {
        $route = collect(Route::getRoutes()->getRoutes())->first(
            fn ($r) => $r->uri() === 'comments' && in_array('POST', $r->methods(), true)
        );

        $this->assertNotNull(
            $route,
            'Deve existir uma rota POST /comments registrada.'
        );

        $middleware = $route->gatherMiddleware();

        $this->assertNotContains(
            'web',
            $middleware,
            'POST /comments NÃO deve usar o grupo de middleware "web" (inclui CSRF). '
            . 'Mova apiResource("comments") para routes/api.php.'
        );
    }

    /**
     * AC-4 — [FALHA ESPERADA HOJE]
     *
     * A rota POST /notifications está em routes/web.php → grupo 'web' → CSRF ativo.
     */
    public function test_notifications_store_route_is_not_in_web_middleware_group(): void
    {
        $route = collect(Route::getRoutes()->getRoutes())->first(
            fn ($r) => $r->uri() === 'notifications' && in_array('POST', $r->methods(), true)
        );

        $this->assertNotNull(
            $route,
            'Deve existir uma rota POST /notifications registrada.'
        );

        $middleware = $route->gatherMiddleware();

        $this->assertNotContains(
            'web',
            $middleware,
            'POST /notifications NÃO deve usar o grupo de middleware "web" (inclui CSRF). '
            . 'Mova apiResource("notifications") para routes/api.php.'
        );
    }

    // =========================================================================
    // BLOCO B — Verificação de CSRF real em requisições HTTP (sem bypass de testes)
    //
    // Em PHPUnit, VerifyCsrfToken::runningUnitTests() retorna true e bypassa
    // a verificação de CSRF automaticamente — por isso os testes "passam" mesmo
    // com rotas em web.php. Para reproduzir o comportamento real do browser,
    // sobrescrevemos runningUnitTests() para sempre retornar false.
    //
    // Comportamento esperado após fix:
    //   POST /projects sem CSRF → auth:api verifica token JWT → 401 Unauthorized
    //                                                (não 419 CSRF mismatch)
    // =========================================================================

    /**
     * Remove o bypass automático de CSRF do ambiente de testes, forçando a
     * execução real do VerifyCsrfToken — equivalente ao comportamento do browser.
     */
    private function disableCsrfTestBypass(): void
    {
        $this->app->bind(
            \Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class,
            function ($app) {
                return new class($app) extends \Illuminate\Foundation\Http\Middleware\VerifyCsrfToken {
                    /**
                     * Sobrescreve o bypass automático de testes.
                     * Retornar false faz o middleware validar o token CSRF normalmente,
                     * simulando o comportamento real de um browser ou cliente HTTP.
                     */
                    protected function runningUnitTests(): bool
                    {
                        return false;
                    }
                };
            }
        );
    }

    /**
     * AC-5 — [FALHA ESPERADA HOJE]
     *
     * POST /projects sem cookie/header CSRF retorna 419 enquanto a rota
     * estiver em routes/web.php.
     * Após fix (mover para routes/api.php, middleware 'api'), deve retornar
     * qualquer código que NÃO seja 419 — tipicamente 401 (sem token JWT).
     */
    public function test_post_projects_without_csrf_token_does_not_return_419(): void
    {
        $this->disableCsrfTestBypass();

        $response = $this
            ->withHeaders([
                'Origin' => 'http://localhost:3000',
                'Accept' => 'application/json',
                // Intencionalmente SEM X-CSRF-TOKEN e SEM cookie de sessão.
                // Isso simula qualquer requisição Ajax/Axios do Vue SPA.
            ])
            ->post('/projects', [
                'name'        => 'Test Project',
                'description' => 'Created by QA test',
            ]);

        $this->assertNotEquals(
            419,
            $response->getStatusCode(),
            'POST /projects NÃO deve retornar 419 (CSRF token mismatch). '
            . 'O Vue SPA nunca envia cookie CSRF — 419 significa que '
            . 'VerifyCsrfToken está ativo na rota, o que só acontece quando '
            . 'ela está em routes/web.php. Mova para routes/api.php.'
        );
    }

    /**
     * AC-6 — [FALHA ESPERADA HOJE]
     *
     * PUT /projects/{id} sem CSRF retorna 419 enquanto a rota estiver em web.php.
     * O método PUT é mutante → VerifyCsrfToken o bloqueia.
     */
    public function test_put_projects_without_csrf_token_does_not_return_419(): void
    {
        $this->disableCsrfTestBypass();

        $response = $this
            ->withHeaders([
                'Origin' => 'http://localhost:3000',
                'Accept' => 'application/json',
            ])
            ->put('/projects/1', [
                'name'        => 'Updated Project',
                'description' => 'Updated by QA test',
            ]);

        $this->assertNotEquals(
            419,
            $response->getStatusCode(),
            'PUT /projects/{id} NÃO deve retornar 419 (CSRF). '
            . 'Rota deve estar em routes/api.php (sem VerifyCsrfToken).'
        );
    }

    /**
     * AC-7 — [FALHA ESPERADA HOJE]
     *
     * DELETE /projects/{id} sem CSRF retorna 419 enquanto a rota estiver em web.php.
     */
    public function test_delete_projects_without_csrf_token_does_not_return_419(): void
    {
        $this->disableCsrfTestBypass();

        $response = $this
            ->withHeaders([
                'Origin' => 'http://localhost:3000',
                'Accept' => 'application/json',
            ])
            ->delete('/projects/1');

        $this->assertNotEquals(
            419,
            $response->getStatusCode(),
            'DELETE /projects/{id} NÃO deve retornar 419 (CSRF). '
            . 'Rota deve estar em routes/api.php (sem VerifyCsrfToken).'
        );
    }

    /**
     * AC-8 — [FALHA ESPERADA HOJE]
     *
     * POST /tasks sem CSRF: mesmo problema de grupo 'web' → 419.
     */
    public function test_post_tasks_without_csrf_token_does_not_return_419(): void
    {
        $this->disableCsrfTestBypass();

        $response = $this
            ->withHeaders([
                'Origin' => 'http://localhost:3000',
                'Accept' => 'application/json',
            ])
            ->post('/tasks', [
                'title'      => 'Test Task',
                'project_id' => 1,
            ]);

        $this->assertNotEquals(
            419,
            $response->getStatusCode(),
            'POST /tasks NÃO deve retornar 419 (CSRF). '
            . 'Mova apiResource("tasks") para routes/api.php.'
        );
    }

    /**
     * AC-9 — [FALHA ESPERADA HOJE]
     *
     * POST /comments sem CSRF: mesmo problema → 419.
     */
    public function test_post_comments_without_csrf_token_does_not_return_419(): void
    {
        $this->disableCsrfTestBypass();

        $response = $this
            ->withHeaders([
                'Origin' => 'http://localhost:3000',
                'Accept' => 'application/json',
            ])
            ->post('/comments', [
                'content' => 'QA test comment',
                'task_id' => 1,
            ]);

        $this->assertNotEquals(
            419,
            $response->getStatusCode(),
            'POST /comments NÃO deve retornar 419 (CSRF). '
            . 'Mova apiResource("comments") para routes/api.php.'
        );
    }

    /**
     * AC-10 — [FALHA ESPERADA HOJE]
     *
     * POST /notifications sem CSRF: mesmo problema → 419.
     */
    public function test_post_notifications_without_csrf_token_does_not_return_419(): void
    {
        $this->disableCsrfTestBypass();

        $response = $this
            ->withHeaders([
                'Origin' => 'http://localhost:3000',
                'Accept' => 'application/json',
            ])
            ->post('/notifications', [
                'message' => 'QA test notification',
                'user_id' => 1,
            ]);

        $this->assertNotEquals(
            419,
            $response->getStatusCode(),
            'POST /notifications NÃO deve retornar 419 (CSRF). '
            . 'Mova apiResource("notifications") para routes/api.php.'
        );
    }

    // =========================================================================
    // BLOCO C — Proteção auth:api não pode sumir após o fix
    //
    // Ao mover as rotas para api.php, o SWE pode acidentalmente remover o
    // Route::middleware('auth:api')->group(). Esses testes garantem que
    // auth:api permanece na pilha de middleware de todos os recursos.
    // =========================================================================

    /**
     * AC-11 — [FALHA ESPERADA HOJE + deve PASSAR após fix]
     *
     * Verifica que 'auth:api' está na pilha de middleware de TODOS os
     * apiResource registrados. O fix não pode remover a proteção de
     * autenticação enquanto conserta o problema de CSRF.
     *
     * Hoje este teste FALHA: rotas em web.php → gatherMiddleware() inclui
     * 'web' mas pode não incluir 'auth:api' dependendo da resolução.
     * Após fix correto: deve incluir 'auth:api' e NÃO incluir 'web'.
     */
    public function test_all_resource_routes_retain_auth_api_middleware_after_fix(): void
    {
        $resources = ['projects', 'tasks', 'comments', 'notifications'];

        foreach ($resources as $resource) {
            // Verifica a rota POST (store) — mais crítica por criar recursos
            $route = collect(Route::getRoutes()->getRoutes())->first(
                fn ($r) => $r->uri() === $resource && in_array('POST', $r->methods(), true)
            );

            $this->assertNotNull(
                $route,
                "Deve existir uma rota POST /{$resource} registrada."
            );

            $middleware = $route->gatherMiddleware();

            $this->assertContains(
                'auth:api',
                $middleware,
                "POST /{$resource} DEVE manter o middleware 'auth:api' após o fix. "
                . "O fix correto move a rota para routes/api.php preservando o "
                . "Route::middleware('auth:api')->group() ao redor dos apiResource."
            );
        }
    }

    /**
     * AC-11 (complemento) — GET /projects sem token JWT deve retornar não-200.
     *
     * Prova que a rota ainda é protegida em runtime (não apenas na pilha de middleware).
     * Sem token Bearer, o guard auth:api deve negar o acesso.
     * 200 aqui significa que a proteção foi removida acidentalmente — bloqueante.
     */
    public function test_get_projects_without_jwt_token_does_not_return_200(): void
    {
        $response = $this
            ->withHeaders([
                'Origin' => 'http://localhost:3000',
                'Accept' => 'application/json',
                // Intencionalmente SEM Authorization: Bearer <token>
            ])
            ->get('/projects');

        $this->assertNotEquals(
            200,
            $response->getStatusCode(),
            'GET /projects sem token JWT NÃO deve retornar 200. '
            . 'A rota deve permanecer protegida por auth:api após o fix. '
            . 'Se retornar 200, significa que o middleware auth:api foi removido acidentalmente.'
        );
    }

    // =========================================================================
    // BLOCO D — Regressão
    //
    // Rotas adjacentes que devem continuar funcionando exatamente como antes.
    // Um fix que quebra as regressões abaixo não pode ser aceito.
    // =========================================================================

    /**
     * AC-12 — [REGRESSÃO]
     *
     * GET /test está em routes/web.php e não deve ser afetado pelo fix.
     * Deve continuar respondendo 200 com o texto correto.
     */
    public function test_regression_get_test_route_still_returns_200(): void
    {
        $response = $this->get('/test');

        $response->assertStatus(200);
    }

    /**
     * AC-12 — [REGRESSÃO]
     *
     * O conteúdo de GET /test não deve mudar (contém a string "API route is working!").
     */
    public function test_regression_get_test_route_returns_expected_content(): void
    {
        $response = $this->get('/test');

        $response->assertSeeText('API route is working!');
    }

    /**
     * AC-13 — [REGRESSÃO]
     *
     * POST /login já estava em routes/api.php (corrigido na TASK-001).
     * O fix da TASK-002 não deve mover /login de volta para web.php nem
     * adicionar o grupo 'web' à sua pilha.
     */
    public function test_regression_login_route_stays_outside_web_middleware_group(): void
    {
        $route = collect(Route::getRoutes()->getRoutes())->first(
            fn ($r) => $r->uri() === 'login' && in_array('POST', $r->methods(), true)
        );

        $this->assertNotNull(
            $route,
            'Deve existir uma rota POST /login registrada.'
        );

        $middleware = $route->gatherMiddleware();

        $this->assertNotContains(
            'web',
            $middleware,
            'POST /login não deve regridir para o grupo "web" após o fix da TASK-002.'
        );
    }

    /**
     * AC-13 — [REGRESSÃO]
     *
     * POST /register já estava em routes/api.php (corrigido na TASK-001).
     * Não deve regridir para web.php após o fix da TASK-002.
     */
    public function test_regression_register_route_stays_outside_web_middleware_group(): void
    {
        $route = collect(Route::getRoutes()->getRoutes())->first(
            fn ($r) => $r->uri() === 'register' && in_array('POST', $r->methods(), true)
        );

        $this->assertNotNull(
            $route,
            'Deve existir uma rota POST /register registrada.'
        );

        $middleware = $route->gatherMiddleware();

        $this->assertNotContains(
            'web',
            $middleware,
            'POST /register não deve regridir para o grupo "web" após o fix da TASK-002.'
        );
    }

    /**
     * AC-14 — [REGRESSÃO]
     *
     * GET /projects deve EXISTIR após o fix (a rota não pode desaparecer).
     * O SWE pode acidentalmente remover o apiResource inteiro em vez de mover.
     */
    public function test_regression_get_projects_route_still_exists_after_fix(): void
    {
        $route = collect(Route::getRoutes()->getRoutes())->first(
            fn ($r) => $r->uri() === 'projects' && in_array('GET', $r->methods(), true)
        );

        $this->assertNotNull(
            $route,
            'Rota GET /projects deve continuar existindo após o fix. '
            . 'O fix apenas move as rotas de web.php para api.php, '
            . 'sem remover nenhuma rota.'
        );
    }

    /**
     * AC-15 — [REGRESSÃO]
     *
     * Todos os quatro recursos (projects, tasks, comments, notifications)
     * devem continuar registrados após o fix — o SWE não pode remover nenhum.
     */
    public function test_regression_all_four_resource_routes_still_exist_after_fix(): void
    {
        $resources = ['projects', 'tasks', 'comments', 'notifications'];

        foreach ($resources as $resource) {
            // Verifica GET (index) e POST (store) para cada recurso
            foreach (['GET', 'POST'] as $method) {
                $uri = $resource;

                $route = collect(Route::getRoutes()->getRoutes())->first(
                    fn ($r) => $r->uri() === $uri && in_array($method, $r->methods(), true)
                );

                $this->assertNotNull(
                    $route,
                    "{$method} /{$resource} deve existir após o fix. "
                    . 'O fix move as rotas de web.php para api.php, não as remove.'
                );
            }
        }
    }
}
