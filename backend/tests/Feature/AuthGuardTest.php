<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;

/**
 * AuthGuardTest — QA_WRITER artifact (TASK-003)
 *
 * =====================================================================
 * DEFEITO DOCUMENTADO
 * =====================================================================
 *
 * config/auth.php NÃO define o guard 'api' com driver 'jwt'.
 * A seção 'guards' contém apenas:
 *
 *   'guards' => [
 *       'web' => ['driver' => 'session', 'provider' => 'users'],
 *   ],
 *
 * routes/api.php usa Route::middleware('auth:api')->group() cobrindo
 * os recursos: projects, tasks, comments, notifications.
 *
 * Consequência: qualquer requisição a essas rotas dispara:
 *
 *   InvalidArgumentException: Auth guard [api] is not defined
 *   → Convertida pelo Laravel em HTTP 500 Internal Server Error
 *
 * O frontend Vue SPA recebe 500 com corpo HTML de exceção.
 * O browser interpreta como falha de CORS (resposta não-JSON com erro
 * de servidor), mascarando a causa raiz.
 *
 * =====================================================================
 * CORREÇÃO ESPERADA
 * =====================================================================
 *
 * Adicionar em config/auth.php, dentro de 'guards':
 *
 *   'api' => [
 *       'driver'   => 'jwt',
 *       'provider' => 'users',
 *   ],
 *
 * E garantir que JWT_SECRET esteja presente no .env
 * (via: php artisan jwt:secret).
 *
 * =====================================================================
 * LEGENDA DOS TESTES
 * =====================================================================
 *
 *  [FALHA ESPERADA HOJE]  — FALHA antes do fix, PASSA após.
 *  [REGRESSÃO]            — PASSA hoje e deve continuar passando após fix.
 *
 * =====================================================================
 * MAPA DE CRITÉRIOS DE ACEITE
 * =====================================================================
 *
 *  AC-1  Guard 'api' existe em config/auth.php  [FALHA ESPERADA HOJE]
 *  AC-2  Guard 'api' usa driver 'jwt'            [FALHA ESPERADA HOJE]
 *  AC-3  Guard 'api' referencia provider 'users' [FALHA ESPERADA HOJE]
 *  AC-4  GET /projects sem token → 401 (não 500) [FALHA ESPERADA HOJE]
 *  AC-5  GET /projects sem token → corpo JSON    [FALHA ESPERADA HOJE]
 *  AC-6  GET /projects com Bearer malformado → 401 [FALHA ESPERADA HOJE]
 *  AC-7  GET /projects com JWT assinatura errada → 401 [FALHA ESPERADA HOJE]
 *  AC-8  Usuário autenticado via guard 'api' acessa /projects → 200 [FALHA ESPERADA HOJE]
 *  AC-9  [REGRESSÃO] Guard 'web' não é removido pelo fix
 *  AC-10 [REGRESSÃO] POST /login continua público (não exige token)
 *  AC-11 [REGRESSÃO] POST /register continua público
 *  AC-12 [REGRESSÃO] auth:api permanece na pilha de middleware dos recursos
 */
class AuthGuardTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Configura banco SQLite em memória e JWT_SECRET mínimo.
     * Executado antes do boot da aplicação — garante que RefreshDatabase
     * use SQLite sem precisar de MySQL/PostgreSQL disponível.
     */
    protected function getEnvironmentSetUp($app): void
    {
        $app['config']->set('database.default', 'sqlite');
        $app['config']->set('database.connections.sqlite', [
            'driver'                  => 'sqlite',
            'database'                => ':memory:',
            'prefix'                  => '',
            'foreign_key_constraints' => true,
        ]);

        // Secret mínimo para que o driver jwt não lance exceção ao inicializar.
        // 64 chars = 512 bits — atende HS256/HS384/HS512 do tymon/jwt-auth.
        $app['config']->set('jwt.secret', str_repeat('QaTestSecret', 5) . 'xxxx');
    }

    // =========================================================================
    // BLOCO A — Inspeção de configuração do guard 'api'
    //
    // Estes testes inspecionam config/auth.php diretamente via config().
    // Não fazem requisições HTTP — falham instantaneamente se a chave estiver
    // ausente, apontando exatamente o que o SWE precisa adicionar.
    // =========================================================================

    /**
     * AC-1 — [FALHA ESPERADA HOJE]
     *
     * config/auth.php não contém a chave 'api' em 'guards'.
     * Resultado atual: assertArrayHasKey falha.
     * Resultado esperado após fix: chave 'api' presente.
     */
    public function test_api_guard_key_exists_in_auth_config(): void
    {
        $guards = config('auth.guards');

        $this->assertArrayHasKey(
            'api',
            $guards,
            "config/auth.php NÃO define o guard 'api'. "
                . "Adicione dentro de 'guards': "
                . "'api' => ['driver' => 'jwt', 'provider' => 'users']. "
                . "Sem essa entrada, Route::middleware('auth:api') lança "
                . "InvalidArgumentException: Auth guard [api] is not defined → HTTP 500."
        );
    }

    /**
     * AC-2 — [FALHA ESPERADA HOJE]
     *
     * Mesmo que a chave 'api' existisse com driver errado (ex: 'session'),
     * o JWT não funcionaria. Este teste garante que o driver é exatamente 'jwt'.
     */
    public function test_api_guard_driver_is_jwt(): void
    {
        $guards = config('auth.guards');

        if (!array_key_exists('api', $guards)) {
            $this->fail(
                "Guard 'api' ausente em config/auth.php — impossível validar o driver. "
                    . "Corrija AC-1 primeiro: adicione 'api' => ['driver' => 'jwt', 'provider' => 'users']."
            );
        }

        $this->assertEquals(
            'jwt',
            $guards['api']['driver'] ?? null,
            "Guard 'api' existe mas usa driver incorreto. "
                . "Esperado: 'jwt' (tymon/jwt-auth). "
                . "Corrija: 'api' => ['driver' => 'jwt', 'provider' => 'users']."
        );
    }

    /**
     * AC-3 — [FALHA ESPERADA HOJE]
     *
     * O guard 'api' deve referenciar o provider 'users' para que o driver
     * jwt saiba de qual tabela/model carregar o usuário autenticado.
     */
    public function test_api_guard_references_users_provider(): void
    {
        $guards = config('auth.guards');

        if (!array_key_exists('api', $guards)) {
            $this->fail(
                "Guard 'api' ausente em config/auth.php — impossível validar o provider."
            );
        }

        $this->assertEquals(
            'users',
            $guards['api']['provider'] ?? null,
            "Guard 'api' deve referenciar o provider 'users'. "
                . "Corrija: 'api' => ['driver' => 'jwt', 'provider' => 'users']."
        );
    }

    // =========================================================================
    // BLOCO B — Comportamento HTTP: sem token → 401, não 500
    //
    // Requisições reais às rotas protegidas.
    // Hoje: guard 'api' não existe → InvalidArgumentException → HTTP 500.
    // Após fix: guard resolve, JWT ausente → HTTP 401 Unauthorized.
    // =========================================================================

    /**
     * AC-4 — [FALHA ESPERADA HOJE]
     *
     * GET /projects sem header Authorization retorna 500 hoje
     * (InvalidArgumentException: Auth guard [api] is not defined).
     * Após fix, o guard JWT identifica ausência de token e responde 401.
     */
    public function test_get_projects_without_authorization_header_returns_401(): void
    {
        $response = $this
            ->withHeaders(['Accept' => 'application/json'])
            ->get('/projects');

        $this->assertNotEquals(
            500,
            $response->getStatusCode(),
            "GET /projects sem Authorization retornou HTTP 500. "
                . "Causa: guard 'api' não existe em config/auth.php → "
                . "InvalidArgumentException: Auth guard [api] is not defined. "
                . "Adicione o guard 'api' com driver 'jwt' para que a ausência "
                . "de token resulte em 401, não em exceção não tratada."
        );

        $response->assertStatus(
            401,
            "GET /projects sem token deve retornar 401 Unauthorized. "
                . "O guard JWT deve negar acesso graciosamente quando não há token."
        );
    }

    /**
     * AC-5 — [FALHA ESPERADA HOJE]
     *
     * A resposta de /projects sem token deve ser JSON válido.
     * Hoje retorna HTML da página de exceção do Laravel (500).
     * Após fix: JSON {"message": "Unauthenticated."} com status 401.
     */
    public function test_get_projects_without_token_response_body_is_json(): void
    {
        $response = $this
            ->withHeaders(['Accept' => 'application/json'])
            ->get('/projects');

        $this->assertNotEquals(
            500,
            $response->getStatusCode(),
            "GET /projects retornou 500 — guard 'api' não configurado."
        );

        $content = $response->getContent();

        $this->assertNotFalse(
            json_decode($content),
            "A resposta de GET /projects sem token deve ser JSON válido, "
                . "não uma página HTML de exceção. "
                . "Corpo recebido: " . substr((string) $content, 0, 200)
        );
    }

    // =========================================================================
    // BLOCO C — Comportamento HTTP: token inválido → 401
    //
    // Garantia de que o driver JWT rejeita tokens malformados/assinatura errada
    // com 401, sem deixar vazar exceção como 500.
    // =========================================================================

    /**
     * AC-6 — [FALHA ESPERADA HOJE]
     *
     * Bearer token completamente malformado (não é JWT) deve resultar em 401.
     * Hoje resulta em 500 porque o guard nem chega a tentar validar o token —
     * a exceção é lançada antes, ao tentar resolver o guard inexistente.
     */
    public function test_get_projects_with_malformed_bearer_token_returns_401(): void
    {
        $response = $this
            ->withHeaders([
                'Accept'        => 'application/json',
                'Authorization' => 'Bearer isto.nao.e.um.jwt.valido',
            ])
            ->get('/projects');

        $this->assertNotEquals(
            500,
            $response->getStatusCode(),
            "GET /projects com token Bearer malformado retornou 500. "
                . "Com guard 'api' configurado, o driver JWT deve rejeitar "
                . "tokens inválidos com 401, não lançar exceção não tratada."
        );

        $response->assertStatus(
            401,
            "GET /projects com token Bearer malformado deve retornar 401. "
                . "O driver JWT deve tratar tokens inválidos graciosamente."
        );
    }

    /**
     * AC-7 — [FALHA ESPERADA HOJE]
     *
     * JWT com estrutura válida (3 segmentos base64) mas assinatura incorreta
     * deve ser rejeitado com 401 — nunca 500.
     *
     * Este token tem header/payload reais mas a assinatura é fake,
     * garantindo que a falha é de verificação, não de parsing.
     */
    public function test_get_projects_with_jwt_wrong_signature_returns_401(): void
    {
        // Header: {"alg":"HS256","typ":"JWT"}
        // Payload: {"sub":"999","iat":1700000000,"exp":9999999999}
        // Signature: inválida (não bate com nenhum secret)
        $fakeJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
            . '.eyJzdWIiOiI5OTkiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6OTk5OTk5OTk5OX0'
            . '.INVALID_SIGNATURE_QA_TEST_DO_NOT_TRUST';

        $response = $this
            ->withHeaders([
                'Accept'        => 'application/json',
                'Authorization' => "Bearer {$fakeJwt}",
            ])
            ->get('/projects');

        $this->assertNotEquals(
            500,
            $response->getStatusCode(),
            "GET /projects com JWT de assinatura inválida retornou 500. "
                . "Com guard 'api' configurado, assinaturas incorretas devem "
                . "resultar em 401, não em exceção não tratada."
        );

        $response->assertStatus(401);
    }

    // =========================================================================
    // BLOCO D — Comportamento HTTP: usuário autenticado passa pelo guard
    //
    // actingAs($user, 'api') injeta o usuário diretamente no guard sem passar
    // pelo fluxo JWT real — isola o teste à configuração do guard.
    //
    // Hoje: actingAs($user, 'api') lança InvalidArgumentException porque o
    //       guard 'api' não existe.
    // Após fix: guard 'api' resolve, usuário autenticado, controller executado.
    // =========================================================================

    /**
     * AC-8 — [FALHA ESPERADA HOJE]
     *
     * actingAs($user, 'api') com guard corretamente configurado deve permitir
     * que a requisição chegue ao ProjectController::index() e retorne 200.
     *
     * Hoje lança: InvalidArgumentException: Auth guard [api] is not defined
     * Após fix: 200 OK com JSON (lista vazia de projects no banco de teste).
     */
    public function test_authenticated_user_via_api_guard_reaches_controller(): void
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user, 'api')
            ->withHeaders(['Accept' => 'application/json'])
            ->get('/projects');

        // Não deve ser 500 — guard não configurado é a causa mais comum
        $this->assertNotEquals(
            500,
            $response->getStatusCode(),
            "GET /projects com usuário autenticado retornou 500. "
                . "Causa mais provável: guard 'api' ausente em config/auth.php → "
                . "InvalidArgumentException: Auth guard [api] is not defined. "
                . "Com o guard configurado, actingAs() injeta o usuário sem JWT "
                . "e o controller deve ser alcançado normalmente."
        );

        // Não deve ser 401 — usuário está autenticado
        $this->assertNotEquals(
            401,
            $response->getStatusCode(),
            "GET /projects com usuário autenticado via guard 'api' retornou 401. "
                . "actingAs() deve injetar o usuário no guard sem exigir token JWT."
        );

        // Deve chegar ao controller e retornar 200
        $response->assertStatus(
            200,
            "GET /projects com usuário autenticado via guard 'api' deve retornar 200 OK. "
                . "O controller ProjectController::index() deve ser alcançado e retornar "
                . "a lista de projects (vazia em ambiente de teste)."
        );
    }

    /**
     * AC-8 (complemento) — A resposta de /projects com usuário autenticado
     * deve ser um array JSON (lista de projects), possivelmente vazio.
     */
    public function test_authenticated_user_gets_json_array_from_projects(): void
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user, 'api')
            ->withHeaders(['Accept' => 'application/json'])
            ->get('/projects');

        if ($response->getStatusCode() !== 200) {
            $this->fail(
                "GET /projects com usuário autenticado não retornou 200. "
                    . "Status: {$response->getStatusCode()}. "
                    . "Corpo: " . substr((string) $response->getContent(), 0, 300)
            );
        }

        $body = json_decode($response->getContent(), true);

        $this->assertIsArray(
            $body,
            "O corpo de GET /projects deve ser um array JSON. "
                . "Recebido: " . substr((string) $response->getContent(), 0, 200)
        );
    }

    // =========================================================================
    // BLOCO E — Regressão
    //
    // Testes que PASSAM hoje e devem continuar passando após o fix.
    // O fix adiciona 'api' em config/auth.php sem quebrar nada existente.
    // =========================================================================

    /**
     * AC-9 — [REGRESSÃO]
     *
     * O guard 'web' (padrão do Laravel) não deve ser removido pelo fix.
     * O fix é ADITIVO: adiciona 'api', não remove 'web'.
     */
    public function test_regression_web_guard_is_preserved_after_fix(): void
    {
        $this->assertArrayHasKey(
            'web',
            config('auth.guards'),
            "Guard 'web' foi removido acidentalmente. "
                . "O fix deve APENAS adicionar o guard 'api'; "
                . "o guard 'web' (session) é necessário para rotas web normais."
        );

        $this->assertEquals(
            'session',
            config('auth.guards.web.driver'),
            "Driver do guard 'web' foi alterado. Deve permanecer 'session'."
        );
    }

    /**
     * AC-10 — [REGRESSÃO]
     *
     * POST /login é rota pública — não exige autenticação.
     * O fix não deve acidentalmente protegê-la com auth:api.
     */
    public function test_regression_login_route_is_publicly_accessible_without_token(): void
    {
        $response = $this
            ->withHeaders(['Accept' => 'application/json'])
            ->post('/login', [
                'email'    => 'inexistente@example.com',
                'password' => 'senha_errada_qa',
            ]);

        // Não deve ser 500 (exceção de guard)
        $this->assertNotEquals(
            500,
            $response->getStatusCode(),
            "POST /login retornou 500 após o fix — rota pública não deve lançar exceção."
        );

        // Credenciais inválidas → 401 ou dados ausentes → 422
        $this->assertContains(
            $response->getStatusCode(),
            [401, 422, 400],
            "POST /login com credenciais inválidas deve retornar 401/422. "
                . "Recebido: {$response->getStatusCode()}."
        );
    }

    /**
     * AC-11 — [REGRESSÃO]
     *
     * POST /register é rota pública — não exige token.
     * Dados inválidos devem resultar em 422 (validação), não 500.
     */
    public function test_regression_register_route_is_publicly_accessible_without_token(): void
    {
        $response = $this
            ->withHeaders(['Accept' => 'application/json'])
            ->post('/register', []); // body vazio → 422 validation

        $this->assertNotEquals(
            500,
            $response->getStatusCode(),
            "POST /register retornou 500 — rota pública não deve lançar exceção."
        );

        $this->assertContains(
            $response->getStatusCode(),
            [401, 422, 400],
            "POST /register com body vazio deve retornar 422 (validação). "
                . "Recebido: {$response->getStatusCode()}."
        );
    }

    /**
     * AC-12 — [REGRESSÃO]
     *
     * O middleware 'auth:api' deve permanecer na pilha de todos os recursos.
     * O fix ADICIONA o guard — não deve remover a proteção existente.
     */
    public function test_regression_auth_api_middleware_remains_on_all_resource_routes(): void
    {
        $resources = ['projects', 'tasks', 'comments', 'notifications'];

        foreach ($resources as $resource) {
            // Verifica GET (index) — rota mais básica de cada resource
            $route = collect(Route::getRoutes()->getRoutes())->first(
                fn ($r) => $r->uri() === $resource && in_array('GET', $r->methods(), true)
            );

            $this->assertNotNull(
                $route,
                "Rota GET /{$resource} desapareceu após o fix. "
                    . "O fix não deve remover nem reorganizar as rotas de recursos."
            );

            $middleware = $route->gatherMiddleware();

            $this->assertContains(
                'auth:api',
                $middleware,
                "GET /{$resource} perdeu o middleware 'auth:api' após o fix. "
                    . "O guard 'api' deve ser ADICIONADO em config/auth.php, "
                    . "não removendo o Route::middleware('auth:api')->group() de routes/api.php."
            );
        }
    }
}
