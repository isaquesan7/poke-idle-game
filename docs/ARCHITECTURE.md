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
