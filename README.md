# always_fit_challenge_code# Projeto de Gerenciamento de Tarefas

Este projeto é uma aplicação web para gerenciamento de tarefas com funcionalidades de colaboração, desenvolvido usando Laravel (PHP) no backend e Vue.js no frontend.

## Requisitos

Antes de iniciar, certifique-se de ter os seguintes requisitos instalados:

- PHP >= 7.3
- Composer
- Node.js (para o frontend Vue.js)
- npm

1. **Clonar o repositório**

   ```bash
   git clone https://github.com/seu-usuario/seu-projeto.git
   cd seu-projeto

2. **Instalar as dependências

composer install
npm install # ou yarn install

3. **Configuração do ambiente
- cp .env.example .env
  
4. **Configure o acesso ao banco de dados no arquivo .env:
  -DB_CONNECTION=mysql
  -DB_HOST=127.0.0.1
  -DB_PORT=3306
  -DB_DATABASE=nome_do_seu_banco
  -DB_USERNAME=seu_usuario
  -DB_PASSWORD=sua_senha
   
5. **Executar as migrations e seeds

-php artisan migrate

Se desejar, também pode-se popular o banco de dados com dados de exemplo (opcional):

-php artisan db:seed

6. **Compilar os assets

-npm run dev

7. **Iniciar o servidor de desenvolvimento
   
-php artisan serve

Funcionalidades
Interface responsiva e intuitiva usando Vue.js.
Gerenciamento completo de tarefas: criar, listar, editar, excluir e marcar como concluídas.
Atribuir tarefas a membros.
Filtrar e buscar tarefas por status, data de criação e responsável.
Sistema de comentários em tarefas.
Anexar arquivos às tarefas.
Sistema de notificações para ações relevantes.
Estrutura do Banco de Dados
A aplicação utiliza um banco de dados relacional (MySQL ou PostgreSQL) com as seguintes tabelas principais:

users (id, nome, email, senha, nível de acesso)
projects (id, nome, descrição, data de criação, data de atualização)
tasks (id, projeto_id, título, descrição, status, responsável_id, data de criação, data de atualização)
comments (id, tarefa_id, usuário_id, conteúdo, data de criação)
notifications (id, usuário_id, mensagem, lida, data de criação)
Autenticação
A aplicação utiliza autenticação JWT (JSON Web Tokens) para gerenciar a autenticação e autorização dos usuários.


