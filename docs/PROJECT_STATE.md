# Estado do projeto e handoff para o próximo chat

**Última revisão:** 2026-11-16  
**Repositório:** https://github.com/isaquesan7/poke-idle-game  
**Branch de produção:** `main`  
**Site:** https://kanto-idle-web-production.up.railway.app/  
**Status de código:** protótipo jogável v0.1 no site; Foundation React/TypeScript v0.2 e laboratórios implementados no repositório, mas sem ativação, migração real ou writer oficial.  
**Importante:** revise `AGENTS.md` e confira o HEAD/deploy atuais antes de continuar.

## Infraestrutura verificada em 2026-11-16
- Railway project `kanto-idle-lab`: `d4867d1e-3f02-4b3d-a52a-bc4be07d46ab`.
- Environment `production`: `dffdf664-9fc0-42c1-a16d-a9182cc91ea9`.
- Service `kanto-idle-web`: `203a6bdd-b6b7-4016-b7b9-208e390af794`.
- Branch conectada: `isaquesan7/poke-idle-game:main`, sem SHA fixado, deploy por push.
- Comando de início: `npm start`. Healthcheck: `/health`.
- Deploy anterior à documentação: `51d7a571-0adc-4339-ad11-c8fb02343d8e`, `SUCCESS`, commit `9076a3e745ee58a34c5a40e338fc9e45002d9753`; `/health` respondeu HTTP 200.
- **Reverificar o deploy após o commit documental e antes de informar status futuro.**
- O endereço online deve permanecer o mesmo; Railway pode ter custos conforme o plano.
- O projeto `isaquesan7/pokedex` é original de referência e deve permanecer INTACTO.

## Código que existe agora (v0.1)
```text
.gitignore
README.md
index.html        ← HTML + CSS + 55 funções JS em um arquivo, ~58 KB
package.json      ← Node >=18, npm start, teste apenas sintático do servidor
server.mjs        ← servidor HTTP de arquivo único e /health
AGENTS.md, docs/* e CHANGELOG.md ← governança/documentação
```
- `index.html`: dados PokéAPI, seleção de inicial Bulbasaur/Charmander/Squirtle, modo normal e demo; telas de visão geral, treinador, meus Pokémon, Pokédex e Arena; treinamento, equipamentos, títulos, insígnias, afinidade, combate e expedições.
- Pokédex: catálogo dos IDs 1–151, consulta da PokéAPI; snapshots locais somente dos 3 iniciais para fallback.
- Time: até 3 integrantes; combate simplificado hoje utiliza o Pokémon ativo, não o motor completo de combate por equipe.
- Pokémons capturados são instâncias com UID; há captura probabilística de inimigos após vitória (regras provisórias).
- Treinador e Pokémon: nível máximo **100 no protótipo**, +2 pontos por nível, máx. 40 investidos manualmente em cada atributo do treinador; pontos extras de equipamentos/título/insígnias **não são limitados a 40**.
- Bônus: `floor(trainerTotal[stat] * (0.08 + 0.02 * affinity/100))`, adicionado ao status correspondente do Pokémon.
- Afinidade: individual, 0–100; aumenta em combate e expedições; começa em 0.
- Títulos: um ativo; insígnias: **todas as conquistadas acumulam atributos**. No protótipo as 8 insígnias são desbloqueadas por número de vitórias (1,3,5,8,11,15,19,24), NÃO pelos ginásios reais.
- 9 slots de equipamento: hat, jacket, gloves, pants, shoes, necklace, ring1, ring2, earrings. Itens e atributos ainda são amostras sem raridades finais.
- Movimentos: um golpe ativo no combate atual, rank de aprimoramento, +5% de poder por rank (mecânica preliminar); sistema de 4 golpes, efeitos completos e AI de batalha são planejamento futuro.
- Expedição: 1 ciclo/10s; máximo de 2880 ciclos (8h) por resgate; recompensa de exemplo 7 moedas, 4 XP treinador, 5 XP Pokémon/ciclo; sem servidor antifraude.
- Dados salvos somente no navegador: `localStorage['kanto-idle-lab-save-v01']`, cache `localStorage['kanto-idle-lab-cache-v01']`. **Não apagar nem sobrescrever em migrações**.
- Fórmulas de XP/progresso e combate detalhadas em `docs/GDD.md`.
- Não existem autenticação, persistência entre dispositivos, PostgreSQL, API própria, pipeline CI, React, TypeScript, Vite ou suíte real de testes nesta v0.1.

## Decisões aprovadas pelo usuário
1. Season 1 com os 151 Pokémon originais, dados de espécie da PokéAPI.
2. Pokémon ganham níveis, distribuem atributos próprios e melhoram movimentos.
3. Treinador possui perfil, XP, nível e pontos de status.
4. Pontos de treinador + itens + um título ativo + **todas** as insígnias conquistadas somam o total do treinador; limite 40 somente na alocação manual.
5. Transferência aditiva de 8%–10% do status TOTAL do treinador ao Pokémon, conforme afinidade individual.
6. Equipamentos com 9 slots; raridades e itens finais a desenhar posteriormente.
7. Padrão técnico futuro: React + TypeScript + Vite, CSS Modules + tokens, `game-core` independente, Vitest, Playwright, backend Node/PostgreSQL somente quando necessário.
8. Visual Kanto Dark (cores em `docs/DESIGN_SYSTEM.md`).
9. Github original `isaquesan7/pokedex` sempre intocado.

## Atenção: o que NÃO está concluído
- Refatoração de `index.html` para módulos, React ou TypeScript.
- Automatização de testes, CI, branch protection.
- Regras de raridades, drop, itens definitivos, inventário de produção.
- Evolução de espécies, ginásios reais, golpes múltiplos/efeitos e controle avançado de batalha.
- Salvar em servidor, autenticação, anticheat e persistência de múltiplos usuários.
- Uso comercial/autorização de personagens e sprites.
- Auditoria completa de qualidade/balanceamento.

## Próxima etapa recomendada
**v0.2 Foundation (refatoração preservando funcionalidade).**
1. Registrar baseline da `main` e garantir backup/exportação de um save v0.1 em testes.
2. Criar branch `refactor/foundation-v0.2` (ou equivalente), sem publicar diretamente na `main`.
3. Introduzir estrutura `apps/web` e `packages/game-core`, TypeScript + Vite/React, lint/format e Vitest.
4. Primeiro extrair em funções puras o cálculo de status treinador/Pokémon, afinidade, XP e recompensas; testes com casos limite.
5. Migrar UI gradualmente sem perder Pokédex, Arena, expedições e save local; manter compatibilidade do armazenamento.
6. Criar verificação CI + Playwright, testar desktop/mobile, só então PR/merge e monitorar Railway `SUCCESS`.
7. Atualizar ESTE documento/CHANGELOG/decisões no mesmo trabalho.

## Registro da sessão atual
- Usuário aprovou a proposta de estrutura/cores/limpeza, pediu um ativo documental para novos chats e atualização contínua.
- Esta entrega é SOMENTE documentação e governança; **não implementa a arquitetura v0.2**.
- Após cada entrega futura, registrar: data, branch, commit, escopo, testes realizados, deploy observado, pendências, próxima tarefa. Não afirmar `SUCCESS` sem verificá-lo.

## Trabalho em revisão — CSS modular e tokens (2026-11-16)
- Branch de trabalho: `refactor/css-tokens-comments-v01`, derivada de `main` em `49f22f64`.
- CSS extraído do `index.html` para `styles/tokens.css` (cores, sombras, raios, espaçamentos e tipografia) e `styles/app.css` (classes documentadas individualmente e agrupadas por tela/componente).
- `server.mjs` passou a disponibilizar as duas rotas CSS por allowlist; `index.html` mantém toda a lógica JS e chave de save sem mudanças.
- Testes adicionados: `tests/style-contract.test.mjs` e script `npm test` para integridade de tokens/classes/rotas.
- Teste local preparatório: CSS analisado por parser, screenshots comparados no desktop (1365px) e mobile (390px), idênticos pixel a pixel em sessão de comparação de estilos; verificar novamente após revisão/merge.
- **Status: PR pendente; não publicado em produção.** A branch `main` e o site Railway permanecem na versão jogável anterior. Conferir HEAD/deploy antes de retomar.
- Próxima ação: revisar o PR, rodar `npm test`, validar CSS servido via HTTP e então, com aprovação, mesclar na `main` e observar deploy `SUCCESS`.


## Continuidade — integração de GIFs Kanto (2026-11-16)
- **Verificado antes de codar:** `main` HEAD `49f22f64ad6048b2aa0c2b13b993240e77958bf1`.
  Railway `kanto-idle-web` deploy `cc948f22-66c7-4578-9f63-8f8bb05894de`,
  status terminal `SUCCESS`, commit `49f22f64` (deploy anterior a esta mudança).
- PR #1: `refactor/css-tokens-comments-v01`, HEAD
  `02ff0c7a146b25f4641de62824c389d576edd1e5`, aberta e sem conflitos.
- **Escopo nesta branch:** `feat/kanto-animated-gifs-v01` criada sobre a PR #1
  (PR empilhada; não atualizar `main` por conta própria).
- Fonte confirmada: `isaquesan7/pokedex/config/img/pokemons/poke_1.gif`
  a `poke_151.gif`, 151 arquivos, ~56,6 MB; referência imutável
  `d86ba82e1f6b2b0da708ff6c304b71e1f70aa139`.
- Implementação preparada: resolver central de imagens (GIF local 1–151,
  fallback PNG em erro), rota HTTP restrita de GIFs, script para copiar 151
  arquivos para ESTA branch, verificador de GIF e testes unitários.
- **Importação confirmada no GitHub:** workflow `43965699462` concluído com
  `success` em 2026-11-16; commit de assets `f33122df1360e7d1959f36d97455c21af82876a7`.
  Tree verificada: **151/151 GIFs presentes, sem faltantes, 56.582.531 bytes**.
  Pipeline executou `npm run verify:gifs` e `npm test` com sucesso.
- **Validação HTTP concluída:** workflow `43966345901` em `success` para
  código `4f90c404f1328681b1faef4783b811ca88b63f5f`. Foram aprovados
  `/health`, arquivo JavaScript de imagem, `poke_1.gif`, `poke_151.gif`,
  cabeçalho real do GIF, além do bloqueio HTTP 404 para IDs 0 e 152.
  Teste visual em navegador e regressão manual do jogo ainda pendentes.
- Compatibilidade: `kanto-idle-lab-save-v01` e
  `kanto-idle-lab-cache-v01` permanecem inalteradas, sem migração.
- **Status de deploy:** nenhuma alteração desta branch foi publicada em
  produção. `main` continua na v0.1 até revisão e merge.
- **Próxima ação concreta:** revisar a PR #1 (CSS) e PR #2 (GIFs),
  testar manualmente desktop/mobile e carregar um save v0.1 preexistente;
  somente após essa validação aprovar merges em ordem (CSS, GIF),
  verificar Railway `SUCCESS` e GET `/health`. A seguir iniciar v0.2
  Foundation com migração gradual, preservando saves e regras do GDD.

## Regressão Playwright na PR #2 (2026-11-16)
- Fixture sintética de save v0.1 em `tests/fixtures/legacy-save-v01.json`, sem dados reais de jogadores.
- `tests/e2e/browser-smoke.mjs` valida no Chromium: desktop 1365×768, mobile 390×844, CSS, GIF animado local, fallback estático, treinador (40 pontos manuais), telas, Pokédex 151, recarga de save e início de novo jogo.
- `.github/workflows/browser-regression.yml` executa estes testes em GitHub Actions e anexa capturas. CI ainda precisa ser observado antes de merge.
- **Próxima ação:** confirmar execução E2E e revisar capturas; corrigir qualquer regressão, depois revisar as duas PRs para integração na ordem CSS → GIFs.

- Workflow E2E inicial `43967967387`: 9/9 unitários e GIFs passaram; navegador não iniciou pois `playwright@1.56.1 install --with-deps` não reconheceu Ubuntu 26.04. Ajustado para instalar Chromium sem gerenciamento automático de dependências SO; reexecutar e inspecionar logs. Sem problema de jogo confirmado nessa falha.

- Diagnóstico adicional: o Playwright 1.56.1 não suporta Ubuntu 26.04 mesmo sem `--with-deps`; runner de navegador fixado em `ubuntu-24.04` e dependências instaladas nessa versão suportada. Aguardar nova execução antes de qualquer merge.

## v0.1 — PRs integradas e produção verificada em 2026-11-16
- PR #1 CSS integrada, commit de merge `ec94f7ce0d2ba998b33ff0dfef5f52cf178d4555`; Railway deploy `07b1754a-6272-44c5-ad1c-576c0a4b4223` em `SUCCESS`.
- PR #2 GIFs integrada, `main` commit `f410011fc6b490c0193acf97f2ce250744599d79`; Railway deploy `c0d23c33-f3e7-4ad5-8e5c-cb2b21bb8191` em `SUCCESS`.
- Regressão Chromium desktop/mobile e save v0.1 no workflow `43968276615` em `SUCCESS`; imagens e testes do navegador validados no GitHub Actions.
- A origem `isaquesan7/pokedex` permanece intocada; nenhuma migração de save foi feita.

## Iteração em desenvolvimento — Foundation v0.2
- Branch independente: `refactor/foundation-v0.2`, base `f410011f` (production `main`).
- Primeira entrega: pacote TypeScript puro de status treinador/Pokémon, afinidade, XP e expedições, com Vitest e tsconfig strict.
- O JavaScript legada de `index.html` continua como executável atual; o `game-core` ainda NÃO está integrado à UI. React/Vite ainda pendentes.
- Workflow de teste `foundation-core.yml` valida typecheck, Vitest, npm test legado, 151 GIFs e gera lockfile.
- **Status:** não publicado; verificar CI e PR antes de integração futura.
- **Próxima ação concreta:** confirmar CI e lockfile; adicionar testes de paridade sobre fixtures de save v0.1, começar camada de storage versionado; depois scaffolding React/Vite e migração progressiva sem trocar a UI de produção abruptamente.

- CI de Foundation `43969560115` identificou `structuredClone` nos testes sem tipos DOM/Node do pacote puro; substituído por cópia rasa do fixture escalar. A correção não modifica regras nem runtime. Revalidar pipeline.

## Nova prévia React/v0.2 em revisão (2026-11-16)
- Branch empilhada `refactor/react-foundation-v0.2`, baseada na branch da PR #3 (`refactor/foundation-v0.2`).
- Workspace React/Vite/TypeScript adicionado em `apps/web`, CSS Modules usando tokens globais sem duplicar a paleta.
- Adaptador `legacySave.ts` apenas lê e valida save v0.1; exporta backup do JSON original por botão, sem escrever nem apagar progresso. Testes unitários de dados ausentes, inválidos, versões futuras e storage bloqueado.
- `npm run dev:web` (porta 5173) e `npm run build:web` são independentes do `npm start` do jogo v0.1.
- Não confundir a prévia técnica de React com jogo portado; Pokédex/Arena/treino ainda funcionam exclusivamente no legado.
- **Pendente:** conferir CI, build e lockfile da nova branch; depois integrar game-core e a prévia React somente com revisão e sem regressões.
- **Próximo passo:** portar o dashboard/treinador ao React com uso de funções do game-core e testes de paridade; migrar telas gradualmente antes da substituição do runtime.

- Regresso de navegador adicional `apps/web/tests/e2e/react-preview.mjs`: desktop/mobile, backup JSON byte a byte, armazenamento local preservado, versão futura rejeitada sem perda e capturas de tela. Workflow React inclui Chromium no runner `ubuntu-24.04`. Confirmar execução antes de merge.

- Primeira execução do browser test React `43970812875`: renderização e save identificados, falha apenas na asserção textual do teste (`Treinador` vs rótulo existente `Nível treinador`, diferenças de maiúsculas). Ajuste do teste; nenhuma alteração funcional necessária até aqui.

## CI comprovado e handoff da Foundation (2026-11-16)
- **PR #3 `refactor/foundation-v0.2`:** CI `43969729234` em `SUCCESS`; TypeScript strict, Vitest, testes Node legados e 151 GIFs passaram. `package-lock.json` registrado no commit `83ac22169605daa6476653494ad3bc55c288c1e1`.
- **PR #4 `refactor/react-foundation-v0.2`:** build React/Vite e testes Vitest/typecheck aprovados no workflow `43970439739`.
- **Regressão de browser da prévia:** workflow `43971040708` em `SUCCESS`; testou desktop 1365px, mobile 390px, download fiel do JSON v0.1, storage não modificado, save versão futura preservado. Capturas no artifact `react-foundation-screenshots` (ID 14279555043). Capturas ainda não inspecionadas visualmente por pessoa.
- **Produção:** nenhuma das PRs #3/#4 foi mesclada na `main`, que segue no commit `f410011fc6b490c0193acf97f2ce250744599d79` (Railway último deploy validado `c0d23c33-f3e7-4ad5-8e5c-cb2b21bb8191`, `SUCCESS`).
- **Continuidade:** revisar PRs na ordem #3 → #4 e seu impacto operacional; manter `server.mjs` e chaves de save. Próximo passo é conectar dashboard/treinador React ao game-core com testes de paridade sobre save v0.1 antes de substituir qualquer parte da UI publicada.

## 2026-11-16 — Telas React e paridade de status (em revisão)
- Branch: `feat/react-trainer-overview-v02`, criada no HEAD `291e6a85df60bd19bb0694a75ec5cc1c26ddc0e9` da PR #4; depende também da PR #3.
- `packages/game-core/src/legacy/catalog.ts`: catálogo fiel da v0.1 de 14 itens demonstrativos, 4 títulos e 8 insígnias, sem criar novo balanceamento.
- `apps/web/src/features/trainer/legacyProjection.ts`: projeção somente leitura usando trainerTotals, pokemonFinalStats, afinidade, XP e estimativa de expedições do core.
- `OverviewPreview` e `TrainerPreview` com CSS Modules/tokens, navegação sem escrever no save; `index.html`/servidor e os GIFs permanecem intocados.
- Somente 3 iniciais têm snapshot embutido; demais espécies precisam do cache local da PokéAPI. Sem cache, não inventar status-base.
- Testes de paridade com `tests/fixtures/legacy-save-v01.json`, limite manual 40, bônus aditivos, títulos, insígnias e expedição com teto de 8h.
- Workflow `trainer-overview-parity.yml` testa TypeScript, Vitest, build e Playwright desktop/mobile tanto da prévia quanto do legado.
- Situação: ainda sem merge/deploy; produção verificada em `f410011fc6b490c0193acf97f2ce250744599d79`, deploy Railway `c0d23c33-f3e7-4ad5-8e5c-cb2b21bb8191` SUCCESS.
- Próxima ação: acompanhar CI e lockfile na feature branch; corrigir falhas, revisar screenshots, depois PR #3 → #4 → #5 na ordem. Ações de escrita do treinador/expedição exigem persistência versionada e testes antes de habilitar.

### Validação da PR #5 — resultado confirmado (2026-11-16)
- Workflow `43975797448`: `completed/success` para código/documentação do commit `49971de6e4853328ada574a36caa3ca15a37fb2d`.
- Aprovaram as etapas `typecheck:core`, `test:core`, `typecheck:web`, `test:web`, `build:web`, `npm test`, `verify:gifs`, E2E da v0.1 e E2E da prévia React.
- Lockfile de workspaces atualizado pelo GitHub Actions no commit `3754a5abf2be47281d9b845fa55c300309221244` (feature branch, sem publicação).
- Capturas de tela disponíveis no artifact `trainer-overview-parity-screenshots` ID `14281131270` (cerca de 2,9 MB), ainda pendentes de revisão visual humana.
- O repositório `main` permanece em `f410011fc6b490c0193acf97f2ce250744599d79` e Railway em `SUCCESS` para deploy `c0d23c33-f3e7-4ad5-8e5c-cb2b21bb8191`; esta versão não foi publicada.
- **Próxima ação concreta:** revisão humana/visual de capturas e código da PR #5, depois integrar #3 → #4 → #5 na ordem se aprovado. A migração de **ações de escrita** (distribuição de pontos e salva de equipamentos) exige adaptador versionado + teste de save de produção e não deve ser feita diretamente no objeto JSON.
- **Observação:** commits históricos no início deste arquivo descrevem estados antigos de PRs; utilizar sempre este registro final junto do HEAD real do GitHub.

## 2026-11-16 — Persistência versionada de simulação v0.2 (PR #6, em revisão)
- Branch `feat/versioned-trainer-drafts-v02` derivada da PR #5 em `5ebcecb82ecb6f4bd5740ae19e731bec53f2f0c3`. Depende da cadeia PR #3 → #4 → #5; **não integrada à main**.
- `packages/game-core/src/legacy/trainerDraft.ts`: regras puras para `invest` e `equip`, teto manual 40 e orçamento de 2 pontos por nível. Rejeita alterações externas a `trainer.manual` e `trainer.equipped` e mantém moedas, XP, Pokémon, insígnias e expedições intactos.
- `apps/web/src/storage/draftSave.ts`: envelope `schemaVersion:2` na chave **independente** `kanto-idle-lab-save-v02-draft`, contendo origem v0.1 bruta, cópia de trabalho e revisão monotônica.
- Nunca grava ou apaga `kanto-idle-lab-save-v01`. A criação é explícita; leitura valida invariantes e exige JSON original byte a byte igual ao atual. Se o legado mudar em outra aba, o rascunho torna-se `stale` e bloqueia edições; conflitos de revisão, versões futuras, dados corrompidos e quota são tratados sem redefinir nada.
- No browser, criação/edição/descarte são serializadas por `navigator.locks.request` (Web Locks); sem suporte, a UI bloqueia escritas. Web Locks não integram o código legado da v0.1; sua escrita independente pode ocorrer a qualquer momento, por isso há verificações antes/depois e nenhuma promoção automática do rascunho.
- `TrainerDraftControls.tsx`: permite testar incremento de atributo e troca de 9 slots **apenas na simulação**. A interface informa explicitamente que alterações não são progresso real; descarte requer confirmação e remove só o rascunho.
- `apps/web/tests/e2e/draft-preview.mjs` acrescenta browser desktop/mobile: iniciar simulação, distribuir ponto, equipar, recarregar, baixar JSON v0.1, detectar save de outra aba e descartar sem perder progresso.
- Workflow `draft-persistence.yml` roda TypeScript/Vitest/build, E2E legado, prévia React e E2E novo, em branch isolada; não faz deploy ou escrita de lockfile.
- **Status inicial:** testes CI pendentes de conclusão; não mesclar até checks e revisão visual. Main/Railway último verificado no commit `f410011fc6b490c0193acf97f2ce250744599d79`, deployment `c0d23c33-f3e7-4ad5-8e5c-cb2b21bb8191` SUCCESS.
- **Próxima etapa:** confirmar CI e corrigir falhas; revisar PR #6, depois projetar promoção transacional/versionada para progresso real, com backups e testes de concorrência, antes de permitir escrita no save legado.

- CI inicial da PR #6 `43978177308` apontou erro TypeScript de narrow de `trainer.manual` como unknown; validação explícita `record(trainer.manual)` adicionada. Reexecutar pipeline. Falha de compilação, não de regras de jogo.

- CI `43978349573`: TypeScript, Vitest, build, GIFs, jogo v0.1 e React E2E passaram. Novo E2E de draft chegou até os testes de recarga/backup e falhou na própria chamada Playwright por 3 argumentos em `page.evaluate`; corrigido para argumento único em objeto. Nenhum erro funcional do jogo confirmado nessa falha.

### Resultado final da validação de rascunhos v0.2 — 2026-11-16
- Workflow de CI `43978606016` em **completed/success**, SHA testado `7e353da906e64421d95d99c0a21a7a0f75685cbe`.
- Passaram `npm ci`, `typecheck:core`, Vitest do core, `typecheck:web`, Vitest do storage, build React/Vite, `npm test` da v0.1, `verify:gifs`, E2E legado, E2E React e E2E novo de simulação (desktop 1365px / mobile 390px).
- Novos testes validaram criação explícita, aplicação de um ponto, troca de luvas, leitura após reload, exportação do JSON original byte a byte, bloqueio após atualização do save v0.1, descarte da simulação, isolamento de moedas/XP/insígnias e revisão contra alterações entre abas.
- Capturas do browser no artifact GitHub `versioned-draft-regression`, ID `14281376764`, tamanho 3.521.168 bytes; pendente inspeção visual humana.
- PR #6: https://github.com/isaquesan7/poke-idle-game/pull/6, base branch `feat/react-trainer-overview-v02`, **aberta, sem merge ou deploy**.
- Situação de produção verificada: `main` SHA `f410011fc6b490c0193acf97f2ce250744599d79`; Railway `c0d23c33-f3e7-4ad5-8e5c-cb2b21bb8191` SUCCESS. Repositório fonte `isaquesan7/pokedex` não foi alterado.
- Próxima ação recomendada: revisar visualmente screenshots e código, depois integrar PRs #3 → #4 → #5 → #6 em ordem com checagens e monitoramento do Railway. Antes de ativar progresso real na UI React, criar projeto de migração com backup imutável, detecção de corrida, controle de versões e recuperação sem perda; não fazer promoção automática do draft à chave v0.1.

## 2026-11-16 — PRs Foundation integradas; preflight de migração em branch
- GitHub `main` SHA `af81fdb45a9f9e3f78b4c7cdbf6b390b3bbd6dab`, depois de merges em ordem: PR #3 `8fbaf415862a027419b8526c9fe355c4cec5e971`; PR #4 `48977b01167b9eec6dfade548016d07b13d3f7aa`; PR #5 `0d4bc823bf2630523e7db8b0b30e53dcf88cb283`; PR #6 `af81fdb45a9f9e3f78b4c7cdbf6b390b3bbd6dab`.
- Deploys Railway por commit todos em SUCCESS: #3 `9639fec5-3c5c-4b83-859a-60e53f2e91f6`, #4 `44d23185-bf2b-43f7-be39-25d2f74bc239`, #5 `054c8133-277a-4649-a8e1-3939b061431a`, #6 `3334e85e-e474-48aa-8628-b3f7801404d7`.
- Logs #6 mostram `npm start`/`node server.mjs`, servidor ouvindo na porta 8080. Railway marcou SUCCESS após healthcheck configurado /health; GET externo manual ficou inacessível nas ferramentas, portanto não foi validado diretamente.
- Captação de screenshots da PR #6 foi visualmente examinada: 1365px desktop e 390px mobile, sem cortes óbvios. Workflow `43978943156` SUCCESS no HEAD da PR antes do merge.
- O runtime público segue o protótipo v0.1; React e o rascunho v0.2 fazem parte do monorepo mas não são disponibilizados como tela inicial nem gravam saves v0.1.

### Em desenvolvimento — feat/v02-migration-preflight
- Branch independente baseada em `af81fdb4`, sem mudança na produção.
- `apps/web/src/storage/migrationPreflight.ts`: leitura apenas, conferência de integridade de save/draft, identificação de conflitos, motivo claro para bloqueio. Status candidate não autoriza commit.
- A prévia React mostra relatório textual, sem nenhum comando para migração.
- Novo workflow `.github/workflows/main-regression.yml` instala `npm ci`, verifica TypeScript, Vitest, build, GIFs e E2E v0.1/React/draft. Ativo para PRs contra main e, quando integrado, pushes main.
- Plano de migração real e rollback em `docs/SAVE_MIGRATION_PLAN.md`. Writer legado v0.1 não usa Web Locks; não permitir overwrite ou promoção automática.
- STATUS: CI deste novo PR ainda precisa ser verificado; screenshots e testes históricos não substituem nova execução.
- PRÓXIMO: validar CI, revisar, depois desenvolver schema do save oficial v0.2 e backups recuperáveis, sem habilitar escrita real.

## ESTADO MAIS RECENTE — Foundation v0.2 integrada e validada (2026-11-16)
- **Fonte de verdade atual:** GitHub `main` SHA `b099e7500826a21ab40adfe5a9593a89c3608769` (PRs #3, #4, #5, #6 e #7 **todas mescladas**). Antes de retomar qualquer trabalho, reconferir SHA e Railway.
- **Railway produção:** deploy `13d5dd6f-e802-421a-8dc5-1e85ad37577f` chegou a **SUCCESS** para esse commit. Logs mostram `npm start`/`node server.mjs` ouvindo em 8080; Railway está configurado com healthcheck `/health`. Requisições HTTP externas diretas não foram verificáveis por esta sessão.
- **CI permanente:** workflow `.github/workflows/main-regression.yml` foi adicionado pela PR #7. Execução em `main`: `43982463671` em **completed/success**, cobrindo npm ci, TS core/web, Vitest core/storage, build Vite, GIFs Kanto 151, E2E jogo v0.1, prévia React e simulação em desktop/mobile.
- **Revisão visual:** artifact `14283676316` do workflow PR #7 (`43982231169`) foi aberto e os screenshots de desktop/mobile da prévia, incluindo o novo relatório de migração, foram examinados; layout legível e sem cortes aparentes. Os E2E checaram overflow.
- **O que está realmente em produção:** a URL pública ainda serve a interface **v0.1** do `index.html`. O pacote `@kanto/game-core`, workspace React, projeção de treinador e simulação v0.2 estão na `main`, mas a interface React é experimental e **não é publicada como rota**, tampouco escreve no save real.
- **Chaves de progresso:** v0.1 `kanto-idle-lab-save-v01` e cache `kanto-idle-lab-cache-v01` preservados. Draft somente para simulação em `kanto-idle-lab-save-v02-draft`; sem promoção automática.
- **Migração:** `inspectMigrationReadiness()` é apenas checagem de leitura e não migra. Problema conhecido e bloqueador: a v0.1 escreve no localStorage sem Web Locks, de modo que o React não pode garantir transação com abas legadas. `docs/SAVE_MIGRATION_PLAN.md` tem fases A–E.
- **Próxima ação objetiva:** modelar contrato de **save oficial v0.2** e backup recuperável (funções puras + fixtures) em nova branch, sem gravar save real. Depois projetar política de writer único, convergência entre abas e rollout opt-in, antes de habilitar qualquer commit de progresso.
- **Limites conhecidos:** sem backend/contas, sem sincronização multi-dispositivo, sem antifraude; resultados dos workflows não equivalem a teste de uso humano completo. Nunca modificar `isaquesan7/pokedex`.

## 2026-11-16 — PR de contrato v0.2 e ensaio de recuperação (EM REVISÃO)
- Fonte GitHub verificada antes da branch: `main` `be0c3be8ef3086860af2cea9c8d609c5577740ab` (PRs #3–#8 integradas); Railway deploy `3825145b-45dc-478d-aba8-78614280d60e` `SUCCESS`. A entrada pública continua v0.1.
- Branch `feat/v02-official-save-backup-contract`, criada a partir da main; não substitui `server.mjs` nem altera `index.html`, os GIFs, o localStorage do jogo ou a UI React.
- `apps/web/src/storage/officialSaveV02.ts`: contrato **candidato** de progresso oficial `{kind:'kanto-official-save',schemaVersion:2,revision:0,origin,payloadFormat:'legacy-v01',progress}`; o payload permanece v0.1 intacto até a migração real das mecânicas. Não confundir contrato com migração/ativação.
- Mesmo módulo: pacote de recuperação com backup contendo `sourceRaw` JSON exato (inclusive espaços e campos desconhecidos), tamanho UTF-8 e SHA-256. Funções puras de criação, inspeção e extração, sem escrita; digest é integridade acidental, NÃO autenticação.
- Chaves **reservadas, não utilizadas pelo runtime**: `kanto-idle-lab-save-v02`, `kanto-idle-lab-save-v02-origin-backup`, `kanto-idle-lab-save-v02-commit`; continuam distintas das chaves legadas e de draft.
- `recoveryJournal.ts`: apenas plano de operações futuras na ordem backup → candidato → marcador final; auditoria não destrutiva dos estados vazio, backup-only, staged, committed, conflict, damaged e extração da origem mesmo se o candidato corromper.
- **IMPORTANTE:** não há executor de escrita em navegador. `committed` no auditor é apenas diagnóstico de teste, não permissão para ativação: v0.1 permanece writer NÃO cooperativo; Web Locks na v0.2 não cobrem tabs antigas.
- Vitest `officialSaveV02.test.ts` e `recoveryJournal.test.ts` incluem SHA-256 conhecido, emojis/UTF-8, whitespace exato, múltiplas instâncias, campos extras, versões futuras, adulteração de XP/moedas/afinidade, crashes após cada etapa, quota/permissões simuladas, marcador corrompido e conflito com save atualizado.
- **Validação:** CI ainda precisa executar na PR; registrar resultado terminal ao terminar. **Deploy:** nenhum na main por esta branch.
- **Próxima ação concreta:** validar TS/Vitest/E2E no GitHub, corrigir erros encontrados e só integrar PR segura. Próximo ciclo: definir writer único/política de transição v0.1→v0.2, depois preparar importação opt-in + export do backup, SEM gravação do save legado.

### Validação do contrato v0.2 — 2026-11-16
- PR #9: https://github.com/isaquesan7/poke-idle-game/pull/9.
- GitHub Actions workflow `43983797980` em `completed/success`, SHA de código e documentação testado `0f7ce34ee95cbeb2607648ac9d91be9fe41edd41`.
- Passaram: `npm ci`, `typecheck:core`, `test:core`, `typecheck:web`, `test:web` (incluindo novos testes de recuperação), `build:web`, testes Node da v0.1, validação dos 151 GIFs e três regressões E2E Chromium: jogo antigo, React e simulação.
- Revisão do diff confirma alterações somente nos módulos `officialSaveV02`/`recoveryJournal`, seus testes e documentação. UI, servidor, dados dos jogadores e binários Kanto não foram modificados.
- Status: **ainda em PR**, sem merge/deploy até esta anotação. Trabalho de escrita e coordenação transacional segue bloqueado; não confundir com save oficial ativado.
- Próximo: integrar PR #9 após checagem final, monitorar deploy e registrar SHA de produção. Em seguida desenhar mecanismo de coordenação com writers cooperativos, export/import opt-in e testes de integração.

## ESTADO MAIS RECENTE — PR #9 publicada com testes aprovados (2026-11-16)
- **Repositório**: `isaquesan7/poke-idle-game`, `main` SHA verificado `bd5306660e1472088f411709b03a8c7df1e46ea1`. PR #9 `https://github.com/isaquesan7/poke-idle-game/pull/9` **merged** com esse SHA; PRs #3–#8 também já haviam sido mescladas.
- **CI de branch/PR**: `43983797980` e `43983994225` em `SUCCESS`; **CI pós-merge na main** `43984189208` em `completed/success`. Passaram TypeScript, Vitest (incluindo novas verificações de backup/corrupção e journal), Vite build, 151 GIFs e Playwright legado/React/draft desktop/mobile.
- **Railway**: deploy `dfca3072-3ef3-4c5f-8113-f525abebc4b1` do commit `bd530666` em **SUCCESS**. O servidor publicado continua `npm start` → `server.mjs` (interface jogável v0.1). Tentativas de GET público a `/health` e `/` pelo navegador de ferramentas não foram acessíveis; não declarar verificação HTTP direta. Railway tem healthcheck `/health` configurado.
- **Entregue em código mas NÃO ativado**: `apps/web/src/storage/officialSaveV02.ts` prepara um futuro contrato de save oficial com payload v0.1 completo, backup exato e checksum SHA-256. `recoveryJournal.ts` apenas planeja escrita futura e audita cenários de falhas/conflictos em snapshots e testes.
- **NÃO existe** botão para promover draft, nem executor de escrita de save v0.2, nem acesso do React ao `kanto-idle-lab-save-v01` para modificar. Chaves oficiais futuras estão apenas reservadas. A v0.1 continua writer não cooperativo entre abas; sem migração real e sem backend/conta.
- **Próximo passo de desenvolvimento**: definir a coordenação de writers e a política de transição/opt-in entre a v0.1 e a v0.2; modelar exportação/importação/restauração com teste de quota reais em ambiente de laboratório, sem escrever saves dos usuários. Só após resolução, portar ações de progressão ao runtime React.
- **Documentação e continuidade**: consultar `docs/SAVE_MIGRATION_PLAN.md` (Fase B parcial, C–E pendentes), D-017/D-018 e o commit `bd530666`. Esta é a última seção e supera descrições históricas de PRs abertas.

## 2026-11-16 — Coordenação de writers e pacote de recuperação (PR #11 EM REVISÃO)
- Base verificada no GitHub: `main` SHA `0750718d10c3cf50c0eed9acebcd727f3adddae6`; último deploy Railway `3491f45e-abf1-4785-a561-5f8e0738171d` SUCCESS; runtime público v0.1 (`index.html`/`server.mjs`) e chaves reais permanecem intactos.
- Branch: `feat/v02-writer-coordination-and-recovery-export`, criada a partir da `main` acima; modifica APENAS código React experimental, testes e documentação. Repositório `isaquesan7/pokedex` mantido totalmente READ-ONLY.
- `apps/web/src/storage/writerCoordination.ts`: auditoria read-only do journal de origens (`legacy-only`, `backup-incomplete`, `v02-isolated`, `legacy-diverged`, `damaged`). Em **TODOS** os estados `canWriteRealSave:false`; as partes v0.1 e v0.2 não se misturam automaticamente. `checkCooperativeRevision` recusa revisões antigas, inválidas e overflow. `withExclusiveV02Writer` exige Web Locks, `ifAvailable:true`, para ensaios de abas cooperativas v0.2, sem fallback inseguro; não está ligado a um writer real.
- **Limitação estrutural:** a v0.1 grava `SAVE_KEY` de modo síncrono, sem lock. Abas v0.1 carregadas anteriormente não participam de Web Locks, portanto é impossível garantir sincronização delas só com o código React. Política: após um futuro opt-in, v0.2 terá chave canônica independente; se v0.1 continuar salvando, detectar divergência e PRESERVAR as duas versões, nunca sobrescrever ou mesclar silenciosamente.
- `apps/web/src/storage/recoveryExchange.ts`: exportação do pacote verificável `RecoveryBundleV02` com checksum SHA-256 e rechecagens da chave legada antes/depois das operações assíncronas. Arquivos carregados são analisados com `inspectRecoveryBundle`, detectam íntegro/igual, íntegro/diferente e inválido, sem `setItem`/`removeItem` ou importação. Limite de upload 8 MiB.
- `apps/web/src/features/storage/RecoveryExchangePanel.tsx` + CSS Modules: botões de download e upload-conferência, textos explícitos SEM RESTAURAÇÃO; tokens de cor/raio existentes e comentários em português em todos os seletores. Visível apenas na prévia React, que não tem rota pública no Railway.
- Testes `writerCoordination.test.ts`, `recoveryExchange.test.ts` cobrem 2 abas cooperativas, lock indisponível/ocupado, revisão stale, cenário de divergência com v0.1, quota simulada, tamanho e SHA, exportações com origem alterada. E2E `react-preview.mjs` testa download de bundle íntegro, importação somente para inspeção, arquivo adulterado, zero novas chaves e save legado byte a byte preservado em desktop/mobile.
- **Status:** código e docs em branch; CI dedicado em PR ainda a verificar. Não houve deploy até este registro.
- **Próxima ação:** obter CI verde e revisar E2E/visual, integrar PR se segura, acompanhar Railway. Fase C segue **parcial e bloqueada para writes reais** até política completa de cutover e paridade total de ações React. Próximo ciclo: laboratório de transição opt-in com recuperação explícita sem persistir saves de jogadores.

## ESTADO MAIS RECENTE — PR #11 integrada, E2E legado intermitente em correção (2026-11-16)
- `main` verificada em `9369e4a4692b448cc2ad9e52a7ef3bbda72c7ef2`, merge PR #11. Railway deployment `ae239947-8f72-4827-b277-4846495879a2` chegou a **SUCCESS** para esse commit; logs confirmam `npm start` / `node server.mjs` ouvindo na porta 8080. A página pública segue o jogo v0.1.
- CI da PR #11 `43986588480` **SUCCESS**: TypeScript, Vitest, build, GIFs, browser desktop/mobile do jogo, React e draft. Artifact screenshots `14285079261` analisado visualmente, painel de recuperação legível e sem overflow evidente.
- CI pós-merge `43986967633` **FAILURE SOMENTE E2E legado**, com timeout em `tests/e2e/browser-smoke.mjs:85`, aguardando fallback PNG para imagem #25. TypeScript/Vitest/build/GIFs passados; as etapas React/draft foram skipped depois da falha.
- Causa provável verificada no código: o teste só instalava a rota 404 do GIF #25 **depois** de visitar a Pokédex, que já podia carregar e cachear o GIF. O teste ficava dependente de cache/ordem de fetch, sem regressão funcional confirmada no servidor.
- Correção em `fix/legacy-e2e-fallback-cache-and-handoff`: registrar 404 do GIF #25 ANTES de abrir a página; usa cache-control no-store e mantém fallback da Pokédex/Arena determinístico. Não muda código de runtime, só teste/documentação.
- `apps/web/src/storage/writerCoordination.ts` na main: Web Locks exclusivamente cooperativos de v0.2 (sem writer real); auditoria de divergência v0.1/v0.2 nunca autoriza gravação. `recoveryExchange.ts` + painel experimental fazem download SHA e inspeção local de arquivo, SEM importação/restauração. `index.html`, sprites, server e save v0.1 não modificados pela PR #11.
- **Próximo:** validar CI da correção, revisar e integrar, acompanhar deploy. Depois iniciar laboratório de cutover opt-in e testes de falha/quota com storage TEMPORÁRIO, preservando chave real v0.1 e versão jogável. Nenhuma promoção automática é autorizada.

## ESTADO MAIS RECENTE — writer experimental/recuperação integrados, E2E estabilizado (2026-11-16)
- **GitHub main SHA verificado:** `db10572b89f8d7243971121661744b43d7f2e153`. PR #11 `9369e4a4692b448cc2ad9e52a7ef3bbda72c7ef2` e PR #12 `db10572b89f8d7243971121661744b43d7f2e153` **merged**, sem outras alterações ao jogo publicado.
- **Railway**: deploy da PR #11 `ae239947-8f72-4827-b277-4846495879a2` SUCCESS, deploy da PR #12 `293781a0-ded3-4b72-906f-feab1baca563` **SUCCESS**. Servidor segue `npm start` → `node server.mjs`, tela pública ainda `index.html` v0.1. O navegador externo HTTP /health não foi testado diretamente; estado SUCCESS é do Railway.
- **Testes PR #11:** GitHub Actions `43986588480` completed/success, screenshot artifact `14285079261` revisado em desktop/mobile. A prévia exibiu painel de pacote de recuperação sem cortes; Playwright validou download SHA-256 e conferência íntegro/adulterado, sem alteração do save real.
- **Falha rastreada:** o CI pós-merge `43986967633` falhou no E2E legado por timeout de fallback PNG #25. A rota de 404 havia sido instalada somente depois de a Pokédex poder cachear o GIF. Foi uma dependência não determinística do teste, não regressão funcional comprovada.
- **Correção PR #12:** `tests/e2e/browser-smoke.mjs` intercepta `poke_25.gif` com resposta 404/no-store ANTES de navegar, mantendo fallback PNG determinístico. CI da PR `43987385710` SUCCESS e **CI pós-merge em main `43987571827` completed/success**, cobrindo TypeScript, Vitest, build, GIFs 151, E2E legado, React e draft/backup desktop/mobile.
- **Proteções atualmente implementadas em código:** `writerCoordination.ts` avalia isolamento das duas versões, Web Locks só entre abas v0.2 cooperativas, revisões monotônicas e bloqueio de divergências; todos os estados ainda possuem `canWriteRealSave:false`. `recoveryExchange.ts` exporta/inspeciona arquivos localmente sem importação; `RecoveryExchangePanel` existe apenas no workspace React experimental.
- **Não há** writer oficial v0.2, persistência servidor, migração, upgrade automático, sincronização entre dispositivos ou restauração via UI. A v0.1 continua salvando em `kanto-idle-lab-save-v01`, chave jamais modificada pelos módulos v0.2.
- **Próxima etapa concreta:** laboratório de transição v0.1→v0.2 opt-in, em armazenamento TEMPORÁRIO/fake, com simulações de quota/permissões, queda entre backup e marcador, double-submit, revisão stale e conflito entre abas; nenhuma escrita nas chaves reais até paridade de todas as ações e revisão de segurança. Primeiro consultar `apps/web/src/storage/writerCoordination.ts`, `recoveryJournal.ts`, `officialSaveV02.ts`, e `index.html` função `save()`.
- Repositório `isaquesan7/pokedex` original segue read-only. Esta seção supera entradas históricas de PRs pendentes.

## 2026-11-16 — Laboratório de migração isolado em desenvolvimento (PR nova)
- **Base confirmada**: GitHub `main` SHA `bfd4b08a2a7f728cd74aa807bf7e3ea23247fb36`, após PRs #3–#13 integradas. Railway produção deploy `baf3c363-01b7-4d90-93f8-daae05a0f2a9` **SUCCESS**. Runtime público ainda é `index.html` v0.1 com `server.mjs`.
- **Branch de trabalho**: `feat/v02-cutover-memory-laboratory`; não inclui alterações no jogo v0.1, backend, GIFs ou formatos das chaves reais.
- **Novo módulo** `apps/web/src/storage/migrationMemoryLab.ts`: classe `MigrationMemoryLab` guarda cópia do save inicial em um `Map<string,string>` privado, **não aceita injeção de Storage, callbacks de persistência, localStorage ou IndexedDB**. A origem pode ser alterada por método exclusivamente simulado para provar conflito com writer v0.1 não cooperativo.
- `simulateCutover` exige frase exata `SIMULAR SOMENTE EM MEMORIA` a cada ensaio, confirma snapshot v0.1, valida pacote SHA-256 e plano `recoveryJournal.ts`, e simula, no Map, backup → candidato → marcador. Falhas/interrupções deixam dados parciais no Map para inspeção, sem limpeza automática. Não marca sucesso se journal não estiver íntegro.
- O laboratório oferece cenário de quota injetada (também capacidade em bytes em Map), crash após cada etapa, alteração simulada por aba v0.1, detecção de double-submit e teste de revisão monotônica sem alterar saves. `extractBackup` apenas extrai os bytes originais verificados do Map; NÃO restaura nada.
- **UI somente no workspace React experimental** `MigrationLabPanel.tsx` e CSS Modules com tokens/commentários por seletor, mostra seleção de cenários e checkbox de confirmação, ensaio e auditoria em memória; não é servido no Railway como página jogável. O projeto original `isaquesan7/pokedex` permanece read-only.
- **Vitest** `migrationMemoryLab.test.ts` cobre consentimento, estágios, quota/erro, 3 crashes, bloqueio de reenvio, conflito, versões inválidas, duas abas stale. **E2E** `apps/web/tests/e2e/react-preview.mjs` passa pela UI em desktop/mobile e verifica que `kanto-idle-lab-save-v01` permanece idêntico e as chaves v0.2 continuam ausentes.
- **Ainda não autorizado**: gravação nas chaves oficiais, migração real, sincronização entre abas v0.1 antigas, importação de pacotes, rollback automático, paridade completa de todas as ações React ou backend. O estágio `committed` no Map é somente um ensaio.
- **Status neste registro:** código, testes e docs em branch; CI/PR/merge/deploy ainda a confirmar e atualizar na próxima seção. **Próxima ação:** executar workflow completo na PR, corrigir falhas, revisar capturas, só integrar após CI aprovado, verificar deploy Railway e documentar resultado. Próximo desenvolvimento: projetar cutover real opt-in com writer único, backup fora do navegador e paridade total antes de liberar escrita em progresso.

## ESTADO MAIS RECENTE — laboratório v0.2 validado e publicado como código (2026-11-16)
- **GitHub**: PR #14 https://github.com/isaquesan7/poke-idle-game/pull/14 integrada na `main`, SHA `455c29a95335bd9efcdba805f50748bc6c051fe0`, logo após PRs #3–#13. O branch de trabalho `feat/v02-cutover-memory-laboratory` não precisou modificar `index.html` ou `server.mjs`.
- **CI**: workflow da PR `43989245322` **completed/success**; regressão final da main `43989615947` **completed/success** para SHA `455c29a95335bd9efcdba805f50748bc6c051fe0`. Ambos verificam TypeScript, Vitest, Vite build, 151 GIFs, E2E legado, React e draft. O E2E React percorreu cenários quota → backup-only, conflito da aba legada → conflict e execução só RAM → committed, e checou que `kanto-idle-lab-save-v01` permaneceu idêntica e nenhuma chave oficial v0.2 foi gravada.
- **Revisão visual**: screenshots desktop 1365px e mobile 390px do artifact GitHub `14287110790` (run `43989245322`) examinadas: painel de laboratório legível, sem cortes evidentes nem overflow na regressão automatizada.
- **Railway**: deploy de produção `b621615b-3d49-4b14-91be-bd440f76a20b` em **SUCCESS** para commit `455c29a9`; logs confirmam `npm start` / `node server.mjs` ouvindo na porta 8080. Não houve validação HTTP externa direta pelo ambiente atual. A interface pública segue v0.1.
- **Como funciona o laboratório**: `MigrationMemoryLab` possui `Map` privado, sem injeção de Storage nem setItem/removeItem no navegador; consentimento literal obrigatório; prepara/verifica backup SHA-256; simula journal backup → candidato → commit com falha de quota, interrupção, conflito e revisão stale. Dados parciais permanecem apenas na instância de teste até descartá-la. `MigrationLabPanel` é exclusivo da prévia React, que não é rota pública.
- **O que NÃO está pronto**: nenhuma escrita oficial v0.2, importação/restauração em storage, coordenação com abas v0.1 não cooperativas, paridade total das ações do jogo, transações em servidor ou sincronização entre dispositivos. 'committed' é somente uma situação simulada, **não** migração de jogador.
- **Próxima ação objetiva**: projetar rollout/cutover opt-in para um writer único; criar testes de exceções reais de quota e fechamento abrupto em origem **de teste separada**, exportação recuperável fora da origem e rollback explícito, sem tocar o progresso do usuário. Depois portar ações restantes do jogo para a v0.2 e só então autorizar migração. Primeiro ler `docs/SAVE_MIGRATION_PLAN.md`, `apps/web/src/storage/migrationMemoryLab.ts`, `writerCoordination.ts`, `recoveryJournal.ts`, `index.html` função `save()`.
- Repositório original `isaquesan7/pokedex` continua intocado. Esta seção substitui estados históricos de branches/PRs anteriores.

## 2026-11-16 — Laboratório de browser real isolado, PR de próxima etapa (EM VALIDAÇÃO)
- **Base verificada**: `main` SHA `65e0dccb90f156596c6e0fb0f2d19232ff943132` (PRs #3–#15 integradas), Railway deploy `85dda8e4-9795-47a8-a869-329d52c829e6` SUCCESS. Jogo público v0.1 permanece servindo `index.html` por `server.mjs`.
- **Branch de trabalho**: `feat/v02-isolated-browser-cutover-tests`; nenhuma alteração ao arquivo de UI publicada, servidor, save do jogador, Pokémon GIFs ou repo `isaquesan7/pokedex`.
- **Módulo** `apps/web/src/storage/browserSandboxCutover.ts`: executa a sequência de journal usando `window.localStorage` REAL apenas se hostname for `localhost`/`127.0.0.1`, protocolo HTTP e pathname exatamente `/__kanto_v02_browser_lab__`; todas as escritas usam **chaves fixas `__kanto_lab__*`**, distintas de `kanto-idle-lab-save-v01` e qualquer chave v0.2 de jogador. Não é importado no App nem pelo servidor.
- **Segurança do sandbox:** exige consentimento textual por execução; lock Web Locks exclusivo de nome `__kanto_lab__exclusive_writer` (diferente do oficial) e `ifAvailable:true`; plano de backup → candidato → marcador com read-back; não sobrescreve entradas existentes e não reexecuta commits parciais. Resultado committed só significa integridade estrutural NO TESTE.
- **Recuperação de laboratório:** interrupção após backup/candidato/marcador deixa chaves de teste para read-back após fechar e reabrir a aba. Exportação de backup devolve texto sem restaurar. Rollback exige confirmação separada e estado íntegro sem divergência; remove apenas candidato/marcador de teste, preservando fixture legada e backup verificado.
- **E2E Playwright** `apps/web/tests/e2e/browser-cutover-lab.mjs`: Vite localhost porta 5174 e rota exclusiva de sandbox; testa recusa de execução fora da rota/sem consentimento, duas abas reais com Web Locks, crash/refresh, alteração da origem em outra aba, rollback, quota nativa do Chromium até `QuotaExceededError`, invariância de todas as chaves v0.1/v0.2/draft/cache. Executado após regressão legado/React/draft pelo `.github/workflows/main-regression.yml`.
- **Importante:** a v0.1 antiga AINDA salva sem locks no seu próprio domínio e pode divergir. O novo teste nunca executa nada no site Railway nem desativa writers legados. Nenhum `setItem` oficial v0.2, backup externo obrigatório, cutover opt-in real, importação de save ou rollback de usuário foram implementados.
- **Estado neste registro:** código + CI + documentação em branch, PR/teste/merge/deploy ainda a confirmar. **Próxima ação:** executar CI e revisar erros, corrigir; integrar só após checks e revisão; Railway deve continuar v0.1. Próxima etapa após isso: especificação de writer único e rollout explícito com paridade das ações React e estratégia de backup fora da origem.

## ESTADO MAIS RECENTE — PR #16: testes reais de browser isolados (2026-11-16)
- **GitHub:** PR #16 `https://github.com/isaquesan7/poke-idle-game/pull/16` integrada ao `main` SHA `977d14a9890300907d090bf1e01a6ae72454e765`; PRs #3–#15 já integradas anteriormente. Sem PRs de código pendentes desta etapa.
- **CI:** workflow da PR `43991731238` `completed/success` e CI pós-merge da main `43991985570` `completed/success`. Tipo/core/storage, build Vite, 151 GIFs, E2E legado/React/draft e novo `browser-cutover-lab.mjs` aprovados. Log da PR mostrou PASS para rota/consentimento, crash/reload, rollback explícito, duas abas Web Locks e `QuotaExceededError` REAL, mantendo o save real intacto.
- **Railway:** deploy `54ccff55-8225-4057-b7ee-82756487d94d` do SHA `977d14a9` chegou a `SUCCESS`, logs `npm start` → `node server.mjs`, porta 8080. **Site ainda executa v0.1**; o serviço não importa a nova rotina de laboratório. O GET HTTP externo `/health` não foi confirmado diretamente pelas ferramentas; status informado é do Railway.
- **Código desta etapa:** `apps/web/src/storage/browserSandboxCutover.ts` aceita gravações somente quando `window.location` aponta para origem localhost/127.0.0.1, protocolo HTTP, pathname exato `/__kanto_v02_browser_lab__`. Chaves escritas são somente `__kanto_lab__*` prefixadas, com lock exclusivo isolado e consentimento literal. Não escreve no `kanto-idle-lab-save-v01`, nem nas chaves oficiais v0.2, draft ou cache.
- **Testes browser reais:** `apps/web/tests/e2e/browser-cutover-lab.mjs` usa Vite loopback porta 5174, contextos descartáveis do Chromium, quota real até `QuotaExceededError`, duas abas, persistência de journal após fechamento/reabertura, conflito de cópia legada, rollback do candidato de TESTE mantendo backup e fixture. Rodado agora também pelo `.github/workflows/main-regression.yml` em PRs e main.
- **Segurança:** nem estado `committed` no laboratório concede migração. Não existem writer v0.2 em produção, commit de progresso v0.2, importação/restore real, sincronização de dispositivos, garantia de lock de abas v0.1 antigas, controle de economia no servidor ou desligamento dos writers antigos. A chave v0.1 real e a UI v0.1 foram preservadas.
- **Próxima ação objetiva:** detalhar e implementar a política de writer único/transferência de autoridade com gate fail-closed, completar paridade de gameplay React (treinador/equipamentos, economia, captura, batalha, expedição, inventário, títulos e insígnias), e plano de cutover opt-in com backup externo e rollback explícito. Ver `docs/SAVE_MIGRATION_PLAN.md`, `docs/CUTOVER_AUTHORITY_PROPOSAL.md`, `apps/web/src/storage/writerCoordination.ts`, `browserSandboxCutover.ts`, `index.html` função `save()`.
- Repositório fonte de GIFs `isaquesan7/pokedex` permanece totalmente read-only. Esta última seção substitui referências históricas de PRs abertas.

## 2026-11-16 — Gate fail-closed e matriz de operações v0.1 (PR EM VALIDAÇÃO)
- Base verificada: GitHub `main` `158c85b9f88d71b5f81f6a16ee317b43f0e3b7cc` (PRs #3–#17 integradas), Railway deploy `39580a3e-6637-4408-bf57-75f188be0ce1` `SUCCESS`; site v0.1 ativo; nenhuma PR aberta ao iniciar.
- Branch `feat/v02-fail-closed-cutover-gate-and-mutation-audit`, sem alterações em `index.html`, `server.mjs`, assets, save real ou repo read-only `isaquesan7/pokedex`.
- `apps/web/src/storage/cutoverGate.ts`: gate de autorização propositalmente com resultado tipado **somente `status:'blocked'`/`canMigrate:false`**. Encapsula `inspectMigrationReadiness` e duas leituras de chaves: v0.1, draft e três chaves oficiais reservadas v0.2; detecta ausência/incompatibilidade/corrida, chaves v0.2 ocupadas e storage indisponível. Além disso, bloqueios de release fixos continuam presentes para aba v0.1 não cooperativa, paridade incompleta, writer oficial não implementado, backup externo não verificado e liberação ainda não autorizada. Web Locks presentes NÃO os removem.
- Prévia `App.tsx` mostra 'Migração v0.2 bloqueada' e motivos acessíveis, apenas texto, sem botão de migrar, sem chamada a setItem/removeItem. CSS usa tokens `:root`, com comentários em português em todos os seletores novos.
- `docs/LEGACY_MUTATION_MATRIX.md`: auditoria dos 21 handlers v0.1, campos alterados e status no React; inclui escritores indiretos `save`, `ensureMove`, `addTrainerXP`, `addPokemonXP`, `gainedBadges`, `claimExp`, `pagehide` e cache. O teste Node `tests/legacy-mutation-audit.test.mjs` falha ao adicionar/remover ações tratadas sem atualizar a matriz/snapshot; revisão manual ainda necessária para mudanças dentro de ações existentes.
- `apps/web/src/storage/cutoverGate.test.ts`: save válido continua bloqueado; locks ausentes; dados de outra versão; treinador inválido; draft stale/forjado; chaves oficiais v0.2 ocupadas; mudança entre leituras; storage inacessível; nenhuma escrita. E2E React desktop/mobile valida motivos de bloqueio e ausência de botão de migrar.
- Status: código, documentação e testes em branch de PR; CI ainda a conferir. PR não ativa migração, writer, importação, rollback real nem backend.
- Próxima ação: executar CI completo, corrigir eventuais falhas, revisão de diff e merge só após verde. Depois iniciar reducers puros para pontos/manuais de Pokémon e equipe, eventos de batalha/expedição idempotentes e política de writer único/backup externo. Usar `docs/LEGACY_MUTATION_MATRIX.md` e `docs/CUTOVER_AUTHORITY_PROPOSAL.md` como referência prioritária.

## ESTADO MAIS RECENTE — gate v0.2 fail-closed e matriz de mutações aprovados (2026-11-16)
- **GitHub main:** SHA verificado `64992f90f693c690c4c9b8df5824c6f34798dfbc`, PR #18 `https://github.com/isaquesan7/poke-idle-game/pull/18` **merged**. PRs #3–#17 já integradas; nenhum arquivo do jogo público ou sprites alterado pela #18.
- **CI:** workflow da PR `43993922365` `completed/success`; CI da main `43994224019` `completed/success`, cobrindo TypeScript, Vitest core/web, auditoria Node de 21 ações, build Vite, 151 GIFs e E2E v0.1, React, draft e browser sandbox em Chromium. E2E React verificou presença da seção 'Migração v0.2 bloqueada' e ausência de botão de migração.
- **Railway:** deploy `4009f1a4-6dd9-4a4f-9859-7bc92684caa7` do SHA `64992f90` **SUCCESS**. O comando de produção continua `npm start`/`node server.mjs`, servindo `index.html` v0.1. Não houve teste HTTP externo direto `/health` nesta sessão; status confirmado pela plataforma Railway.
- **Código:** `apps/web/src/storage/cutoverGate.ts` não oferece valor `'allowed'` nem `canMigrate:true` — a API somente retorna `blocked`. Mesmo com save estruturalmente válido e Web Locks disponível, writer legado não cooperativo, paridade incompleta, writer oficial ausente, backup externo não verificado e release pendente bloqueiam a transição. Nenhuma função nova grava chaves oficiais.
- **Matriz de operações:** `docs/LEGACY_MUTATION_MATRIX.md` detalha os 21 handlers v0.1 e escritores indiretos (`ensureMove`, `pagehide`, `battle`, `claimExp`, etc.). `tests/legacy-mutation-audit.test.mjs` detecta alteração no conjunto de ações; não substitui auditoria interna de cada função.
- **Próxima ação objetiva:** portar, em etapas separadas e testadas, reducers puros de treino/reset de pontos por UID para Pokémon, controle da equipe e validação de expedição; em seguida eventos idempotentes de batalha e claim para evitar duplas recompensas. Depois revisar modelo de writer único e backup fora da origem; não implementar cutover real até paridade completa e aprovação. Consultar `docs/LEGACY_MUTATION_MATRIX.md`, `docs/CUTOVER_AUTHORITY_PROPOSAL.md` e `packages/game-core`.
- **Estado de entrega:** código da PR #18 integrado e validado; UI pública preservada sem save v0.2. Esta seção supera entradas históricas sobre PR #18 'em validação'. Repositório `isaquesan7/pokedex` continua read-only.

## 2026-11-16 — Redutores puros Pokémon/equipe v0.1→core (PR EM REVISÃO)
- **Base confirmada**: GitHub `main` `547a1e3c5ff99be13fbe4ddca4d25b6155ced0c7`, PRs #3–#19 integradas, sem PRs abertas; Railway deploy `b36ddb70-86ca-4f33-ace1-f47adf2cd2dc` SUCCESS, jogo público ainda `index.html`/`server.mjs` v0.1.
- **Branch**: `feat/v02-pokemon-team-pure-reducers`. Nenhuma modificação no save real, na página pública, no servidor, em assets ou no repo read-only `isaquesan7/pokedex`.
- **Implementado** `packages/game-core/src/legacy/pokemonTeamReducer.ts`: `reduceLegacyPokemonTeamJson(sourceJson,action)` retorna NOVO texto JSON (`ok`) ou bloqueio (`invalid`) sem DOM, storage, RNG, PokéAPI, clocks e sem mutar entrada. Ações `invest-pokemon`, `reset-pokemon`, `add-team`, `remove-team`. Ponto manual individual por UID, `budget=(level-1)*2`, nível 1–100, sem aplicar teto 40 do treinador aos Pokémon. `reset` mantém XP, afinidade, golpes, espécie, UID, dados extras e recursos intactos.
- **Equipe**: no mínimo 1 e no máximo 3 Pokémon capturados, sem UIDs duplicados/inexistentes; a ordem preserva o líder de batalha. A v0.1 não permite alterar time durante `expedition` ativa; treino ainda permitido. Ações desconhecidas/save inválido/versão futura/orçamento fracionário ou excedido são recusados.
- **Contratos** exportados pelo `@kanto/game-core` em `src/index.ts`; testes `packages/game-core/tests/pokemon-team-reducer.test.ts` verificam determinismo, dois Pokémon da mesma espécie com UID diferente, status e economia intocados, teto real dos pontos, equipe cheia, expedição, saves legados sem manual e integridade de roster/time.
- **Limite intencional**: não foi implementado writer v0.2, evento idempotente ou interface jogável React, e `cutoverGate.ts` continua `canMigrate:false`. Dados retornados não são aplicados à chave v0.1 nem a chaves oficiais v0.2.
- **Estado**: código/documentação/testes adicionados à branch, CI e revisão de PR ainda pendentes. **Próxima ação**: conferir CI completo (TypeScript/Vitest/build/E2E), corrigir e integrar após checks, acompanhar Railway; depois desenvolver eventos puros de combate, captura e expedição com idempotência e autoridade única de escrita. Este registro será atualizado após release.

## ESTADO MAIS RECENTE — reducers Pokémon/equipe validados e integrados (2026-11-16)
- **GitHub main verificada:** `5e60f17b83771d01af0e56ee33390a2dde057c7d`; PR #20 `https://github.com/isaquesan7/poke-idle-game/pull/20` integrada; PRs #3–#19 já integradas. A branch de funcionalidade foi revisada sem alterações em `index.html`, `server.mjs` ou assets.
- **CI:** PR `43996185895` `completed/success`; CI pós-merge main `43996462703` `completed/success`. Cobertura: TypeScript core/web, Vitest core/storage, build React, 151 GIFs, testes Node legado, E2E jogo v0.1, React, draft e browser sandbox de cutover. Nenhuma alteração da interface pública.
- **Railway:** deployment `da78ab5a-8d5c-4894-9be2-a59897e8f4f2` em **SUCCESS** para SHA `5e60f17b`. Logs: `npm start` → `node server.mjs` escutando porta 8080. A checagem HTTP externa `/health` não ficou acessível nesta sessão; `SUCCESS` informado pela plataforma Railway.
- **Implementação:** `packages/game-core/src/legacy/pokemonTeamReducer.ts` exporta `reduceLegacyPokemonTeamJson` e `legacyPokemonManualBudget`. Permite investir +1 ponto manual por UID, resetar só a instância e adicionar/remover membros do time com proteção de roster/UID duplicado, equipe 1–3 e bloqueio por expedição. Pokémon v0.1 usa orçamento `(level-1)*2`; o teto 40 é apenas do TREINADOR. Ações produzem JSON novo e nunca escrevem em localStorage.
- **Testes específicos:** `packages/game-core/tests/pokemon-team-reducer.test.ts` cobre níveis 1/100, orçamento esgotado, >40 no Pokémon nível alto sem cap indevido, duplicidade de espécie vs UID, integridade de moedas, XP, afinidade, título, insígnias, dados extras, time cheio e proteção durante expedição; testes integram CI permanente.
- **Migração segue bloqueada:** `cutoverGate.ts` permanece sempre `canMigrate:false`, sem writer v0.2, sem backup externo verificado e sem equivalência total das ações; o site publicado continua o jogo v0.1 e o repositório `isaquesan7/pokedex` não foi modificado.
- **Próxima prioridade concreta:** projetar comandos/eventos idempotentes para vitória/derrota/captura e resgate/encerramento de expedição em módulos PUROS, com identificadores de evento, validação de revision e testes de dois envios para não duplicar coins/XP/UID. Não conectar eventos às chaves reais até writer único, paridade total e rollout aprovados. Leia `docs/LEGACY_MUTATION_MATRIX.md`, `docs/CUTOVER_AUTHORITY_PROPOSAL.md`, `docs/SAVE_MIGRATION_PLAN.md` e `packages/game-core/src/legacy/pokemonTeamReducer.ts`.
- Esta seção substitui as entradas históricas que descrevem PR #20 como pendente.

## 2026-11-17 — Eventos idempotentes de recompensa e expedição (PR EM REVISÃO)
- **Baseline confirmado:** GitHub `main` SHA `2b477576e43e741affbad7f6b198f4eaba55af53`, PRs #3–#21 merged, sem PRs abertas. Railway deploy `e1e86c96-a4af-453c-9a82-df5aeafb8965` SUCCESS; jogo publicado ainda `index.html` v0.1 com `server.mjs`.
- **Branch:** `feat/v02-idempotent-reward-events`, apenas game-core/testes/docs, nunca `index.html`, backend, chaves reais, assets ou `isaquesan7/pokedex`.
- **Implementação:** `packages/game-core/src/legacy/rewardEvents.ts` introduz `RewardJournal {raw,revision,receipts}`, preparado por `prepareRewardJournal(raw)`, aplicado por `applyRewardEvent(journal,cmd)`; só valores e texto em RAM, zero IO. Eventos `battle-result` (win/loss/draw pré-resolvido; captura opcional dentro da mesma transição), `start-expedition`, `claim-expedition`, `stop-expedition`. Usa `grantXp`, `expeditionRewards` e `LEGACY_BADGES` do core.
- **Idempotência localizada:** mesmo ID + mesmo payload => `duplicate` e mesmo envelope, ID com payload diferente => `rejected`, nova ação com revision antiga => `rejected`. Revisão e recibo avançam juntos com moedas/XP/UID, evitando reaplicação quando chamadas serialmente no MESMO envelope. Cursor `lastClaimAt = nowMs` controla claims; um segundo claim no mesmo período não paga de novo; stop paga claim final UMA vez e encerra.
- **Paridade provisória:** vitória legada moedas `25+3*wildLevel`, XP treinador `30+7*wildLevel`, XP Pokémon ativo `20+6*wildLevel`, afinidade de vitória `2..5` fornecida, 8 badges cumulativas por patamar, captura em vitória gera UID de `nextUid`; derrota ou empate contam 1 loss. Claim até 2880 ciclos de 10s (7 coins/4 XP treinador/5 XP cada Pokémon por ciclo; afinidade floor(cycles/3)), com snapshot de UIDs e relógio EXPLÍCITO, sem ler hora do sistema. Não calcula RNG/combate verdadeiro nem prova legitimidade do evento.
- **Testes:** `packages/game-core/tests/reward-events.test.ts` cobre replay, ID adulterado, revisão obsoleta, duas cópias divergentes simuladas, recompensa/captura sem duplicar, vitória/derrota/empate, insígnias, expedição/claim/stop/8h, corrupção e campos extras sem mutação original. CI/PR/deploy ainda a verificar.
- **Riscos bloqueantes:** não existe writer oficial, transação entre abas diferentes, backend que valide recompensas ou cursor antifraude. Um cliente pode forjar `battle-result`; duplicação entre DOIS envelopes independentes ainda é possível. Portanto `cutoverGate.ts` permanece SEMPRE `canMigrate:false`, sem uso na UI pública ou no save v0.1/v0.2.
- **Próximo passo:** validar TypeScript/Vitest e CI completo no PR, revisar diff e integrar após testes; monitorar deploy Railway. Em fase posterior, definir writer canônico/ledger durável e autenticação/autorização do evento, simulador de combate determinístico e captura com RNG verificável, antes de liberar qualquer persistência oficial. A próxima seção de handoff deve atualizar SHA e CI após merge.

## ESTADO MAIS RECENTE — eventos puros de recompensa validados (2026-11-17)
- **GitHub** `main` SHA `989c2cdc05b1d945109381ba878e3e16cd219e59`, PR #22 `https://github.com/isaquesan7/poke-idle-game/pull/22` merged. PRs #3–#21 também integradas. Nenhuma alteração em `index.html`, `server.mjs`, CSS, assets ou `apps/web`.
- **CI**: PR #22 run `44056942594` `completed/success` e CI pós-merge `44057278833` `completed/success`, cobrindo TypeScript/Vitest, Node legado, 151 GIFs, Vite build e E2E v0.1/React/draft/browser sandbox Chromium. As duas primeiras runs da PR falharam somente por tipagem de helpers de teste, corrigida antes do merge.
- **Railway**: deployment `5b76abc6-c194-4db2-81e7-2876ed09aa89` SHA `989c2cdc` **SUCCESS**; logs `npm start` → `node server.mjs` ouvindo na porta 8080. HTTP GET `/health` não foi acessado diretamente nesta sessão; SUCCESS é a indicação do Railway.
- **Novo core**: `packages/game-core/src/legacy/rewardEvents.ts` + `packages/game-core/tests/reward-events.test.ts`; `RewardJournal` somente RAM com `{raw,revision,receipts}`; `applyRewardEvent()` aceita comandos de `battle-result` pré-resolvido, `start-expedition`, `claim-expedition`, `stop-expedition`, e retorna `applied|duplicate|rejected` sem mutações globais nem armazenamento.
- **Regras v0.1 replicadas em memória:** créditos por wildLevel em vitória, derrota/empate contam loss, progressão XP do treinador/instância Pokémon, afinidade, badges cumulativas, captura opcional com UID da próxima sequência, resgate de expedição a cada 10 segundos com teto 2880 ciclos/8h, encerramento com claim final, cursor `lastClaimAt = nowMs` explícito.
- **Antirreplay LOCAL**: replay com mesmo ID + mesmo payload é `duplicate` sem pagamento; mesmo ID diferente conflita; revisão stale rejeita. Teste simula duas abas independentes e demonstra que SEM transação/canonical writer os dois envelopes ainda podem conceder localmente a mesma recompensa. O reducer **não** verifica legitimidade de vitória ou aleatoriedade da captura, e não é mecanismo antifraude.
- **Segurança**: `cutoverGate.ts` continua SEMPRE `canMigrate:false`, não foi instalado writer real, backend ou página React jogável, e a v0.1 pública com chave `kanto-idle-lab-save-v01` continua intacta. Repo original `isaquesan7/pokedex` segue read-only.
- **Próxima ação concreta**: implementar sandbox de autoridade única para decisões de recompensa, com teste de revision atômica + recibo idempotente e falhas/duas abas, ainda em memória/origem local exclusiva; depois motor determinístico de combate/captura, paridade total e backup externo. NÃO tratar ledger em RAM como banco de dados nem habilitar migração v0.2.
- Esta seção substitui os registros históricos que diziam que PR #22 aguardava CI/merge.

## Continuidade — golpe equipado e upgrade em teste (2026-11-17)
- **Base verificada:** `main` `989c2cdc05b1d945109381ba878e3e16cd219e59`; PR #22 integrada. CI pré-merge da PR `44056942594` completed/success. CI pós-merge da `main` não confirmado.
- **Railway:** deploy `5b76abc6-c194-4db2-81e7-2876ed09aa89`, para `989c2cdc`, em SUCCESS; jogo público segue `index.html`/v0.1. `GET /health` externo não testado nesta etapa.
- **Branch atual:** `feat/v02-pokemon-move-reducers-main-synced`, criada a partir desse SHA, sem alterações em `index.html`, `server.mjs`, GIFs ou `isaquesan7/pokedex`.
- **Novo módulo:** `packages/game-core/src/legacy/pokemonMoveReducer.ts` oferece `reduceLegacyPokemonMoveJson` para `select-move` e `upgrade-move` (somente RAM), além de `legacyMoveRankLimits`. Seleção exige golpe listado no catálogo fornecido; upgrade exige golpe atual e poder positivo; orçamento `floor(level/5)`, rank máximo `min(10,floor(level/10)+1)`. Mantém ranks de outros golpes, isolamento por UID e todos os demais campos, inclusive recursos/XP/afinidade.
- **Testes:** `packages/game-core/tests/pokemon-move-reducer.test.ts` exercita duas instâncias da mesma espécie, rank, níveis 1/100, ausência de dados em saves legados, rejeição de golpes inválidos e conservação de dados. CI ainda PENDENTE de execução.
- **Limites:** `availableMoves`/`movePower` são injeção de dados de referência, NÃO comprovação autorizada de espécie/golpe. Não foi criado writer real, não existe combate validado e não houve migração. O gate `canMigrate:false` continua intacto.
- **Próxima tarefa concreta:** executar CI completo da PR #25; corrigir eventuais falhas; revisar/mesclar após aprovação e acompanhar o deploy do commit exato. Em seguida, retomar a prioridade da PR #23: sandbox de autoridade única e ledger/transações entre abas, simulador verificável de combate e testes antirreplay. Depois continuar títulos/reset de treinador e demais ações legadas; backup externo e cutover continuam condicionados à aprovação.

## ESTADO MAIS RECENTE — PR #25 liberada; próxima etapa é autoridade única (2026-11-17)
- **GitHub:** `main` commit de merge `851fe85f96cbe9c3219f357200e1da487d35aa4e`, PR #25 `https://github.com/isaquesan7/poke-idle-game/pull/25` **merged**. PR #24 anterior ficou encerrada, SUPERADA pela #25 porque a `main` avançou após PR documental #23. Branch da #25 foi criada diretamente sobre `11a143ec`, preservando handoff/regras da #23.
- **CI da PR:** run `44059077306` `completed/success`. A suíte cobriu typecheck/core+web, Vitest, build React, tests Node, 151 GIFs e quatro E2E Chromium (v0.1, React preview, draft e browser sandbox). A primeira execução detectou tipo union amplo em helpers de teste (corrigido). Execuções intermediárias falharam devido a instalação adicional do Playwright tentando buscar `csstype@3.2.4` (HTTP 404); root `package.json` agora fixa `csstype@3.2.3` via override, correspondente ao lockfile, e o CI completo passou.
- **CI da `main` pós-merge:** resultado não confirmado por este conector nesta sessão (não inferir sucesso). PR aprovada antes do merge, com teste integral verde.
- **Railway produção:** deploy `8cbf036f-c96b-4e03-8a86-eda948710de5` para o SHA **exato** `851fe85f` atingiu **SUCCESS**. Logs mostram `npm start`, `node server.mjs`, porta 8080, e build contém `Healthcheck succeeded!` para `/health`. O GET externo do site não foi testado nesta sessão.
- **Código novo:** `packages/game-core/src/legacy/pokemonMoveReducer.ts` exportado em `src/index.ts`, testes `packages/game-core/tests/pokemon-move-reducer.test.ts` e D-025. `select-move` e `upgrade-move` produzem JSON novo SEM side effects, validam UID, catálogo fornecido pelo chamador, poder danoso, orçamento `floor(level/5)` e limite `min(10,floor(level/10)+1)` por golpe, preservam ranks de outros golpes e todos os dados não alterados.
- **Segurança intacta:** `index.html`, `server.mjs`, 151 GIFs, chaves `kanto-idle-lab-save-v01` e chaves de progresso v0.2 ficaram intactos; não há writer oficial, prova de vitória ou antifraude. `cutoverGate.ts` segue `canMigrate:false`. `isaquesan7/pokedex` nunca foi modificado.
- **Próxima ação concreta:** implementar sandbox de autoridade **ÚNICA** para comandos de recompensa/expedição com um journal e revisão canônicos sob contrato transacional, testar replay, falha entre gravação/resposta, duas abas concorrentes e conflitos, somente em `Map`/origem de laboratório, NÃO em save real. Em seguida motor determinístico/validação de combate e restante da paridade; nunca abrir cutover sem writer real, backup externo, paridade e aprovação explícita.
- **Handoff:** este registro substitui trechos históricos que descrevem a PR #25 como pendente ou a PR #22 como próximo desenvolvimento. As instruções de `AGENTS.md`, GDD e ADRs continuam vigentes.

## 2026-11-17 — Laboratório de autoridade única de recompensas (branch em validação)
- **Base confirmada:** GitHub `main` SHA `c34ab0748a8829da0e01a8acc9c5b6227813c1a6`, PR #26 documental integrada; Railway deploy `51e06e42-c462-4560-bc73-84963d11af67` `SUCCESS`. PRs abertas ao iniciar: nenhuma.
- **Branch independente:** `feat/v02-reward-authority-memory-lab`, somente game-core/testes/docs; não modifica `index.html`, `server.mjs`, React público, sprites nem `isaquesan7/pokedex`.
- **Implementação:** `packages/game-core/src/legacy/rewardAuthorityMemoryLab.ts` exporta `RewardAuthorityMemoryLab`, que encapsula um único `Map` privado com chave FIXA de laboratório `__kanto_lab__reward_authority_in_memory`. Um único valor serializado registra `RewardJournal` completo (texto JSON do estado, revisão e recibos) e checksum FNV-1a apenas para detectar dano acidental. NUNCA lê/grava armazenamento real ou rede, e não recebe portas de persistência nem chaves de origem.
- **Transição simulada:** clientes de `openClient()` compartilham a instância e consultam snapshots copiados; `submit()` valida evento usando `applyRewardEvent()` e aplica o novo envelope em uma única gravação do Map, sem `await` entre leitura e commit. `Promise.all` de duas abas da MESMA instância admite uma revisão, rejeitando a outra como obsoleta. Reenvio com ID+payload idênticos retorna `duplicate`. Falha antes do commit não aplica; falha após commit gera ACK perdido que replay recupera. Corrupção fecha a escrita em modo fail-closed.
- **Testes:** `packages/game-core/tests/reward-authority-memory-lab.test.ts` cobre disputa de revisão, duas recompensas que não duplicam na mesma instância, replay, dados de cliente mutáveis, corrupção, start/claim/stop e dupla instância independente que diverge. Execução CI ainda PENDENTE neste registro.
- **Limites IMPORTANTES:** Map privado morre com a instância; o checksum FNV-1a não autentica o resultado, nem impede fraude. Não há durabilidade fora do processo, isolamento entre múltiplos processos/servidores/abas reais, auditoria de resultados de batalha, tempo de expedição confiável, migração, backend ou desbloqueio de writer real. A v0.1 ainda salva sem coordenação via localStorage, e o gate oficial segue `canMigrate:false`.
- **Próxima ação:** executar CI completo (TypeScript/Vitest/build/GIFs/E2E), revisar PR e integrar somente após checks. Em seguida desenhar autoridade transacional persistente e simulação/validação determinística de batalha/rolagem, mais testes de concorrência reais em repositório transacional de TESTE; concluir paridade e backup externo antes de qualquer migração opt-in.

## ESTADO MAIS RECENTE — PR #27 integrada, autoridade de recompensas apenas em RAM (2026-11-17)
- **GitHub:** `main` SHA verificado `de6b84e3554d27df31d2ec0e4b190d897ffb74b9`. PR #27 `https://github.com/isaquesan7/poke-idle-game/pull/27` **merged**. A branch `feat/v02-reward-authority-memory-lab` adicionou arquivos de game-core, testes e documentação; sem modificações de UI/servidor/assets.
- **CI:** `44063137880` da PR foi `completed/success` após correção de dois parênteses em asserções. Validou TypeScript strict, testes Vitest do core/web, testes Node legado, build React, 151 GIFs e 4 regressões E2E Chromium (v0.1, React, draft e browser sandbox). CI pós-merge de `main` não verificada pelo conector nesta sessão.
- **Railway:** deploy de produção `667ad1f3-8535-44d7-9c4d-b163f342895a` em **SUCCESS** para o SHA `de6b84e`. Logs confirmam `npm start`, `node server.mjs`, porta 8080, e build **Healthcheck succeeded!** com pathname `/health`. GET HTTP externo não foi conferido diretamente.
- **Módulo entregue:** `packages/game-core/src/legacy/rewardAuthorityMemoryLab.ts` exporta `RewardAuthorityMemoryLab` e contratos de cliente. Uma única entrada em Map privado guarda estado JSON, revisão, recibos e checksum de dano acidental. Transições sequenciais do MESMO objeto têm idempotência por ID/payload, proteção de revisão stale, falhas injetadas antes/depois do commit e recusa de ledger corrompido. Testes em `packages/game-core/tests/reward-authority-memory-lab.test.ts` incluem prova de que duas instâncias independentes ainda podem divergir.
- **Limitações críticas:** Map é descartável; checksum FNV-1a não autentica resultados; duas abas REAIS, processos e dispositivos separados não coordenam; cliente ainda pode fornecer batalha pré-resolvida falsa. Não há banco, ledger durável ou writer v0.2. A v0.1 continua autônoma em `localStorage` sem locks; `cutoverGate.ts` continua `canMigrate:false`. Dados reais e repositório `isaquesan7/pokedex` intactos.
- **Próxima tarefa concreta:** elaborar e testar simulador de batalha determinístico em `game-core` com entradas de status, poderes, tipagem e sequências de aleatoriedade explícitas/validáveis e resultados reproduzíveis (sem tocar batalha pública). Em paralelo projetar ledger **persistente transacional** de eventos/revisões com unicidade por jogador, sem conectar nenhum writer real até paridade completa, backup externo e liberação de cutover. Arquivos de partida: `index.html` funções `battle()`/`hitDamage()`, `packages/game-core/src/legacy/rewardEvents.ts`, `docs/GDD.md` e `docs/CUTOVER_AUTHORITY_PROPOSAL.md`.
- Este registro substitui a seção anterior que descrevia a PR #27 como ainda em validação.

## Continuidade — primeira rota v0.2 jogável em construção (2026-11-17, PR pendente)
- **Nova decisão do usuário:** ainda não existe jogador real; **priorizar funcionamento e UI/UX da v0.2**, sem bloquear progresso do projeto por migração do save v0.1, que atualmente representa só testes. Dados de teste v0.2 podem ser reiniciados por escolha explícita (D-027). Nenhum jogo multiplayer ou conta real ativado; segurança de produção deverá ser reavaliada antes de receber jogadores.
- **Base técnica ao iniciar:** GitHub `main` `166bf972bf52d6fb48a60c12840e754c14822425`, Railway deployment `1af5ab3a-a2f0-472a-a4ef-06e29e7b2351` SUCCESS; PR #27 laboratório e PR #28 handoff integradas. Branch `feat/v02-playable-onboarding-idle-route` aberta desse commit.
- **Implementação em revisão:** `apps/web/src/play/PlayApp.tsx` + CSS module, `playSave.ts`, testes Vitest de save/treino/claim/reset e E2E de `/play` no servidor real desktop/mobile. Onboarding (nome+3 iniciais), modo demo opcional, tela geral, treinador/atributos/equipamentos, Pokémon/treino, expedição start/claim/stop. Usa exclusivamente funções puras `@kanto/game-core` e chave de testes `kanto-idle-play-v02` independente da chave original. `/play` serve Vite compilado no Railway através de `npm prestart` e rota allowlist; o legado `/` segue v0.1 nesta etapa de verificação.
- **Persistência local:** `PlaySnapshot` versionado e revisionado, RewardsJournal com recibos idempotentes para expedições, Web Locks preferidos entre navegadores cooperativos; fallback otimista **não garante** CAS atômico. Sem backend, sistema antifraude, comprovação de relógio ou conta. `resetPlaySave` apaga somente a chave v0.2 após confirmação UI; nenhum `localStorage.clear()`, nenhuma migração automática nem escrita v0.1.
- **Status no momento deste registro:** branch e CI ainda a validar; **não afirmar release** antes de merge + deploy sucesso + healthcheck.
- **Próxima ação concreta:** executar CI (core/web/Node/GIFs/Chromium legado/React/draft/sandbox/**/play**), corrigir falhas, integrar PR e conferir Railway. Próxima funcionalidade de produto: batalha determinística + captura real pelo core com progressão no save v0.2; posteriormente Pokémon/coleção/insígnias, com UI responsiva e dados de teste livremente reiniciáveis até beta pública.

## ESTADO MAIS RECENTE — v0.2 alfa jogável publicada, correção Node 22 em validação (2026-11-17)
- **Decisão do produto D-027:** sem jogadores reais, é permitido recomeçar dados de TESTE e priorizar `/play` em vez de migrações hipotéticas. Sem apagar automaticamente outros dados. Retomar política de persistência antes da beta pública.
- **GitHub:** PR #29 `https://github.com/isaquesan7/poke-idle-game/pull/29` integrada à `main` no SHA **`684ebf434a3c69267380b80ea2eaf11178cfd3a6`**. CI `44067662663` **completed/success**, após corrigir escape do regex do servidor e sincronização do E2E (Web Lock assíncrono e invariantes `startedAt <= lastClaimAt`). Typecheck/core+web, Vitest, build React, Node legado, 151 GIFs e Chromium v0.1/React/draft/sandbox/**/play** desktop/mobile verdes.
- **Railway produção:** deployment `fd9cd32a-1486-45b9-8e88-6381aeb6008f` para **SHA exato `684ebf43`**, **SUCCESS**. Logs confirmam `npm prestart` → `vite build` OK → `node server.mjs` ouvindo porta 8080 e healthcheck interno `/health` SUCCESS. GET externo de `/play` NÃO verificado diretamente: ferramentas externas indisponíveis. A rota é servida pelo código e testada por E2E do servidor em CI.
- **Anomalia de infraestrutura verificada:** no runtime Railway, Vite gerou aviso `Node.js 18.20.8`, exige 20.19+ ou 22.12+. Build Vite TERMINOU com sucesso, mas devemos remover incompatibilidade antes de próximos desenvolvimentos. Branch `fix/v02-playable-node22-release-handoff` altera root `package.json` e `package-lock.json` para `>=22.12.0 <23`, além de docs; CI e deploy dessa correção AINDA PENDENTES neste registro.
- **Funcionalidades realmente acessíveis após build:** `/play` tem criação de treinador e starter, seleção de modo normal ou demonstração, visão geral, treino de treinador/Pokémon, equipamentos provisórios de teste, expedição start/claim/stop. Progresso salvo LOCALMENTE em `kanto-idle-play-v02` com revisão e recibos de expedição; não há backend nem antifraude/clock verificável. Reset é manual via confirmação e não toca `kanto-idle-lab-save-v01`. `/` continua jogo legado v0.1; todos os GIFs locais #001–151 permanecem.
- **Próxima ação concreta:** validar CI+PR da correção do Node, mesclar e conferir Railway e healthcheck. Depois priorizar batalha determinística e captura no game-core conectadas a `/play`, e interfaces Pokémon/coleção, mantendo design Kanto Dark/tokens e CI. Não ligar banco/autenticação sem projeto específico; dados atuais são de teste.

## ESTADO MAIS RECENTE — Primeira v0.2 jogável e Node 22 em produção (2026-11-17)
- **Produto:** primeira rota React v0.2 alfa **publicada** em `/play`; `/` permanece v0.1 até migrar o restante das mecânicas. Decisão D-027: não há jogadores reais; saves de TESTE v0.2 podem ser resetados por ação explícita. A prioridade é o jogo funcional. Não reaplicar indiscriminadamente os bloqueios históricos de migração do legado na nova chave local independente.
- **GitHub:** PR #29 `https://github.com/isaquesan7/poke-idle-game/pull/29` merged SHA `684ebf434a3c69267380b80ea2eaf11178cfd3a6`, CI `44067662663` SUCCESS com regressão completa e E2E nova rota desktop/mobile. PR #30 `https://github.com/isaquesan7/poke-idle-game/pull/30` merged SHA **`9536860e4943e38cc0224d8d79dfd6abcd13f614`**, CI `44068373957` **completed/success** com typecheck, Vitest, Node, build, GIFs e E2E Chromium completos.
- **Railway:** deploy `025abdf3-454e-4203-83b4-277ff1403d33`, commit exato `9536860e`, **SUCCESS**. Logs build selecionam `mise node@22.23.4`; `npm prestart` compilou Vite 7.3.8 com sucesso e SEM antigo aviso de Node 18. `node server.mjs` escuta porta 8080; build Healthcheck **`/health succeeded!`**. Consulta GET HTTP externa a `/play` e `/health` foi inviável nas ferramentas (web não acessou URL, container sem DNS), então não declarar validação de GET público real. E2E navegou `/play` no servidor Node da aplicação local em CI.
- **Fluxo funcional v0.2:** onboarding de treinador, 3 iniciais, modo normal/demonstração, dashboard, treinador/atributos/equipamento de teste, Pokémon/treino e expedição start/claim/stop; dados locais em `kanto-idle-play-v02` com envelope v2, revision, RewardJournal, Web Locks cooperativos no navegador, fallback otimista. GIFs #001–151 servidos localmente no mesmo domínio quando o servidor estiver acessível. `resetPlaySave` só remove chave v0.2 mediante confirmação, nunca save antigo.
- **Limites:** sem batalhas/capturas na v0.2, contas, backend, sincronização, autenticidade do relógio ou antifraude. Prêmios idle locais são editáveis pelo próprio usuário; toda a alfa é de testes. O workflow completo incluiu testes da v0.1 e do sandbox de migração e tudo passou. Log Railpack `npm install` reportou 3 vulnerabilidades de dependências (1 moderada, 2 críticas), **não auditadas/classificadas nesta entrega**; verificar `npm audit` e escopo dev/prod antes de beta real.
- **Próxima tarefa concreta:** implementar simulador determinístico de batalha em `packages/game-core/src/combat` com regras v0.1 (damage, STAB, tipo, crítico, variação, máximo 30 turnos), dados/aleatoriedade injetados e testes de replay. Integrar batalhas e captura à rota `/play` via progressão no save de teste v0.2, atualizar UI responsiva e E2E. Depois desenvolver equipe/Pokédex e trocar a raiz quando o loop estiver íntegro. Sempre documentar e validar CI/railway; `isaquesan7/pokedex` permanece intocado.
- Esta seção substitui registros anteriores sobre PR #29/#30 ainda pendentes e sobre preservação de saves de usuários inexistentes como bloqueio do produto.

## Continuidade — PR #32 Arena determinística v0.2 em validação (2026-11-17)
- **Base verificada:** GitHub `main` `579506b0641990cfcaf0ed475078137f364a2727` (PRs #29/#30/#31 integradas). Railway deploy `49aaf907-248c-4c75-bc5f-79c27bdb52ba` SUCCESS. `/play` contém onboarding, treinador, Pokémon, equipamentos provisórios, expedição; `/` v0.1 continua. Não há jogadores reais (D-027); saves alfa são dados de teste, reiniciáveis com confirmação e sem importação obrigatória da v0.1.
- **Nova branch:** `feat/v02-kanto-deterministic-battles`, PR #32 `https://github.com/isaquesan7/poke-idle-game/pull/32`, CI e merge **PENDENTES NESTE REGISTRO**.
- **Core:** `combat/kantoBattle.ts` exporta catálogo local 3 iniciais e 8 selvagens, tabela de efetividade, dano puro STAB/crítico/variação e `simulateKantoBattle` determinística por seed uint32 em até 30 turnos. Captura 35%/afinidade 2–5 apenas em vitória, sem matemática fora das regras atuais. Testes `packages/game-core/tests/kanto-battle.test.ts`.
- **Jogo:** `playSave.ts` passa a aceitar `{type:'battle',seed}`, computa status reais do treinador/Pokémon, sorteia encontro com seed e usa motor; recompensa `battle-result` é derivada, nunca recebida como afirmação de vitória da UI. Save alfa único contém moedas/XP/afinidade/badges/captura UID, `seen`, `lastBattle` (log). Proteção revisionada/recibos existente, testada junto a expedição em `apps/web/tests/play-save.test.ts`.
- **UI:** nova aba Arena em `PlayApp.tsx`, GIFs locais #001–#151 para artistas visuais, botão de batalha, sumário do último duelo, capturas/recompensas/insígnias e diário rolável, CSS responsivo via variáveis globais. Novo E2E estende `apps/web/tests/e2e/playable-route.mjs` desktop/mobile com luta, recarregamento e chave v0.1 intocada.
- **Limites:** só 8 espécies selvagens no catálogo de arena ainda, 3 starters como principais; sem full 151 Pokédex nem team switching, status effects, múltiplos moves ou servidor. Seed do browser não confere autenticidade/antifraude. `npm audit` ainda pendente de investigação de dependências reportadas.
- **Próxima ação:** concluir CI TypeScript/Vitest/Node/Vite/151 GIFs/E2E e corrigir eventuais falhas, revisar diff/merge PR #32, validar SHA exato e healthcheck do deploy Railway. Depois expandir catálogo Kanto/coleção/equipe, otimizar animações e preparar troca de `/` quando v0.2 atingir paridade suficiente.

## ESTADO MAIS RECENTE — Arena determinística v0.2 publicada, próxima etapa coleção/equipe (2026-11-17)
- **GitHub:** PR #32 `https://github.com/isaquesan7/poke-idle-game/pull/32` **merged**, `main` SHA de código confirmado **`6bf399ac2ee15f4923072378c00db62fc8c0f111`**. A PR tem apenas core, React `/play`, testes e documentação; `index.html` v0.1, `server.mjs` e repositório de origem `isaquesan7/pokedex` **não foram alterados**.
- **CI:** run `44071892270` `completed/success`. Foram corrigidos quatro erros iniciais de tipagem de campos `unknown` no React/save. Suíte final verde: TypeScript core/web, Vitest, Node legado, Vite build, integridade de 151 GIFs e 5 suites de E2E Chromium (v0.1, preview React, draft, browser sandbox, `/play` desktop/mobile). O E2E atual de `/play` **clica em Arena, executa combate, confere o registro das recompensas/seen/revision/receipt e recarrega o diário**.
- **Railway:** deployment **`1e30e03e-4de7-48f9-b999-2206919a43b7`** do SHA exato `6bf399ac` alcançou **SUCCESS**. Logs runtime: `npm prestart` → `vite build` OK → `node server.mjs` porta 8080; build healthcheck `/health` **succeeded!**. Web tool não conseguiu acessar GET externo `/play` nem `/health`; não declarar verificação HTTP pública direta. E2E navegou `/play` no servidor real Node em ambiente CI.
- **Novidades jogáveis:** core `combat/kantoBattle.ts` com seed uint32, LCG puro, fórmula v0.1, prioridade/velocidade, precisão, STAB, críticos, variação, efetividade de tipos/imunidade, empate 30 turnos, captura 35% após vitória e afinidade 2–5. Catálogo piloto: 3 starters e 8 selvagens (Caterpie #10, Pidgey #16, Rattata #19, Pikachu #25, Vulpix #37, Oddish #43, Poliwag #60, Geodude #74). `playSave.ts` deriva o comando `battle-result` do resultado calculado (nenhuma flag win injetada da UI), atualiza moedas/XP/insígnias/captura UID/seen/diário numa única escrita do save alfa `kanto-idle-play-v02`, com recibo/revisão de evento. Aba Arena responsiva e animações GIF da Pokédex local.
- **Limitações importantes:** o catálogo é piloto, não 151 batalhas; a UI de coleção/equipe ainda não existe. Não há backend, contas, time ativo de 3 na UI, movimentos múltiplos, efeitos de status, cura ou antifraude. A seed vem do navegador e pode ser manipulada: o motor determinístico NÃO autentica vitórias. Ainda não há jogadores reais, então dados atuais são de TESTE e reset manual por confirmação é permitido (D-027). Logs npm install anteriores reportaram dependências vulneráveis ainda não auditadas.
- **Próxima ação concreta:** ampliar o conjunto de espécies disponíveis do core preservando dados-base de PokéAPI e sprites; criar tela de coleção de **instâncias por UID** no React e ações de adicionar/remover do time usando `reduceLegacyPokemonTeamJson` (1–3, bloquear mudanças durante expedição), seleção de Pokémon ativo de acordo com `team[0]`, equipe visível na Arena, testar repetição de espécie com UIDs diferentes, badge/status XP e E2E desktop/mobile. Em seguida golpes múltiplos/evolução/Pokédex completa. Preferir branch/PR + testes + Railway SUCCESS e documentar no mesmo trabalho.
- **Handoff:** este registro substitui o bloco anterior que dizia PR #32/CI/merge pendentes; consultar este final para o último estado. Links: `https://kanto-idle-web-production.up.railway.app/play` e `https://github.com/isaquesan7/poke-idle-game`.

## Continuidade — coleção/equipe v0.2 em implementação (2026-11-17, CI/PR aguardando)
- **Base verificada de entrada:** `main` **`8c47e1dd1217d736ac9823c4ce20d9ce9da98162`**, Railway deployment **`3f838e21-5191-43a8-a41d-e2e135d286ab` SUCCESS. A v0.2 React já tem treinador, Pokémon, equipamentos provisórios, Arena determinística com 8 selvagens, captura e expedições; `/` v0.1 se mantém funcional.
- **Nova branch:** `feat/v02-collection-team-management` com React `/play` exibindo **Coleção** (cards de instâncias UID, filtros/busca, 3 vagas), ações de adicionar/remover equipe e promover UID escalado a `team[0]`. `set-active` implementado no reducer puro `packages/game-core/src/legacy/pokemonTeamReducer.ts`, reutilizando writer local revisionado existente. Treinar qualquer instância via `selectedUid` não modifica líder, stats/ficha mostram base local piloto para capturas; o líder escolhido aparece em Arena/visão geral via catálogo local. Durante expedição, controles de time ficam desabilitados e o reducer valida bloqueios.
- **Testes incluídos:** Vitest core para `set-active` e preservação da ordem/UID/XP; Vitest web para duplicata de espécie (UIDs 2/3), pontos independentes, bloqueio de expedição, equipe cheia e comando de batalha com o líder. Playwright E2E `playable-route.mjs` desktop/mobile cria duas capturas de TESTE com mesmo species ID e UIDs distintos, testa filtro/busca, team, líder, treino distinto e efeito no comando de Arena/reload. Estas capturas injetadas são **APENAS fixtures de CI**, não recurso de captura gratuita na UI.
- **D-027 permanece:** ainda não existem jogadores reais; save `kanto-idle-play-v02` local pode ser resetado por consentimento. Sem backend, contas, seed de combate verificada, proteção antifraude. `isaquesan7/pokedex` intacto.
- **ESTADO NESTE REGISTRO:** CI/PR/release da coleção/equipe ainda **NÃO confirmados**. Validar TypeScript/Vitest/Node/Vite/GIFs/Chromium (legado, preview, draft, sandbox, nova coleção+arena), corrigir e revisar diff antes de merge, verificar Railway STATUS SUCCESS e healthcheck `/health` no SHA exato, então acrescentar handoff final.
- **Próximo produto:** estender dados-base das espécies 1–151 com fonte verificável (sem modificá-los), ampliar encontros da Arena, golpes/evolução e Pokédex (vistos/capturados); mais adiante trocar `/` após paridade jogável. Auditar avisos de dependências do `npm install` antes da beta real.

## ESTADO MAIS RECENTE — Coleção/equipe v0.2 PUBLICADA; próxima prioridade Pokédex/Kanto (2026-11-17)
- **Código `main`:** PR #34 `https://github.com/isaquesan7/poke-idle-game/pull/34` **merged**, SHA confirmado **`e6ee20b545386fe9f9f1a174d1c7800d129317ab`**. Release de coleção/equipe adicionou componentes e CSS module em `PlayApp`, ação pura `set-active` em `pokemonTeamReducer`, testes e documentação, SEM alterar `index.html` v0.1, `server.mjs`, a chave legada ou `isaquesan7/pokedex`.
- **GitHub CI:** run **`44081662800`** `completed/success`, incluindo TypeScript, Vitest core/web, build Vite, Node legado, validação 151 GIFs locais e 5 suites E2E Chromium. O E2E de `/play` navegou com viewport desktop/mobile, simulou somente no TESTE dois Pidgey UID distintos, tentou editar time durante expedição (bloqueado), encerrou expedição, adicionou ambos ao time, promoveu o UID certo a líder, filtrou por nome/equipe/reserva, treinou apenas o outro UID, fez batalha usando o líder e conferiu save após reload e chave legada intacta.
- **Railway:** deployment **`047d2ee9-ba49-43d8-bbac-c5a11e8fcec4`** para SHA exato `e6ee20b5` **SUCCESS**. Logs Vite v7.3.8 build em ~1.2s, `node server.mjs` porta 8080 e healthcheck interno **`/health succeeded!`**. O web tool NÃO conseguiu consultar GET HTTP externo `/play` nem `/health` diretamente (acesso recusado pela ferramenta); E2E testou o mesmo servidor em CI. Portanto não declarar GET público confirmado.
- **Funcionalidade visível:** nova aba **Coleção** com 3 slots, busca nome/ID de espécie/UID, filtros de equipe e reserva e cards por instância UID, inclusive Pokémon repetidos de mesma espécie; botão Escalar, Retirar, Tornar líder, Treinar. Time 1–3, líder `team[0]` usado na Arena e overview. Treinar UID escolhido mantém líder intacto; fórmula final de stats usa o snapshot local da espécie e `view.totals`. Equipe e líder bloqueados durante expedição, mas treino individual permitido. Visão geral agora oferece acesso à coleção. Save segue exclusivamente em `localStorage['kanto-idle-play-v02']` com revisão, Web Locks cooperativos e recibos de recompensas. `/` ainda serve a v0.1.
- **Limites:** ainda são 3 iniciais + 8 espécies selvagens no catálogo de batalha local, não os 151. UI de Pokédex completa por 151 slots, múltiplos golpes, evoluções, backend/contas, antifraude, combate com troca entre os 3 e persistência cross-device **não existem**. Não há jogadores reais; progresso local de TESTE pode ser reiniciado com confirmação (D-027). Alertas de `npm install` sobre dependências vulneráveis ainda não foram classificados, auditar antes da beta real.
- **Próximo passo concreto:** construir um catálogo Kanto das 151 espécies com nome, tipos, stats-base e golpes verificados, versionado e testado; integrar seus dados ao motor de combate/coleção com resolução sem inventar stats e ampliar os encontros além das 8 espécies. Criar Pokédex visual de 151 slots (vistos/capturados), com filtros e destaque de novas capturas; manter UID individual no roster e 1–3 integrantes. Em seguida golpes múltiplos/evoluções, ajuste de UX/combate e substituição gradual da v0.1 na rota `/` quando o loop estiver completo. Branch+PR+CI+Railway e docs a cada etapa.
- **Handoff:** este bloco substitui registros anteriores que diziam que a PR #34/CI/merge/deploy estavam pendentes. Repo: `https://github.com/isaquesan7/poke-idle-game`; v0.2 alfa: `https://kanto-idle-web-production.up.railway.app/play`.

## CONTINUIDADE — Pokédex 151 e catálogo Kanto (PR em validação, 2026-11-17)
- **Base verificada:** GitHub `main` **`88cd60beddbf25e104d5007e6b288dad2f0ab60b`**, Railway deployment `1cc33b2a-bcc7-42c1-8d83-72d30121de65` **SUCCESS**. PR #34 coleção/equipe e PR #35 handoff documentais integradas; `/play` com Arena/coleção/expedição, `/` v0.1 preservada. Sem jogadores reais, autorização D-027 para reset consciente de TESTES; não há contas/backend/antifraude.
- **Branch:** `feat/v02-kanto-151-pokedex`, partir de `88cd60be`. CI, PR, merge e deploy desta entrega ainda **PENDENTES** neste registro; não afirmar release antecipada.
- **Origem verificável dos dados:** CSV oficial do repositório público `PokeAPI/pokeapi` no commit **`ac2f1acb055026e3dff1e0aca743bb46256a810a`**, utilizando `pokemon.csv`, `pokemon_stats.csv`, `pokemon_types.csv`, `pokemon_species.csv`, `pokemon_species_names.csv`, `types.csv`. Snapshot `packages/game-core/src/catalog/kantoSpecies.ts` com exatamente 151 espécies, nomes EN, tipos modernos, seis stats-base, preevolução, captureRate, lendário/mítico; casos comprovados Bulbasaur 45/49/49/65/65/45, Mr. Mime predecessor #439 (fora dos 151), Mewtwo lendário e Mew mítico. CI valida integridade. Fontes são Pokémon/PokéAPI; consultar licença original e evitar confusão com jogo oficial.
- **Jogo/combate:** `KANTO_BATTLE_SPECIES` agora abrange 151, reduz duplicidade do catálogo piloto. Pool de encontros selvagens expandida de **8 para 54 não lendários**, preservando sequência inicial `[10,16,19,25,37,43,60,74]`. 11 golpes anteriores mantidos; os novos combatentes recebem **golpes de fallback provisórios**, NÃO learnsets verificados. Fórmulas STAB, crítico, seed, 30 turnos, recompensa, captura 35% e UID existentes preservadas; `captureRate` do CSV NÃO altera a chance de captura por enquanto.
- **UI:** tab `Pokédex` em `/play`, componente `PokedexPanel.tsx`/CSS module independente, 151 slots `#001–#151`, desconhecidos sem imagem/nome, vistos por `save.seen`, capturados por `save.roster` sem duplicar espécie por UID, detalhes oficiais de stats/tipo/evolução para descobertos, busca por número ou nome descoberto, filtros status, progresso visual. A Arena mostra primeiras 12 das 54 espécies como exemplos e link para Pokédex; dados-base corretos usados em coleção/ficha por cache local compartilhado.
- **Testes novos:** `packages/game-core/tests/kanto-catalog.test.ts` de integridade/combate de cada espécie e pool; `apps/web/tests/e2e/playable-route.mjs` expande Playwright desktop/mobile com Pokédex inicial 151, bloqueio de divulgação Mewtwo antes de descobrir, filtro capturados, detalhes de Charmander, visto da espécie de batalha, Pidgey capturado por dois UIDs=uma espécie e persistência no reload. Ainda sujeitos a CI nesta etapa.
- **Próximo passo imediato:** executar CI TypeScript/Vitest/build/Node/151 GIFs/Chromium legado e `/play`; corrigir erros, criar/merge PR, verificar SHA exato e deployment Railway SUCCESS com /health. **Próxima funcionalidade:** aprender/selecionar movimentos validados por espécie e nível com moveset PokéAPI, depois evoluções, melhorias de UX e migração de rota raiz em pré-lançamento. `isaquesan7/pokedex` não deve ser modificado.
