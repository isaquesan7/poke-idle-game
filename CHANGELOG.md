# CHANGELOG — Poke Idle Game
Histórico de entregas. **Toda atualização futura deve acrescentar uma entrada aqui** e atualizar `docs/PROJECT_STATE.md` no mesmo trabalho. Não reescrever/ocultar histórico. Use data, escopo, commit, testes, deploy e pendências.

## [Unreleased]
- 2026-11-17 · **Golpes por UID em branch `feat/v02-pokemon-move-reducers-main-synced` (CI/PR pendentes):** reducer puro para seleção/upgrade com orçamento `floor(level/5)`, teto `min(10,floor(level/10)+1)` e preservação de recursos; testes Vitest adicionados. Metadados de golpes são parâmetros sem prova de origem. Sem gravação nem alteração na UI pública. Próximo: validar CI/PR; continuar paridade e contrato de writer único.
- **2026-11-17 · Eventos idempotentes puros validados:** PR #22 merged em `989c2cdc`, CI PR `44056942594` e CI pós-merge `44057278833` SUCCESS, Railway `5b76abc6` SUCCESS. Envelopes RAM com replay/id/revision para batalha pré-resolvida/captura e expedição; nenhuma mudança na v0.1 pública nem writer v0.2. Próximo: autoridade única e motor de combate verificável.
- 2026-11-17 · **Eventos de recompensas idempotentes em RAM (branch `feat/v02-idempotent-reward-events`, CI pendente):** `RewardJournal` com `revision`, `receipts` e IDs por evento, captura atômica em resultado de batalha resolvido, eventos para iniciar/resgatar/encerrar expedição, progressão XP via core, 8 insígnias cumulativas e afinidade. Replay idêntico retorna `duplicate`; ID conflitante e revisão stale são recusados. Sem persistência, RNG, autoridade de combate nem garantia entre envelopes separados. `cutoverGate` segue bloqueado, sem UI/save v0.2 oficial.
- **2026-11-16 · Paridade parcial de Pokémon/equipe validada:** PR #20 merge `5e60f17b`, Railway deploy `da78ab5a` SUCCESS; GitHub Actions pós-merge `43996462703` SUCCESS. Reducers puros sem side effects, budget Pokémon `(level-1)*2`, UIDs por instância, equipe 1–3 e bloqueio em expedição; sem writer real. Próximo: batalha/expedição idempotentes e segurança de writer único.
- 2026-11-16 · **Redutores puros de Pokémon/equipe (branch `feat/v02-pokemon-team-pure-reducers`, PR em validação):** módulo `game-core/src/legacy/pokemonTeamReducer.ts` com treino +1 por UID, redistribuição por instância, adição/remoção de equipe e regras do legado (2 pontos por nível; **sem teto 40 por atributo para Pokémon**; equipe 1–3, congelada em expedição). Validação de UID, budget, estrutura e versão; preservação de XP, moedas, afinidade, insígnias, golpes e campos desconhecidos. Testes Vitest de integridade, falhas e determinismo. Somente funções puras: nenhum save ou rota pública alterado. CI, PR e Railway pendentes.
- **2026-11-16 · Gate de ativação v0.2 aprovado e integrado:** PR #18 merged SHA `64992f90`, Railway deploy `4009f1a4-6dd9-4a4f-9859-7bc92684caa7` SUCCESS e CI da main `43994224019` SUCCESS. Diagnóstico React fail-closed, matriz de 21 ações legadas e teste Node para detectar alterações não auditadas. Jogo público e save v0.1 intactos, sem writer oficial. Próximo: reducers de gameplay e controle de idempotência antes de cutover.
- **2026-11-16 · Gate de cutover fail-closed + auditoria de mutações v0.1 (PR em revisão):** `cutoverGate.ts` sempre bloqueia ativação, inclusive com save válido/Web Locks, expõe motivos do preflight, dados reservados v0.2, fonte instável e pré-requisitos de release; painel React informa bloqueios sem botão de migração. Nova matriz `docs/LEGACY_MUTATION_MATRIX.md` documenta 21 ações e escritores indiretos do `index.html`, com teste de regressão da lista. Vitest + Playwright do gate. Zero alteração de saves, runtime público ou GIFs. CI/merge ainda a validar.
- **2026-11-16 · Browser sandbox validado e integrado:** PR #16 merged `977d14a9`. Railway `54ccff55-8225-4057-b7ee-82756487d94d` SUCCESS; CI pós-merge `43991985570` SUCCESS (core, web, GIFs e E2E do jogo, React, draft e browser sandbox). Exercícios reais em origem localhost com Web Locks entre abas, erro QuotaExceededError, crash/reload e rollback apenas de dados de teste. Nenhuma alteração na interface ou save público v0.1. Próximo: gate de writer único, cutover opt-in e paridade total antes de permitir progressão real v0.2.
- 2026-11-16 · PR de laboratório de navegador real: `browserSandboxCutover.ts` usa somente chaves `__kanto_lab__*` e exige `http://localhost`/`127.0.0.1` na rota `/__kanto_v02_browser_lab__`. Ensaios Web Locks entre abas, crash/reload, quota nativa do Chromium, revisão de journal, conflito legado e rollback explícito preservando backup. Novo E2E automatizado na `main-regression.yml`; sem importação no React público, sem tocar chaves v0.1/v0.2 e sem writer oficial. Ainda em PR, sem deploy nesta entrada.
- **2026-11-16 · Laboratório seguro de migração v0.2 integrado:** PR #14 merged `455c29a9`, Railway deploy `b621615b` **SUCCESS**, CI da `main` `43989615947` **SUCCESS**. Cenários de quota, crash, writer v0.1 divergente, double-submit e revisão stale somente em `Map` privado com confirmação; E2E desktop/mobile e capturas revisadas. Jogo público/saves v0.1 preservados. Próximo: política de cutover/writer único e rollback real antes de ativar qualquer gravação.
- 2026-11-16 · **Laboratório opt-in de cutover v0.1→v0.2 (branch `feat/v02-cutover-memory-laboratory`):** classe `MigrationMemoryLab` com `Map` privado e nenhuma dependência de armazenamento do navegador, confirmação explícita, ensaio de backup → candidato → marcador, quota limitada ou falha injetada, crashes em três etapas, conflito com aba legada, double-submit e revisão stale entre abas simuladas. Painel React exclusivamente experimental e E2E desktop/mobile conferem zero gravações nas chaves reais. Não ativa migração, restauração nem writer v0.2. CI e revisão pendentes nesta entrada.
- **2026-11-16 · Finalização do protocolo experimental v0.2:** PRs #11 (recuperação SHA-256, bloqueios/revisões Web Locks) e #12 (E2E de fallback GIF sem cache intermitente) integradas até `db10572b`. Railway deploy `293781a0-ded3-4b72-906f-feab1baca563` SUCCESS e CI `main` `43987571827` SUCCESS. Runtime público e save v0.1 preservados, sem migração real; próximo: laboratório de cutover opt-in isolado.
- 2026-11-16 · **PR #11 integrada:** SHA `9369e4a4`, Railway deploy `ae239947-8f72-4827-b277-4846495879a2` SUCCESS. CI da PR `43986588480` SUCCESS, screenshots revisadas; UI pública v0.1 permanece inalterada, backup/coordenação restritos à prévia e testes.
- 2026-11-16 · **Correção de flakiness no E2E legado (branch `fix/legacy-e2e-fallback-cache-and-handoff`):** CI pós-merge `43986967633` falhou esperando fallback PNG de #25 porque rota 404 foi instalada após o navegador cachear GIF na Pokédex. Simulação 404 agora começa antes de `page.goto`. Apenas teste/docs, sem mudança do jogo ou saves; nova CI pendente.
- 2026-11-16 · **Proteção de writer e recuperação verificável v0.2 (PR #11 em revisão):** contrato de coordenação Web Locks só para abas v0.2 cooperativas, revisão monotônica, identificação de divergência v0.1/v0.2 sem mesclar dados. A prévia React exporta JSON de recuperação com SHA-256 e confere arquivos externos SOMENTE em memória, sem importar/restaurar. Vitest de concorrência, corrupção, quota/erros e E2E desktop/mobile; **nenhuma gravação oficial habilitada**. Ainda não publicado, aguardando CI.
- **2026-11-16 · Release do contrato de save v0.2 no repositório:** PR #9 merged SHA `bd530666`; Railway deploy `dfca3072-3ef3-4c5f-8113-f525abebc4b1` `SUCCESS`; regressão da `main` workflow `43984189208` `SUCCESS` (TS, Vitest, 151 GIFs, build React, E2E legado/React/draft). Página pública v0.1 não alterada; backup/journal só funções puras e testes, sem gravações nem migração real.
- 2026-11-16: PR #9 aprovada no CI `43983797980` (TypeScript, Vitest inclusive backups, build, GIFs e E2E legado/React/draft). Nenhuma gravação real habilitada; revisão do diff concluída; aguardando merge e deploy.
- **2026-11-16 · Contrato candidato v0.2 e backup recuperável (branch `feat/v02-official-save-backup-contract`):** tipos do save oficial futuro, origem v0.1 copiada fielmente, SHA-256 UTF-8, validação de pacote e simulação de journal com backup, snapshot e marcador final. Testes de crashes/quota/conflito/corrupção; sem executor de escrita, sem alteração de chaves do jogo, sem deploy nesta branch. Próxima etapa: CI e política de writer único.
- **2026-11-16 · Release foundation v0.2 no repositório (runtime v0.1 preservado):** PRs #3–#7 integradas à `main` até commit `b099e750`; último deploy Railway `13d5dd6f-e802-421a-8dc5-1e85ad37577f` em `SUCCESS`; CI permanente em `main` workflow `43982463671` em `SUCCESS` (TS, Vitest, Vite, 151 GIFs, E2E v0.1/React/draft). UI pública continua sendo a v0.1, sem migração de saves; análise de migração futura é apenas leitura.
- 2026-11-16: branch `feat/v02-migration-preflight` adiciona análise somente leitura de prontidão estrutural de saves, testes de conflitos/falhas, relatório na prévia, CI duradouro para main e `docs/SAVE_MIGRATION_PLAN.md`. Não promove rascunho, não grava no progresso real e não está publicada.
- 2026-11-16: PRs #3, #4, #5 e #6 integradas à main (`8fbaf415`, `48977b01`, `0d4bc823`, `af81fdb4`) com deploy Railway SUCCESS em cada etapa. Entrada pública segue sendo o jogo v0.1.
- **2026-11-16 · PR #6 CI aprovado:** workflow `43978606016` em `SUCCESS` (TypeScript, Vitest, build, GIFs, regressão v0.1 e E2E React/draft desktop/mobile), screenshots artifact `14281376764`; SHA verificado `7e353da9`. A PR continua em revisão, sem merge e sem deploy; progresso v0.1 preservado.
- Corrigido invocador Playwright E2E de draft para usar um único argumento serializável em `page.evaluate`; sem alterar o runtime de jogo ou armazenamento.
- Ajuste do type guard TS no editor puro de treinador para garantir `trainer.manual` como objeto antes da atribuição. CI da branch reexecutado; sem efeito em produção.
- 2026-11-16 · **Simulação v0.2 versionada (PR #6 em revisão)**: core puro para distribuir pontos e trocar equipamentos, chave independente `kanto-idle-lab-save-v02-draft` com fonte original e revisão, bloqueio Web Locks, detecção de conflitos, descarte explícito e testes Vitest/Chromium. Nenhuma alteração no save v0.1, sem deploy; CI pendente.
- 2026-11-16: workflow `43975797448` da PR #5 em `SUCCESS`; validações TypeScript, Vitest, build, GIFs e Playwright do jogo antigo e da prévia React aprovadas. Lockfile atualizado em `3754a5ab`, capturas arquivadas em artifact `14281131270`. PR aberta, sem deploy. Revisão visual humana pendente.
- 2026-11-16: branch `feat/react-trainer-overview-v02` contém catálogo fiel de Kanto v0.1, projeção read-only usando `@kanto/game-core`, telas React de visão geral e treinador, paridade e CI desktop/mobile. Sem mudanças no save ou deploy; aguardar validação CI.
- Foundation v0.2: workflows `43969729234` (core), `43970439739` (build React) e `43971040708` (Playwright React/backup) em `SUCCESS`; lockfile e screenshots versionados/arquivados nas branches. PRs #3/#4 seguem abertas; sem deploy de v0.2.
- Ajuste de asserção em Playwright para rótulo real `Nível treinador` da prévia React. Não altera app nem save.
- PR React: adicionada regressão Playwright desktop/mobile, download de backup JSON byte a byte e garantia de storage inalterado. Screenshots arquivados no CI; aguardar execução.
- **Prévia React v0.2 em branch**: workspace `apps/web`, TypeScript/Vite, shell com leitura segura de save v0.1 e exportação do JSON original; CSS Modules usando tokens oficiais, testes Vitest e workflow CI. Não publicada, sem modificar `server.mjs` ou saves. Depende da PR #3 de core.
- Ajuste TypeScript na suíte do game-core: fixture usa spread em objeto escalar em vez de `structuredClone` (não declarado no lib ES2022 puro); sem impacto no jogo.
- **Foundation v0.2 (branch `refactor/foundation-v0.2`)**: primeiros módulos de domínio TypeScript (`stats`, `affinity`, `progression`, `rewards`) e testes Vitest, workspaces npm e CI com lockfile versionado. Sem mudança no runtime, save local ou deploy. Aguardar GitHub Actions e PR.
- **Produção v0.1 atualizada**: PR #1 CSS (`ec94f7ce`) e PR #2 GIFs (`f410011f`) integradas; Railway deploys `07b1754a` e `c0d23c33` ambos `SUCCESS`. Regressão Chromium `43968276615` em `SUCCESS`.
- CI E2E fixado no runner `ubuntu-24.04` compatível com Playwright 1.56.1; o ambiente `ubuntu-latest` usava 26.04 não suportado pela versão fixada.
- Ajuste CI: evitar `--with-deps` do Playwright 1.56.1 em Ubuntu 26.04 (instalador incompatível), mantendo instalação de Chromium e testes E2E.
- 2026-11-16: criados testes Chromium de regressão para desktop/mobile, GIFs e fallback, Pokédex 151, teto manual 40, compatibilidade de save v0.1 e novo jogo; screenshots anexáveis ao workflow. Aguardar CI antes de merge.
- **2026-11-16 · PR de GIFs Kanto em preparação:** branch `feat/kanto-animated-gifs-v01`
  empilhada sobre a PR #1 de CSS. A interface passa a preferir
  `assets/pokemon-gifs/poke_ID.gif` para #001–#151; fallback estático,
  rota HTTP allowlist, importador fixado em SHA, testes, verificador e
  GitHub Actions para copiar os arquivos na branch. Importação **confirmada**
  em `f33122df` (151/151 GIFs, 56.582.531 bytes); workflow
  `43965699462` em `success`, verificador e testes aprovados.
  Segundo workflow `43966345901` em `success`: smoke-test HTTP real de
  `/health`, JS e GIFs 1/151, com HTTP 404 para IDs 0/152.
  **Pendente:** navegador desktop/mobile e compatibilidade manual de save v0.1.
  Salvas locais intocadas. **Deploy:** nenhum para esta branch.
  **Próxima ação:** validar o workflow, testes e as duas PRs antes de merge.
- PR em revisão na branch `refactor/css-tokens-comments-v01`: CSS retirado do HTML, `:root` com tokens de cores/sombras/raios/espaçamentos, classes documentadas, rotas CSS explícitas e testes de contrato; sem alteração de lógica de jogo, sem deploy na `main`.
- Planejada a refatoração v0.2 Foundation: módulos, React/TS/Vite, game-core e testes; **nenhum código de v0.2 implantado ainda**.
- Catálogo de raridades de itens, evolução, ginásios, motor completo de combate e backend pendentes.

## [docs-1.0] — 2026-11-16
**Escopo:** somente documentação e continuidade, sem mudanças de mecânica, JavaScript ou servidor.
- Adicionado `AGENTS.md` como guia obrigatório para novos chats.
- Adicionados documentos de estado, GDD, decisões, arquitetura, design system, convenções e checklist de release.
- Criada referência `assets/README.md` para futuros ativos visuais.
- Atualizado README para corrigir informação antiga: GitHub `main` **já está conectado** ao Railway.
- Registro das diferenças entre o jogo v0.1 implementado e funcionalidades apenas planejadas.
- **Testes desta entrega:** verificação documental e dos arquivos/serviço atuais; nenhum teste funcional novo.
- **Deploy:** verificar resultado terminal da implantação documental e registrar em `docs/PROJECT_STATE.md` no próximo registro de trabalho; não confundir alteração de documentação com nova versão jogável.

## [v0.1.0] — 2026-11-16
- Protótipo HTML/CSS/JS com treinador e Pokémon, stats distribuíveis, afinidade, itens/título/insígnias, Pokédex Kanto, Arena e expedições idle.
- Dados de espécies e golpes pela PokéAPI, com fallback mínimo dos iniciais.
- Primeiro projeto de hospedagem Railway `kanto-idle-lab` e URL pública.
- Usuário confirmou que protótipo está funcional.
- Criado repositório independente `isaquesan7/poke-idle-game`, primeiro commit de publicação `227a079ba3e7bce5740606321b2efa2bb20427a9`.
- GitHub `main` conectado ao serviço Railway; primeira implantação pela fonte GitHub `51d7a571-0adc-4339-ad11-c8fb02343d8e` em `SUCCESS`, com `/health` HTTP 200; commit `9076a3e745ee58a34c5a40e338fc9e45002d9753`.
- Sem backend, sem testes automatizados reais do jogo, sem preservação entre dispositivos; código ainda centralizado em `index.html`.

## Modelo para próximas entradas
```md
## [vX.Y.Z] — AAAA-MM-DD
- Objetivo:
- Alterações (arquivos/funcionalidades):
- Regras ou decisões alteradas:
- Testes executados / não executados:
- Branch e commit:
- Deploy Railway: status e ID (se aplicável):
- Pendências/alertas:
- Próxima ação:
```
