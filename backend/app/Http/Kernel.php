<?php

namespace App\Http;

use Illuminate\Foundation\Http\Kernel as HttpKernel;

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
