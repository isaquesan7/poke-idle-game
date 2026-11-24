# ONLINE-01C-23E9 — Primeira revisão da fronteira web/API

## Achados e correções

- O proxy tinha allowlist de rotas, mas repassava cabeçalhos arbitrários que não faziam parte do protocolo. Agora repassa apenas Content-Type, Origin, Cookie e Accept, remove também os campos nomeados por Connection, e usa allowlist de resposta (inclui Set-Cookie e Retry-After). Cache-Control no-store, X-Content-Type-Options nosniff, X-Frame-Options DENY e Referrer-Policy no-referrer são impostos pelo próprio proxy.
- Métodos por rota: GET status/me/save, POST para as rotas de ação existentes. Não expande a allowlist de caminhos, não cria endpoint, não abre cadastro.
- POST tem limite de 16 KiB, inclusive uploads chunked; proxy recebe o corpo completo antes de enviar ao backend, com prazo de 10 segundos. Rejeita uploads maiores, GET com corpo, interrompidos ou expirados sem começar o writer. Não equivale a WAF ou limite global de conexões.
- Testes de regressão cobrem cabeçalhos falsos (X-Real-IP, X-Forwarded-For, identidade interna e Authorization), métodos incompatíveis, uploads excessivos e cabeçalhos de resposta. Cookie e Origin legítimos e Retry-After continuam preservados. CI PG18, navegador e geral obrigatórios antes de merge.

## Identidade e quotas: bloqueio preservado

A API usa req.socket.remoteAddress, não cabeçalho fornecido pelo cliente. Atrás do proxy isso pode agrupar jogadores na mesma quota de IP. A documentação Railway (https://docs.railway.com/networking/public-networking/specs-and-limits, consultada 24/11/2026) descreve X-Real-IP, mas o comportamento de sobrescrita de valores injetados pelo cliente ainda precisa de comprovação em ambiente isolado, inclusive IPv6, duplicidade, caminho privado e acesso direto. Não confiar cegamente em X-Forwarded-For, X-Real-IP ou cabeçalho interno. A próxima etapa deve provar a fronteira de confiança, autenticação interna e separação de quotas (sem registrar IP bruto no banco). Não configurar ONLINE_API_INTERNAL_URL, segredos ou flags em produção nesta etapa.

## Estado de homologação

PR #249, commit e501e4e5bda242ff71f636b2ab2c7b4e553a81af, CI PG18/browser/geral e Railway API/web SUCCESS. PR #250 documenta a jornada real sandbox e Delivered observado pelo operador; domínio definitivo e prova formal de eventos/revisão seguem pendentes. Restore real registrado em #248; RPO/RTO, checksums e ambiente distinto ainda pendentes. Privacidade/LGPD e segurança operacional não aprovadas por esta correção. Sem alteração no motor, /play local, sem migração de saves, Regiões 1v1, Gym 3v3 da equipe escolhida na Coleção. Nome provisório preservado, cadastro público OFF.
