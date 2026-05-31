<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\TaskController;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\NotificationController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — sem middleware 'web' (sem VerifyCsrfToken)
|--------------------------------------------------------------------------
|
| Rotas de autenticação e recursos do SPA Vue. Devem estar fora do grupo
| 'web' para que requisições cross-origin do frontend não recebam 419 Page
| Expired. O Vue SPA não possui cookie CSRF, portanto VerifyCsrfToken
| rejeitaria toda requisição POST com 419.
|
| Registradas em bootstrap/app.php via withRouting(then:) sem prefixo /api,
| sob o grupo de middleware 'api' (throttle + bindings, sem CSRF).
|
*/

Route::post('login', [AuthController::class, 'login']);
Route::post('register', [AuthController::class, 'register']);

Route::middleware('auth:api')->group(function () {
    Route::apiResource('projects', ProjectController::class);
    Route::apiResource('tasks', TaskController::class);
    Route::apiResource('comments', CommentController::class);
    Route::apiResource('notifications', NotificationController::class);
});
