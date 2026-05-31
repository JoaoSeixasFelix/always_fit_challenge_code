FROM php:8.3-cli

# Dependências do sistema
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    libzip-dev \
    zip \
    unzip \
    && docker-php-ext-install \
        pdo_mysql \
        mbstring \
        xml \
        bcmath \
        opcache \
        zip \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Composer
COPY --from=composer:2.7 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Copia os arquivos de dependência primeiro (melhor cache de layers)
COPY composer.json composer.lock ./

# Instala dependências PHP (sem scripts, pois app/ ainda não foi copiado)
RUN composer install --no-scripts --no-autoloader --no-interaction --prefer-dist

# Copia o restante do código
COPY . .

# Gera autoload e roda scripts
RUN composer dump-autoload --optimize

# Permissões de storage e cache
RUN chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# Script de entrypoint para aguardar MySQL e rodar migrate
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
