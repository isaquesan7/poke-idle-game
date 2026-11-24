# ONLINE-01C-23C8 — Verificação offline dos critérios do beta

Esta etapa adiciona `services/api/src/betaReadiness.mjs` e testes unitários de um **avaliador local, offline, fail-closed**. O comando lê exclusivamente um JSON sanitizado passado pelo operador:

```sh
cd services/api
node scripts/check-beta-readiness.mjs /caminho/fora-do-repo/evidencias-sanitizadas.json
```

O programa **não** acessa Railway, GitHub, Resend ou PostgreSQL; não gera backup, não restaura dados, não valida automaticamente a autenticidade de atestações e **não** habilita cadastro. É uma segunda conferência de preenchimento/consistência, nunca substitui auditoria humana e evidência técnica.

O arquivo JSON deve conter um `headSha` de 40 caracteres e `gates` com os nomes `ci`, `railway`, `restore`, `resend`, `privacy` e `security`. Cada gate precisa ter `passed: true`, `reference` (identificador de evidência não sensível), `checkedAt` (UTC ISO-8601) e `reviewer` (papel/revisor). Campos adicionais obrigatórios:

- `ci.commitSha` = `headSha`.
- `railway.apiCommitSha` e `railway.webCommitSha` = `headSha`.
- `restore.isolated`, `actuallyRestored`, `integrityVerified` = `true`; `backupId`, `restoreId` presentes; `observedRpoMinutes` e `observedRtoMinutes` medidos e não negativos.
- `resend.domainVerified`, `verificationDelivered`, `resetDelivered`, `expirationTested` = `true`.
- `privacy.privacyPolicyUrl`, `termsUrl` preenchidos, `retentionApproved` e `deletionFlowReviewed` = `true`.
- `security.sessionReviewed`, `csrfReviewed`, `rateLimitReviewed`, `ownershipReviewed`, `productionHarnessDisabled` = `true`.

Saída `ready: false` / exit code **1** se qualquer requisito não foi comprovado ou está inconsistente. JSON inválido / ausência do arquivo retorna **2**, validado retorna **0**. **Nunca** passar credenciais, e-mails pessoais, tokens HMAC, URLs assinadas ou dados de clientes na evidência; manter o JSON fora do repositório. Valores `passed` só devem ser preenchidos após inspeção independente das provas, jamais presumidos com base em deploy SUCCESS, volume persistente ou testes com mock.

## Estado real da etapa

- Código de conferência e casos de teste adicionados em branch derivada da PR #229, aguardando CI e revisão.
- Nenhuma restauração real executada; gate de backup/PITR continua **bloqueado**.
- Nenhum envio real de verificação/reset feito; gate Resend continua **bloqueado**.
- As demais revisões legais e de segurança não estão homologadas.
- Cadastro permanece **OFF** e `/play` continua LOCAL sem migração.
- Regiões são 1v1 (`team[0]`); Ginásios são 3v3 com equipe definida antecipadamente na Coleção, motor canônico e pagamento server-side.

## Próximo passo

Executar e documentar restore seguro em clone de Railway *com aprovação operacional*, verificar entregabilidade Resend em ambiente isolado, revisar privacidade e segurança; somente depois alimentar o avaliador com referências reais. Não promover esta etapa a release nem interpretar `ready: true` de dados inventados como autorização de beta.
