# ONLINE-01C-23D2 — Reconciliação de leases e métricas da fila de e-mails

## Adicionado (somente infraestrutura interna)

- `reconcileAccountMail(pool)` — manutenção SQL explícita, idempotente, apta para múltiplos operadores: marca `expired` mensagens cujo prazo acabou e `dead` mensagens que esgotaram cinco tentativas. Não mexe em mensagens com `lease_until` no futuro (entrega possivelmente em andamento). Retorna **somente contagens**, sem IDs ou conteúdo de e-mail.
- `accountMailMetrics(pool)` — snapshot interno somente-leitura: contagens por `pending/sending/delivered/expired/dead`, número de mensagens **já elegíveis para claim** e idade máxima desse conjunto em segundos. Exclui leases ativos e mensagens ainda em backoff; não inclui destinatário, identificador, token nem segredo.
- `claimAccountMail(pool)` — não seleciona registros cujo `expires_at` já passou; o operador deve primeiro rodar reconciliação para fechar pendências expiradas.
- `processOneAccountMail(pool,...)` — updates de ACK/falha passam a exigir **mesmo número de tentativa e lease ainda válido**, impedindo que um worker atrasado finalize uma mensagem já retomada. Chave de cifragem histórica ausente deixa mensagem pendente com atraso de cinco minutos, **sem gastar o orçamento de tentativas**, para permitir recuperação operacional. Retém ciphertext.
- Integração PostgreSQL descartável `account-mail-operations.integration.test.mjs`: duas reconciliações concorrentes sem dupla finalização; não tocar em lease ativo; expiração e exaustão; ausência de chave; nenhuma mensagem enviada; contadores sanitizados; recuperação posterior de lease antigo; idempotência da reconciliação. Teste antigo de expiração atualizado para exigir manutenção explícita, e registrado em `test:integration`.

## Segurança e limitações

**Nenhum worker é instalado ou ativado em produção.** Nenhum endpoint público de manutenção ou métricas foi exposto. Proibido passar a métrica por resposta HTTP pública, gravar ciphertext em log ou configurar chaves reais sem autorização e isolamento.

É um sistema de entrega **at-least-once**; durante crash entre resposta do Resend e ACK, a mesma chave de idempotência é reapresentada. É necessário verificar limites e retenção desse recurso no provedor. O ACK condicionado ao lease protege o estado local; o provedor externo ainda pode ter aceitado uma mensagem antes do ACK. A checagem de token segue pré-envio, não é uma transação que se estende pela rede.

O estado `dead` precisa de procedimento manual de investigação e nova emissão de token, **nunca** replay automático de token já expirado. Antes de beta: credenciais e keyring versionadas, worker supervisionado, alertas para `dead`, backlog e bloqueio de chave histórica, restore REAL Railway, Resend real e revisão LGPD. Não inventar evidência de segurança ou de envio real.

## Sequência de PRs

23D2 depende de 23D1 (#233), 23D0 (#232), 23C9 (#231), 23C8 (#230) e 23C7 (#229), ainda não integradas à main. Requer CI PostgreSQL 18 e regressão geral aprovadas no SHA final, revisão do código e merge em ordem. Cadastro continua OFF, `/play` local sem migração, Regiões 1v1 `team[0]`, Ginásios 3v3 com trio escolhido antes na Coleção, HMAC e recompensas inalterados.

### Próxima etapa

23D3: auditoria de recuperação de mensagens de chave antiga, detecção de backlog por limiar, testes de falha/restart e prevenção de envio de tokens após revogação em concorrência — sempre no ambiente isolado.
