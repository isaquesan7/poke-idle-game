# ONLINE-01C-23E2 — Exportação autenticada por HTTP (somente harness de teste)

## Objetivo
Conectar o rascunho interno de portabilidade 23D8 a uma rota real de teste, sem expor dados de jogadores em produção. A rota POST /api/v1/account/export fica **indisponível em produção por código**: exige NODE_ENV=test e ONLINE_REGISTRATION_ENABLED=true, com a mesma proteção aplicada ao cadastro.

## Controles implementados
- Apenas POST com Origin exatamente igual ao APP_ORIGIN, autenticação por cookie HttpOnly, sessão ativa e conta com email verificado.
- A identidade da conta é obtida exclusivamente pela sessão no servidor. O cliente não escolhe accountId; campo extra recebe erro 400.
- Reautenticação pela senha atual antes da exportação, sem enviar ou armazenar senha na resposta.
- Rate limit persistido em PostgreSQL por ID de conta: 3 tentativas por 15 minutos, inclusive tentativas de senha incorreta (scope privacy-export-account).
- Resposta 200 é JSON com Cache-Control no-store, Content-Disposition attachment e X-Robots-Tag noindex, nofollow; sem CORS e com cabeçalhos de segurança já padronizados.
- Usa exportAccountData: transação PostgreSQL repeatable-read somente leitura, filtros por owner em todas as consultas; sem hash de senha, digest de sessão, tokens, enfileiramento de emails, nem dados de outras contas.
- Teste de integração HTTP cria dois usuários fictícios com e-mails verificados e saves distintos em PostgreSQL18 descartável. Cobre 401, 400 para Origin inválido, senha incorreta, isolamento por conta, conteúdo, throttling 429 e campos não permitidos. Teste do modo NODE_ENV=production exige 503 mesmo com ONLINE_REGISTRATION_ENABLED=true.

## Limites para LGPD e produto
Esta exportação **ainda é parcial**: não contém todas as categorias possivelmente relacionadas ao jogador (por exemplo, históricos detalhados de batalha e reservas); ainda faltam fluxo de solicitação, entrega segura ao usuário, retentiva formal, processamento de requisições, proteção de acesso ao arquivo após download e revisão jurídica. O novo endpoint de teste não altera privacy.dataExportReviewed e não autoriza ativar registros públicos.

## Compatibilidade
Sem novas migrações; sem alterações no Railway, senhas de produção, entrega Resend, engine de batalha ou saves do navegador. /play local permanece; Regiões 1v1 usam team[0], Ginásios 3v3 dependem da equipe previamente montada na Coleção. Restore Railway real, Resend real, segurança/LGPD e proxy continuam pendentes de homologação.
