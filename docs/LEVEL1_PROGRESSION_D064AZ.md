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
