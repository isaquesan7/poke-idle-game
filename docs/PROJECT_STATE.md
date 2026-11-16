# Estado do projeto e handoff para o próximo chat

**Última revisão:** 2026-11-16  
**Repositório:** https://github.com/isaquesan7/poke-idle-game  
**Branch de produção:** `main`  
**Site:** https://kanto-idle-web-production.up.railway.app/  
**Status de código:** protótipo jogável v0.1; *arquitetura v0.2 apenas planejada, ainda não migrada*.  
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
