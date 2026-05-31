<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response('OK', 200);
});

Route::get('/test', function () {
    return 'API route is working!';
});

// Rotas de recursos movidas para routes/api.php
// (grupo 'api', sem VerifyCsrfToken — necessário para o Vue SPA)
