# ONLINE-01C-23D8 — Portabilidade interna de dados da conta (rascunho seguro)

## Implementação

Módulo `services/api/src/accountPrivacy.mjs` fornece `exportAccountData(pool,{accountId})` **somente para backend confiável**. Usa `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, accountId UUID validado, filtro por conta na consulta de cada tabela e campos explicitamente permitidos. Nenhuma rota HTTP pública, nenhum job, nenhuma variável Railway ou segredo alterado.

Os dados retornados abrangem conta (ID, e-mail e carimbos de criação/verificação), perfil (nome público do treinador), um save canônico (estado completo e revisão), e recibos de ações (actionId, tipo, revisão e data). A resposta **não inclui** password_hash, digest de sessão, tokens de verificação/redefinição, chaves HMAC, payload criptografado da fila de emails ou registros de outra conta. A consulta falha se houver mais de 10 mil recibos — não trunca silenciosamente a exportação.

A implementação é **um rascunho parcial de portabilidade**, não corresponde a um acesso LGPD integral: faltam ainda histórico de sessões/segurança, filas de e-mail com metadados apropriados, reservas e recibos detalhados de batalhas, fluxos de verificação da identidade do requerente, entrega protegida, solicitação autenticada e auditável, política de retenção e exclusão, tratamento de dados em backups, limitação de acesso e aprovação legal. **Não** marcar `privacy.dataExportReviewed` ou `privacy.accountDeletionVerified` como `true` por conta deste módulo.

## Testes

Teste `tests/account-privacy.integration.test.mjs` executa em PostgreSQL18 descartável e cria duas contas fictícias distintas, sessão e saves. Garante isolamento, ausência de credenciais, formato e ausência de escrita no export. Remove fixtures após execução. CI PG18 e regressão geral são critérios de merge.

## Continuação

1. Desenhar exclusão sob transação e provas de exclusão de dados dependentes, incluindo reservas, outbox e recibos, com retenções legais e backups revisados.
2. Projetar endpoints de solicitação de exportação/exclusão só após autenticação forte, confirmação de identidade, proteções CSRF, rate limits, auditoria e política LGPD.
3. Avaliar comportamento de `requesterIp` por trás do proxy e custos de abuso antes do cadastro.
4. Backup Railway **REAL** restaurado isoladamente, e-mails **REAIS** Resend comprovados, revisão LGPD e autorização independente permanecem gates.

Sem alterações no motor canônico: Regiões 1v1 usando `team[0]`, Gym 3v3 com trio definido antes na Coleção, `/play` local e sem migração.
