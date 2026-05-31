<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            // Rotas de autenticação do SPA — middleware 'api' (sem CSRF, sem prefixo /api).
            // Ficam em routes/api.php e são acessadas diretamente em /login e /register.
            Route::middleware('api')
                ->group(base_path('routes/api.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware) {
        // CorsMiddleware registrado globalmente (prepend) para:
        //  1. Curto-circuitar requisições OPTIONS (preflight) retornando 200 imediatamente
        //  2. Adicionar Access-Control-Allow-Credentials: true em toda resposta permitida
        // Prepend garante que CORS é processado antes de qualquer outro middleware.
        $middleware->prepend(\App\Http\Middleware\CorsMiddleware::class);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
