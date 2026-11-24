# ONLINE-01C-23D0 — Fundação transacional de e-mail, NÃO ATIVA

## Estado da branch

- Migração append-only **025_account_mail_outbox.sql**: fila atrelada à conta com chave de idempotência única, payload criptografado, fingerprint HMAC, prazo, status, lease, tentativas limitadas (5) e recibo do provedor; nenhuma mensagem em texto puro no banco.
- `src/accountMailOutbox.mjs`: keyring AES-256-GCM explícita (32 bytes), criptografia autenticada de destinatário/token/origin, writer `enqueueAccountMail(client,...)` que participa **da transação do chamador**, reconhecimento de replay exato e recusa conflito com a mesma idempotency key. Worker interno opt-in com `FOR UPDATE SKIP LOCKED`, leases de 45 segundos, retry exponencial limitado e mesma idempotency key enviada ao Resend em cada tentativa.
- **NÃO EXISTE worker agendado ou serviço em produção**; a API continua com seu fluxo anterior, de maneira que esta fundação **ainda não substitui o envio inline** do registro/reset. Não ativar no Railway antes da etapa de integração de emissão do token e enfileiramento na MESMA transação.
- A cifra exige keyring privada versionada e retenção da chave histórica até esgotar mensagens pendentes. **NÃO persistir chave ou token em GitHub, logs ou documentação**. Sem chave, execução deve falhar fechada; não configurar segredo fictício em produção.
- `tests/account-mail-outbox.integration.test.mjs`: PostgreSQL descartável verifica rollback, deduplicação/conflito, cifra sem plaintext no banco, autenticação criptográfica, corrida de claims, falha de transporte, replay após lease e recibo terminal, expiração sem entrega. Transporte Resend é **fake injetado**, nunca HTTP externo.
- `npm run test:integration` inclui teste de outbox em sequência com as jornadas do Gym/conta; SQL migrations esperado agora **25**. Acompanhar CI no HEAD PR e corrigir antes de qualquer merge.

## Operação e riscos ainda não resolvidos

1. **Sem entrega garantida:** o módulo está desconectado das rotas e não existe worker em execução. Próxima fase: inserir outbox no mesmo BEGIN/COMMIT da criação de token (verificação e recuperação) e eliminar envio síncrono depois que testes E2E provarem o novo fluxo, inclusive falhas após commit.
2. **Sem exatamente uma entrega garantida:** uma queda após o Resend aceitar mas antes do ACK pode gerar nova tentativa. A idempotency key estável mitiga duplicação apenas nos limites contratuais do provedor; comprovar comportamento e janela de retenção real do Resend.
3. **Revogação de links:** a expiração da mensagem evita links vencidos, mas antes de entregar é preciso também verificar que o token ainda está ativo (um novo reset revoga anterior); acrescentar validação no banco na etapa de integração.
4. **Tempo / lease:** worker lento pode superar 45s; configurar timeout de rede inferior à lease e confirmar tratamento quando outra instância retoma o envio. Não operar em produção sem observabilidade de fila, dead-letter, métricas e procedimentos manuais.
5. **Segredos:** incluir rotação, key ID, backup seguro, retenção até drain e hardening da autorização do worker; impedir exposição da tabela a usuários web.
6. **Invariantes:** cadastro continua desativado em produção; `/play` LOCAL sem migração; Regiões 1v1 via `team[0]`, Ginásios 3v3 definidos na Coleção, HMAC Gym e recompensas intocados.
7. **Gates independentes:** RAILWAY restore/PITR **REAL**, verificação remetente Resend **REAL**, LGPD e CI permanecem pendentes.

## Próxima etapa

ONLINE-01C-23D1: integrar emissão de verificação e reset ao outbox sob o mesmo commit e validar replay/expiração e comportamento do provedor em laboratório; preparar worker com configuração explícita e monitoramento, mas não liberar cadastro antes do restore Railway real, Resend e LGPD.
