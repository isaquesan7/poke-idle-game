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


## ONLINE-01C-5 — portal HTML do treinador (ainda em PR)
- A página `/` possui campos de entrada/cadastro e links de recuperação; `/verify-email` e `/reset-password` respondem HTML sem credenciais. O cliente verifica `/api/v1/status` e desabilita ações até o backend declarar `registrationEnabled:true` — um sinal que a produção atualmente nunca fornece.
- Token de e-mail/red­efinição da query string é lido e removido do histórico antes da requisição; política `no-referrer`. Não é fluxo de conta liberado ao público nem migra progresso do `/play`. UI deverá receber revisão de acessibilidade e de proteção antifraude antes da beta.


## ONLINE-01C-6 — ação transacional inicial no servidor (branch)
- `POST /api/v1/trainer/invest`: recebe exatamente `{actionId,expectedRevision,stat}`, sessão verificada e Origin exigidos. Verifica orçamento calculado do nível persistido, máximo 40 pontos manuais por atributo, save esperado e receipt único. `FOR UPDATE` protege chamadas concorrentes e commit da revisão + receipt é atômico.
- Não existe rota pública para conceder nível, XP, moeda, insígnia ou capturas. A ação é test-only, produção tem `enabled=false`; o teste Nv2 usa fixture direta em PostgreSQL descartável. Sem importação de localStorage.


## ONLINE-01C-7 — módulo interno de RNG, ainda não integrado
- `src/battleEntropy.mjs` fornece HMAC-SHA256 determinístico, separado por conta, UUID de encontro e fase. Requer Buffer de chave de servidor com no mínimo 32 bytes; não implementa encontros, drops nem premiações.
- Regra de integração futura: somente criar stream após reserva/persistência de encontro pelo backend; nunca aceitar ID de encontro ou seed do cliente; ligar ao motor validado e ledger com transações e receipts. Não configurar chave ou expor rota nesta entrega. `/play` e cadastro real continuam inalterados.

## ONLINE-01C-8 — reserva de encontros (módulo interno)
- Migrar `004_encounter_reservations.sql` com o runner checksum/lock já existente. `reserveEncounter` é função server-only, não há rota HTTP nem geração de espécies/recompensas.
- Usa actionId idempotente, revisão esperada e um único encontro reservado por treinador, com `FOR UPDATE` do save, UUID do DB e gravação atômica do receipt. Região 1 apenas até validar progressão regional. Mesmo actionId lê ID persistido; nenhuma fonte de seed do cliente. CI de restauração valida quatro migrações em banco descartável.
- Não habilitar cadastro público nem configurar RNG de produção nesta fase; /play sem migração.

## ONLINE-01C-9 — materializar reserva com RNG privado (somente interno)
- Migração `005_encounter_materialization.sql` congela espécie, nível, versão RNG e instante de um encontro reservado, de modo transacional e com CHECK de preenchimento completo.
- `materializeReservedEncounter` precisa de UUIDs de conta/encontro já validados pelo servidor, chave HMAC privada 32+ bytes, reserva `status=reserved` e save do backend. Aplica só região 1, fonte sincronizada e testada contra `kantoRegions.ts`; concorrência/retries leem resultado congelado mesmo se trocar a chave em processo novo.
- Nunca expor secret ou dados de controle em HTTP ou logs. Não é endpoint de jogo; sem combate, captura, recompensas ou mutação de /play. Sem registro público.

## ONLINE-01C-10 — snapshot de preparação de combate (interno)
- `006_battle_snapshot.sql` preserva `battle_snapshot` e `battle_prepared_at`; só aceita snapshot se o encontro já foi materializado. Runner checksum passa a aplicar seis migrações.
- `prepareReservedBattle(pool,{accountId,encounterId})` lê os dados da reserva e do save da conta no servidor, congela o líder da equipe e o adversário e retorna replay imutável por consulta ao DB. Não recebe dados de luta nem resultados do navegador; é função interna sem rota.
- Próximo serviço usará o game-core canônico para conferir learnset, stats, HP/SP, IA e resolver turnos. Sem recompensa, XP ou captura nesta fase, sem alterar localStorage. Cadastro público continua desativado.

## ONLINE-01C-12 — bundle Node de batalha Kanto e prévia interna
- `services/api/Dockerfile` compila `packages/game-core/src/combat/serverFrozenBattle.ts` em ESM auto-suficiente (esbuild do lock monorepo) e copia apenas `/srv/api/game-core/frozenBattle.mjs` para o runtime isolado. CI verifica existência e importação do bundle.
- Migração `007_canonical_battle_preview.sql` registra `battle_preview` + data e exige existência de snapshot/materialização. `previewReservedBattle` acessa somente reserva existente, valida snapshot, usa HMAC privado e `previewFrozenWildBattle`, faz commit da prévia uma única vez com `FOR UPDATE`. Com corrida/retry, a prévia persistida é retornada sem reroll.
- Função interna **sem endpoint**, sem logs de segredo, sem save/recompensas, sem captura; reserva segue pendente. Não configurar chave ou abrir contas reais neste release. No CI, variável CORE_BUNDLE_PATH permite apontar para bundle temporário em NODE_ENV=test; produção ignora override.

## ONLINE-01C-13 — selagem de batalha (somente backend)
- Migration `008_battle_outcome_seal.sql` adiciona campos de selagem com CHECK e índice único de ação. Não marca reserva como encerrada nem concede qualquer progresso.
- `sealReservedBattle` é função privada sem rota HTTP. Executa transação com lock no save e depois no encontro, confere resultado da prévia no banco e usa actionId/expectedRevision para salvar receipt `battle-seal` e avançar revisão. Replays da mesma ação retornam o mesmo resultado; segunda ação distinta não produz nova selagem. O save bruto `journal.raw` fica inalterado.
- Não habilitar cadastro público nem exposição da função nesta etapa: payout, captura, despesas e conclusão segura de reservas são passos posteriores.

## ONLINE-01C-14 — cotação de recompensas pós-selagem, ainda sem pagamento
- Migração `009_battle_reward_quote.sql`: campos `battle_reward_quote` (JSONB) e timestamp. CHECK exige outcome selado idêntico ao da proposta e status reservado.
- `quoteSealedBattleRewards` é serviço INTERNO sem rota. Sob `FOR UPDATE` do encontro, exige preview/selagem anteriores, chama bundle `quoteFrozenBattleRewards` do game-core e usa HMAC `wild-battle-affinity` apenas para derivar 2–5 de afinidade. A proposta é persistida antes de responder; retries retornam valor idêntico.
- Não concede XP, moedas, afinidade, Pokébolas ou capturas, não escreve no save, não recebe identidade/payload de luta do browser. Backend só ficará acessível ao público após writer integral e gates de resiliência.

## ONLINE-01C-15 — payout interno e uma única vez
- Migration `010_battle_payout.sql` registra recibo/ação/revisão de pagamento no encontro sem marcar o encontro como concluído. `paySealedBattleRewards` trava save e encontro, revalida cotação via game-core, atualiza coins/XP/afinidade/histórico e grava receipt `battle-payout` em uma única transação.
- Mesmo actionId retorna replay durável. IDs novos não pagam novamente; revisões obsoletas e save alterado/inconsistente são recusados. A bolsa de Pokébolas, elenco e badges não mudam, nenhum drop/captura é concedido. Sem HTTP e sem registro público.
- O fluxo completo ainda precisa da decisão de captura, débito de Pokébolas e conclusão segura da reserva. O `/play` não migra para PostgreSQL.

## ONLINE-01C-16 — captura ou desistência e encerramento do encontro (somente interno)
- `011_capture_finalization.sql`: campos finais, constraint de completude e ação única por conta; versões anteriores de constraints 008/009/010 são reeditadas em migração append-only para permitir conclusão somente com o pagamento já registrado.
- `finishPaidWildEncounter(pool,{accountId,encounterId,actionId,expectedRevision,choice,entropyKey})`: executado SOMENTE por contexto servidor autenticado. Choice `skip` ou uma bola Poké/Great/Ultra. Seed de captura é HMAC derivada do encontro; core valida vitória/HP/bolso, gasta 1 bola inclusive na falha, cria 1 UID no sucesso. Lock save→encontro e commit único salva estado, receipt, status e resultado.
- Retry da mesma ação e escolha devolve a conclusão já persistida. Ação distinta não concede outro lançamento. Sem rota HTTP e sem cadastro público; `/play` independente.

## ONLINE-01C-17 — sorteio privado e crédito de Pokébolas no payout
- `quoteSealedBattleRewards` também deriva `wild-battle-ball-drop` via HMAC de chave privada com inteiro 0–9999 sem viés de módulo; `quoteFrozenBattleRewards` guarda `ballDropId` na quote PostgreSQL (sem novos campos SQL).
- `paySealedBattleRewards` usa o redutor canônico para validar a quote completa (afinidade e buckets de drop) e debita/crédita o inventário no mesmo COMMIT de moedas/XP/receipt. Somente uma bola por vitória elegível; nunca ao perder/empatar ou sem fator de progresso. Retentativas não pagam uma segunda bola e o fechamento posterior da batalha não altera o drop.
- Sem endpoints HTTP, contas públicas ou migração /play; taxas R2–R10 são validadas em core, enquanto serviço de encontro atual segue restrito a R1.

## ONLINE-01C-18 — sessão turn-zero, sem combate executável ainda
- `012_wild_turn_session.sql` guarda o JSONB da sessão e a data de início; constraint bloqueia prévia automática/selagem/payout no mesmo encontro.
- `startReservedWildTurnSession` é serviço INTERNO com identidade de conta da futura sessão autenticada, lock em save→encontro, revisão esperada, reconstrução exata do snapshot e persistência idempotente. Replays não criam nova sessão, RNG, recompensas ou recibos. Retorna estado inicial HP/SP, até quatro golpes selvagens FRLG e somente o golpe equipado do jogador mais ataque básico.
- Não existem ações por turno, comandos públicos, resultados ou pagamentos nesse modo. Previews automáticas anteriores seguem isoladas e intocadas. Cadastro continua desativado; sem importação de save `/play`.

## ONLINE-01C-19 — ações privadas de turno com receipt durável
- `applyReservedWildTurn(pool,{accountId,encounterId,actionId,expectedRevision,action,entropyKey})`: somente contexto interno. Aceita `basic`, `focus`, ou `move` com `moveName` equipado; bloqueia extras, golpes fora de nível, SP insuficiente e trocas não definidas. Reusa `resolveGymAiTurn` via bundle core e persiste estado HP/SP/turn/log no `battle_turn_state`.
- Migration `013_wild_turn_receipts.sql` impõe unicidade por ação e por número de rodada. Recibo `wild-turn`, revisão do save e estado de batalha são gravados juntos. HMAC `wild-turn-N` independente dos demais sorteios; sem seed enviada ao navegador.
- Resultado do combate interativo **não** gera `battle_preview` ou prêmio; settlement posterior ainda pendente. Sem rotas HTTP nem liberação do cadastro.
