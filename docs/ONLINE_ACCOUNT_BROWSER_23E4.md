# ONLINE-01C-23E4 — Jornada real de conta no navegador (somente CI)

Este recorte acrescenta uma nova regressão automatizada de ponta a ponta. O teste `tests/e2e/account-browser.mjs` inicia **três processos locais** no GitHub Actions: API isolada (`NODE_ENV=test`, contas permitidas apenas no harness), servidor web com proxy privado para essa API, e servidor web sem proxy que representa o site publicado com o cadastro bloqueado.

A integração usa uma instância temporária PostgreSQL **18** criada pelo serviço do próprio job. Nenhum PostgreSQL do Railway, e-mail real, Resend, save local de usuário ou dado do jogo publicado é acessado.

## Cobertura no Chromium

- Tela pública em viewport mobile: `/api/v1/status` indisponível, botão de cadastro desativado, caminho `/play` preservado.
- Tela de teste em desktop: cadastro real pelo formulário, rejeição local de confirmação de senha incorreta e registro de conta fictícia pelo proxy.
- Login negado para e-mail não verificado; link `/verify-email?token=…` de uso único emitido apenas pelo harness, removido do endereço antes de confirmação.
- Login real com cookie e sessão vinculada ao próprio jogador, validado por `/api/v1/me`.
- Solicitação de recuperação pelo formulário, token exclusivo **somente para teste**, página `/reset-password?token=…`, confirmação de nova senha e redefinição real.
- Sessão antiga revogada após reset; reaproveitamento de token rejeitado; senha anterior não autentica e nova senha autentica.
- Falhas de execução JS no navegador são rejeitadas; conta fictícia é eliminada do PostgreSQL descartável após o teste.

## Infraestrutura e restrições

Workflow dedicado `.github/workflows/account-browser.yml` com Postgres18, npm lock reproduzível, bundle do game-core canônico, build de `/play`, migrações transacionais e Chromium Playwright. O teste verifica explicitamente `NODE_ENV=test` e `DATABASE_URL` localhost no banco `kanto_ci`; **falha fechado** em qualquer outro destino.

Este teste é uma **evidência de software**, não é prova de entrega real de e-mails pelo Resend, de restauração controlada real de backup Railway, de pronta execução de requisitos LGPD ou de segurança de uma produção aberta. Cadastro e login públicos continuam indisponíveis. A futura home `/` já existe; `/play` e save local permanecem sem migração. Regiões 1v1 e Ginásios 3v3 não sofrem modificações.

## Correção encontrada pelo navegador

O primeiro ensaio detectou autenticação HTTP 200 seguida de sessão 401 no Chromium. A causa foi identificada: o cookie `__Host-kanto_session` estava sem `Secure` em `NODE_ENV=test`, apesar de o prefixo `__Host-` exigir esse atributo em **todos** os ambientes. A API agora define `Secure` sempre; teste PostgreSQL verifica a flag e o E2E deve provar que o navegador realmente preserva a sessão em loopback. Esta correção reforça a configuração de produção (onde `Secure` já era emitido). Não altera mecanismos de autenticação, tokens, banco ou dados existentes.
