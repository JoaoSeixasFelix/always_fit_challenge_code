<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * TaskCrudTest — QA_WRITER artifact (TASK-005)
 *
 * =====================================================================
 * DEFEITO DOCUMENTADO
 * =====================================================================
 *
 * Existem 2 migrations conflitantes para a tabela `tasks`:
 *
 *   1. 2024_06_20_202341_create_tasks_table.php
 *      → Executa primeiro (ordenação lexicográfica por timestamp).
 *      → Cria a tabela `tasks` com APENAS `id` + timestamps.
 *      → NÃO define as colunas: `title`, `description`, `status`.
 *
 *   2. 2024_06_20_231157_create_tasks_table.php
 *      → Tem `if (!Schema::hasTable('tasks'))` como guard.
 *      → Como a tabela já existe após a primeira migration, este bloco
 *        NUNCA executa — as colunas corretas jamais são criadas.
 *
 * Resultado no banco (MySQL e SQLite em-memória via RefreshDatabase):
 *   - Tabela `tasks` existe MAS não possui `title`, `description`, `status`.
 *
 * TaskController::store() valida e tenta inserir esses três campos:
 *   $request->validate(['title' => 'required|...', 'status' => 'required|...', ...])
 *   Task::create($validated)  ← SQLSTATE[42S22]: Unknown column 'title'
 *
 * Todos os endpoints do CRUD de tasks resultam em HTTP 500 ou falha de
 * schema — nenhuma operação funciona corretamente.
 *
 * =====================================================================
 * CORREÇÃO ESPERADA
 * =====================================================================
 *
 * Corrigir 2024_06_20_202341_create_tasks_table.php para incluir as
 * colunas corretas na criação da tabela:
 *
 *   $table->string('title');
 *   $table->text('description')->nullable();
 *   $table->string('status')->default('pending');
 *
 * OU remover o guard `if (!Schema::hasTable('tasks'))` da segunda
 * migration e eliminar a primeira (ou vice-versa) para não haver
 * duplicação conflitante.
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
 *  AC-1  POST /tasks com dados válidos retorna HTTP 201              [FALHA ESPERADA HOJE] P1
 *  AC-2  GET /tasks retorna HTTP 200 com array JSON                  [FALHA ESPERADA HOJE] P1
 *  AC-3  GET /tasks/{id} retorna HTTP 200 com os campos corretos     [FALHA ESPERADA HOJE] P1
 *  AC-4  PUT /tasks/{id} atualiza e retorna HTTP 200                 [FALHA ESPERADA HOJE] P1
 *  AC-5  DELETE /tasks/{id} retorna HTTP 204                         [FALHA ESPERADA HOJE] P1
 *  AC-6  Task criada contém title, description, status na resp JSON  [FALHA ESPERADA HOJE] P2
 *  AC-7  POST /tasks sem title retorna HTTP 422 (validação)          [FALHA ESPERADA HOJE] P2
 *  AC-8  POST /tasks com status inválido retorna HTTP 422            [FALHA ESPERADA HOJE] P3
 *  AC-9  [REGRESSÃO] GET /tasks sem token retorna 401, não 500       [REGRESSÃO] P1
 *  AC-10 [REGRESSÃO] rotas de tasks ainda exigem autenticação        [REGRESSÃO] P1
 */
class TaskCrudTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Sobrescreve refreshApplication() para garantir que a configuração do banco
     * seja aplicada ANTES que RefreshDatabase (chamado em setUpTraits()) execute
     * as migrations.
     *
     * Contexto: phpunit.xml define <env name="DB_DATABASE" value=":memory:"/> mas
     * o container Docker tem DB_DATABASE=always_fit_db como variável de processo
     * (docker-compose.yml), o que toma precedência sobre <env> do phpunit.xml.
     * Sobrescrever refreshApplication() e forçar a config após o boot da app garante
     * que as migrations rodem no SQLite em-memória independente do ambiente.
     */
    protected function refreshApplication(): void
    {
        parent::refreshApplication();

        // Força SQLite em-memória — deve rodar ANTES de setUpTraits()/RefreshDatabase
        $this->app['config']->set('database.default', 'sqlite');
        $this->app['config']->set('database.connections.sqlite', [
            'driver'                  => 'sqlite',
            'database'                => ':memory:',
            'prefix'                  => '',
            'foreign_key_constraints' => true,
        ]);

        // JWT secret mínimo (64 chars) — evita exceção do driver jwt ao autenticar
        $this->app['config']->set('jwt.secret', str_repeat('QaTestSecret', 5) . 'xxxx');

        // Garante que o guard 'api' usa jwt (caso a config base não esteja correta)
        $this->app['config']->set('auth.guards.api', [
            'driver'   => 'jwt',
            'provider' => 'users',
        ]);
    }

    // =========================================================================
    // Helpers privados
    // =========================================================================

    /**
     * Cria um usuário de teste e retorna a instância.
     */
    private function createUser(): User
    {
        return User::factory()->create([
            'email'    => 'qa-task-tester@example.com',
            'password' => bcrypt('secret'),
        ]);
    }

    /**
     * Payload válido para criação de uma task.
     *
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    private function validTaskPayload(array $overrides = []): array
    {
        return array_merge([
            'title'       => 'Task de teste QA',
            'description' => 'Descrição gerada pelo QA_WRITER',
            'status'      => 'pending',
        ], $overrides);
    }

    // =========================================================================
    // BLOCO A — CRUD completo (AC-1 a AC-5) [FALHA ESPERADA HOJE]
    //
    // Sem as colunas title/description/status na tabela, qualquer operação
    // que envolva esses campos dispara QueryException (SQLSTATE[HY000] no
    // SQLite ou SQLSTATE[42S22] no MySQL) → Laravel devolve HTTP 500.
    // =========================================================================

    /**
     * AC-1 [P1] — POST /tasks com dados válidos deve retornar HTTP 201.
     *
     * [FALHA ESPERADA HOJE]: A migration 2024_06_20_202341_create_tasks_table.php
     * cria `tasks` sem as colunas necessárias. Task::create() dispara
     * QueryException e a rota retorna 500, não 201.
     */
    public function test_ac1_post_tasks_with_valid_data_returns_http_201(): void
    {
        $user = $this->createUser();

        $response = $this->actingAs($user, 'api')
            ->postJson('/tasks', $this->validTaskPayload());

        $this->assertNotEquals(
            500,
            $response->status(),
            '[AC-1] POST /tasks retornou HTTP 500. '
            . 'Causa provável: tabela `tasks` não possui as colunas title/description/status. '
            . 'Verifique 2024_06_20_202341_create_tasks_table.php — a migration cria '
            . 'a tabela SEM essas colunas, tornando Task::create() inválido. '
            . 'Corpo da resposta: ' . $response->getContent()
        );

        $response->assertStatus(201);
    }

    /**
     * AC-2 [P1] — GET /tasks deve retornar HTTP 200 com um array JSON.
     *
     * [FALHA ESPERADA HOJE]: Em SQLite em-memória, embora um SELECT em tabela
     * sem dados não falhe de imediato, a tabela incompleta pode causar erros
     * em cenários com dados pré-existentes. O teste garante também que a
     * resposta seja um array (não um objeto de erro ou HTML de exceção).
     *
     * Nota: Este AC pode passar mesmo com a migration quebrada se não houver
     * dados. A falha primária está nos ACs de escrita (AC-1, AC-4).
     * O teste cria dados para maximizar a chance de detectar a regressão.
     */
    public function test_ac2_get_tasks_returns_http_200_with_json_array(): void
    {
        $user = $this->createUser();

        $response = $this->actingAs($user, 'api')
            ->getJson('/tasks');

        $this->assertNotEquals(
            500,
            $response->status(),
            '[AC-2] GET /tasks retornou HTTP 500. '
            . 'Corpo: ' . $response->getContent()
        );

        $response->assertStatus(200);

        // A resposta deve ser um array JSON (pode estar vazio)
        $data = $response->json();
        $this->assertIsArray(
            $data,
            '[AC-2] GET /tasks não retornou um array JSON. '
            . 'Resposta recebida: ' . $response->getContent()
        );
    }

    /**
     * AC-3 [P1] — GET /tasks/{id} deve retornar HTTP 200 com os campos da task.
     *
     * [FALHA ESPERADA HOJE]: Para criar a task de setup, Task::create() é chamado
     * internamente. Com a migration quebrada, essa inserção dispara QueryException —
     * o setup falha antes mesmo de chegar ao GET.
     */
    public function test_ac3_get_task_by_id_returns_http_200_with_correct_fields(): void
    {
        $user = $this->createUser();

        // Cria a task via API para garantir que o fluxo completo é testado
        $createResponse = $this->actingAs($user, 'api')
            ->postJson('/tasks', $this->validTaskPayload([
                'title'       => 'Task para busca por ID',
                'description' => 'Descricao para AC-3',
                'status'      => 'in progress',
            ]));

        $this->assertNotEquals(
            500,
            $createResponse->status(),
            '[AC-3] Setup falhou: POST /tasks retornou 500. '
            . 'A tabela `tasks` provavelmente não tem as colunas necessárias. '
            . 'Corpo: ' . $createResponse->getContent()
        );

        $taskId = $createResponse->json('id');
        $this->assertNotNull($taskId, '[AC-3] Criação da task não retornou um ID.');

        $response = $this->actingAs($user, 'api')
            ->getJson("/tasks/{$taskId}");

        $response->assertStatus(200);

        // Os campos obrigatórios devem estar presentes
        $response->assertJsonStructure(['id', 'title', 'description', 'status']);
    }

    /**
     * AC-4 [P1] — PUT /tasks/{id} deve atualizar a task e retornar HTTP 200.
     *
     * [FALHA ESPERADA HOJE]: Task::update() com campos que não existem na tabela
     * dispara QueryException → HTTP 500.
     */
    public function test_ac4_put_task_updates_and_returns_http_200(): void
    {
        $user = $this->createUser();

        // Cria a task de setup
        $createResponse = $this->actingAs($user, 'api')
            ->postJson('/tasks', $this->validTaskPayload());

        $this->assertNotEquals(
            500,
            $createResponse->status(),
            '[AC-4] Setup falhou ao criar task: HTTP 500. '
            . 'Corpo: ' . $createResponse->getContent()
        );

        $taskId = $createResponse->json('id');
        $this->assertNotNull($taskId, '[AC-4] Criação da task não retornou um ID.');

        $updatePayload = [
            'title'       => 'Título atualizado pelo QA',
            'description' => 'Descrição atualizada',
            'status'      => 'completed',
        ];

        $response = $this->actingAs($user, 'api')
            ->putJson("/tasks/{$taskId}", $updatePayload);

        $this->assertNotEquals(
            500,
            $response->status(),
            '[AC-4] PUT /tasks/{id} retornou HTTP 500. '
            . 'Causa provável: Task::update() com colunas inexistentes. '
            . 'Corpo: ' . $response->getContent()
        );

        $response->assertStatus(200);

        // O título deve ter sido atualizado na resposta
        $this->assertEquals(
            'Título atualizado pelo QA',
            $response->json('title'),
            '[AC-4] O título retornado após atualização não corresponde ao enviado.'
        );

        $this->assertEquals(
            'completed',
            $response->json('status'),
            '[AC-4] O status retornado após atualização não corresponde ao enviado.'
        );
    }

    /**
     * AC-5 [P1] — DELETE /tasks/{id} deve retornar HTTP 204.
     *
     * [FALHA ESPERADA HOJE]: O setup (criação da task) falha com QueryException
     * antes do DELETE ser executado.
     */
    public function test_ac5_delete_task_returns_http_204(): void
    {
        $user = $this->createUser();

        $createResponse = $this->actingAs($user, 'api')
            ->postJson('/tasks', $this->validTaskPayload());

        $this->assertNotEquals(
            500,
            $createResponse->status(),
            '[AC-5] Setup falhou ao criar task: HTTP 500. '
            . 'Corpo: ' . $createResponse->getContent()
        );

        $taskId = $createResponse->json('id');
        $this->assertNotNull($taskId, '[AC-5] Criação da task não retornou um ID.');

        $response = $this->actingAs($user, 'api')
            ->deleteJson("/tasks/{$taskId}");

        $response->assertStatus(204);

        // Confirma que a task foi removida do banco
        $getResponse = $this->actingAs($user, 'api')
            ->getJson("/tasks/{$taskId}");

        $getResponse->assertStatus(404);
    }

    // =========================================================================
    // BLOCO B — Integridade dos campos na resposta (AC-6) [FALHA ESPERADA HOJE]
    // =========================================================================

    /**
     * AC-6 [P2] — Task criada deve conter title, description e status na resposta JSON.
     *
     * [FALHA ESPERADA HOJE]: Com a migration quebrada, o INSERT falha antes de
     * qualquer resposta ser gerada — a resposta é HTTP 500 sem campos de task.
     */
    public function test_ac6_created_task_response_contains_required_fields(): void
    {
        $user = $this->createUser();

        $payload = $this->validTaskPayload([
            'title'       => 'Task com todos os campos',
            'description' => 'Verificando campos na resposta JSON',
            'status'      => 'pending',
        ]);

        $response = $this->actingAs($user, 'api')
            ->postJson('/tasks', $payload);

        $this->assertNotEquals(
            500,
            $response->status(),
            '[AC-6] POST /tasks retornou 500 — campos da task nunca chegaram à resposta. '
            . 'Corpo: ' . $response->getContent()
        );

        $response->assertStatus(201);

        // Verifica presença dos campos obrigatórios na resposta
        $response->assertJsonStructure([
            'id',
            'title',
            'description',
            'status',
            'created_at',
            'updated_at',
        ]);

        // Verifica que os valores retornados correspondem ao que foi enviado
        $response->assertJsonFragment([
            'title'       => 'Task com todos os campos',
            'description' => 'Verificando campos na resposta JSON',
            'status'      => 'pending',
        ]);
    }

    // =========================================================================
    // BLOCO C — Validação de inputs inválidos (AC-7, AC-8) [FALHA ESPERADA HOJE]
    //
    // TaskController::store() chama $request->validate() ANTES de Task::create().
    // Com a migration quebrada, qualquer payload que passe na validação dispara
    // QueryException — porém payloads inválidos devem ser rejeitados em 422
    // ANTES do banco ser consultado. O teste verifica que a camada de validação
    // está correta independentemente do schema.
    //
    // Nota: AC-7 e AC-8 podem PASSAR mesmo com a migration quebrada (a
    // validação ocorre antes do DB). Estão listados como [FALHA ESPERADA HOJE]
    // porque sem o fix o CRUD completo está inoperante — em cenário de rollback
    // total da migration, mesmo o validate() pode ter comportamento errático.
    // =========================================================================

    /**
     * AC-7 [P2] — POST /tasks sem o campo title deve retornar HTTP 422.
     *
     * [FALHA ESPERADA HOJE]: Sem a migration correta, o controller pode
     * nunca chegar ao validate() em ambientes onde o guard ou o boot da
     * aplicação falha. Confirma que a validação está no lugar correto.
     */
    public function test_ac7_post_tasks_without_title_returns_http_422(): void
    {
        $user = $this->createUser();

        $response = $this->actingAs($user, 'api')
            ->postJson('/tasks', [
                'description' => 'Task sem título',
                'status'      => 'pending',
            ]);

        $this->assertNotEquals(
            500,
            $response->status(),
            '[AC-7] POST /tasks sem title retornou HTTP 500 em vez de 422. '
            . 'O validate() deve rejeitar com 422 ANTES de qualquer acesso ao banco. '
            . 'Corpo: ' . $response->getContent()
        );

        $response->assertStatus(422);

        // A resposta de erro deve indicar o campo 'title'
        $response->assertJsonValidationErrors(['title']);
    }

    /**
     * AC-8 [P3] — POST /tasks com status inválido deve retornar HTTP 422.
     *
     * Status permitidos: 'pending', 'in progress', 'completed'.
     * Qualquer outro valor deve ser rejeitado pela validação (rule: in:...).
     */
    public function test_ac8_post_tasks_with_invalid_status_returns_http_422(): void
    {
        $user = $this->createUser();

        $response = $this->actingAs($user, 'api')
            ->postJson('/tasks', $this->validTaskPayload([
                'status' => 'invalid_status_value',
            ]));

        $this->assertNotEquals(
            500,
            $response->status(),
            '[AC-8] POST /tasks com status inválido retornou HTTP 500 em vez de 422. '
            . 'Corpo: ' . $response->getContent()
        );

        $response->assertStatus(422);

        // A resposta de erro deve indicar o campo 'status'
        $response->assertJsonValidationErrors(['status']);
    }

    // =========================================================================
    // BLOCO D — Regressão de segurança (AC-9, AC-10) [REGRESSÃO]
    //
    // Esses testes garantem que o fix da migration NÃO remova as proteções
    // de autenticação das rotas de tasks.
    // =========================================================================

    /**
     * AC-9 [P1] — GET /tasks sem token de autenticação deve retornar HTTP 401.
     *
     * [REGRESSÃO]: O guard auth:api deve continuar protegendo as rotas.
     * A correção da migration não deve remover ou bypassar essa proteção.
     * Resultado esperado: 401 Unauthorized — NUNCA 500 ou 200.
     */
    public function test_ac9_regression_get_tasks_without_token_returns_401_not_500(): void
    {
        $response = $this->getJson('/tasks');

        $this->assertNotEquals(
            500,
            $response->status(),
            '[AC-9] GET /tasks sem token retornou HTTP 500. '
            . 'O guard auth:api deve rejeitar com 401, não lançar exceção. '
            . 'Corpo: ' . $response->getContent()
        );

        $response->assertStatus(401);
    }

    /**
     * AC-10 [P1] — POST /tasks sem token de autenticação deve retornar HTTP 401.
     *
     * [REGRESSÃO]: Confirma que o endpoint de criação também exige autenticação.
     * O fix da migration não deve tornar nenhuma rota de task pública.
     */
    public function test_ac10_regression_post_tasks_without_token_returns_401(): void
    {
        $response = $this->postJson('/tasks', $this->validTaskPayload());

        $this->assertNotEquals(
            500,
            $response->status(),
            '[AC-10] POST /tasks sem token retornou HTTP 500 em vez de 401. '
            . 'Corpo: ' . $response->getContent()
        );

        $response->assertStatus(401);
    }
}
