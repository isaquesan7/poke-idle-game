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

## ONLINE-01C — camada de segurança de autenticação (em branch, sem cadastro público)
- SQL `002_auth_limits_verification.sql` adiciona contadores transacionais `game_auth_throttles` e tokens de verificação `game_email_verifications`, persistidos só por digest SHA-256. `migrate.mjs` percorre 001 e 002 sob a mesma transação/advisory lock e journal de checksum.
- `authSecurity.mjs` usa HMAC-SHA256 com `AUTH_RATE_LIMIT_SECRET` para não salvar IP/e-mail legíveis; PostgreSQL UPSERT atômico mantém limite compartilhado entre réplicas e impede bypass entre processos. IP é endereço TCP real, sem confiar em cabeçalhos X-Forwarded-For arbitrários. Limites de teste: login 6/email e 30/IP por 15 minutos, registro 4/email e 10/IP, verificação 20/IP.
- Em `NODE_ENV=test` com flag, registro emite token **somente no payload do test harness**, guarda apenas hash no banco, endpoint `/api/v1/auth/verify` consome token uma vez e ativa `email_verified_at`. Login antes da verificação responde 403. **Não existe envio de e-mail conectado nesta etapa: teste não representa entrega real**.
- `NODE_ENV=production` mantém login/registro/verificação bloqueados, mesmo se a flag for ativada. Não criar conta real antes de integração com provedor de e-mail, limites/antifraude completos, proxy same-origin e criador de save autoritativo.
- Backup: Railway possui backups de volumes e PITR PostgreSQL (veja [documentação de backups](https://docs.railway.com/volumes/backups) e [PITR](https://docs.railway.com/volumes/point-in-time-recovery)), mas **nenhum backup agendado ou exercício de restauração foi confirmado nesta etapa**. Configurar e testar antes de lançar contas reais. Não restaurar sobre volume de produção para testes.


## ONLINE-01C-2 — recuperação de senha e e-mail transacional (implementação em PR)

- 003_password_reset.sql: tokens criptograficamente aleatórios; banco armazena somente SHA-256, validade de 30 minutos e uso único. O runner aplica 001, 002 e 003 em transação e registra checksum.
- /api/v1/auth/request-reset: responde genericamente para conta existente ou inexistente, com limites PostgreSQL por IP e e-mail. /api/v1/auth/confirm-reset: troca senha por scrypt, consome token e revoga todas as sessões da conta na mesma transação.
- mailer.mjs: adaptador Resend via POST HTTPS autenticado, Idempotency-Key e envio em texto plano, usando exclusivamente RESEND_API_KEY e MAIL_FROM em ambiente privado. ACCOUNT_MAIL_MODE=off por padrão; sem domínio remetente verificado ou credenciais, nenhum e-mail real é enviado. As páginas /verify-email e /reset-password ainda precisam ser criadas.
- Em produção a autenticação continua bloqueada por código; tokens são retornados no corpo apenas no harness de testes sem envio de e-mail, jamais em produção.
- Não habilitar contas antes de backup/PITR com teste de restauração isolada, entrega real verificada, recuperação de erros e primeiro save autoritativo. /play segue local, sem migração de saves.


## ONLINE-01C-3 — criação transacional da primeira aventura (somente CI)
- POST /api/v1/adventure/start valida sessão, e-mail verificado, origin e um único campo starterId (1, 4 ou 7). O servidor gera nome do perfil, relógio e política inicial Kanto nível 1; rejeita recompensas fornecidas pelo navegador.
- INSERT de game_saves e game_action_receipts no mesmo BEGIN/COMMIT; ON CONFLICT(account_id) DO NOTHING previne replays e duas abas criando aventuras simultaneamente. GET /api/v1/save permanece somente leitura. Escrita posterior de progresso (batalhas, capturas etc.) ainda NÃO foi implementada no backend.
- O CI cria duas contas de teste, valida a unicidade e executa backup/restore em banco PostgreSQL de teste isolado. Isso não comprova backup agendado ou PITR na instância Railway de produção. Sem importação local; /play não foi modificado.


## ONLINE-01C-4 — passagem privada same-origin (em branch)
- Web possui proxy `/api/v1/*` com allowlist para o serviço API interno, via `ONLINE_API_INTERNAL_URL` (somente origem privada definida pelo operador; **não adicionar credenciais ou endpoint secreto ao Git**). Sem essa variável, responde 503. O backend permanece independente, sem domínio público.
- `Origin` e `Cookie` de entrada seguem intactos; `Forwarded`, `X-Forwarded-For`, `X-Forwarded-Host` e `X-Forwarded-Proto` são descartados, sem confiar em cabeçalhos controlados pelo cliente. O destino é configuração fixa, sem redirects controlados pelo browser ou proxy aberto; body limitado a 16KiB.
- Configuração NÃO está ativada no Railway. Fazer revisão de segurança da rede interna, `APP_ORIGIN`, cookies, backup e restore e email operacional antes de conectar a variável. Mesmo com proxy, o guard `NODE_ENV=production` ainda bloqueia auth e início da aventura. Não existe fluxo online aberto.


## ONLINE-01C-6 — ação transacional inicial no servidor (branch)
- `POST /api/v1/trainer/invest`: recebe exatamente `{actionId,expectedRevision,stat}`, sessão verificada e Origin exigidos. Verifica orçamento calculado do nível persistido, máximo 40 pontos manuais por atributo, save esperado e receipt único. `FOR UPDATE` protege chamadas concorrentes e commit da revisão + receipt é atômico.
- Não existe rota pública para conceder nível, XP, moeda, insígnia ou capturas. A ação é test-only, produção tem `enabled=false`; o teste Nv2 usa fixture direta em PostgreSQL descartável. Sem importação de localStorage.
