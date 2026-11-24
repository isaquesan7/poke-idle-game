# 23F8B — contrato HTTP de expedição


## ONLINE-01C-23F8B — contrato HTTP de Expedição CI-only
- Depende #280. GET current autenticado/verificado, revisão e relógio PG, líder fixo, região e elegibilidade derivada do catálogo, preview pelo reducer real sem gravar. POST start/claim/stop com shape estrito, CSRF, throttle e relógio exclusivamente DB. Proxy somente opt-in test; produção 503 API/404 Web. E2E browser HTTP usa fixture envelhecida apenas no PG18 e verifica cap, tempo adulterado, duplicate e stop. Sem interface visual nesta etapa (evitar conflito landing #279); próximo 23F8C cronômetro e UI após reconciliação. Cadastro OFF; sem SQL novo; CI pendente.
