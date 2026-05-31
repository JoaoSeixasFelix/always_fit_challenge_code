FROM node:20-alpine

WORKDIR /app

# Copia manifests de dependência primeiro (melhor cache de layers)
COPY package.json package-lock.json ./

# Instala dependências
RUN npm ci

# Copia o restante do código
COPY . .

EXPOSE 5173

# Hot reload com host 0.0.0.0 para aceitar conexões externas ao container
# --port 5173 sobrescreve o port: 3000 do vite.config.js
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
