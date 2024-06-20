<?php

$middlewareGroups = [
    'api' => [
        'throttle:api',
        \Illuminate\Routing\Middleware\SubstituteBindings::class,
        \Tymon\JWTAuth\Http\Middleware\Authenticate::class,
    ],
];
