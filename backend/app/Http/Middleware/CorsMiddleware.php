<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CorsMiddleware
{
    /**
     * Origens permitidas para requisições cross-origin.
     */
    private array $allowedOrigins = [
        'http://localhost:3000',
    ];

    /**
     * Handle an incoming request.
     *
     * Para requisições OPTIONS (preflight), retorna 200 imediatamente com os
     * headers CORS necessários — sem repassar ao $next, evitando 404/405 do
     * roteador que não tem handler OPTIONS registrado.
     *
     * Para demais requisições de origens permitidas, adiciona os headers CORS
     * (incluindo Access-Control-Allow-Credentials: true, obrigatório quando
     * Axios usa withCredentials: true).
     */
    public function handle(Request $request, Closure $next): Response
    {
        $origin = $request->header('Origin', '');

        if (!in_array($origin, $this->allowedOrigins, true)) {
            return $next($request);
        }

        // AC-4: curto-circuita preflight OPTIONS sem chamar $next
        if ($request->isMethod('OPTIONS')) {
            return response('', 200)
                ->header('Access-Control-Allow-Origin', $origin)
                ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
                ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
                ->header('Access-Control-Allow-Credentials', 'true')
                ->header('Access-Control-Max-Age', '86400');
        }

        // AC-5: inclui credentials header em toda resposta a origens permitidas
        return $next($request)
            ->header('Access-Control-Allow-Origin', $origin)
            ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
            ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
            ->header('Access-Control-Allow-Credentials', 'true');
    }
}
