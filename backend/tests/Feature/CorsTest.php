<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use App\Http\Middleware\CorsMiddleware;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * CorsTest — QA_WRITER artifact
 *
 * Cobre os defeitos identificados no setup CORS deste projeto:
 *
 *  BUG-1  CorsMiddleware não emite o header Access-Control-Allow-Credentials: true.
 *         Sem esse header o browser REJEITA qualquer resposta a requisições com
 *         withCredentials: true, mesmo que Access-Control-Allow-Origin esteja correto.
 *
 *  BUG-2  CorsMiddleware não trata preflight OPTIONS: repassa a requisição ao $next
 *         normalmente. Rotas não possuem handler OPTIONS → 404/405 no preflight →
 *         o browser bloqueia a requisição real antes mesmo de enviá-la.
 *
 *  BUG-3  As rotas POST /login e POST /register estão em routes/web.php, que aplica
 *         o grupo de middleware 'web' (inclui VerifyCsrfToken). Requisições
 *         cross-origin vindas do Vue SPA não possuem cookie CSRF → 419 Page Expired.
 *         O ambiente de testes bypassa o CSRF automaticamente; o browser real NÃO.
 *
 *  BUG-4  App\Http\Kernel.php é código morto no Laravel 11. O bootstrap/app.php usa
 *         a nova API fluente (->withMiddleware(fn(){})). O Kernel.php customizado NUNCA
 *         é carregado → CorsMiddleware registrado nele NUNCA é executado em produção.
 *         O CORS ativo é EXCLUSIVAMENTE o de config/cors.php via HandleCors do framework.
 *
 * Os testes que FALHAM hoje estão marcados com [FALHA ESPERADA HOJE].
 * Os testes de regressão que PASSAM hoje estão marcados com [REGRESSÃO].
 */
class CorsTest extends TestCase
{
    use RefreshDatabase;

    private const ALLOWED_ORIGIN    = 'http://localhost:3000';
    private const DISALLOWED_ORIGIN = 'http://evil.com:9999';

    // =========================================================================
    // Grupo 1 — Comportamento do HandleCors (config/cors.php)
    // Estes testes validam o mecanismo CORS realmente ativo no projeto (Laravel 11
    // usa HandleCors global via fruitcake/php-cors + config/cors.php).
    // Devem PASSAR hoje e continuar passando após qualquer fix.  [REGRESSÃO]
    // =========================================================================

    /**
     * AC-1 — Preflight OPTIONS de origem permitida recebe 200 com ACAO header.
     * [REGRESSÃO] — HandleCors responde OPTIONS antes do roteamento.
     */
    public function test_options_preflight_from_allowed_origin_returns_200_with_acao_header(): void
    {
        $response = $this
            ->withHeaders([
                'Origin'                         => self::ALLOWED_ORIGIN,
                'Access-Control-Request-Method'  => 'POST',
                'Access-Control-Request-Headers' => 'Content-Type, Authorization',
            ])
            ->options('/login');

        $response->assertStatus(200);
        $response->assertHeader('Access-Control-Allow-Origin', self::ALLOWED_ORIGIN);
    }

    /**
     * AC-2 — Requisição GET de origem permitida recebe Access-Control-Allow-Origin.
     * [REGRESSÃO]
     */
    public function test_get_from_allowed_origin_receives_access_control_allow_origin_header(): void
    {
        $response = $this
            ->withHeaders(['Origin' => self::ALLOWED_ORIGIN])
            ->get('/test');

        $response->assertStatus(200);
        $response->assertHeader('Access-Control-Allow-Origin', self::ALLOWED_ORIGIN);
    }

    /**
     * AC-2 — Requisição GET de origem permitida recebe Access-Control-Allow-Credentials: true.
     * Exigido pelo browser quando Axios usa withCredentials: true.
     * [REGRESSÃO] — config/cors.php já tem supports_credentials: true.
     */
    public function test_get_from_allowed_origin_receives_access_control_allow_credentials_true(): void
    {
        $response = $this
            ->withHeaders(['Origin' => self::ALLOWED_ORIGIN])
            ->get('/test');

        $response->assertHeader('Access-Control-Allow-Credentials', 'true');
    }

    /**
     * AC-2 — Preflight OPTIONS recebe Access-Control-Allow-Credentials: true.
     * [REGRESSÃO] — Sem esse header no preflight o browser bloqueia a requisição real.
     */
    public function test_options_preflight_receives_access_control_allow_credentials_true(): void
    {
        $response = $this
            ->withHeaders([
                'Origin'                         => self::ALLOWED_ORIGIN,
                'Access-Control-Request-Method'  => 'POST',
                'Access-Control-Request-Headers' => 'Content-Type, Authorization',
            ])
            ->options('/login');

        $response->assertHeader('Access-Control-Allow-Credentials', 'true');
    }

    /**
     * AC-8 — Preflight OPTIONS indica que POST é permitido em Access-Control-Allow-Methods.
     * [REGRESSÃO] — Login e Register são POST; sem isso o browser bloqueia.
     */
    public function test_options_preflight_allows_post_method(): void
    {
        $response = $this
            ->withHeaders([
                'Origin'                        => self::ALLOWED_ORIGIN,
                'Access-Control-Request-Method' => 'POST',
            ])
            ->options('/login');

        $allowedMethods = strtoupper((string) $response->headers->get('Access-Control-Allow-Methods', ''));

        $this->assertTrue(
            str_contains($allowedMethods, 'POST') || $allowedMethods === '*',
            "Access-Control-Allow-Methods deve incluir POST (recebido: '{$allowedMethods}')"
        );
    }

    /**
     * AC-7 — Origem não-permitida NÃO recebe seu próprio valor em ACAO.
     * [REGRESSÃO] — Garante que a whitelist está sendo respeitada.
     */
    public function test_disallowed_origin_does_not_receive_cors_access(): void
    {
        $response = $this
            ->withHeaders(['Origin' => self::DISALLOWED_ORIGIN])
            ->get('/test');

        $this->assertNotEquals(
            self::DISALLOWED_ORIGIN,
            $response->headers->get('Access-Control-Allow-Origin'),
            'Uma origem não-permitida jamais deve receber seu valor em Access-Control-Allow-Origin.'
        );
    }

    // =========================================================================
    // Grupo 2 — Classe CorsMiddleware (comportamento da implementação customizada)
    //
    // Mesmo sendo código morto no Laravel 11 (BUG-4), a classe CorsMiddleware
    // contém defeitos que devem ser corrigidos antes de ser promovida a middleware
    // ativo (caso o SWE opte por utilizá-la via bootstrap/app.php em vez de
    // confiar somente no HandleCors).
    // =========================================================================

    /**
     * AC-5 — [FALHA ESPERADA HOJE] BUG-1
     * CorsMiddleware::handle() não adiciona 'Access-Control-Allow-Credentials: true'.
     * Enquanto esse header estiver ausente, QUALQUER resposta a requisições com
     * withCredentials: true será rejeitada pelo browser — mesmo que ACAO esteja correto.
     */
    public function test_cors_middleware_adds_access_control_allow_credentials_header(): void
    {
        $middleware = new CorsMiddleware();

        $request = Request::create('/login', 'POST');
        $request->headers->set('Origin', self::ALLOWED_ORIGIN);

        $result = $middleware->handle($request, fn () => new Response('OK', 200));

        $this->assertEquals(
            'true',
            $result->headers->get('Access-Control-Allow-Credentials'),
            'CorsMiddleware DEVE emitir "Access-Control-Allow-Credentials: true" para que '
            . 'o browser aceite respostas de requisições com withCredentials: true (Axios).'
        );
    }

    /**
     * AC-4 — [FALHA ESPERADA HOJE] BUG-2
     * CorsMiddleware::handle() repassa requisições OPTIONS ao $next em vez de
     * retornar imediatamente com a resposta de preflight.
     * Consequência: o $next chega ao roteador → 404/405 (sem handler OPTIONS) →
     * browser recusa a requisição real → erro de CORS visível na console.
     */
    public function test_cors_middleware_short_circuits_options_preflight_without_calling_next(): void
    {
        $middleware   = new CorsMiddleware();
        $nextWasCalled = false;

        $request = Request::create('/login', 'OPTIONS');
        $request->headers->set('Origin', self::ALLOWED_ORIGIN);
        $request->headers->set('Access-Control-Request-Method', 'POST');
        $request->headers->set('Access-Control-Request-Headers', 'Content-Type, Authorization');

        $result = $middleware->handle($request, function () use (&$nextWasCalled) {
            $nextWasCalled = true;
            return new Response('handler de rota NÃO deve ser chamado no preflight', 200);
        });

        $this->assertEquals(
            200,
            $result->getStatusCode(),
            'Resposta OPTIONS preflight deve ser HTTP 200.'
        );

        $this->assertFalse(
            $nextWasCalled,
            'CorsMiddleware DEVE curto-circuitar requisições OPTIONS retornando uma resposta '
            . 'diretamente, SEM chamar $next. Chamar $next no preflight repassa a requisição '
            . 'ao roteador, que não tem handler OPTIONS → 404/405 → falha de CORS.'
        );

        $this->assertEquals(
            self::ALLOWED_ORIGIN,
            $result->headers->get('Access-Control-Allow-Origin'),
            'A resposta OPTIONS preflight deve conter Access-Control-Allow-Origin.'
        );
    }

    /**
     * AC-4 — [FALHA ESPERADA HOJE] BUG-2 (complemento)
     * A resposta preflight do CorsMiddleware também deve incluir
     * Access-Control-Allow-Credentials: true para origens permitidas.
     */
    public function test_cors_middleware_options_response_includes_credentials_header(): void
    {
        $middleware = new CorsMiddleware();

        $request = Request::create('/login', 'OPTIONS');
        $request->headers->set('Origin', self::ALLOWED_ORIGIN);
        $request->headers->set('Access-Control-Request-Method', 'POST');

        $result = $middleware->handle($request, fn () => new Response('ignored', 200));

        $this->assertEquals(
            'true',
            $result->headers->get('Access-Control-Allow-Credentials'),
            'A resposta preflight do CorsMiddleware deve conter Access-Control-Allow-Credentials: true.'
        );
    }

    /**
     * AC-6 — [REGRESSÃO] CorsMiddleware reflete a origem permitida em ACAO.
     * Este comportamento já funciona hoje — deve continuar funcionando após fix.
     */
    public function test_cors_middleware_reflects_allowed_origin_in_acao_header(): void
    {
        $middleware = new CorsMiddleware();

        $request = Request::create('/test', 'GET');
        $request->headers->set('Origin', self::ALLOWED_ORIGIN);

        $result = $middleware->handle($request, fn () => new Response('OK', 200));

        $this->assertEquals(
            self::ALLOWED_ORIGIN,
            $result->headers->get('Access-Control-Allow-Origin'),
            'CorsMiddleware deve refletir a origem permitida no header Access-Control-Allow-Origin.'
        );
    }

    /**
     * AC-7 — [REGRESSÃO] CorsMiddleware não concede CORS a origens não-permitidas.
     */
    public function test_cors_middleware_does_not_grant_access_to_disallowed_origin(): void
    {
        $middleware = new CorsMiddleware();

        $request = Request::create('/test', 'GET');
        $request->headers->set('Origin', self::DISALLOWED_ORIGIN);

        $result = $middleware->handle($request, fn () => new Response('OK', 200));

        $this->assertNotEquals(
            self::DISALLOWED_ORIGIN,
            $result->headers->get('Access-Control-Allow-Origin'),
            'CorsMiddleware não deve conceder ACAO a origens fora da whitelist.'
        );
    }

    // =========================================================================
    // Grupo 3 — Posicionamento de rotas e proteção CSRF
    //
    // BUG-3: POST /login e POST /register estão em routes/web.php, que aplica
    // automaticamente o grupo 'web' (inclui VerifyCsrfToken). Em ambiente de
    // testes o CSRF é bypassado (VerifyCsrfToken::runningUnitTests()), portanto
    // o erro não aparece nos testes mas ocorre em qualquer browser real.
    // =========================================================================

    /**
     * AC-3 — [FALHA ESPERADA HOJE] BUG-3
     * POST /login não deve ter o middleware group 'web' (que inclui VerifyCsrfToken).
     * Rotas de autenticação de API devem estar em routes/api.php (grupo 'api', sem CSRF)
     * ou ter VerifyCsrfToken explicitamente excluída.
     *
     * Hoje: route está em routes/web.php → gatherMiddleware() inclui 'web'.
     * Após fix: route em routes/api.php → gatherMiddleware() NÃO inclui 'web'.
     */
    public function test_login_route_is_not_under_web_csrf_middleware_group(): void
    {
        $loginRoute = collect(Route::getRoutes()->getRoutes())->first(
            fn ($r) => $r->uri() === 'login' && in_array('POST', $r->methods())
        );

        $this->assertNotNull(
            $loginRoute,
            'Deve existir uma rota POST /login registrada.'
        );

        $middleware = $loginRoute->gatherMiddleware();

        $this->assertNotContains(
            'web',
            $middleware,
            'POST /login NÃO deve usar o grupo de middleware "web". '
            . 'O grupo "web" inclui VerifyCsrfToken, que rejeita requisições cross-origin '
            . 'do Vue SPA (sem cookie CSRF) com 419 Page Expired. '
            . 'Corrija movendo a rota para routes/api.php.'
        );
    }

    /**
     * AC-3 — [FALHA ESPERADA HOJE] BUG-3 (mesmo problema para /register)
     */
    public function test_register_route_is_not_under_web_csrf_middleware_group(): void
    {
        $registerRoute = collect(Route::getRoutes()->getRoutes())->first(
            fn ($r) => $r->uri() === 'register' && in_array('POST', $r->methods())
        );

        $this->assertNotNull(
            $registerRoute,
            'Deve existir uma rota POST /register registrada.'
        );

        $middleware = $registerRoute->gatherMiddleware();

        $this->assertNotContains(
            'web',
            $middleware,
            'POST /register NÃO deve usar o grupo de middleware "web" (inclui CSRF). '
            . 'Mova para routes/api.php.'
        );
    }

    /**
     * AC-3 — [FALHA ESPERADA HOJE] BUG-3 (verificação direta de CSRF na resposta)
     * Testa que POST /login retorna JSON de autenticação (401 credenciais inválidas),
     * NÃO uma resposta 419 de CSRF mismatch.
     *
     * NOTA: Em testes PHPUnit o VerifyCsrfToken bypassa automaticamente via
     * runningUnitTests(). Para forçar a verificação real, instanciamos a classe
     * concreta e substituímos o binding no container.
     */
    public function test_post_login_without_csrf_token_does_not_return_419(): void
    {
        // Substituir VerifyCsrfToken por uma implementação que SEMPRE valida
        // (remove o bypass automático de testes) para simular comportamento real do browser.
        $this->app->bind(
            \Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class,
            function ($app) {
                return new class($app) extends \Illuminate\Foundation\Http\Middleware\VerifyCsrfToken {
                    // Sobrescreve runningUnitTests para SEMPRE retornar false,
                    // removendo o bypass automático de testes.
                    protected function runningUnitTests(): bool
                    {
                        return false;
                    }
                };
            }
        );

        $response = $this
            ->withHeaders([
                'Origin'  => self::ALLOWED_ORIGIN,
                'Accept'  => 'application/json',
            ])
            // Intencionalmente SEM cookie/header CSRF — simula o Vue SPA real
            ->post('/login', [
                'email'    => 'test@example.com',
                'password' => 'wrongpassword',
            ]);

        $this->assertNotEquals(
            419,
            $response->getStatusCode(),
            'POST /login não deve retornar 419 (CSRF mismatch). '
            . 'Uma requisição real do Vue SPA nunca terá cookie CSRF. '
            . 'Mova a rota para routes/api.php para remover a proteção CSRF.'
        );

        // Após fix: deve retornar 401 (credenciais inválidas) ou 422 (validação)
        $this->assertContains(
            $response->getStatusCode(),
            [401, 422, 400],
            'POST /login deve retornar 401/422/400, nunca 419.'
        );
    }

    // =========================================================================
    // Grupo 4 — Testes de regressão em módulos adjacentes
    // Devem PASSAR tanto antes quanto depois de qualquer correção.
    // =========================================================================

    /**
     * AC-11 — [REGRESSÃO] GET /test continua respondendo normalmente após fix.
     */
    public function test_regression_get_test_route_works_after_cors_fix(): void
    {
        $response = $this->get('/test');
        $response->assertStatus(200);
    }

    /**
     * AC-12 — [REGRESSÃO] Rotas protegidas ainda exigem autenticação válida.
     * CORS corrigido não deve remover a proteção de auth:api das rotas privadas.
     */
    public function test_regression_protected_routes_still_require_authentication(): void
    {
        $response = $this
            ->withHeaders([
                'Origin' => self::ALLOWED_ORIGIN,
                'Accept' => 'application/json',
            ])
            ->get('/projects');

        // Sem token JWT → deve ser 401 Unauthorized, nunca 200
        $response->assertStatus(401);
    }

    /**
     * AC-12 — [REGRESSÃO] Requisições de origem não-permitida não recebem dados de
     * rotas protegidas — a camada de auth é independente da camada CORS.
     */
    public function test_regression_disallowed_origin_cannot_access_protected_routes(): void
    {
        $response = $this
            ->withHeaders([
                'Origin' => self::DISALLOWED_ORIGIN,
                'Accept' => 'application/json',
            ])
            ->get('/projects');

        // Sem auth → 401 (independente de CORS)
        $response->assertStatus(401);

        // E não deve receber o header CORS da origem inimiga
        $this->assertNotEquals(
            self::DISALLOWED_ORIGIN,
            $response->headers->get('Access-Control-Allow-Origin'),
            'Origem não-permitida jamais deve receber ACAO, mesmo que a rota retorne 401.'
        );
    }
}
