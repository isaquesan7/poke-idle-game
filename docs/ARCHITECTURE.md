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

## Contrato candidato de save oficial v0.2 e recuperação (pré-migração)
- `apps/web/src/storage/officialSaveV02.ts`: tipos versionados `OfficialSaveV02`, `OriginBackupV02`, `RecoveryBundleV02`; criação/validação assíncrona via WebCrypto SHA-256, tamanho UTF-8 e extração dos bytes originais sem writes.
- O `OfficialSaveV02` guarda um payload v0.1 intocado com `payloadFormat:'legacy-v01'`; é deliberadamente uma estrutura de COMPATIBILIDADE, não uma conversão já jogável nem a definição de ações/ economia definitivas.
- `apps/web/src/storage/recoveryJournal.ts`: plano de três escritas para eventual commit (backup → candidato → marcador) e auditoria dos estados interrompidos, conflitos e corrupção; nenhuma operação é executada em localStorage. Integridade por SHA-256 detecta alterações não intencionais, não fraude ou adulteração intencional.
- O marcador não garante atomicidade de três chaves. A v0.1 segue como writer não-cooperativo; é proibido ativar o plano sem estratégia de writer único, política de migração e testes multi-tab.
- Nenhum módulo novo é importado pela UI/servidor. Testes Vitest simulam falhas de armazenamento, recuperação e preservação integral do save. A publicação do código no repositório não ativa migração.

## Coordenação futura de writers e recuperação read-only (PR #11)
- `apps/web/src/storage/writerCoordination.ts` usa `auditRecoveryJournal()` para definir estágios conservadores. Mesmo `v02-isolated` expõe `canWriteRealSave:false`: esse estado só atesta integridade estrutural do snapshot. `checkCooperativeRevision()` valida incremento após lock; `withExclusiveV02Writer()` pede Web Locks exclusivo para código cooperativo, sem fallback de escrita.
- A função `save()` do `index.html` não usa lock; tabs antigas não podem ser neutralizadas por JS novo. É proibido declarar garantia transacional para v0.1/v0.2. A migração futuramente será opt-in e bifurcada em CHAVES distintas, com alerta de divergência, backups e writer v0.2 autoritativo somente após paridade.
- `recoveryExchange.ts` prepara pacote JSON SHA-256 após rechecagem do save, e verifica upload sem writes. Nova `features/storage/RecoveryExchangePanel.tsx` aparece APENAS na prévia React com download e conferência read-only, sem chamada a `setItem`/`removeItem` ou botão de restauro.
- Testes Vitest de locks/revisões/conflitos e Playwright desktop/mobile para exportação, checksum, adulteração de arquivo e isolamento de todas as chaves persistentes. UI pública do Railway permanece o jogo v0.1; `server.mjs` não serve React.

## Laboratório de cutover em Map privado (prévia React)
- `apps/web/src/storage/migrationMemoryLab.ts` é o único executor de passos de journal desta etapa, MAS opera estritamente no `Map<string,string>` privado do objeto. Não aceita portas de storage, referência a `window.localStorage`, IndexedDB nem callbacks injetáveis de escrita. Não é um writer oficial.
- `simulateCutover()` recebe consentimento literal antes de qualquer ação, valida JSON legado e pacote, calcula SHA-256, ensaia a ordem backup → candidato → marcador, rechecando a origem; impede double-submit e reuso de chaves. Falha de quota (injetada ou limite em bytes), interrupção e writer antigo simulado deixam estado parcial auditável.
- `MigrationMemoryLab.inspect()` reusa `auditRecoveryJournal()` existente; `extractBackup()` recupera origem como TEXTO sem escrever. `simulateRevision()` ensaia revisão stale entre dois clientes do mesmo objeto, não modifica o save.
- `apps/web/src/features/storage/MigrationLabPanel.tsx` exibe apenas cenários simulados, opt-in por checkbox e relatório. CSS Modules usa tokens `:root` e comentários em português. A prévia React não está roteada pelo `server.mjs` público; o jogo v0.1 continua no Railway.
- Vitest cobre consentimento, crash/quota, divergência, double-submit e resgate de backup; Playwright desktop/mobile executa três cenários e verifica imutabilidade do localStorage. Sem mudança na API de produção, contrato de dados real, progressão ou assets.

## Executor de journal em origem de navegador LOCAL, exclusivo para E2E (D-021)
- `apps/web/src/storage/browserSandboxCutover.ts` importa o plano puro de recovery, porém verifica protocolo/hostname/pathname antes de acessar Storage. Prefixo fixo de chaves `__kanto_lab__*` impede colisão acidental com qualquer save oficial; não aceita chaves externas ou `Storage` injetado e NÃO é importado pelo App.
- O ensaio usa `navigator.locks.request('__kanto_lab__exclusive_writer', {mode:'exclusive',ifAvailable:true})`, bloqueia conflito entre abas cooperativas, revalida fonte antes de cada escrita, valida read-back de backup/candidato/marcador. Como legado v0.1 é não cooperativo, qualquer mudança durante/após simulação é um conflito e não há mescla automática.
- `rollbackBrowserLab()` explicitamente confirmado descarta apenas candidato/marcador de laboratório depois de auditoria sem conflito; preserva a origem e o backup para recuperação. Não é uma ferramenta de restauração de progresso real.
- O novo E2E usa Vite localhost porta 5174 e Playwright Chromium, exercício de quota REAL de localStorage, reload/crash e duas abas. Workflow PR/main agora testa essa etapa após as regressões antigas. Nenhuma rota de sandbox é publicada pelo `server.mjs` v0.1.

## Gate fail-closed v0.2 e cobertura de mutações legadas (D-022)
- `apps/web/src/storage/cutoverGate.ts` é um relatório *read-only*, com retorno de tipo que NÃO permite `allowed`. A leitura repetida detecta corridas observáveis, mas não é transação e não interrompe futuras escritas da v0.1. Pré-verificação estrutural favorável apenas marca `sourceCompatible`, nunca libera progresso real.
- Relatórios de bloqueio incluem save ilegível/ausente, storage negado, fonte/draft alterados na leitura, existência de chaves oficiais v0.2, ausência de Web Locks e requisitos pendentes de writer único, paridade gameplay, backup externo e aprovação de release. Não há feature flag ou consentimento no cliente que remova estes últimos bloqueios.
- UI React mostra o gate na seção de migração sem adicionar ação/botão de write. CSS Modules usa variáveis semânticas e comentários por seletor. Testes Vitest e Playwright garantem que save válido, draft compatível e lock disponível não desbloqueiam cutover.
- `docs/LEGACY_MUTATION_MATRIX.md` referencia 21 ações dos handlers, alterações do save e escritores indiretos; `tests/legacy-mutation-audit.test.mjs` trava o conjunto de ações de `index.html` e presença de funções críticas. Mudança dentro de uma função existente ainda exige revisão manual.

## Redutores puros de Pokémon e time (D-023)
- `packages/game-core/src/legacy/pokemonTeamReducer.ts` espelha quatro ações da v0.1 (`stat-pokemon`, `reset-pokemon`, `add-team`, `remove-team`) sem depender do navegador: entrada JSON legado, validação de origem/roster/time e saída JSON novo. Código não importa adaptador de storage nem funções de recompensa.
- O reducer distingue UID de espécie, preserva a identidade e toda recompensa não relacionada; o orçamento do Pokémon é `2*(level-1)` sem teto manual de 40 (teto exclusivo do treinador). O time mantém ordem, tamanho 1–3 e não troca durante expedição.
- A implementação é fundamento de paridade e não equivale à migração: sem writer v0.2, sem gravação ou UI jogável React. Retornos `ok` são somente objetos/strings de memória; o gate de release segue `blocked`.
- Testes Vitest core simulam mesma espécie com UIDs diferentes, duplicação de IDs, orçamentos, nível 1/100, equipe, expedição ativa, estrutura ilegível e campos desconhecidos. Devem permanecer na regressão permanente.

## Envelope de recompensa em memória — eventos v0.2 (2026-11-17)
- `packages/game-core/src/legacy/rewardEvents.ts`: adaptador puro sobre texto JSON de progresso v0.1, `RewardJournal` com revision e todos os recibos de evento. Cada comando traz ID e revisão esperada; replay bit-a-bit do comando é `duplicate`, ID reaproveitado com payload distinto conflita, revisões antigas são rejeitadas. Não aceita IO/StoragePort, nem clock/RNG externos implícitos.
- O reducer calcula em UMA transição atômica **somente em memória** alterações de battle-result pré-resolvido (win/loss/draw, capture opcional em win), insígnias, XP e afinidade; expedição start/claim/stop com timestamp recebido e limite 8h. `grantXp`, `expeditionRewards` e `LEGACY_BADGES` são reutilizados.
- Recibos vivem no envelope entregue pelo chamador. Sem writer canônico/versionamento DURÁVEL e operação transacional, duas abas que começam da MESMA revisão ainda podem aceitar o mesmo evento em envelopes independentes — o teste simula explicitamente esta limitação. O módulo NÃO deve ser conectado a saves reais. Mesmo um resultado `applied` não é prova de batalha legítima.
- A futura camada autoritativa deve validar resultado da batalha/rolagem de captura, reservar e aplicar evento de forma serializável, persistir revisão/ledger e verificar conflitos entre dispositivos. `cutoverGate.ts` segue bloqueado até revisão de arquitetura.

## Paridade de golpes no game-core (2026-11-17)
O módulo `src/legacy/pokemonMoveReducer.ts` recebe JSON v0.1 e comandos por UID, valida orçamento e limite de rank e retorna JSON NOVO, sem efeitos colaterais. `availableMoves` e `movePower` são fornecidos por uma camada externa e não constituem prova antifraude. Nunca importar esse laboratório no runtime público antes da paridade e da política de autoridade única. `cutoverGate.ts` permanece bloqueado.

## Laboratório de autoridade única de recompensa em memória (2026-11-17)
- `packages/game-core/src/legacy/rewardAuthorityMemoryLab.ts` depende unicamente de `rewardEvents.ts`; clientes recebem `openClient()` com `read()` (cópia) e `submit()`. O `Map` é PRIVADO e usa única chave fixa `__kanto_lab__reward_authority_in_memory`; nenhum Browser Storage, lock oficial, IndexedDB, servidor, banco, token ou credencial.
- Um valor JSON atômico no Map representa `RewardJournal` inteiro e um checksum FNV-1a **não criptográfico** para erro acidental. Toda submissão reobtém o registro, checa recibo/revisão e o atualiza sem pausa assíncrona; `before-commit` e `after-commit` exercitam perda de execução/resposta.
- Esta serialização é somente dentro da **mesma instância JS**. A aplicação precisa de uma autoridade durável (p.ex. banco transacional com UNIQUE por jogador/evento, revisão compare-and-swap e validação de comandos) antes de executar em múltiplos processos/abas/dispositivos. Vitórias recebidas do cliente não são prova de combate.
- Nunca importar o laboratório no jogo público v0.1, adaptador React ou `cutoverGate.ts`. A implementação não é substituto do writer oficial v0.2, do backup externo, de rollback ou do lock do legado.

## Primeiro loop jogável v0.2 — rota /play (2026-11-17)
Diretriz D-027: **pré-lançamento sem jogadores**, priorizar produto jogável. `server.mjs` continua oferecendo `/` (legado) mas recebe `/play` e serve apenas `apps/web/dist/index.html` mais assets Vite em nomes de arquivo estritamente validados. `npm prestart` compila o workspace React antes de servir no Railway; `/health` permanece.
- `apps/web/src/main.tsx` decide `/play` → `PlayApp`, e demais caminhos da prévia → `App` técnica. E2Es da prévia continuam isolados.
- `apps/web/src/play/playSave.ts`: `PlaySnapshot {schemaVersion:2,revision,journal:RewardJournal}` em `localStorage['kanto-idle-play-v02']`; `journal.raw` é estado de domínio formato v1, para reusar reducers atuais SEM importar o save legado. Edição normal incrementa revisão externa, eventos de expedição também incrementam o journal de recibos. Cada ação faz leitura/validação/rechecagem/escrita de UMA chave; `navigator.locks` oferece coordenação cooperativa quando disponível; sem isso usa comparação otimista, sem promessa transacional multi-aba.
- `PlayApp.tsx`: onboarding, Kanto Dark responsivo, catálogo de iniciais, treino, equipamento e expedição. Imagens GIF 151 continuam em `/assets/pokemon-gifs/`; fallback de imagem estática da PokéAPI. Sem contas, PostgreSQL, autenticação, combate/captura v0.2 ou sincronização; XP idle usa tempo do dispositivo. Reset manual remove apenas a chave local de teste após confirmação.
- Build/CI: o E2E `apps/web/tests/e2e/playable-route.mjs` inicia o servidor real e verifica onboarding, treino, claims, reload, responsividade e chave legada intacta. A raiz `/` não troca de UI nesta entrega. Próximo passo: motor de batalha determinístico integrado à rota v0.2 e progressão captura/Pokédex.

### Runtime fixado para o build Vite v0.2 (2026-11-17)
A imagem Railpack selecionou Node 18.20.8 por causa do `engines.node >=18` legado. Vite 7 emite aviso pois exige Node 20.19+/22.12+, embora o build `/play` da PR #29 tenha sucedido. A partir de D-028, root `package.json` e `package-lock.json` passam a declarar `>=22.12.0 <23`; `npm prestart` continua compilando Vite e `node server.mjs` continua ouvindo `/health`/legado/`/play`. Verificar Node efetivo no Railway pós-deploy e manter CI em Node 22.

## Pipeline da Arena v0.2 (PR #32, 2026-11-17)
- `packages/game-core/src/combat/kantoBattle.ts`: catálogo piloto estático (3 iniciais + 8 selvagens), tabela de efetividade de tipos, `kantoDamage()` puro e `simulateKantoBattle(player,wild,seed)` com LCG determinístico. Sem fetch, RNG global, Storage ou DOM; cobertura Vitest para críticos, variações, imunidades, capturas, empate 30 turnos e repetição da seed.
- `apps/web/src/play/playSave.ts`: ação `battle` recebe somente `seed` uint32. A camada monta `Combatant` com os stats efetivos `pokemonFinalStats` (bônus treinador+equipamentos+título+insígnias), seleciona wild pelo catálogo e executa simulação. Ela compõe `RewardCommand battle-result` a partir do RESULTADO calculado (não de flags da UI). `applyRewardEvent` calcula XP/moedas/badges/captura e recebe um ID próprio da revisão. Em seguida `seen` e `lastBattle` são adicionados ao mesmo `RewardJournal.raw`; atualização de `PlaySnapshot` acontece em UMA gravação `kanto-idle-play-v02` sob Web Lock preferido.
- `apps/web/src/play/PlayApp.tsx` expõe tab Arena, sprites do atacante e último selvagem, sumário persistido e diário da luta. `playable-route.mjs` testa batalha real no servidor `/play` de CI desktop/mobile e confirma reload. Nenhuma modificação do `index.html` v0.1 ou `isaquesan7/pokedex`.
- **Confiança limitada:** seed do cliente manipulável; catálogo local inicial parcial, sem servidor/replay autoritativo. Antes da beta com jogadores, backend deve refazer combate e guardar ledger em banco transacional. Próximo produto: expandir catálogo base/moves das 151 espécies e implementar equipe/Pokédex.

## Coleção e equipe por UID — v0.2, PR de implementação (2026-11-17)
A rota `/play` não recebe nenhuma nova chave de storage ou writer. `packages/game-core/src/legacy/pokemonTeamReducer.ts` recebe nova ação pura `{type:'set-active',uid}`, válida apenas para UID já presente em `team`; promove para índice zero preservando os outros IDs e **não permite** mudança se `expedition != null`. `add-team` e `remove-team` existentes seguem validados como antes (1–3, sem duplicata). `PlayApp` envia comandos via `dispatch({type:'pokemon',value})`, que chama `reduceLegacyPokemonTeamJson` e grava uma única revisão `PlaySnapshot` em `kanto-idle-play-v02` (Web Locks cooperativos preferidos).
A tela `collection` renderiza `data.roster` usando UID como chave React e `data.team` em 3 slots, filtros/busca locais e botões disabled quando a regra não permite. A tela de treino mantém um `selectedUid` transitório **só para visualização**; não modifica `team[0]`. Os stats da instância selecionada são recalculados com `pokemonFinalStats`, `view.totals` do treinador e `KANTO_BATTLE_SPECIES` (sem alterar stat base). A projeção de `projectLegacyTrainer` recebe cache derivado do mesmo catálogo de batalha, para exibir corretamente Pokémon capturados como líderes, com seus stats.
A Arena utiliza sempre `team[0]` para construir Combatant e recompensa no core. Unit tests e Playwright E2E testam duas instâncias da mesma espécie e UIDs diferentes, seleção do líder, limite da equipe, travamento durante expedição, treino independente, escolha refletida na batalha e persistência após reload. `/` legado e repo `isaquesan7/pokedex` não são alterados.

## Catálogo PokéAPI versionado e Pokédex 151 — D-031
`packages/game-core/src/catalog/kantoSpecies.ts` é o snapshot tipado de **151 formas padrão** da PokéAPI (`PokeAPI/pokeapi@ac2f1acb055026e3dff1e0aca743bb46256a810a`), com colunas verificáveis de `pokemon.csv`, `pokemon_species_names.csv` (language 9), `pokemon_types.csv`, `types.csv`, `pokemon_stats.csv` e `pokemon_species.csv`. Não há fetch em runtime. `kantoSpecies(id)` faz lookup por ID indexado; `kantoDexStatus(id,seen,caught)` resolve `unknown/seen/caught` com prioridade à captura. `packages/game-core/tests/kanto-catalog.test.ts` valida 151 IDs consecutivos, seis stats >0, tipos 1–2, nomes, referências de evolução, ausência de lendários/míticos nos 54 selvagens, combatente válido e manutenção dos golpes originais.
`combat/kantoBattle.ts` projeta `KANTO_BATTLE_SPECIES` para as 151 espécies com base exata e **move temporário por tipo** (11 overrides antigos para compatibilidade), `KANTO_WILD_POOL` expandido de 8 para 54 em ordem explícita. `playSave.ts` e `PlayApp.tsx` recebem automaticamente essa base pelo core existente, mantendo save único `kanto-idle-play-v02`, sem modificar eventos/revisões/writer de recompensas.
`apps/web/src/play/PokedexPanel.tsx` + `.module.css` é visualização sem side effects: `seenIds` do save e `capturedSpeciesIds` do roster, nomes/imagens ocultos até descobrir, filtros/busca locais, ficha de atributos-base e referências de pré-evolução. A contagem não repete UIDs da mesma espécie. Os 151 GIFs locais são solicitados apenas para registros revelados, reduzindo carregamento de desconhecidos; React CSS usa tokens Kanto Dark. A rota `/` segue v0.1 e o repositório fonte de GIFs `isaquesan7/pokedex` permanece intocado.

## FireRed/LeafGreen level-up moves + BattlePlayback (D-032)
- `packages/game-core/src/catalog/kantoLevelMoves.ts`: snapshot compactado de `pokemon_moves.csv` blob `f66f614adf535af6940c65f434efe5ddeec4687a`, `moves.csv` e `types.csv`, PokéAPI SHA fixo `ac2f1acb055026e3dff1e0aca743bb46256a810a`, version_group_id 7, method=1. `kantoLevelMoves(speciesId,level)` retorna APENAS danos suportados e aprendidos até o nível. 24 definições e 125 espécies com algum dano aprendível, outras 26 com fallback antigo; mantém 11 golpes clássicos e não implementa secondary effects. `KANTO_BATTLE_MOVES` integra metadados para seleção sem duplicar fontes.
- `apps/web/src/play/playSave.ts`: nova `PlayAction {type:'move',uid,moveName,operation:'select'|'upgrade'}`. O writer de save v0.2 valida UID/espécie/nível no estado atual e deriva `availableMoves` e `movePower` **inteiramente** do snapshot e não de parâmetros da interface; usa reducer puro `reduceLegacyPokemonMoveJson` para respeitar orçamento/rank e revisão do save sem adicionar receipts (somente eventos de recompensa os possuem). Batalhas continuam chamando `simulateKantoBattle` e `applyRewardEvent` UMA vez; `lastBattle.battleId` carrega ID de evento já existente, sem quebrar saves com lastBattle anterior.
- `apps/web/src/play/BattlePlayback.tsx`: apresentação baseada em `lastBattle.log` persistido, com componentes React/useEffect e timers limpos em desmontagem, uma linha a cada 900ms (ou 450ms em 2×), cronômetro acumulado 100ms enquanto executa, pausar, pular e replay. Controlador `PlayApp` ativa playback SOMENTE depois de `transact` confirmar escrita; oculta resultado enquanto animando, mantém registro anterior completo em reload; replay não dispara commands nem toca storage. UI acessível com progresso, contador de turnos, mídia responsiva e regra `prefers-reduced-motion`. Log é fonte da apresentação, não nova escrita. Se interrompido por navegação, preserva save e mostra desfecho ao retornar. `BattlePlayback` não reproduz eventos no core nem muta saldo.
- E2E Playwright confere log surgindo aos poucos, pausa, mudança de velocidade, pular, replay sem alteração de save e UI do golpe/upgrade/reload, desktop/mobile. Nenhum writer adicional, `/` legado e repo `isaquesan7/pokedex` intactos.

## Slots de golpes e IA de combate (D-035; 2026-11-17)
- `packages/game-core/src/catalog/kantoSupportMoves.ts`: fonte local imutável de suporte e nível/espécie; não depende de rede em runtime.
- `packages/game-core/src/legacy/pokemonMoveSlotsReducer.ts`: transição pura e validada de slots por UID; `moveNames?: string[]` + `moveName` legado como slot 1, sem quebrar schema 2 nem chave `kanto-idle-play-v02`. A UI só manda UID/nome/operação; writer valida e grava uma única revisão.
- `packages/game-core/src/combat/kantoBattle.ts`: `Combatant.moves` e `ranks` opcionais; validação dos golpes, escolha de suporte ou melhor ataque por heurística determinística, ordem de turnos pela prioridade do golpe escolhido, dano/debuff/status e log imutável para replay. O controlador de apresentação não muta o save. Sem `Math.random`, fetch, DOM ou estado global.
- `apps/web/src/play/PlayApp.tsx`: mostra 4 slots, seleção de principal, inclusão/remoção de golpes e catálogo de suporte, sem duplicar regras de elegibilidade. `playSave.ts` é o ponto único de gravação local, com revisão e Web Lock cooperativo. Falta servidor autoritativo e economia real; não alegar antifraude.


## D-036 — trilha visual de combate (2026-11-17)
- O game-core registra log e frames em ordem 1:1 por helper único na simulação; cada frame imutável guarda playerHp, wildHp, kind, target, amount. O retorno inclui playerMaxHp, wildMaxHp e identidade histórica do Pokémon do jogador. RNG, estado e resultados continuam como antes.
- O writer da Arena mantém uma só transação/revisão da batalha, incluindo lastBattle.frames; o BattlePlayback avisa seu índice visível ao PlayApp, que valida a trilha opcional e alimenta o BattleStage. O componente só desenha sprites, HP progressbar textual e animações; não importa writer nem simula turnos.
- Compatibilidade: logs anteriores sem frames exibem o histórico sem barras. Replay/pular/pausa não têm acesso a atualização de progresso; novo save schema ou key NÃO foi criado.

## D-037: SP compartilhado com trilha determinística (17/11/2026)
- Novo `packages/game-core/src/combat/kantoSkillEnergy.ts` concentra `KANTO_SP_BALANCE`, `KANTO_BASIC_ATTACK`, `kantoMaxSp(level)` e `kantoMoveSpCost(move)`, sem fetch, relógio ou RNG. Custo de ofensivas deriva de poder base, efeito secundário e prioridade (máximo 30); catálogo fechado de suportes. Não misturar com `legacyMoveRankLimits.skillPoints`, pontos permanentes de rank.
- `kantoBattle.ts` inicializa `playerSp/wildSp` para cada simulação, escolhe movimento com IA determinística/alternância, deduz SP **após** checar paralisia e **antes** da precisão, usa fallback básico e registra `playerMaxSp/wildMaxSp/playerRemainingSp/wildRemainingSp` e SP em todos os `frames` junto com metadados `spCost`, `moveName`, `moveType`, `actor`, `critical` e `effectiveness`. Textos do log/frames são gerados na mesma operação; a UI nunca deduz SP de texto ou reexecuta simulação.
- `BattleStage` desenha medidores e efeito de tipo/crítico do frame atual; `PlayApp` valida a trilha SP opcional separada do HP. Saves com trilha HP de D-036 mas sem SP continuam apresentando HP sem SP; diários anteriores a D-036 seguem legíveis. Esquema do writer local v0.2, recibo e chave do save intactos. `PlayApp` exibe custo do catálogo nas opções de golpes e separa visualmente treinamento de rank e energia de combate.
- Testes `kanto-skill-energy.test.ts`, `kanto-battle-visual.test.ts`, `play-save.test.ts` e E2E desktop/mobile validam custo, paralisia/erro, reserva não negativa, fallback básico, cardinalidade e sincronização SP/HP/replay sem duplicar prêmio.

## D-038 — Fonte PP local, escolha Concentrar e snapshots (17/11/2026; publicada PR #50)
- `catalog/kantoMovePp.ts`: mapeamento estático de 29 movimentos executáveis e respectivos PP oficiais, fonte GitHub PokeAPI `moves.csv` revision `ac2f1acb055026e3dff1e0aca743bb46256a810a`, blob `a55116329ca22f230fea953de94c2d1dffe2ad0e`; sem fetch em runtime. `kantoMovePp` sinaliza ausência de metadado com null; custo usa fallback numérico para movimentos customizados em testes, não altera learnsets.
- `combat/kantoSkillEnergy.ts` implementa `kantoMaxSp(level,speciesId)` com dados-base imutáveis de `KANTO_POKEDEX` e clamp 40..100; `kantoMoveSpCost` híbrido PP/power/efeito/prioridade e pesos de suporte; `kantoFocusRecovery` recupera até 30% limitado ao teto; `KANTO_CONCENTRATE` é interna, impossível equipar via domínio ou forjar para `simulateKantoBattle`.
- `combat/kantoBattle.ts` escolhe suporte, Concentrar ou ataque ofensivo/básico sem RNG adicional para IA; contador de foco e último turno separado para player/wild com máximo 2/cooldown 4; pula ação e captura `kind:'focus',spRecovery,actor,playerSp,wildSp` no MESMO `note` das demais linhas. `kantoDamage` reconhece apenas ataque básico canônico como **sem tipo ofensivo**, com STAB1 e eficácia1, para evitar bloqueio por imunidade; Tackle/Ghost permanece eficácia0. Simulação/seed e recibos mudam para lutas FUTURAS, mas `lastBattle` registrado não é recalculado pelo replay.
- `BattleStage` anima concentração (overlay textual +SP e pulso ciano com reduced motion), `PlayApp` valida `focus` em frames novos, exibe PP oficial e custo SP nas escolhas e capacidade da espécie. Save schema2, local writer, recompensa e reprodução da D-036/D-037 preservados.
- Testes: Vitest custo/PP/151 espécies e 1.152 duelos, E2E Chromium /play desktop/mobile sincronizando números log/frame/replay, Node v0.1 e assets; nenhuma migração destrutiva nem rotas novas.

## D-039 — Prévia de custo PokéAPI + replay acessível (17/11/2026; publicada PR #52)
- Core `combat/kantoSkillEnergy.ts`: `KANTO_SP_BALANCE.minSp=50/baseSp=36/maxSp=100`; fórmula por espécie mantém `kantoMaxSp(level,speciesId)`. `kantoMovePp` usa `Object.hasOwn` para nomes estranhos sem ler prototype; custo de batalha permanece canônico. Novo `KantoApiMoveSpPreview` e `kantoPreviewMoveSpCost` recebem metadata tipada de `/move/{id}` (**pp, power null, priority, damage_class.name, meta.category.name/min_hits/max_hits/healing**) e retornam **SOMENTE PRÉVIA DE CUSTO**; validam dados, não instanciam Combatant/KantoMove, nem combatem. Dados verificados no snapshot PokeAPI/pokeapi@ac2f1acb055026e3dff1e0aca743bb46256a810a `moves.csv`, `move_meta.csv`, `move_meta_categories.csv`: Recover/Soft-Boiled cura50%, Bullet Seed 2..5 hits. Atualizar efeito de cura/multihit em domínio **somente quando habilitado no catálogo e testado**.
- Web `BattlePlayback.tsx`: renderiza texto de diário normalmente sem aria-live automática a cada 900ms; região `role=status aria-live=polite` dedicada anuncia eventos-chave e, em modo leitura assistiva selecionado, cada linha (3s/linha em 1×). Timer `role=timer aria-live=off`, log `role=log aria-live=off`, progresso `role=progressbar`; botões nativos, controle acessível por teclado quando painel focado, avanço por linha somente pausado. Nenhum comando de domínio disparado, só estado local visual.
- Web `BattleStage.tsx` + CSS Modules: Concentrar é identificado apenas por `frame.kind==='focus'` e `spRecovery` (sem parsing do log) para badge CONCENTRAR +SP, medidor SP realçado, `prefers-reduced-motion` anula animações. `aria-hidden` no badge duplicado para leitor de tela; log acessível descreve evento. Replays anteriores não reprocessam nem normalizam SP salvo. CSS tokens, comentários e responsividade mantidos.
- Validação: core e UI/Playwright desktop/mobile com teclado, timer/diário, leitura assistiva, focus realçado mesmo com reduced-motion, integridade da chave local e recibos, 1.920 duelos determinísticos; nenhuma migração destrutiva. Próximos passos: teste manual de leitores de tela reais e npm audit.

## D-040 — observabilidade de combate e auditoria pré-beta (2026-11-18; publicada PR #54)
- `packages/game-core/tests/kanto-balance-observability.test.ts` é teste Vitest isolado, não exporta motor alternativo nem telemetria online. Reusa `simulateKantoBattle` do core com espécies/níveis/seeds fixos D-039, agrupa resultado por cenário/nível e escreve `D040_BALANCE_REPORT` como diagnóstico de CI. Nenhum código da UI importa esse teste; o replay original e um save nunca são tocados.
- `scripts/report-npm-audit.mjs` lê artefatos JSON de `npm audit` geral e `--omit=dev`, valida formato, diferencia pacote direto/transitivo, severidade e possibilidade de correção. `.github/workflows/prebeta-audit.yml` publica resumo Markdown no GitHub Actions e anexa JSON/Markdown em artifact. Vulnerabilidades não atualizam lockfile ou iniciam deploy; um erro da consulta também não pode virar relatório de zero vulnerabilidades.

## D-041 — sprites estáveis e preferência de movimento isolada (2026-11-18; publicada PR #56)
- `BattleStage/Fighter` mantém o DOM do palco e a instância `PokemonArt` ao revelar novas linhas do diário. `useLayoutEffect` usa `getAnimations({subtree:false})`, cancel/play apenas no efeito CSS do wrapper quando há frame com impacto/cura/status/foco; `cue` não é mais usado como `key` do ancestral da imagem. Badges de dano/crítico/concentração continuam com `key` própria baseada no `cue`. Não introduz timer, RNG, ação de domínio ou writer.
- `PlayApp` guarda exclusivamente a preferência de CSS `system/full/reduce` em `kanto-idle-ui-motion-v01`, independente de `kanto-idle-play-v02`, com fallback caso localStorage seja bloqueado. O atributo `data-motion` na raiz faz override de `prefers-reduced-motion` apenas se o jogador optar por `full`, ou reduz movimento ao escolher `reduce`. Gifs e ativos ficam no mesmo caminho local.

## D-042 — CSS estático e stress test (18/11/2026; branch)
- `PlayApp.tsx` usa `data-motion="full"` constante no `.appShell`, sem estado, leitura/gravação ou seletor para preferências `kanto-idle-ui-motion-v01`. Estilos específicos `data-motion='full'` têm maior especificidade e reativam os efeitos CSS sobre as media queries de reduced motion; os estilos `data-motion='reduce'` foram removidos. Nenhum dado é excluído automaticamente.
- `kanto-long-battle-stress.test.ts` executa `simulateKantoBattle` com stats artificialmente elevados de forma local e determinística para exercitar 30-turn cap, SP/focus/status, sem novas exportações, runtime ou persistência; imprime relatório `D042_LONG_BATTLE_REPORT` apenas nos logs Vitest.

## D-044 — artefato imutável e runtime sem devDependencies (18/11/2026; PUBLICADA PR #61)
- Antes: o serviço Railway `Kanto Idle LAB` tinha `build.builder=RAILPACK` sem buildCommand e `deploy.startCommand="npm start"`, `healthcheckPath="/health"`; o npm rodava `prestart=npm run build:web` **a cada start**. Assim ferramentas Vite/Vitest estavam disponíveis no ambiente de boot mesmo sem servidor dev exposto.
- Novo `Dockerfile` em dois estágios: `node:22-alpine AS build` recebe lockfile e workspaces, faz `npm ci`, `npm run build:web` e valida `apps/web/dist/index.html`; o estágio `runtime` recebe SOMENTE `package.json` (para `npm start` que o Railway ainda sobrepõe), `server.mjs`, `index.html` v0.1, CSS/scripts legados, 151 GIFs e `apps/web/dist`. Node roda como usuário `node`, sem `node_modules`, sem lockfile, sem fontes TS, sem `.git`, sem testes ou ferramentas de build. CMD Docker padrão `node server.mjs`, compatível com override Railway `npm start`.
- `package.json` deixa de ter `prestart`; `npm run build:web` permanece explícito para dev/CI e Docker. O endpoint `/health` agora é readiness: responde **200 somente quando `apps/web/dist/index.html` existe**; sem build, retorna 503 e impede healthcheck verde falso em migração de builder. `/play` já retornava 503 quando o build faltava. Não há alteração de RNG, SP/PP, escritor, save nem ciclo de replay.
- `.dockerignore` exclui `node_modules`, dist local, artefatos, arquivos env, docs e git do contexto do build. `tests/e2e/runtime-image-smoke.mjs` prova rotas / e /play, assets Vite, GIFs, 404 para rotas privadas. Workflow `runtime-image-regression.yml` roda `docker build`, inspeciona nonroot/ausência de código dev e usa **`docker run ... npm start` igual a Railway**. A regressão Playwright/TS/Node já existente segue obrigatória.
- Migração automática para Dockerfile deve ser CONFIRMADA pelos logs de Railway; sucesso CI da imagem não prova que o Railway escolheu esse builder. Config-as-code `railway.json` legado NÃO foi criado (Railway documenta depreciação e corte 2026-12-01); manter configuração do serviço existente e só ajustar se log comprovar erro. Se build estiver ausente, /health reprova a release em vez de servir React quebrado.
- Segurança residual: `picomatch@4.0.7` ainda está no **estágio de build**, porque depende de Vite; não existe pacote inventado ou mitigação CVE total. Isolar do runtime reduz exposição, não substitui acompanhar patch upstream ou SCA completa.

## D-045 — ações de autocura e danos multi-hit determinísticos (18/11/2026; publicada PR #63)
- `kantoMultiHit.ts` contém registro fechado de `double-kick` 2/2; `kantoLevelMoves.ts` injeta apenas os learnsets de nível FRLG para 6 formas Nidoran. `kantoSupportMoves.ts` adiciona `recover` como `kind:'heal'` para Staryu15/Starmie1, normalizando os metadados nulos de PokéAPI para a interface `KantoMove` que usa power:number.
- `kantoSkillEnergy.ts` aplica `kantoMoveHitCount` na base de potência sem alterar os 29 movimentos anteriores; custo Double Kick18 e Recover36 via PP versionado `kantoMovePp.ts`. Recuperação tem a própria regra executável e não usa `kantoPreviewMoveSpCost` como autorização.
- `kantoBattle.ts` tenta autocura prioritária somente com limiar HP<=50%, SP>=36, uma vez por combate e até turno26. Status heal ignora tipo do inimigo e gera `kind:'heal'` no alvo aliado com HP/SP corretos. Multi-hit tem 1 roll de precisão/custo SP, 2 impactos com critical/variance por hit, break após KO/imunidade, `hitIndex`/`hitTotal` opcionais em frames. Custo no segundo frame0 para compatibilidade com a métrica de delta SP por linha. O log é autoritativo e o playback apenas lê frames, sem tocar writer.
- `PlayApp` mostra Recover como Cura com descrição de limites e Double Kick como "30 × 2 impactos"; E2E injeta UIDs apenas no contexto de teste e usa writer de slots/combate reais em desktop/mobile. Não há nova migração de save, consultas de rede em combate ou mudança de runtime Docker D-044.

## D-047 — testes de tipo e limites, política futura de TM (18/11/2026; publicada PR #67)
- `tests/kanto-d047-type-matchup.test.ts` chama `simulateKantoBattle` sem/ com Double Kick para famílias Nidoran, agrupando por `kantoTypeMultiplier('fighting',defender.types)`; em teste de dano isolado constrói `KantoMove` SINTÉTICO Fighting60 (nunca exportado/cadastrado) para comparar dois `kantoDamage` de power30 vs um de60 com mesmos stats/roll. Motor/IA/PP e SP não são modificados.
- `tests/kanto-d047-recover-boundaries.test.ts` força limiar de cura em adversários com stats ARTIFICIAIS, garante HP/SP e um uso máximo; Staryu/Mega Kick somente em teste, não aprendido via reducer. `tests/kanto-d047-tm-boundary.test.ts` confirma que prévia custo não é TM equipável; `reducePokemonMoveSlotsJson` continua restrito a learnsets por nível.
- `docs/TM_SYSTEM_DESIGN_D047.md` especifica futuro registro `TMDefinition`/`MachineCompatibility`/`MoveVersion`, identidade de versão, inventário e transação idempotente; **nenhum desses tipos foi incluído em runtime**. Proteção de save schema2/chave, writer e replay imutáveis; sem TM09/Bullet Seed disponível até PR futura com gates.

## D-048 — TM preview versionado e bloqueio fail-closed (18/11/2026; em branch)
- `catalog/kantoTmPreview.ts` é módulo puro sem chamadas HTTP/runtime, localStorage ou imports de React. Ele separa `existingMoveStats:'published-modern-snapshot-preserved'` de `newMachineStats:'gen3-historical-explicit'`, com grupo7/learnMethod4 do snapshot PokeAPI. `KANTO_TM09_PREVIEW` contém a ficha histórica especial/power10/PP30 e máquina `9,7,313,331`; o preview NÃO é `KantoMove` nem aparece no catálogo, inventorário ou writer.
- `kantoTmPreviewHitCount(tmId,roll)` valida `[0,1)` e retorna 2/3/4/5 por pesos fixos3:3:1:1; `kantoTmPreviewMeanHits` = **3,0** (corrige erro de média2,75 D044–D047), testado por 8.000 entradas; **não consome a seed de `simulateKantoBattle`** nem faz custo ou recompensa. `kantoTmIsTeachEnabled` consulta set local vazio de máquinas liberadas, retornando false mesmo para Bulbasaur até compatibilidade positiva/estoque/writer serem reais.
- `src/index.ts` exporta preview read-only para testes/planejamento, mas o React não o usa. `reducePokemonMoveSlotsJson` permanece somente nível e bloqueia TM09; se futuro `teach-tm` for implementado, deverá usar alteração de estoque e `moveNames` atômica com versionamento de schema e recibos. Sem migração/tela/endpoint ou mudança no Docker/runtime.

