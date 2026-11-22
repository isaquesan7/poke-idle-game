# D-064AZ — progressão NORMAL desde o nível 1

**21/11/2026 — diagnóstico em branch; sem alterações nas regras de gameplay.**

## Pergunta
Com a mudança D064AY, todo Pokémon inicial novo tem nível 1; a primeira região, Bosque Inicial, contém selvagens de níveis 2 a 10. Uma expedição REGIONAL exige líder no mínimo no nível 2, enquanto as batalhas concedem XP somente quando há vitória. Existe uma trajetória legítima, sem XP/níveis inventados, capaz de sair do nível 1?

## Evidência implementada
O teste `apps/web/tests/d064az-level1-writer-journey.test.ts` executa:
- Para Bulbasaur #1, Charmander #4 e Squirtle #7, perfis novos de modo normal, iniciais níveis 1, sem equipamento nem treinamento, usando `createPlaySave` e `updatePlaySave` exatos do site.
- **72 encontros reais sequenciais por inicial (216 no total)**, com seeds fixas porém distintas, na região 1, com a IA selvagem D064AV, stats e movesets do writer. Cada batalha usa uma Poké Ball se ela estiver disponível e o encontro puder gerar captura. Sem editar o save por fora; a própria lógica da região repõe Poké Balls segundo vitórias.
- Mede número de vitórias/derrotas, tentativa da primeira vitória, primeiro nível 2 do Pokémon, primeiro nível 2 do treinador, níveis após 12/36/72 tentativas, capturas/UIDs, estoque, integridade do journal e frames e duração teórica máxima do replay.
- Antes do nível 2, exige bloqueio de expedição regional. Após progressão LEGÍTIMA, inicia e resgata dois ciclos de expedição na mesma região, confirma XP/UID/recibos e rejeição de claim repetido. Bloqueia região2 prematura e evolução de nível16.
- Verifica separadamente que nenhum inicial começa já evoluído, com pedras, time multiespécie, ou acesso fictício a R9.
- O relatório é impresso no CI como `D064AZ_LEVEL1_WRITER_REPORT` e **não é telemetria nem prova de curva até R9**, pois se limita a 72 tentativas sequenciais/espécie e 3 seeds iniciais. A origem das sementes é determinística, sem manipular outcomes durante a simulação.

## Pontos de atenção
A região 1 libera combate no treinador nível1, mas seu nível mínimo selvagem é 2; expedições regionais ficam bloqueadas até o Pokémon alcançar o nível2, de propósito no contrato atual. Derrota/empate não concede XP. Consequentemente, **o único caminho de saída do nível1 é uma primeira vitória**; isso cria risco de frustração para iniciantes, que deve ser medido e tratado com decisão de design antes de uma alteração na força da IA ou XP em derrotas. As comparações sobre XP/abertura de novas regiões são baseadas exclusivamente em saves legais.

## Exclusões
Não mudar curva de XP, níveis dos selvagens, batalha, IA, raridade de lendários, captura, pedras, compras, TM09, equipamentos, UI, schema2, animações ou repositório `isaquesan7/pokedex` neste recorte. Testes/reports e docs são o único delta.

## Próxima etapa
Usar os resultados observados para decidir se a jornada inicial precisa de intervenção explícita (por exemplo, tutorial, encontro inicial adequado ou pequenos pontos de XP em derrotas), sem conceder recursos invisíveis. Prolongar a trajetória até a primeira evolução via writer e investigar desbloqueios da região2, expedições reais e impacto de partidas curtas no jogador. CI, merge e Railway SUCCESS no SHA exato são gates.


## Diagnóstico comprovado na primeira regressão — bloqueio grave
CI `44966046157` no HEAD `6894e5958a3863665f30ab4cafd6c9a73ea4a060` obteve os seguintes dados, com IA D064AV e starter Lv1 normal, 72 encontros sequenciais por espécie:

| Inicial | Vitórias/72 | Primeiro resultado vitorioso | Chegou ao Nv2? |
|---|---:|---|---|
| Bulbasaur #1 | **0** | nunca | não |
| Charmander #4 | **1** | tentativa 35 | não |
| Squirtle #7 | **0** | nunca | não |

A regra antiga dava XP **somente pela vitória**. Nesse cenário os três permaneceram no nível 1 após 72 batalhas, sem poder iniciar a expedição regional, demonstrando um **softlock real**, não apenas risco teórico.

## Correção implementada D064AZ
- **Aprendizado inicial:** enquanto o Pokémon ativo está no **nível 1**, uma derrota ou empate concede **22 XP somente a esse Pokémon**, uma única vez via writer transacional no evento já registrado. Quatro não-vitórias somam 88 XP; o limiar do Lv1 é 87 XP, então o Pokémon chega ao Nv2 (restando 1 XP). Vitórias continuam com recompensa normal, podendo antecipar a progressão.
- Ao atingir Nv2, o benefício termina automaticamente. Não há moedas, XP do treinador, afinidade ou Pokébolas por derrotas. A IA, os selvagens, precisão, dano, custo SP, regiões, níveis/XP de vitória e raridade dos lendários não foram alterados.
- `beginnerBattleXp` definido em `packages/game-core/src/progression/xp.ts`, compartilhado por `rewardEvents` (aplica XP) e `apps/web/src/play/playSave.ts` (registra XP real no replay e frame de informação). A interface explica a regra na região1 para líder Nv1.
- Regressão de jornada pelo writer valida correspondência `lastBattle.pokemonXp`, ausência de ganho de treinador/moedas nas derrotas de Nv1, evolução/expedição desbloqueadas apenas quando permitidas e proteção de revisões/recibos. Teste puro `d064az-beginner-xp.test.ts` prova quatro resultados sem vitória, parada automática após Nv2 e rejeição de níveis inválidos.

**Limitações:** regra é uma hipótese de onboarding para alfa, válida a qualquer Pokémon Nv1, não só starter. Não é telemetria de pessoas. A trajetória até a segunda região e primeiro estágio evoluído ainda precisará de medição posterior. CI final e Railway SUCCESS no SHA exato são gates antes da publicação.

## Resultado após correção — CI `44966534464` (HEAD `dd659610aba530f74f1812fb6a70851a621323a4`)

Todos os testes passaram: regressão TypeScript/Vitest/core+web/React E2E `44966534464 SUCCESS`, Playwright isolado `44966534485 SUCCESS`, Docker/HTTP `44966534484 SUCCESS`.

Relatório `D064AZ_LEVEL1_WRITER_REPORT` nas 72 tentativas sequenciais por starter, sem inserts arbitrários no save, usando o writer real:

| Inicial | Vitórias | Primeiro Nv2 Pokémon | 1ª vitória | Nv Pokémon final | Nv treinador final | Capturas |
|---|---:|---:|---:|---:|---:|---:|
| Bulbasaur | 15/72 (20,83%) | **tentativa 4** | tentativa 5 | 5 | 4 | 13 |
| Charmander | 35/72 (48,61%) | **tentativa 4** | tentativa 11 | 11 | 7 | 21 |
| Squirtle | 17/72 (23,61%) | **tentativa 4** | tentativa 16 | 6 | 4 | 16 |

No último checkpoint, cada inicial desbloqueou e resgatou uma expedição **sem injetar nível ou XP**. O estoque de Pokébolas foi respeitado; quando zerou, batalhas seguiram **sem tentar capturar**, evitando pedidos de inventário inexistente. O relatório da XP de derrota no save/diário coincidiu com a transação, sem XP/coins do treinador na derrota.

**Importante:** esta é uma única trajetória determinística por starter, de 72 encontros sequenciais (não 72 perfis independentes), sem estratégias diferentes nem seleção otimizada de líderes. As porcentagens não representam win-rate populacional. O desnível entre os iniciais, em especial o rápido avanço de Charmander, é um sinal para uma auditoria maior antes de mexer em atributos/IA, assim como a dificuldade tardia da região9. Os XP extras cessam após Lv2; derrotas normais continuam sem recompensas.
