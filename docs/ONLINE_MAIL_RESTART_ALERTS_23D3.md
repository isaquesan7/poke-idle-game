# ONLINE-01C-23D3 — Falhas de worker, retomada e alertas da outbox

## Escopo entregue (interno, CI-only)

- Novo `evaluateAccountMailAlerts(metrics, thresholds)` sem efeitos colaterais: sinaliza fila ativa acima do limite, backlog antigo e mensagens mortas. Padrões: **25** mensagens disponíveis, **300 segundos** de idade da mais antiga disponível e **1** mensagem `dead`. Contagem de backlog zero não provoca alarme de idade, mesmo se idade informada for alta. Métrica agregada não expõe pessoa, token, link, email ou recibo.
- Resposta do worker agora **verifica `rowCount` do ACK e da atualização de falha**. Se o lease foi perdido ou retomado por outra instância, retorna `lost-lease` — nunca afirma `delivered` ou `retry` sem ter efetivamente atualizado o PostgreSQL. A proteção anterior por tentativa + lease permanece.
- `tests/account-mail-restart.integration.test.mjs` (PostgreSQL 18 descartável): um claim abandonado simula processo encerrado; um novo worker retoma o mesmo item e preserva a idempotency key. Outro cenário simula resposta aceita pelo provedor após o lease expirar e ser retomado; o worker original recebe `lost-lease`, enquanto o registro segue sob controle do novo worker. Testa ainda limiares, validação de argumentos, reconciliação e métricas privadas.
- Suíte `test:integration` e checagem de sintaxe da API passam a incluir o teste 23D3.

## Contrato operacional

Nenhum worker, agendamento ou endpoint de métricas foi habilitado. Estes recursos ainda dependem de execução **explícita, isolada e aprovada**. Erros `lost-lease` devem ser investigados sem logar dados do destinatário. Alerta deve conter somente os agregados. Nunca emitir envio automático com chave histórica de cifragem ausente.

A retomada de um envio potencialmente aceito pelo Resend preserva a mesma `Idempotency-Key`; a garantia efetiva contra dois e-mails dependerá da política real do provedor. Mesmo quando o ACK local falha, não há como desfazer um e-mail externo aceito. Não alegar exactly-once. Não ativar a operação real sem teste do comportamento do provedor, limites da lease, isolamento de worker e observabilidade.

## Integração e próximos gates

PR 23D3 baseada na 23D2 (#234), ainda em cadeia com as PRs #233, #232, #231, #230 e #229. O conjunto permanece fora de `main`. **CI ainda precisa ser executada e aprovada no HEAD**, assim como análise completa das mudanças antes da integração sequencial. Não declarar beta pronto baseado apenas no teste escrito.

Cadastro de produção permanece **OFF**, `/play` LOCAL sem migração, Regiões 1v1 com `team[0]`, Ginásios 3v3 com trio pré-definido na Coleção, motor/recompensas/Gym HMAC intocados.

Próximo foco: **consolidação e execução efetiva de CI da sequência de PRs**, revisão de recuperação real Railway Postgres, remetente e transporte Resend reais e política LGPD. Tais aprovações são independentes e continuam bloqueadas.
