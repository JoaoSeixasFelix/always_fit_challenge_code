#!/bin/bash
set -e

echo "⏳ Aguardando MySQL em ${DB_HOST}:${DB_PORT:-3306}..."

MAX_TRIES=30
COUNT=0
until (echo > /dev/tcp/"${DB_HOST}"/"${DB_PORT:-3306}") 2>/dev/null; do
    COUNT=$((COUNT + 1))
    if [ "$COUNT" -ge "$MAX_TRIES" ]; then
        echo "❌ MySQL não respondeu após ${MAX_TRIES} tentativas. Abortando."
        exit 1
    fi
    echo "   tentativa ${COUNT}/${MAX_TRIES} — aguardando 2s..."
    sleep 2
done

echo "✅ MySQL disponível! Aguardando inicialização completa..."
sleep 3

echo "🔧 Rodando migrations..."
php artisan migrate --force

echo "🚀 Iniciando servidor Laravel..."
exec "$@"
