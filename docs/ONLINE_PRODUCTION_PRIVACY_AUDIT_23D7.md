# ONLINE-01C-23D7 — Matriz de bloqueio de produção e inventário de privacidade

## Entregue na branch

- Novo teste `tests/production-lockdown.integration.test.mjs` inicia API com `NODE_ENV=production` **num PostgreSQL 18 descartável** e `ONLINE_REGISTRATION_ENABLED=true` deliberadamente incorreto. Ele exige `503` em **seis rotas de autenticação e oito rotas de escrita do jogo**; `/api/v1/me` e `/api/v1/save` devem retornar `401` com cookie falso. Exige ausência de permissões CORS, cookie de sessão, cache, embedding e vazamento de bearer token nas recusas.
- O teste mede contagens de contas, sessões, saves e fila de e-mails **antes e depois das requisições negadas** no banco descartável, sem logs de identidade pessoal.
- A porta local fixa do teste é `43158`, sem qualquer efeito sobre o Railway.
- O `betaReadiness.mjs` agora exige também `privacy.dataExportReviewed`, `privacy.accountDeletionVerified`, `security.productionRouteLockdownVerified` e `security.reverseProxyRateLimitReviewed`. Isso é um **fail-closed de revisão**, não uma implementação dos fluxos ausentes e nem atestado automático da LGPD.

## Inventário de privacidade, observações e pendências

**Dados sensíveis e identificadores atualmente previstos pelo modelo online:** e-mail da conta, hash da senha, nome público do treinador, IDs de conta e saves, históricos de batalhas, recibos de ações, tokens de sessão/verificação/redefinição **somente em digest**, payload da fila de e-mail criptografado, carimbos de expiração e digest HMAC de limites de abuso. A classificação definitiva e o prazo de retenção de cada tabela precisam de revisão antes de permitir contas.

**Exportação/acesso:** ainda não existe um fluxo público implementado e revisado que exporte dados de uma conta de forma autenticada e limitada; o gate `dataExportReviewed` deve ficar falso até implementação, testes de autorização, proteção contra IDOR e política de entrega segura.

**Exclusão:** também não existe fluxo público implementado, revisado e testado para exclusão integral/anonimização conforme retenções legais, revogação de sessões, expiração da outbox, recibos econômicos, backups e controle de repetição. `accountDeletionVerified` deve ficar falso até comprovação ponta a ponta em banco isolado, incluindo a política para backups.

**Menores e LGPD:** políticas de privacidade e termos devem ser aprovados pelo responsável legal. Não inventar URLs, base legal, período de retenção ou atendimento de solicitações; revisão jurídica e operacional independentes são obrigatórias antes do beta.

## Risco específico de proxy no Railway

`authSecurity.mjs::requesterIp` usa o IP do par TCP (`req.socket.remoteAddress`) e **ignora cabeçalhos forwarded** para evitar spoofing. Atrás de um proxy reverso que conecta todos os usuários ao mesmo peer IP, uma cota por IP pode ser compartilhada por todos, bloqueando usuários legítimos e prejudicando a defesa contra abuso. **Não** usar `X-Forwarded-For` arbitrário: somente um pipeline de identidade de cliente com lista de proxies confiáveis e teste de spoofing pode ser aprovado. O gate `reverseProxyRateLimitReviewed` fica bloqueado até verificação do proxy real, distribuição de IPs e limites de abuse sob concorrência.

## Fronteira de lançamento

O **harness test-only** permanece fechado em produção pelo duplo critério `NODE_ENV==='test' && ONLINE_REGISTRATION_ENABLED==='true'`; o novo teste protege essa regressão. O cadastro público, save online e quaisquer rotas de alteração não são liberados por esta PR. Regras do motor local, Regiões 1v1 `team[0]`, Ginásios 3v3 com equipe previamente definida na Coleção e `/play` local permanecem intactos.

O beta continua bloqueado até: restore REAL Railway isolado com RPO/RTO e validação independente, Resend real entregue e observado, fluxo real de exportação/exclusão, revisão dos controles de proxy/abuso e aprovação jurídica/segurança. Nenhuma validação offline equivale a execução real.
