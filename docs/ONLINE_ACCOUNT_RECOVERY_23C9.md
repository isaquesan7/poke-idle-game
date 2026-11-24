# ONLINE-01C-23C9 — Expiração e recuperação de conta via HTTP, em CI

## Implementado na branch

Teste `services/api/tests/account-recovery.integration.test.mjs` executa o servidor real de API sob `NODE_ENV=test`, cadastro habilitado **apenas no processo de CI**, `ACCOUNT_MAIL_MODE=off`, e banco PostgreSQL descartável configurado pelo pipeline existente.

A jornada testa por HTTP autenticado, sem mocks do motor de autenticação:

1. Cadastro em conta de teste isolada, token de verificação armazenado somente como SHA-256 no PostgreSQL.
2. Expiração forçada da verificação diretamente na fixture do PostgreSQL **descartável**; link vencido é rejeitado, login não verificado permanece proibido, e reset não emite token a contas não verificadas.
3. Nova verificação criada via issuer **interno** apenas na fixture do teste; rejeição de Origin estranha, ativação legítima e token de uso único.
4. Login e cookie de sessão. Duas solicitações sucessivas de reset: a segunda invalida a primeira.
5. Expiração forçada da segunda solicitação: token vencido não altera senha nem encerra sessão.
6. Terceira solicitação de reset: CSRF inválido rejeitado; reset legítimo troca a senha, consome o token e revoga sessão anterior; senha antiga falha, senha nova funciona.
7. Logout exige Origin legítima e invalida a nova sessão; tokens de reset seguem armazenados como hashes de 32 bytes.

`services/api/package.json` executa o novo teste em `npm run test:integration` **sequencial**, ao lado dos testes PostgreSQL e Gym já existentes. `npm run check` passa a validar sintaxe do arquivo.

## Limitações e gates

Este teste **não** simula entrega real do Resend e não gera evidência de domínio remetente verificado. `ACCOUNT_MAIL_MODE=off` é exclusivamente isolamento CI. Não executa restore Railway, não testa PITR e não habilita cadastro em produção. Na API, `enabled` continua estritamente condicionado a `NODE_ENV==='test'`; nunca modificar sem todos os critérios de segurança e aprovação.

A suíte deverá passar em CI no HEAD final da PR antes de merge; se falhar, investigar concorrência, controle do ambiente PG18 e regressões. Não habilitar login público, nem alterar `/play` local, saves, recompensas, HMAC, dados históricos, lógica Regiões 1v1 ou Gym 3v3 da Coleção.

## Próximo recorte

ONLINE-01C-23D0: integração de **outbox transacional** de e-mails (sem liberar transporte real) e prova operacional de remetente Resend em ambiente isolado, preservando ausência de enumeração e reenvio idempotente; backup/restore Railway real e LGPD permanecem bloqueios independentes.
