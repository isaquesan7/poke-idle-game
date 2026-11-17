# CHANGELOG — Poke Idle Game
Histórico de entregas. **Toda atualização futura deve acrescentar uma entrada aqui** e atualizar `docs/PROJECT_STATE.md` no mesmo trabalho. Não reescrever/ocultar histórico. Use data, escopo, commit, testes, deploy e pendências.

## [Unreleased]
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
