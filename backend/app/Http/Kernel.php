<?php

namespace App\Http;

use Illuminate\Foundation\Http\Kernel as HttpKernel;

/**
 * @deprecated Laravel 11 — Este arquivo é CÓDIGO MORTO e não é carregado.
 *
 * No Laravel 11, public/index.php chama handleRequest() na instância Application
 * retornada por bootstrap/app.php. O roteamento de middlewares globais e de grupo
 * é configurado exclusivamente em bootstrap/app.php via ->withMiddleware().
 *
 * Consequências de manter sem atenção:
 *  - CorsMiddleware registrado aqui NUNCA é executado em produção.
 *  - Qualquer alteração neste arquivo não terá efeito algum.
 *
 * Ação recomendada: remover este arquivo e usar bootstrap/app.php para toda
 * configuração de middleware (já feito via ->withMiddleware()).
 *
 * @see bootstrap/app.php
 */
class Kernel extends HttpKernel
{
    protected $middleware = [
        // Outros middlewares globais...
        \App\Http\Middleware\CorsMiddleware::class, // Middleware CORS global
    ];

    protected $middlewareGroups = [
        \App\Http\Middleware\CorsMiddleware::class,
        'web' => [
            // Outros middlewares para o grupo web...
        ],

        'api' => [
            // Outros middlewares para o grupo API...
            \App\Http\Middleware\CorsMiddleware::class, // Middleware CORS para API
            'throttle:api',
        ],
    ];

    protected $routeMiddleware = [
        // Outros middlewares de rota...
        'cors' => \App\Http\Middleware\CorsMiddleware::class,
    ];
}

