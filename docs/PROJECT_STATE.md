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
