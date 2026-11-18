# D-048 — política de versões e base fechada de TMs

**Data:** 18/11/2026 · **Estado:** contrato de código e testes em branch; **TM09 / Bullet Seed continuam não jogáveis** até inventário, elegibilidade e writer transacional serem desenvolvidos e testados em PR futura.

## Decisão formal de fontes (D-048)

O jogo v0.2 tem golpes existentes já publicados com dados **atuais** da PokéAPI, e learnsets de espécies validados para FireRed/LeafGreen (`version_group_id=7`). Alterar seus poderes, categorias, PP, SP ou replay agora quebraria as decisões de balanceamento anteriores.

**Política aprovada para expansão gradual:**
1. **Golpes existentes:** congelar comportamento e metadados já executáveis, inclusive Recover (PP5 / SP36), Double Kick (poder30×2 / SP18) e demais golpes, usando a categoria física/especial já publicada. Não migrar saves/replays em D-048.
2. **TMs novas do conjunto FRLG:** importar **explicitamente a ficha histórica da Geração III** (tipo, categoria, poder, PP, precisão, alvo, multihit e probabilidades), com campo `versionGroup='firered-leafgreen'` e origem por atributo. Compatibilidade só pela máquina de versão e pelo método `machine`; não atribuir a toda espécie do mesmo tipo, a todos os níveis nem pela mera existência da prévia de custo.
3. **Sistema próprio do Idle:** custos SP, Concentrar, IA, tier/rank e limite de turnos permanecem **mecânicas originais do jogo**. Não rotular o sistema inteiro como simulação perfeita de FRLG; há coexistência histórica consciente de dados e regras.
4. **Toda ficha jogável futura** deve passar por catálogo aprovado com versionamento de regras/learnset, teste de SP/batalha/replay, transação de inventário e decisão de liberação. A `kantoPreviewMoveSpCost` pesquisa dados da PokéAPI atual **e não autoriza golpes**.

Não é uma mistura silenciosa: `KANTO_TM_VERSION_POLICY.existingMoveStats='published-modern-snapshot-preserved'` e `newMachineStats='gen3-historical-explicit'`.

## Snapshot verificável da TM09

Dados de `PokeAPI/pokeapi@ac2f1acb055026e3dff1e0aca743bb46256a810a`:

| Arquivo/linha | Fato |
|---|---|
| `machines.csv`, blob `0ccca49159ef5fde36026f0503296ef766d39ee6` | `9,7,313,331` → TM09, FireRed/LeafGreen grupo7, item313, golpe331 |
| `pokemon_move_methods.csv`, blob `ebd7be9a1bcbb1fa7321c51f5a45d41953dc7cea` | método `4,machine` |
| `version_group_pokemon_move_methods.csv` | grupo7 admite método4 |
| `moves.csv`, blob `a55116329ca22f230fea953de94c2d1dffe2ad0e` | golpe331 Bullet Seed, atributos **modernos** poder25/físico, PP30, precisão100 |
| `pokemon_moves.csv`, blob `f66f614adf535af6940c65f434efe5ddeec4687a` | fonte futura de compatibilidade positiva; **a leitura do CSV completo retornou conteúdo vazio por limite de tamanho**, portanto nenhuma lista de espécies foi inventada |

A TM09 histórica GenIII usa `grass/special/powerPerHit:10/PP:30/accuracy:100`. Fontes externas:
- https://pokemondb.net/move/bullet-seed
- https://www.psypokes.com/dex/techdex/331/all
- https://bulbapedia.bulbagarden.net/wiki/Multistrike_move

`KANTO_TM09_PREVIEW` é um preview **não equipável**, com `state:'not-released'`, `speciesCompatibility:'not-verified'`, `inventoryEconomy:'not-implemented'`. A função `kantoTmIsTeachEnabled('tm09',speciesId)` retorna falso para **todos** os 151 IDs até a liberação explícita. A opção de prévia não adiciona ao `KANTO_BATTLE_MOVES`/`KANTO_MULTI_HIT_MOVES`, não cria TM em inventário, não entra na UI e não toca `reducePokemonMoveSlotsJson`.

## Distribuição histórica isolada

O helper puro `kantoTmPreviewHitCount('tm09',roll)` recebe número já sorteado em `[0,1)` e classifica 2/3/4/5 impactos pelos pesos **3/8,3/8,1/8,1/8**. `kantoTmPreviewMeanHits('tm09')=2,75`. Ele **não consome o RNG de `simulateKantoBattle`**, não executa danos nem cura nem credita recompensas; sua função é permitir validação matemática e futuro projeto. Roll inválido e TM desconhecida são rejeitados. Teste determinístico com 8.000 pontos distribuídos uniformemente encontrou exatamente **3.000/3.000/1.000/1.000** acertos. Não é estatística de players.

A prévia D-039 em dados modernos continua usando 2,5 impactos como heurística e retorna aproximadamente **18 SP** para modern power25/PP30, sem executar o golpe. Se futuramente a TM histórica passar ao jogo, a fórmula de SP com 10×2,75 sugeriria ~12 SP, mas **isso não é custo aprovado**, pois precisa de estudo de balanceamento vs Double Kick e do tratamento de múltiplas animações. Decisão de SP será explícita em nova PR.

## Inventário e writer futuros (não implementados)

Antes da D-049:
- **Elegibilidade completa:** obter e verificar conjunto POSITIVO da fonte fixa `pokemon_moves.csv`, filtrando `pokemon_id 1..151`, `version_group_id=7`, `move_id=331` e `pokemon_move_method_id=4`. A fonte é grande; usar script de geração com checksum e artefato revisável fora de runtime, sem confiar em IDs inventados ou consulta on-line por batalha. Conferir divergências de forma, evolução e move de TM.
- **Economia de item:** definir se TM única consumível, como é obtida no próprio Idle e qual limite máximo por jogador. Nenhuma TM é obtida ou consumida em D-048.
- **Writer atômico:** `teach-tm` com UID, ID da máquina, slot, versão esperada e receipt/idempotency key; validar inventário positivo/compatibilidade/sem duplicação, aplicar **consumo e alteração de `moveNames` na mesma transação**, rejeitando revisões antigas/conflitos, slots lotados ou golpe incompatível. Sem backend, não prometer segurança contra adulteração pelo próprio usuário.
- **Persistência/replay:** só criar migração de schema se demonstrada por teste de leitura de saves antigos; não apagar `kanto-idle-play-v02`, não ressimular frames nem conceder recompensas na reprodução. Manter `/` legado.
- **Motor 2–5:** um roll da seed por ação acertada define quantos impactos; um único débito SP, crítico/variação por impacto conforme política explícita, stop no KO/imunidade, uma linha/frame por impacto, limite30 turnos, IA pondera distribuição sem alterar Focus. Tests exigidos para KO no 1º–5º hit, replay e acessibilidade.

## Gates e riscos restantes

A nova suíte `kanto-d048-tm-version-policy.test.ts` verifica os identificadores/sha de origem, atributos GenIII, imutabilidade do catálogo, fronteiras e distribuição 3:3:1:1, ausência de desbloqueio nas 151 espécies, rejeição de `add`/`replace-primary` para Bullet Seed, sem modificação de coins, coleção e pedras; Double Kick e Recover existentes continuam habilitados.

**D-048 é infraestrutura de catálogo SOMENTE LEITURA, não uma feature de ensino de TM.** No futuro, não remover o gate vazio sem compatibilidade, inventário, sistema de receipts e testagem independente. Acessibilidade real NVDA/VoiceOver e animação Full compulsória, além de avisos upstream Picomatch no estágio de build, permanecem pendências pré-beta.
