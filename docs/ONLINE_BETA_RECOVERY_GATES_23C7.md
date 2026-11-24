# ONLINE-01C-23C7 — Gates operacionais do beta (24/11/2026 UTC)

## Base verificada (não confundir com beta liberado)

- Main `7b2981dfa610ca66e0bfc0ecfd9a4c2bb026db26` (PR #228): jornada HTTP autenticada Coleção → Brock → certificado → pagamento em PostgreSQL descartável, exclusivamente no harness `NODE_ENV=test`.
- Railway projeto `kanto-idle-lab` (`d4867d1e-3f02-4b3d-a52a-bc4be07d46ab`), ambiente `production` (`dffdf664-9fc0-42c1-a16d-a9182cc91ea9`): API `kanto-idle-api`, web `kanto-idle-web` e `Postgres` existem. API deployment `e63fa3a1-6982-4f1f-b404-0d515f56f292` e web `8ce7237e-9f36-43c0-b883-c5eb6c34f680` SUCCESS com SHA exato `7b2981d...`. PostgreSQL 18 com volume persistente `postgres-volume` de 50.000 MB em `/var/lib/postgresql/data`.
- Volume persistente, deploy saudável e integração CI **não comprovam backup/PITR nem restauração**. Nenhum restore ou snapshot de produção foi executado nesta fase.
- Cadastro público OFF; rotas Gym HTTP apenas CI/test. Não importar save de `/play`, não expor HMAC/seed, não modificar `isaquesan7/pokedex`.

## Gate A — Recuperação REAL do PostgreSQL do Railway (BLOQUEADO)

1. Confirmar no painel Railway do serviço PostgreSQL, no ambiente **production**, suporte e configuração efetiva de backups/snapshots e retenção/PITR do plano atual. Registrar horários (UTC), janela de retenção, política de exclusão e proprietário da operação. **Não presumir PITR pelo simples fato de haver volume.**
2. Produzir ponto de restauração real: snapshot/backup concluído, com identificador, horário e tamanho (sem URLs assinadas, credenciais ou conteúdo do banco em logs/PR). Se PITR for oferecido, registrar o instante alvo e a janela disponível.
3. Restaurar **somente em serviço/ambiente isolado** com volume e credenciais novos, nunca sobrescrever o PostgreSQL de production e nunca apontar API/web reais ao clone. Para dados sensíveis, limitar acesso e eliminar clone após a auditoria.
4. Antes do teste, capturar um marcador de integridade não sensível no banco de origem (versão de migração, contagem agregada de tabelas e checksum de fixture não pessoal). Na réplica restaurada comparar: integridade `pg_checksums` quando aplicável, conectividade, versão PG, esquema/migrações, contagens e relações de FK; executar transação de escrita **somente na réplica**, rollback e leitura posterior.
5. Se houver PITR, validar também restauração a um instante intermediário documentado com marcador descartável; não simular PITR com `pg_dump`. Um dump lógico pode ser mecanismo auxiliar, mas não prova PITR.
6. Registrar resultado: horário UTC, responsável, backup/restore IDs, RPO observado, RTO observado, versão da app, verificações aprovadas/reprovadas, plano de resposta a falha. **Não marcar aprovado sem execução real**.
7. Destruir recursos temporários após exportar evidência não sensível. Confirmar que URLs, variáveis e chaves do ambiente de production permaneceram intactas.

Critério de saída A: restore isolado efetivamente executado, consistência comprovada, RPO/RTO aceitos pelo responsável, restauração e recuperação reexecutáveis e evidência auditável. Se PITR indisponível, definir proteção substituta e obter aprovação explícita do risco antes do beta.

## Gate B — E-mail transacional e identidade (BLOQUEADO)

- Verificar domínio/remetente Resend, SPF/DKIM/DMARC quando aplicável, chave privada provisionada somente nas variáveis seguras do backend e limites.
- Exercitar cadastro → verificação de e-mail → login → sessão → logout → recuperação/expiração de token, em ambiente não público, com e-mail de teste controlado. Verificar links expirados, tokens usados, tentativas excessivas, duplicidade de e-mail e ausência de enumeração.
- Impedir vazamento de tokens em logs, URLs de analytics e mensagens de erro. Registrar somente IDs de execução e resultados sanitizados.
- Cadastro e rotas de produção permanecem desativados até aprovação explícita de todos os gates.

## Gate C — LGPD, abuso e disponibilidade (BLOQUEADO)

- Publicar e revisar Política de Privacidade e Termos; definir dados coletados, finalidade/base legal, retenção, exclusão/exportação do usuário, canal de contato e regras para menores.
- Auditar cookies seguros, `SameSite`, `HttpOnly`, rotação/revogação de sessão, CORS/Origin/CSRF, proteção de cadastro/login/reset por IP+conta, limites por ação de jogo, ownership e bloqueio de IDOR.
- Validar concorrência/replay para ações econômicas, rate limits e isolamento entre contas; checar se a API rejeita toda entrada de seed/HMAC/preço/recompensa e se não existem atalhos de teste habilitados em production.
- Definir observabilidade sem PII/segredos, alarmes de erro, indisponibilidade do banco, tentativas abusivas e integridade dos recibos; documentar rollback seguro.
- Rodar CI completo e testes de browser desktop/mobile no HEAD que de fato será publicado, verificar deploy no SHA correspondente, logs de migração e smoke test real sem permitir contas públicas antes dos gates.

## Matriz de liberação

| Gate | Estado em 24/11/2026 | Evidência exigida |
| --- | --- | --- |
| Jornada Gym HTTP end-to-end em CI com engine canônica | Implementada na main; confirmar status CI do HEAD se necessário | Workflow GitHub PG18 + regressão |
| Railway API + web alinhados à main | Verificado SUCCESS, SHA `7b2981d` | Deploy IDs acima |
| Backup e PITR restaurados em Railway REAL | NÃO VERIFICADO / BLOQUEADO | Restore isolado + RPO/RTO + consistência |
| Resend fim-a-fim | NÃO VERIFICADO / BLOQUEADO | Fluxo de e-mails e revogação testados |
| LGPD, sessão, segurança e suporte | NÃO VERIFICADO / BLOQUEADO | Revisões e testes auditáveis |
| Cadastro público / save remoto no `/play` | DESATIVADOS | Somente após todos os gates |

## Próxima implementação segura

ONLINE-01C-23C8: preparar automação de evidências e testes não destrutivos de backup/recovery e identidade, sem ler/expor credenciais, sem criar rota pública e sem executar restores em produção. Ao final, submeter relatório de aprovações para decisão de habilitar beta. Preservar Regiões 1v1 (`team[0]`), Ginásios 3v3 escolhidos antecipadamente na Coleção, o core local canônico, save `/play` local sem migração e todo o pipeline de recompensas server-only.
