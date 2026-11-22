# ONLINE-01 — Fundamento de contas e persistência

**Status:** API e schema ONLINE-01B operacionais em serviço privado Railway; **a autenticação pública não está liberada para jogadores**. O PostgreSQL foi criado no projeto Railway `kanto-idle-lab`; não registrar credenciais ou URL do banco neste repositório.

## Decisões de produto
- A rota `/` deixa de executar v0.1 e prepara o futuro cadastro/login.
- `/play` permanece **laboratório de testes**, com save `localStorage` v0.2 separado.
- Não existe importação, restauração nem migração de saves locais para o banco.
- Quando o cadastro for lançado, o treinador começa uma aventura nova, gerada pelo **servidor**; progresso do navegador jamais é prova de saldo, XP, captura ou insígnia.

## Backend (isolado do frontend)
- `services/api` não é workspace do Vite/Docker web. A API já tem imagem Docker própria e serviço Railway **sem domínio público**, sem proxy no `kanto-idle-web`.
- `services/api/sql/001_online_foundation.sql`: contas, hashes de senha, sessões (somente hash do token), perfis, saves versionados e recibos idempotentes.
- `services/api/src/auth.mjs`: validação, scrypt com salt aleatório, comparação `timingSafeEqual`, token de sessão aleatório e cookie `__Host-` HttpOnly/SameSite.
- `services/api/src/server.mjs`: protótipo de API Node HTTP com PostgreSQL `pg` e registro **desabilitado por padrão**. Rotas: `GET /health`, `GET /api/v1/status`, `GET /api/v1/me`, `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/save`. **Não existe gravação client-side de saves.**

## Regras de lançamento (ainda pendentes)
1. Gerar e versionar lockfile exclusivo da API, instalar somente deps de produção e criar imagem Docker isolada; fazer testes Node HTTP + banco real em ambiente de teste.
2. Executar `npm run db:migrate` (transação, advisory lock e checksum) após configurar backup, conexão privada e lockfile da API; confirmar tabelas e constraints. O arquivo SQL commitado **não significa migration executada**.
3. Revisão de segurança: rate limiting distribuído para login/cadastro, verificação de e-mail e recuperação de senha, cookies `Secure`, CSRF/origin estritos, monitoramento, retenção e gestão de dados/LGPD.
4. Conectar frontend `/` aos endpoints pela **mesma origem** (proxy reverso autenticado), e só depois liberar `ONLINE_REGISTRATION_ENABLED`.
5. Mover inicialização do save, turnos, capturas, recompensas e inventário para transações **autoritativas no servidor**. Não implementar `PUT /save` aceitando JSON arbitrário de cliente.
6. Isolar produção/teste e planejar rollback e backups. Somente então habilitar contas reais.

## Parâmetros locais do serviço API (não preencher valores em git)

```env
DATABASE_URL=<fornecida pela conexão interna Railway>
APP_ORIGIN=http://localhost:3001
ONLINE_REGISTRATION_ENABLED=false
PORT=3001
NODE_ENV=development
```

A migration `001_online_foundation.sql` **foi aplicada** ao PostgreSQL Railway em 22/11/2026, confirmada pelos logs do pre-deploy do serviço privado. A API foi implantada com healthcheck SUCCESS e **não foi conectada ao site nem exposta publicamente**; o cadastro permanece DESABILITADO inclusive quando flag=true em `NODE_ENV=production`. Lockfile e CI de integração PostgreSQL/Docker confirmados. Backups agendados/restauração, rate limiting, verificação de e-mail e writer autoritativo continuam pendentes. Nunca expor variáveis privadas ou credenciais.
