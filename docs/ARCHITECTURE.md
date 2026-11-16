# Arquitetura — atual e alvo

## Atual: v0.1 (não confundir com planejado)
Site estático servido por `server.mjs` (Node >=18). `index.html` contém HTML, CSS, JS, dados de protótipo e funções do jogo. `npm start` serve a página; `npm test` verifica somente a sintaxe do servidor. Salvamento/cache em localStorage; PokéAPI sob demanda. Nenhum backend autoritativo ou CI. Railway deploya automaticamente commits de `main`.

## Alvo: v0.2 Foundation (NÃO implementado)
- Monorepo leve com `npm workspaces` ou estrutura igualmente simples; evitar introduzir ferramentas sem necessidade.
- Front-end: React + TypeScript + Vite; componentes pequenos e funcionais.
- CSS Modules para componentes; variáveis de design em `tokens.css`, `global.css`.
- Regra de negócio: `packages/game-core` TypeScript puro, sem React, DOM, acesso direto a localStorage ou rede. Determinístico e testável.
- Camada de dados: clientes tipados da PokéAPI com normalização, cache e tratamento de erro.
- Persistência v0.2: adaptador versionado local para compatibilidade com save v0.1.
- Backend futuro, separado (Node.js/TypeScript, PostgreSQL), será autoridade de economia, níveis, captura, treino e recompensas. NÃO usar estado do cliente como prova para recompensas.

## Organização pretendida
```text
apps/
  web/
    public/assets/
    src/
      app/
      components/{ui,layout}/
      features/{trainer,pokemon,affinity,equipment,titles,badges,battle,expeditions,pokedex}/
      services/
      storage/
      styles/{tokens.css,global.css,themes.css}
packages/
  game-core/
    src/{stats,progression,combat,affinity,rewards,seasons}/
docs/
  GDD.md
  PROJECT_STATE.md
  DECISIONS.md
  DESIGN_SYSTEM.md
  CONVENTIONS.md
  RELEASE_CHECKLIST.md
tests/e2e/
.github/workflows/
CHANGELOG.md
AGENTS.md
```
Pode ajustar com justificativa explícita no log de decisões, sem perder fronteiras entre UI, domínio e infraestrutura.

## Dependências permitidas (direção única)
```text
UI/React -> serviços/adaptadores -> game-core (funções puras)
                                 -> APIs externas, cache, storage
Servidor futuro -> game-core + persistência transacional
game-core -X-> UI, DOM, Railway, fetch, localStorage
```

## Contratos essenciais
1. `trainerStatTotal(stat)` inclui pontos manuais (teto 40), equipamentos, título e TODAS as insígnias; sem teto global de 40.
2. `trainerContribution(stat, affinity)` resulta em pontos inteiros aditivos, taxa 8–10%.
3. Normalização de dados da PokéAPI preserva `base_stat` original e associa espécie ao ID Nacional.
4. `pokemonInstance` possui identificador único e progresso independente de outro da mesma espécie.
5. Atualizações de save são versionadas e migráveis; nunca reinicializar progresso silenciosamente.
6. Recompensas futuras calculadas e confirmadas no servidor, com idempotência; dados de cliente não são confiáveis.

## Estrutura de migração
- Baseline em branch: registrar comportamento e exemplos de saves.
- Criar `refactor/foundation-v0.2`; introduzir testes antes de portar regras.
- Extrair game-core e testes; mover UI gradualmente; validar PokéAPI, combate e saves.
- PR com checks automatizados, testes no navegador, documentação atualizada; `main` somente quando aprovado.
- Confirmar deploy `SUCCESS` e `/health` HTTP 200; rollback possível para commit anterior se necessário.

## Operação
- Repo: https://github.com/isaquesan7/poke-idle-game
- Site: https://kanto-idle-web-production.up.railway.app/
- Railway project: `d4867d1e-3f02-4b3d-a52a-bc4be07d46ab`.
- Railway environment production: `dffdf664-9fc0-42c1-a16d-a9182cc91ea9`.
- Railway service: `203a6bdd-b6b7-4016-b7b9-208e390af794`.
- Healthcheck: `GET /health`. GitHub `main` conectada, sem SHA fixado.
- Github `isaquesan7/pokedex` é outro projeto: NÃO tocar.


## Iteração de imagens animadas em revisão — 2026-11-16
- Branch de feature `feat/kanto-animated-gifs-v01`, empilhada sobre
  `refactor/css-tokens-comments-v01` (PR #1).
- `scripts/pokemon-sprites.js` concentra o caminho local dos GIFs 1–151
  e o fallback estático da PokéAPI, sem tocar no estado do jogo.
- `server.mjs` tem allowlist estrita de IDs 1–151 e entrega GIFs por stream;
  os arquivos binários ficam em `assets/pokemon-gifs/`.
- Importador com origem fixada em SHA, validação offline e workflow GitHub
  exclusivo da branch; **não altera `isaquesan7/pokedex` nem `main`**.
- Cache e save local (chaves v0.1) mantidos sem migração de schema.
- A arquitetura React/TypeScript/game-core segue como próximo ciclo, após
  revisar e publicar com segurança as mudanças incrementais.

## Foundation v0.2 — implementação inicial em branch (2026-11-16)
- `packages/game-core` inicia a separação do domínio em TypeScript puro, sem DOM, React, storage ou fetch.
- Módulos: `stats` (treinador, Pokémon), `affinity`, `progression` (XP), `rewards` (expedições).
- Contratos replicam as fórmulas v0.1, sem mudar a versão de save ou o runtime de produção.
- A raiz adota workspaces npm, `npm run test:core` e `npm run typecheck:core`; Vitest e TypeScript são exclusivos do package de domínio.
- React/Vite e a substituição gradual das funções de `index.html` ainda NÃO estão implementados.
- CI em `.github/workflows/foundation-core.yml` verifica compatibilidade e gera lockfile nesta branch; nenhuma publicação automática na `main`.

## Prévia React (PR empilhada após game-core)
- `apps/web` é um workspace React + TypeScript + Vite isolado; `npm run dev:web` abre a prévia em 5173, `npm run build:web` compila.
- `apps/web/src/storage/legacySave.ts` fornece parsing e leitura somente de v0.1, sem gravar nem converter estado. Backup pode baixar o JSON original.
- A prévia usa `styles/tokens.css` da raiz como fonte única de cores, raios e sombras; CSS Modules documentados na interface.
- O `server.mjs` do Railway e o HTML jogável v0.1 permanecem intocados. Não há troca de produção, migração de schema ou sincronização de saves entre origens.

## Telas React: visão geral e treinador (PR empilhada)
- Fluxo: `App.tsx` → `features/trainer/legacyProjection.ts` → `@kanto/game-core`; catálogo de compatibilidade em `packages/game-core/src/legacy/catalog.ts`.
- Salva/cache somente leitura; sem `setItem`, migração ou concessão de XP. A projeção retorna motivo se não for possível reproduzir cálculos fiéis.
- O componente não copia fórmulas: totals/status/expedição são derivados do core. Falta de base_stat torna status indisponível, não zero.
- Testes de paridade com fixture v0.1 e Playwright desktop/mobile também cobrem o jogo antigo. A UI v0.1 continua publicada.
- PR #5 empilhada sobre #4, esta sobre #3; nenhuma etapa muda automaticamente a `main`.

## Simulação versionada em branch isolada — PR #6
- Camada de domínio pura: `packages/game-core/src/legacy/trainerDraft.ts`, validando comandos e alterações de `trainer.manual`/`trainer.equipped` sem mudar recompensas ou estado de outros sistemas.
- Adaptador `apps/web/src/storage/draftSave.ts`: somente chave `kanto-idle-lab-save-v02-draft`, envelope `{schemaVersion:2,revision,sourceRaw,workingRaw}`. `sourceRaw` é JSON exato v0.1 para detecção de divergência e backup; `workingRaw` contém apenas edição permitida.
- UI: `App.tsx` sob Web Locks para todas as operações; `TrainerDraftControls` permite simulação opt-in, não grava progresso real. Se o jogo v0.1 alterar sua chave, a edição é interrompida e preservada para descarte explícito.
- A comparação de revisão em localStorage não é transação atômica isoladamente. Web Locks sincronizam apenas clientes que cooperam; NÃO prometer segurança inter-aba contra o código v0.1 que não usa locks. Evitar promoção automática até implementar mecanismo versionado de produção.
- Tests: Vitest do core e storage, Playwright da prévia e do legado, execução no CI dedicada. Sem mudança em `server.mjs`, GIFs, `index.html` ou schema salvo em produção.

## Pré-verificação do save antes de futura migração real
- `apps/web/src/storage/migrationPreflight.ts` lê apenas a chave v0.1 e o draft v0.2; valida formato, detecta conflitos e devolve motivo. Não executa escrita.
- `App.tsx` apresenta candidato/bloqueio como informação, sem ação para migrar. `candidate` não comprova ausência de corrida com o writer legado.
- O fluxo de backup, nova chave oficial, writer único e rollback ainda depende de projeto/implementação futura. Plano de fases e riscos em `docs/SAVE_MIGRATION_PLAN.md`.
- `.github/workflows/main-regression.yml` adiciona verificações permanentes de main/PR: testes de tipos, Vitest, build e E2E do jogo original, prévia React e simulação. Não muda o servidor público.
