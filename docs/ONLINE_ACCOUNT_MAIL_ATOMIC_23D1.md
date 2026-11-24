# ONLINE-01C-23D1 — Emissão atômica de tokens e outbox (somente harness CI)

## Implementado

A API reconhece `ACCOUNT_MAIL_MODE=outbox` **apenas** quando `NODE_ENV=test` e `ONLINE_REGISTRATION_ENABLED=true`. O modo recusa inicialização fora do harness. `ACCOUNT_MAIL_KEYRING_JSON` (mapa de chave AES-256-GCM base64) e `ACCOUNT_MAIL_ACTIVE_KEY_ID` são obrigatórios nesse modo; **NUNCA configurar chave de teste em produção**.

- Cadastro: `BEGIN` → account + profile → verificação hash → outbox criptografada → `COMMIT`; falha no enfileiramento reverte tudo. Não envia Resend inline no modo outbox e não devolve token HTTP.
- Reset: `issuePasswordReset(pool,email,{enqueue})` permite transação única: lock da conta, revogação de tokens anteriores, criação de novo token + registro da mensagem e `COMMIT`. Com e-mail desconhecido/não verificado, não emite token, preservando a resposta não enumerável. Fluxo antigo em testes `ACCOUNT_MAIL_MODE=off` continua compatível; em `resend` o envio inline histórico não foi alterado nesta PR.
- Worker opt-in, nunca iniciado automaticamente: antes da chamada Resend, busca a legitimidade atual do token pelo SHA-256 e ownership da conta; links já usados, revogados, expirados ou de conta desabilitada não são enviados. Registros inválidos passam a `expired`. O worker trabalha em ordem de criação e mantém idempotência estável no provedor.
- Respostas HTTP não revelam `verificationToken` nem `testResetToken` em modo outbox. O harness off ainda expõe tokens somente nos testes antigos; **ambos permanecem inacessíveis em produção**.
- Integração PostgreSQL 18 descartável: `account-mail-http.integration.test.mjs` inicia API real no harness, registra treinador, confere outbox com ciphertext, entrega fake da verificação, verifica conta, emite dois resets, impede entrega do primeiro revogado, entrega o segundo com adaptador fake, finaliza reset e verifica ausências de token na resposta.

## Não comprovado / não habilitado

- Nenhuma chave real foi provisionada, nenhum worker/cron foi iniciado, nenhuma requisição HTTP ao Resend real foi feita.
- `ACCOUNT_MAIL_MODE=outbox` não é a política final de release: exige infraestrutura operacional de chave, monitoramento, recuperação de filas e remoção do bloqueio test-only **somente após gates completos**.
- A checagem de validade é anterior à chamada externa; outra transação pode revogar o token durante a chamada. Isso não permite uso do link expirado no endpoint, mas não garante supressão absoluta de envio concorrente. Validar protocolo operacional e corrida antes de release.
- Uma queda após aceitação do provedor e antes do ACK pode gerar nova tentativa. `Idempotency-Key` mitiga, mas não garante exactly-once fora das garantias do Resend.
- O isolamento e os testes não provam backup/PITR Railway real, remetente Resend verificado, retenção LGPD, auditoria de segurança ou CI verde. Registrar esses gates como bloqueados até comprovação.
- Nenhuma regra de combate, região 1v1, gym 3v3 trio da Coleção, economia, save `/play` local, HMAC Gym ou endpoint de produção foi aberta.

## Sequência

PR 23D1 é dependente da 23D0 (#232), que depende de 23C9 (#231), 23C8 (#230) e 23C7 (#229). Rodar CI PostgreSQL18/regressão no commit final e revisar por ordem antes de integrar. Próximo: métricas de fila, reconciliação de leases, tratamento de mensagens revogadas antes de claim e worker isolado/operacional; **sem abrir o cadastro**.
