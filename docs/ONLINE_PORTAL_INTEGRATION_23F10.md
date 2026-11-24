# 23F10 — integração conjunta do portal


## ONLINE-01C-23F10 — integração conjunta dos painéis (candidata)
- PR #279 consolida #278 (estado Gym, CI anterior verde exceto geral pendente), #279 (UI Gym, seis CI SUCCESS anteriores), #282 (UI expedição, seis CI SUCCESS anteriores) e #283 (loja, PG18 SUCCESS anterior, CI final pendente). Main base 763736fc7d6517059df44ea0d1b94c136573b4c5 publicada web/API. Todos os writers e gates CI-only preservados; uma jornada browser regional → expedição → compra → Gym → recuperação de conta, com bloqueios cruzados, revisão comum e recarga. Não mesclar branches concorrentes separadamente; #279 será a integração única depois de CI completo no HEAD exato. Fechar PRs absorvidos apenas após merge confirmado. Cadastro OFF, sem SQL novo ou alteração econômica; /play intacto. Próximo: CI final e Railway, só então evoluções/golpes.
