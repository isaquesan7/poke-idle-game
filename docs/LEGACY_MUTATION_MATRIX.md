# Matriz de mutações v0.1 → Foundation v0.2

**Origem auditada:** `index.html` no commit base `158c85b9` (2026-11-16). O JavaScript legado está majoritariamente minificado em linhas extensas; as referências abaixo são as linhas desse commit. O teste `tests/legacy-mutation-audit.test.mjs` identifica alterações no catálogo de 21 ações do handler, mas **não substitui revisão manual** de efeitos indiretos.

**Status:** nenhuma operação abaixo foi autorizada para persistência oficial v0.2. Os módulos do `game-core` existentes calculam fórmulas e a prévia React apenas lê/projeta save ou edita rascunho isolado.

## Ações do usuário (`handleClick` e `handleChange`)

| Ação/evento v0.1 | Origem | Campos e efeitos persistentes | Situação v0.2 | Próxima exigência |
| --- | --- | --- | --- | --- |
| `starter` | L203, `newState` L127 | Cria estado v1 completo, iniciais, time, moedas e níveis; invoca `ensureMove` e salva | Sem comando equivalente | Portar inicialização idempotente, modos e schema |
| `save-name` | L205 | `state.name` | Somente leitura | Sanitização e escrita versionada |
| `stat-trainer` | L206 | `trainer.manual[stat]++`, até 40 por atributo e orçamento por nível | Simulação via `trainerDraft` | Portar ação real sob revisão |
| `reset-trainer` | L207 | Zera todos os pontos manuais do treinador | Sem ação real | Reembolso seguro, revisão e teste |
| `stat-pokemon` | L208 | Pontos manuais da instância Pokémon por UID | **Reducer puro no core**, sem write | Testar integração React + revisão versionada antes de persistir |
| `reset-pokemon` | L209 | Zera os pontos manuais daquela instância | **Reducer puro no core**, sem write | Fluxo React protegido + save oficial somente após cutover |
| `select-pokemon` | L210 | Apenas seleção de UI em memória; **não salva** | Prévia mostra Pokémon ativo | Preservar distinção seleção vs equipe |
| `add-team` | L211 | `team.push(uid)`; até 3, expedição impede trocas | **Reducer puro no core**, sem write | Testar paridade com UI/combate/expedição e writer |
| `remove-team` | L212 | `team` filtrado; exige ao menos 1 | **Reducer puro no core**, sem write | Portar fluxo da equipe e política de writer |
| `upgrade-move` | L213 | `roster[].upgrades[moveName]`, limite de rank e pontos | **Reducer puro no core**, sem write | Validar poder do golpe em autoridade confiável antes de persistir |
| `encounter` | L214 e L186 | `seen.push(pokemonId)`, salva; também prepara `wild` em RAM | Sem ação real | Encontro, aleatoriedade e deduplicação |
| `battle` | L215, L190–196 | Vitórias/derrotas, moedas, XP, níveis, afinidade, insígnias, captura/UID/roster | **Evento puro idempotente de resultado pré-resolvido** | Falta simulador de combate, RNG verificado e writer autoritativo |
| `start-exp` | L216, L197 | `expedition={startedAt,lastClaimAt,teamUids}` | **Evento puro com snapshot de time** | Persistência + monotonicidade de relógio em autoridade única |
| `claim-exp` | L217, L198–199 | Moedas, XP treinador/Pokémon, afinidade, `lastClaim`, `lastClaimAt` | **Evento puro de claim + recibo** | Garantir claim único entre abas com writer canônico |
| `stop-exp` | L218, L200 | Claim final e `expedition=null` | **Evento puro com claim final/encerramento** | Transação durável e teste de conflito entre abas |
| `dex-details` | L219 | Apenas carregamento API/UI; **não grava save** | Leitura parcial | Dados Pokédex e tratamento de cache |
| `encounter-specific` | L220, L186 | Delegação ao `encounter`: adiciona espécie vista | Sem ação real | Tratar como mutação indireta |
| `reset-all` | L221, L201 | **Remove** a chave real do save v0.1 após confirmação | Não existe no React | Plano de exclusão/backup separado; nunca migração automática |
| `equip` | L223 | `trainer.equipped[slot]`; a v0.1 permite itens do catálogo, sem compra/inventário persistido | Simulação isolada | Regras de propriedade/inventário a definir |
| `title` | L224 | `trainer.title` quando condição permite | Projeção somente leitura | Checagem de elegibilidade e writer |
| `move` | L225 | `roster[].moveName`; pré-carrega movimento no cache | **Reducer puro no core**, sem write | Lista da espécie validada pela autoridade; cache separado |

## Escritas indiretas, efeitos de ciclo de vida e cache

| Função/efeito | Origem | Risco que precisa ser portado ou bloqueado |
| --- | --- | --- |
| `save()` / `saveCache()` | L116–117 | `localStorage.setItem` síncrono sem CAS/Web Locks. O save v0.1 não coopera com writer v0.2; cache separado não é fonte de progresso |
| `init()` | L182–183 | Lê JSON v0.1 e normaliza manual/upgrades/afinidade **em memória**; `ensureMove()` pode escrever após carregar. Uma aba antiga pode regravar snapshot velho |
| `ensureMove()` | L184 | Define/altera `moveName` após chamadas async à PokéAPI e **salva**. Chamado por init, batalha, starter e captura |
| `addTrainerXP()`, `addPokemonXP()` | L140–141 | XP, level e limiares; mutações indiretas de batalha/claim, já existem fórmulas puras no core mas nenhum writer real |
| `gainedBadges()` | L145 | Adiciona insígnias cumulativas ao chegar a certos wins; chamada após vitória |
| `ensureTitle()` | L147/L179 | Render pode trocar título inelegível; mudança pode ser persistida pelo próximo `save()` |
| `encounter()` | L186 | `seen` persistente e `wild` transitório; requisições async antes de salvar |
| `battle()` | L190–196 | Monte de mutações dependente de RNG e PokéAPI; `ensureMove` pode salvar antes do resultado. Concessão de recompensa não idempotente entre abas |
| `claimExp()` | L198–199 | Usa horário de parede e arredonda ciclos, máximo 2880; duas abas v0.1 podem resgatar os mesmos ciclos |
| `pagehide` | L228 | Chama `save()` mesmo sem alteração: **pode sobrescrever progresso mais recente de outra aba** |
| `resetAll()` | L201 | `removeItem(SAVE_KEY)`, destrutivo, sem recuperação remota |
| `getPokemon/getMove/getRelations` | L124–126 | Cache `kanto-idle-lab-cache-v01`; falha/ordem de API podem alterar seleção de golpe ou combate |

## Dependências de paridade (bloqueadores)

1. **Writer canônico e transferência de autoridade**: nenhuma aba v0.1 carregada anteriormente poderá ser bloqueada via Web Locks da v0.2. Preservar separação de chaves e mostrar conflito; não mesclar.
2. **Jogabilidade completa**: inicialização, perfil, treinador/Pokémon, equipe, golpes/upgrades, encontro, batalha, captura, XP, insígnias/títulos, equipamento e expedição precisam de ações puras/reducer, validação e testes de idempotência.
3. **Integridade de inventário/economia**: a v0.1 tem equipamento de catálogo, mas não possui um sistema de compra/posse definitivo. Não inventar regras de propriedade como se já estivessem implementadas.
4. **Persistência/versionamento e backup externo**: só considerar um writer real quando rollback e arquivo fora do navegador forem testados e o usuário optar explicitamente.
5. **Verificação automática**: `tests/legacy-mutation-audit.test.mjs` falha se um novo `data-action` tratado pelo handler for adicionado/removido sem atualizar o snapshot de ações; isso NÃO garante detectar mutações introduzidas dentro de uma função existente. Auditoria manual continua obrigatória.

**Próxima implementação sugerida:** criar reducers puros para treino/reset de pontos do Pokémon e equipe, sem writes; em seguida batalha/claim com eventos idempotentes e testes de dupla aba. O gate fail-closed em `apps/web/src/storage/cutoverGate.ts` mantém a migração real sempre bloqueada mesmo que o JSON seja válido.


## Implementação incremental de paridade: Pokémon/equipe (2026-11-16)
O reducer `packages/game-core/src/legacy/pokemonTeamReducer.ts` cobre exclusivamente as quatro ações `stat-pokemon`, `reset-pokemon`, `add-team` e `remove-team` em um NOVO texto JSON, sem persistência. Valida UIDs individuais, orçamento de dois pontos por nível, expedição ativa e limites de equipe (1–3). Rejeita saves incompatíveis; preserva XP, moedas, capturas e atributos não relacionados. **Não cobre** combate, recompensas, encontros, títulos, equipamento, compras, writer ou rollback real. `cutoverGate.ts` permanece fail-closed. Testes: `packages/game-core/tests/pokemon-team-reducer.test.ts`.

### Resultado da etapa de Pokémon/equipe (2026-11-16)
PR #20 integrada em `5e60f17b`; CI `43996462703` e Railway `da78ab5a` SUCCESS. Os quatro handlers de Pokémon/time da matriz já têm equivalente PURO no core, mas **nenhuma escrita oficial**: próxima exigência é coordenar eventos de combate/expedição sem duplicação de recompensas antes do cutover v0.2.


### Progresso da paridade de recompensas (2026-11-17)
`packages/game-core/src/legacy/rewardEvents.ts` adiciona comandos **somente em memória**, com `RewardJournal` + revision/IDs, para resultado de batalha pré-resolvido/captura, start/claim/stop de expedição. A vitória/derrota/captura/claim são contabilizadas uma vez por evento em uma transição SEQUENCIAL do envelope. Não há engine de turnos, comprovação da vitória ou proteção entre abas isoladas: dois envelopes com mesma revisão ainda divergem. Nenhum writer real v0.2 foi criado e o gate permanece fechado.

### Golpes do Pokémon (2026-11-17, branch em teste)
O novo `pokemonMoveReducer.ts` trata `move` e `upgrade-move` por UID, sem tocar em outras instâncias ou recursos; confere limites do protótipo e preserva ranks após troca. Os metadados recebidos não têm prova autoritativa. Sem writer, UI React jogável, RNG ou persistência oficial.
