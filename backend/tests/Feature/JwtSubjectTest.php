<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tymon\JWTAuth\Contracts\JWTSubject;
use Tymon\JWTAuth\Facades\JWTAuth;

/**
 * JwtSubjectTest — QA_WRITER artifact (TASK-004)
 *
 * =====================================================================
 * DEFEITO DOCUMENTADO
 * =====================================================================
 *
 * App\Models\User NÃO implementa Tymon\JWTAuth\Contracts\JWTSubject.
 *
 * AuthController::login() chama JWTAuth::attempt($credentials), que:
 *   1. Autentica o usuário via provider Eloquent (OK).
 *   2. Chama internamente $user->getJWTIdentifier() para compor o
 *      sub-claim do token JWT.
 *   3. Chama internamente $user->getJWTCustomClaims() para claims extras.
 *
 * Como User não declara esses métodos (nem implementa a interface),
 * PHP lança TypeError / BadMethodCallException em runtime.
 * O Laravel converte em HTTP 500 — o frontend Vue interpreta como falha
 * de rede/CORS, mascarando a causa real.
 *
 * =====================================================================
 * CORREÇÃO ESPERADA
 * =====================================================================
 *
 * Em app/Models/User.php:
 *   1. Adicionar `implements JWTSubject` à declaração da classe.
 *   2. Implementar getJWTIdentifier(): retorna $this->getKey() (o ID).
 *   3. Implementar getJWTCustomClaims(): retorna [] (sem claims extras).
 *
 * Exemplo mínimo:
 *
 *   use Tymon\JWTAuth\Contracts\JWTSubject;
 *
 *   class User extends Authenticatable implements JWTSubject
 *   {
 *       public function getJWTIdentifier(): mixed
 *       {
 *           return $this->getKey();
 *       }
 *
 *       public function getJWTCustomClaims(): array
 *       {
 *           return [];
 *       }
 *   }
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
 *  AC-1  User implementa Tymon\JWTAuth\Contracts\JWTSubject       [FALHA ESPERADA HOJE] P1
 *  AC-2  User::getJWTIdentifier() existe e é callable             [FALHA ESPERADA HOJE] P1
 *  AC-3  User::getJWTCustomClaims() existe e é callable           [FALHA ESPERADA HOJE] P1
 *  AC-4  getJWTIdentifier() retorna o valor de getKey()           [FALHA ESPERADA HOJE] P1
 *  AC-5  getJWTCustomClaims() retorna array vazio []              [FALHA ESPERADA HOJE] P1
 *  AC-6  POST /login com credenciais válidas retorna 200 + token  [FALHA ESPERADA HOJE] P1
 *  AC-7  O token retornado é um JWT de 3 segmentos base64url      [FALHA ESPERADA HOJE] P1
 *  AC-8  POST /login com credenciais inválidas retorna 401        [FALHA ESPERADA HOJE] P2
 *  AC-9  POST /login com credenciais inválidas NÃO retorna 500    [FALHA ESPERADA HOJE] P2
 *  AC-10 Token válido gerado no login concede acesso a GET /projects [FALHA ESPERADA HOJE] P2
 *  AC-11 [REGRESSÃO] User ainda estende Authenticatable           [REGRESSÃO] P1
 *  AC-12 [REGRESSÃO] User ainda contém fillable name/email/pass   [REGRESSÃO] P2
 *  AC-13 [REGRESSÃO] GET /projects sem token continua retornando 401 [REGRESSÃO] P1
 */
class JwtSubjectTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Configura SQLite em memória e JWT_SECRET mínimo.
     * Garante que os testes rodem sem dependência de MySQL ou .env real.
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

        // Secret mínimo para que o driver jwt-auth não lance exceção ao
        // tentar criar tokens. 64 chars = 512 bits — atende HS256/HS384/HS512.
        $app['config']->set('jwt.secret', str_repeat('QaJwtSubject9', 4) . 'xxxx');

        // Garante que o guard 'api' existe em qualquer estado do projeto —
        // estes testes focam em JWTSubject, não na configuração do guard.
        // Se o guard já estiver correto (fix TASK-003 aplicado), este set
        // é inócuo. Se ainda estiver faltando, garante que AC-10/AC-13 não
        // falhem por razão diferente da testada aqui.
        $app['config']->set('auth.guards.api', [
            'driver'   => 'jwt',
            'provider' => 'users',
        ]);
    }

    // =========================================================================
    // BLOCO A — Conformidade estrutural: interface e métodos obrigatórios
    //
    // Testes estáticos que inspecionam a classe sem banco de dados.
    // Falham instantaneamente se o contrato JWTSubject não for satisfeito.
    // =========================================================================

    /**
     * AC-1 — [FALHA ESPERADA HOJE] P1
     *
     * App\Models\User deve declarar `implements JWTSubject` ou herdar de
     * uma classe que já o faça.
     *
     * Sem essa declaração:
     *   - JWTAuth internamente faz instanceof JWTSubject → false
     *   - tymon/jwt-auth ^2.x lança TypeError ao tentar chamar getJWTIdentifier()
     *     em um objeto que não tem o método.
     *
     * Hoje: class_implements(User::class) NÃO contém JWTSubject → FAIL.
     * Após fix: contém → PASS.
     */
    public function test_user_model_implements_jwt_subject_interface(): void
    {
        $implemented = class_implements(User::class);

        $this->assertContains(
            JWTSubject::class,
            $implemented,
            "App\\Models\\User NÃO implementa Tymon\\JWTAuth\\Contracts\\JWTSubject. "
                . "Adicione `implements JWTSubject` à declaração da classe e implemente "
                . "os métodos getJWTIdentifier() e getJWTCustomClaims(). "
                . "Sem isso, JWTAuth::attempt() lança TypeError em runtime ao tentar "
                . "gerar o token JWT, resultando em HTTP 500 no POST /login."
        );
    }

    /**
     * AC-2 — [FALHA ESPERADA HOJE] P1
     *
     * O método getJWTIdentifier() deve existir em App\Models\User
     * (declarado diretamente ou herdado via interface + trait).
     *
     * Verificação via Reflection — não depende de instância persistida.
     */
    public function test_user_model_has_get_jwt_identifier_method(): void
    {
        $this->assertTrue(
            method_exists(User::class, 'getJWTIdentifier'),
            "App\\Models\\User NÃO possui o método getJWTIdentifier(). "
                . "Este método é exigido por Tymon\\JWTAuth\\Contracts\\JWTSubject. "
                . "Implemente: public function getJWTIdentifier(): mixed { return \$this->getKey(); }"
        );
    }

    /**
     * AC-3 — [FALHA ESPERADA HOJE] P1
     *
     * O método getJWTCustomClaims() deve existir em App\Models\User.
     * Retorna um array associativo de claims extras a incluir no payload JWT.
     * A implementação padrão (sem claims extras) é retornar [].
     */
    public function test_user_model_has_get_jwt_custom_claims_method(): void
    {
        $this->assertTrue(
            method_exists(User::class, 'getJWTCustomClaims'),
            "App\\Models\\User NÃO possui o método getJWTCustomClaims(). "
                . "Este método é exigido por Tymon\\JWTAuth\\Contracts\\JWTSubject. "
                . "Implemente: public function getJWTCustomClaims(): array { return []; }"
        );
    }

    // =========================================================================
    // BLOCO B — Comportamento dos métodos: valores retornados
    //
    // Instancia um User persistido e verifica os valores de retorno.
    // Falham se os métodos existirem mas retornarem valores incorretos.
    // =========================================================================

    /**
     * AC-4 — [FALHA ESPERADA HOJE] P1
     *
     * getJWTIdentifier() deve retornar o mesmo valor que getKey() —
     * que é o valor da chave primária do model (campo 'id', inteiro
     * auto-incremento neste projeto).
     *
     * Este é o valor que o tymon/jwt-auth coloca no claim 'sub' do JWT.
     * Se retornar null, string vazia ou outro valor, o sub-claim fica
     * inválido e tokens não poderão ser verificados corretamente.
     */
    public function test_get_jwt_identifier_returns_model_primary_key(): void
    {
        $user = User::factory()->create();

        if (!method_exists($user, 'getJWTIdentifier')) {
            $this->fail(
                "Método getJWTIdentifier() não existe em User. "
                    . "Corrija AC-2 antes de validar AC-4."
            );
        }

        $identifier = $user->getJWTIdentifier();
        $expected   = $user->getKey();

        $this->assertNotNull(
            $identifier,
            "getJWTIdentifier() retornou null. "
                . "Deve retornar \$this->getKey() (o ID do usuário: {$expected})."
        );

        $this->assertEquals(
            $expected,
            $identifier,
            "getJWTIdentifier() retornou '{$identifier}', "
                . "mas getKey() retorna '{$expected}'. "
                . "A implementação correta é: return \$this->getKey();"
        );
    }

    /**
     * AC-5 — [FALHA ESPERADA HOJE] P1
     *
     * getJWTCustomClaims() deve retornar um array vazio [].
     *
     * Este projeto não utiliza claims customizadas — qualquer outro
     * retorno (null, false, objeto) causaria erro no payload do JWT.
     */
    public function test_get_jwt_custom_claims_returns_empty_array(): void
    {
        $user = User::factory()->create();

        if (!method_exists($user, 'getJWTCustomClaims')) {
            $this->fail(
                "Método getJWTCustomClaims() não existe em User. "
                    . "Corrija AC-3 antes de validar AC-5."
            );
        }

        $claims = $user->getJWTCustomClaims();

        $this->assertIsArray(
            $claims,
            "getJWTCustomClaims() deve retornar um array. "
                . "Retornou: " . gettype($claims) . ". "
                . "Implementação esperada: return [];"
        );

        $this->assertEmpty(
            $claims,
            "getJWTCustomClaims() deve retornar [] (array vazio) para este projeto. "
                . "Retornou: " . json_encode($claims) . ". "
                . "Claims customizadas só são necessárias se o sistema exigir "
                . "dados extras no payload JWT."
        );
    }

    // =========================================================================
    // BLOCO C — End-to-end: fluxo de login gera token JWT válido
    //
    // Testes de integração completos: requisição HTTP real ao POST /login.
    // Dependem dos Blocos A e B estarem corretos — se User não implementa
    // JWTSubject, o JWTAuth::attempt() lança TypeError → HTTP 500 → FAIL aqui.
    // =========================================================================

    /**
     * AC-6 — [FALHA ESPERADA HOJE] P1
     *
     * POST /login com credenciais válidas deve retornar:
     *   - HTTP 200 OK
     *   - JSON com chave 'token'
     *
     * Hoje: JWTAuth::attempt() chama getJWTIdentifier() em User →
     *       TypeError (método não existe) → HTTP 500 → FAIL.
     * Após fix: User implementa JWTSubject → token gerado → 200 + token.
     */
    public function test_login_with_valid_credentials_returns_200_with_token(): void
    {
        $plainPassword = 'SenhaQaTeste123!';

        $user = User::factory()->create([
            'email'    => 'qa.jwt@example.com',
            'password' => bcrypt($plainPassword),
        ]);

        $response = $this
            ->withHeaders(['Accept' => 'application/json'])
            ->post('/login', [
                'email'    => $user->email,
                'password' => $plainPassword,
            ]);

        $this->assertNotEquals(
            500,
            $response->getStatusCode(),
            "POST /login retornou HTTP 500 com credenciais válidas. "
                . "Causa mais provável: User NÃO implementa JWTSubject → "
                . "JWTAuth::attempt() lança TypeError ao chamar getJWTIdentifier(). "
                . "Corpo da resposta: " . substr((string) $response->getContent(), 0, 300)
        );

        $response->assertStatus(
            200,
            "POST /login com credenciais válidas deve retornar 200 OK. "
                . "Status recebido: {$response->getStatusCode()}. "
                . "Corpo: " . substr((string) $response->getContent(), 0, 300)
        );

        $response->assertJsonStructure(['token']);

        $this->assertNotNull(
            $response->json('token'),
            "A chave 'token' na resposta não deve ser null."
        );

        $this->assertNotEmpty(
            $response->json('token'),
            "A chave 'token' na resposta não deve ser string vazia."
        );
    }

    /**
     * AC-7 — [FALHA ESPERADA HOJE] P1
     *
     * O token retornado pelo login deve ter o formato JWT canônico:
     * três segmentos base64url separados por ponto (header.payload.signature).
     *
     * Valida que o JWTAuth de fato gerou um token real, não uma string
     * aleatória ou um objeto serializado por engano.
     *
     * Hoje: login falha com 500 → token nunca retornado → FAIL.
     * Após fix: token gerado tem exatamente 3 segmentos → PASS.
     */
    public function test_login_token_has_valid_jwt_format_three_segments(): void
    {
        $plainPassword = 'SenhaQaJwt456@';

        $user = User::factory()->create([
            'email'    => 'qa.jwt.format@example.com',
            'password' => bcrypt($plainPassword),
        ]);

        $response = $this
            ->withHeaders(['Accept' => 'application/json'])
            ->post('/login', [
                'email'    => $user->email,
                'password' => $plainPassword,
            ]);

        if ($response->getStatusCode() !== 200) {
            $this->fail(
                "POST /login retornou {$response->getStatusCode()} — não chegou a gerar token. "
                    . "Corpo: " . substr((string) $response->getContent(), 0, 300)
            );
        }

        $token = $response->json('token');

        $this->assertNotNull($token, "Campo 'token' ausente ou null na resposta do login.");

        $segments = explode('.', (string) $token);

        $this->assertCount(
            3,
            $segments,
            "O token JWT deve ter exatamente 3 segmentos separados por '.'. "
                . "Token recebido: '{$token}'. "
                . "Segmentos encontrados: " . count($segments) . ". "
                . "Formato esperado: header.payload.signature (base64url)."
        );

        // Valida que cada segmento é base64url não-vazio
        foreach ($segments as $index => $segment) {
            $this->assertNotEmpty(
                $segment,
                "Segmento {$index} do JWT está vazio. Token: '{$token}'."
            );

            $this->assertMatchesRegularExpression(
                '/^[A-Za-z0-9\-_]+$/',
                $segment,
                "Segmento {$index} do JWT contém caracteres inválidos para base64url. "
                    . "Segmento: '{$segment}'."
            );
        }
    }

    /**
     * AC-8 — [FALHA ESPERADA HOJE] P2
     *
     * POST /login com credenciais inválidas (senha errada) deve retornar
     * HTTP 401 Unauthorized — nunca 500.
     *
     * Hoje: o erro acontece antes mesmo de checar as credenciais (TypeError),
     * resultando em 500. Após o fix do JWTSubject, credenciais erradas →
     * JWTAuth::attempt() retorna false → AuthController retorna 401.
     */
    public function test_login_with_invalid_credentials_returns_401(): void
    {
        $user = User::factory()->create([
            'email'    => 'qa.invalid@example.com',
            'password' => bcrypt('senha_correta_secreta'),
        ]);

        $response = $this
            ->withHeaders(['Accept' => 'application/json'])
            ->post('/login', [
                'email'    => $user->email,
                'password' => 'senha_ERRADA',
            ]);

        $this->assertNotEquals(
            500,
            $response->getStatusCode(),
            "POST /login com senha errada retornou 500. "
                . "Após o fix de JWTSubject, credenciais inválidas devem resultar "
                . "em 401 (JWTAuth::attempt retorna false), não 500 (TypeError). "
                . "Corpo: " . substr((string) $response->getContent(), 0, 300)
        );

        $response->assertStatus(
            401,
            "POST /login com senha inválida deve retornar 401 Unauthorized. "
                . "Status recebido: {$response->getStatusCode()}."
        );
    }

    /**
     * AC-9 — [FALHA ESPERADA HOJE] P2
     *
     * Complemento de AC-8: o corpo da resposta de credenciais inválidas
     * deve ser JSON com chave 'error', nunca HTML de exceção.
     *
     * Confirma que a rota é tratada graciosamente pelo controller
     * (return response()->json(['error' => 'Invalid credentials'], 401)).
     */
    public function test_login_with_invalid_credentials_returns_json_error(): void
    {
        $user = User::factory()->create([
            'email'    => 'qa.json.error@example.com',
            'password' => bcrypt('correct_pass'),
        ]);

        $response = $this
            ->withHeaders(['Accept' => 'application/json'])
            ->post('/login', [
                'email'    => $user->email,
                'password' => 'wrong_pass',
            ]);

        if ($response->getStatusCode() === 500) {
            $this->fail(
                "POST /login retornou 500 — JWTSubject provavelmente não implementado. "
                    . "Corrija AC-1 a AC-5 primeiro."
            );
        }

        $decoded = json_decode((string) $response->getContent(), true);

        $this->assertNotNull(
            $decoded,
            "A resposta de POST /login com credenciais inválidas deve ser JSON válido. "
                . "Corpo recebido: " . substr((string) $response->getContent(), 0, 200)
        );

        $this->assertArrayHasKey(
            'error',
            $decoded,
            "O JSON de resposta para credenciais inválidas deve conter a chave 'error'. "
                . "JSON recebido: " . json_encode($decoded)
        );
    }

    /**
     * AC-10 — [FALHA ESPERADA HOJE] P2
     *
     * Um token JWT gerado via POST /login deve ser aceito pelo guard 'api'
     * no header Authorization: Bearer {token} ao acessar GET /projects.
     *
     * Fluxo completo:
     *   1. Cria usuário
     *   2. Faz login → obtém token
     *   3. Usa o token em GET /projects → deve retornar 200
     *
     * Hoje: falha na etapa 2 (500 por TypeError). Após o fix: 200 OK.
     */
    public function test_token_from_login_grants_access_to_protected_route(): void
    {
        $plainPassword = 'SenhaAcessoRota789#';

        $user = User::factory()->create([
            'email'    => 'qa.access@example.com',
            'password' => bcrypt($plainPassword),
        ]);

        // Etapa 1: obter token via login
        $loginResponse = $this
            ->withHeaders(['Accept' => 'application/json'])
            ->post('/login', [
                'email'    => $user->email,
                'password' => $plainPassword,
            ]);

        if ($loginResponse->getStatusCode() !== 200) {
            $this->fail(
                "POST /login retornou {$loginResponse->getStatusCode()} — "
                    . "não foi possível obter token para testar acesso a /projects. "
                    . "Corpo: " . substr((string) $loginResponse->getContent(), 0, 300)
            );
        }

        $token = $loginResponse->json('token');

        $this->assertNotNull($token, "Token ausente na resposta do login.");

        // Etapa 2: usar token em rota protegida
        $response = $this
            ->withHeaders([
                'Accept'        => 'application/json',
                'Authorization' => "Bearer {$token}",
            ])
            ->get('/projects');

        $this->assertNotEquals(
            401,
            $response->getStatusCode(),
            "GET /projects com token válido retornou 401. "
                . "O token emitido pelo login deve ser aceito pelo guard 'api'. "
                . "Corpo: " . substr((string) $response->getContent(), 0, 300)
        );

        $this->assertNotEquals(
            500,
            $response->getStatusCode(),
            "GET /projects com token válido retornou 500. "
                . "Corpo: " . substr((string) $response->getContent(), 0, 300)
        );

        $response->assertStatus(
            200,
            "GET /projects com Bearer token válido deve retornar 200 OK. "
                . "Status recebido: {$response->getStatusCode()}."
        );
    }

    // =========================================================================
    // BLOCO D — Regressão
    //
    // Testes que verificam que o fix (adicionar JWTSubject ao User)
    // não quebra contratos existentes do model nem proteções de rota.
    // Devem PASSAR antes e depois do fix.
    // =========================================================================

    /**
     * AC-11 — [REGRESSÃO] P1
     *
     * App\Models\User deve continuar estendendo Authenticatable após o fix.
     * O fix é ADITIVO: adiciona a interface JWTSubject sem remover a herança.
     *
     * Se alguém trocar a herança por engano, o sistema de autenticação
     * padrão do Laravel para de funcionar.
     */
    public function test_regression_user_still_extends_authenticatable(): void
    {
        $this->assertTrue(
            is_a(User::class, \Illuminate\Foundation\Auth\User::class, true),
            "App\\Models\\User não estende mais Illuminate\\Foundation\\Auth\\User "
                . "(Authenticatable). O fix deve APENAS adicionar a interface JWTSubject, "
                . "sem alterar a herança existente."
        );
    }

    /**
     * AC-12 — [REGRESSÃO] P2
     *
     * A propriedade $fillable de User deve continuar contendo
     * name, email e password após o fix.
     *
     * Garante que o mass-assignment em AuthController::register() continua
     * funcionando corretamente após a modificação do model.
     */
    public function test_regression_user_fillable_contains_required_fields(): void
    {
        $user = new User();
        $fillable = $user->getFillable();

        foreach (['name', 'email', 'password'] as $field) {
            $this->assertContains(
                $field,
                $fillable,
                "O campo '{$field}' foi removido do \$fillable de User. "
                    . "O fix do JWTSubject não deve alterar os campos fillable."
            );
        }
    }

    /**
     * AC-13 — [REGRESSÃO] P1
     *
     * GET /projects sem Authorization header deve continuar retornando 401
     * (não 200, não 500) após o fix.
     *
     * O fix não deve tornar as rotas protegidas públicas. A proteção pelo
     * guard 'api' deve permanecer intacta.
     */
    public function test_regression_protected_route_still_requires_token(): void
    {
        $response = $this
            ->withHeaders(['Accept' => 'application/json'])
            ->get('/projects');

        $this->assertNotEquals(
            200,
            $response->getStatusCode(),
            "GET /projects sem token retornou 200 após o fix. "
                . "A rota /projects deve permanecer protegida por auth:api. "
                . "O fix de JWTSubject não deve remover o middleware de autenticação."
        );

        $this->assertNotEquals(
            500,
            $response->getStatusCode(),
            "GET /projects sem token retornou 500. "
                . "Com guard 'api' configurado e JWTSubject implementado, "
                . "ausência de token deve resultar em 401, não em exceção não tratada. "
                . "Corpo: " . substr((string) $response->getContent(), 0, 200)
        );

        $response->assertStatus(
            401,
            "GET /projects sem token deve retornar 401 Unauthorized. "
                . "Status recebido: {$response->getStatusCode()}."
        );
    }
}
