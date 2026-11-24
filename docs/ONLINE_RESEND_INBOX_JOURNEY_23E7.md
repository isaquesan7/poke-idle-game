# ONLINE-01C-23E7 — Jornada Resend com remetente de testes (sem domínio próprio)

## Situação real

O operador confirmou recebimento de uma mensagem simples enviada à própria caixa Resend com onboarding@resend.dev. Isso comprova o teste básico informado, não a entrega dos e-mails da aplicação nem um domínio verificado. Nome e domínio definitivos adiados por decisão do operador. Não usar credenciais de outro projeto.

## Implementação

- Comando manual `npm run drill:resend:journey --prefix services/api` inicia a API canônica em porta aleatória no loopback, com banco local descartável já migrado, modo outbox, chave AES e segredo de throttle gerados a cada execução. Chave Resend e destinatário solicitados com entrada oculta, em memória, sem passagem ao subprocesso. Não executar em CI, Railway, produção ou terminal sem TTY. Não escrever a chave em arquivo ou Git.
- Exige `NODE_ENV=test`, `MAIL_DRILL_CONFIRM=SEND_ONE_REAL_MESSAGE`, DATABASE_URL com 127.0.0.1 e banco kanto_mail_drill vazio de contas e mensagens, 25 migrações, CORE_BUNDLE_PATH válido; usar instância local própria, nunca túnel/forward para Railway. Não compartilhar a base com outros processos de aplicação.
- Envia no máximo duas mensagens, **uma por confirmação ENVIAR**, pela fila transacional canônica e transporte restrito à caixa do próprio operador. Remetente literal onboarding@resend.dev. Resend limita o domínio de testes ao e-mail associado à conta. Não permite envio para outros destinatários, nem alteração de origem. Respeitar os limites do provedor.
- O fluxo cria uma conta fictícia, prova bloqueio antes da confirmação, entrega de token via outbox (não via resposta HTTP), consumo único do link recebido, login, reset, novo login, recusa da senha antiga e revogação da sessão anterior. Senhas aleatórias temporárias, nunca imprimir. A pessoa copia o endereço completo do link de cada mensagem diretamente para o terminal privado (não para chat, não abrir o link). O comando valida origem e finalidade antes de consumir o token. URLs HTTPS loopback são identificadores do ensaio, **não existe página aberta nessas URLs**. O consumo ocorre na API local por HTTP loopback com Origin previsto; não é teste de cookie no navegador. O navegador HTTPS já foi testado separadamente em 23E4.
- Registra apenas recibos do provedor, UTC de aceite e resultados. Aceite não comprova evento Delivered nem autentica a observação na caixa postal. Testes CI usam transporte simulado; não enviam e-mail. A expiração de tokens permanece coberta pela integração anterior, não por este ensaio real.
- A produção não passa a registrar contas nem executar worker por causa deste comando. O resultado tem senderDomainVerified=false, providerDeliveryEventVerified=false e publicRegistrationAuthorized=false. A evidência completa 23D6 requer domínio definitivo verificado, eventos do provedor, caixa controlada, expiração/reuso e revisão independente.

## Preparação local (Windows PowerShell)

Pré-requisitos: Git, Node 22.12+ da série 22, npm, PostgreSQL 18 local (por exemplo Docker Desktop local), e checkout do commit aprovado. Não reutilizar o banco do jogo nem o banco restaurado. Em uma pasta do repositório:

1. npm ci --ignore-scripts --no-audit --no-fund
2. npm ci --prefix services/api --ignore-scripts --no-audit --no-fund
3. Definir `$env:CORE_BUNDLE_PATH = Join-Path $env:TEMP "kanto-mail-drill-core.mjs"` e executar `node scripts/build-api-game-core.mjs "$env:CORE_BUNDLE_PATH"`.
4. Criar uma instância Postgres 18 descartável, bind somente 127.0.0.1, database kanto_mail_drill, credenciais locais aleatórias. Definir DATABASE_URL apenas para essa instância local (sem URI options, sem túnel); aplicar `npm run db:migrate --prefix services/api`. Não publicar o PostgreSQL na rede.
5. Definir `$env:NODE_ENV="test"` e `$env:MAIL_DRILL_CONFIRM="SEND_ONE_REAL_MESSAGE"`.
6. Rodar `npm run drill:resend:journey --prefix services/api`. Digitar e-mail próprio e chave apenas quando solicitado, autorizar cada envio digitando ENVIAR, copiar o link de cada mensagem recebida (endereço completo, sem encurtador/redirect; não abrir). Se falhar, não enviar repetidamente nem reaproveitar a base; diagnosticar a etapa e usar nova base descartável. Não colar tokens em chat ou logs; limpar clipboard ao terminar.
7. Conferir os dois eventos Delivered no painel Resend, verificar recebimento na caixa e guardar referências sanitizadas, sem link, endereço ou senha. Encerrar a instância descartável após revisão e limpar as variáveis do terminal. O comando não destrói automaticamente dados.

O nome Poke Idle Game é provisório, não exige domínio nem marca definitivos. Não alterar regras 1v1, Gym 3v3, save local /play ou gates de lançamento. Restauração PITR real e auditoria estrutural registradas em 23E6, mas ambiente separado, checksums, RPO/RTO e revisão independente continuam pendentes.
