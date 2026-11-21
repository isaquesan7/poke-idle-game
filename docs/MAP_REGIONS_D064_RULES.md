# D-064 — Mapa, regiões, progressão, expedições e Poké Bolas
Atualizado em 2026-11-20

> **FASE ATUAL: FUNDAMENTOS ISOLADOS NA BRANCH. NÃO MUDAR O COMBATE OU SAVE PUBLICADO E NÃO PUBLICAR SEM VALIDAR ECONOMIA, EXPEDIÇÃO E OBTENÇÃO DE BOLAS.**
>
> O usuário autorizou o conceito do mapa e definiu regras adicionais. Este arquivo substitui a hipótese inicial de lendários exclusivos como chefes: são **encontros selvagens extremamente raros** em duas regiões específicas, misturados aos demais encontros, e capturáveis somente com Ultra Ball. A Master Ball será definida depois, como ação manual.

## Decisões do produto

1. Nome do menu **Mapa** em vez de Arena, com mapa ilustrado ORIGINAL de Kanto, caminhos entre regiões e batalha D-063 ao entrar em uma região; botão Voltar ao mapa.
2. **Todas as 151 espécies** devem poder ser encontradas e capturadas nas regiões do mapa, assegurando possibilidade de completar a Pokédex sem depender de eventos ou compras limitadas.
3. Nesta proposta, são **10 regiões** de dez níveis (região inicial nível selvagem 2–10 conforme limite do motor). Cada espécie pertence a pelo menos uma região. Não é necessário expandir regiões só para caber as 151.
4. **Articuno #144, Zapdos #145, Moltres #146** somente na 9ª região, junto de outros Pokémon e com raridade muito alta. **Mewtwo #150 e Mew #151** somente na 10ª e ainda mais raros.
5. Região desbloqueada pelo **nível do Treinador**; jogador sempre pode retornar a regiões liberadas. Evitar que a curva lenta do Treinador bloqueie o ritmo de jogo: área 1 aberta, marcos de região devem ser curtos e seus requisitos de nível/XP testados juntos. O projeto anterior sugeria nível + marco na área anterior; manter como **proposta de refinamento**, não travar o jogo por grinding inesperado.
6. **Expedição associada à região, nível do Pokémon e progresso do Treinador.** Exemplo literal: Treinador Nv. 11, Pokémon Nv. 5 => pode entrar apenas em Bosque Inicial. Ao chegar ao Nv. 10, a **XP do Pokémon cessa** nessa expedição; moedas continuam. Para acessar Colinas, encerrar e iniciar outra expedição selecionando Colinas (desde que tenha acesso pelo Treinador e Pokémon tenha concluído a região anterior). **Não migrar automaticamente uma expedição ativa.**
7. **Treinador sobe de nível muito mais lentamente que Pokémon**, privilegiando desenvolver vários parceiros e descobrir Kanto; curva até 100 precisa ser desafiadora mas não travada. Recalcular threshold e ganhos de batalha/expedição em conjunto; não aplicar fórmulas novas sem simulações e teste de saves antigos.
8. **Captura exige bola no inventário** e cada tentativa consome uma unidade (também quando falha). Não permitir captura sem estoque. Trocar a atual captura automática 35% por evento de tentativa autorizado e atômico, somente depois de implementar um meio renovável de conseguir bolas antes da futura loja.
9. Bola de Kanto:
   - Poké Ball, multiplicador oficial 1×; capturas comuns.
   - Great Ball, 1,5×; capturas comuns.
   - Ultra Ball, 2×; capturas comuns e **única bola permitida para lendários/míticos nesta fase**, com chance muito baixa adicional baseada na espécie/condições.
   - Master Ball: captura garantida no universo Pokémon; **não disponível na loja convencional, não é consumida automaticamente e não pode ser usada ainda**. Esperar regra/manual de seleção futura.
10. **Pokédex regional: mesma lista de espécies na tela e no sorteio real**. Se uma espécie aparece na lista, ela precisa ter probabilidade não nula de aparecer, sob as condições anunciadas. Mostrar raridade explicitamente e não apresentar lendário como comum.

## Fundamentos codificados, sem gameplay ativo

- `packages/game-core/src/map/kantoRegions.ts` — 10 áreas, 151 IDs exclusivos e raridades regionais. Todos os IDs referem-se ao snapshot `KANTO_POKEDEX`. Funções puras de consulta e de sorteio determinístico por seed, **ainda não integradas ao writer de batalha ou UI**.
- `packages/game-core/src/capture/kantoBalls.ts` — quatro tipos de bola, multiplicadores canônicos e validador de elegibilidade por espécie/estoque; **ainda não representa propriedade real nem consome item**.
- Testes Vitest para cobertura de todos os 151, restrição dos cinco raros, limites de nível, reproducibilidade e política de bola.
- Os pesos de encontro inseridos são apenas **parâmetros preliminares para simulação**: região 9 possui 3 Pokémon especiais com peso 1 contra 7 comuns com peso 120 (chance total de raro ~0,356%); região 10 tem 2 especiais com peso 1 contra 7 comuns de peso 240 (chance total ~0,119%). Chance de *captura* é outra variável, independente. **Não assumir que essa combinação produz um tempo aceitável para completar a Pokédex** sem Monte Carlo para encontros, vitórias e estoque de Ultra Ball. Reavaliar esses pesos à luz do objetivo de longo prazo.
- Fonte de dados: snapshot oficial PokéAPI presente no game-core (species, types, stats, capture_rate, legendary, mythical). Multiplicadores de Poké Ball/Great/Ultra e Master Ball garantida são da mecânica clássica dos jogos principais, documentada por Bulbapedia/Pokémon; **multiplicadores de bola NÃO são probabilidades absolutas**.

## Plano de economia e XP a simular antes de programar

Estado atual auditado:
- `xpThreshold('trainer',L)=95+27L`; `xpThreshold('pokemon',L)=65+22L`.
- Vitória Nv. W: treinador `30+7W` XP, Pokémon líder `20+6W` XP, `25+3W` moedas, afinidade 2–5.
- Expedição a cada 10 s: `+4` XP Treinador, `+5` XP de Pokémon participante, `+7` moedas; 1 h -> 1.440 XP treinador, 1.800 XP Pokémon, 2.520 moedas.
- Captura automática atual: 35% após vitória **sem item**, mecanismo a desativar somente quando substituto atômico e aquisição estiverem prontos.

Política desejada:
- Curvas de XP diferentes (ex.: treinador Nv. 5 / Pokémon Nv. 15 após dedicação comparável), níveis 1–100 com XP acumulativo difícil no final. Diferenciar XP do Treinador por participação em diversas espécies e conquistas sem tornar a progressão de Pokémon novos impossível.
- Expedições: escolher região no início; por Pokémon, conceder XP somente até o teto da região (interromper **exatamente** ao chegar ao teto; clamping do XP excedente), continuar moedas; para subir de tier, o jogador encerra a expedição e reinicia na seguinte. Se o Pokémon estiver acima do teto desde o início, não recebe XP naquele tier.
- **Decisão técnica recomendada para XP de treinador na expedição**: interromper ou reduzir fortemente a XP ao atingir o teto regional, senão a expedição contorna a curva lenta que o usuário pediu. Levar ao usuário a opção; exemplo acima especifica explicitamente XP do Pokémon e moedas, não o comportamento do XP do treinador.
- Moedas e XP de combate por região serão menores que hoje, com curva crescente controlada e teste de tempo para chegar aos níveis 10, 20, 40, 60, 80, 100. Validar vitória de starters e dos exemplares recém-capturados contra inimigos regionais.
- **Não inventar valores de preços de bolas ainda.** Antes da loja, prover estoque inicial e fonte sustentável de reposição (por exemplo missão repetível ou recompensa de vitória) **sem liberar geração ilimitada de moedas/bolas**. O número inicial e política de renovação exigem simulação da taxa de captura e estoque.
- Ultra Balls: disponibilidade justa e renovável, porém limitada, para que as cinco espécies raras sejam de fato acessíveis. Nenhuma espécie pode depender de Master Ball.
- A taxa de captura precisa considerar `captureRate` real de cada espécie, bônus da bola e, se aplicável, status/HP finais; não confundir bônus oficial com chance por tentativa. Se o sistema idle fizer o arremesso automaticamente, escolha de bola e estoque devem ter política transparente. Master Ball nunca automática.

## Integridade e compatibilidade obrigatórias

- Sem usar somente controle de UI para bloquear região, espécie ou captura. O escritor de recompensa precisa validar região acessível, faixa de nível, espécie autorizada, propriedade da bola, decremento único, sucesso/falha e criação UID num **mesmo commit revisionado**, sem permitir duplicação por replay ou seed.
- Não transformar save legado `inventory` ausente em posse fictícia. O contrato `inspectInventoryOwnership` existente é somente leitura, acompanha equipamento e não inclui consumíveis; estabelecer bolsa de bolas separada ou versão nova migrável e documentada, preservando contas existentes.
- Expedição ativa criada antes da atualização deve ser concluída de forma determinística, sem gerar XP adicional indevida nem sumir com ciclos legítimos. Não migrar automaticamente de região.
- Replays antigos sem `regionId` devem continuar funcionais; `lastBattle` novo deve registrar região e bola usada quando pertinente.
- As rotas `/`, `/play`, a Pokédex, GIFs e os projetos externos permanecem preservados.

## Sequência de implementação antes da publicação

1. **D-064A:** base de regiões, cobertura 151, regras de raridade e catálogo de bolas testados na branch isolada (**em andamento**).
2. **D-064B:** protótipo de mapa ilustrado e navegação Mapa/Região/Arena, sem alterar eventos de combate até a autoridade estar pronta.
3. **D-064C:** nova curva XP Trainer/Pokémon, escala de recompensas por região, simulador multi-seed e projeção do tempo para Nv. 100; validação de EXPEDITION tier gates e cap exato de XP.
4. **D-064D:** nova bolsa de consumíveis com aquisição inicial/renovável, política de Poké Ball/Great/Ultra, escolha segura, captura transacional consumindo 1 bola por tentativa, vitória e replay.
5. **D-064E:** integrar seleção regional ao motor, expedições e listas de espécies, validar raridade dos cinco Pokémon especiais e completar Pokédex.
6. **D-064F:** testes Vitest, E2E desktop/mobile, migração do save, Docker, revisão de UX e publicação em Railway **somente após o balanceamento revisado e autorizado**.

Este documento explicita decisões aprovadas, hipóteses para simulação e questões ainda não definidas. Não interpretar uma política planejada como função já publicada.


## D-064C — protótipo puro de teto da Expedição (sem writer ativo)

- `map/regionalExpeditionXp.ts` inclui `canStartRegionalExpedition(trainerLv,pokemonLv,regionId)`: respeita o nível do treinador para liberar a região e exige que o Pokémon tenha alcançado o **teto da região anterior** para entrar na próxima. Áreas já acessíveis continuam selecionáveis, mas não concedem XP de Pokémon acima do teto.
- `cappedRegionalPokemonXp` calcula quanto XP do lote é aceito até o nível máximo da região sem carregar excedentes para tiers seguintes, preservando XP preexistente se o Pokémon já estava no teto ou acima dele. Exemplo: Pokémon Nv. 9 com 7 XP restantes para subir, expedição credita 600 XP => somente 7 aceitos e nível para em 10; moedas permanecem calculadas por outro canal, no futuro writer.
- Esses são **contratos puros/testados**, sem gravação de save, sem afetar expedições existentes, coins, treinador ou banco. A integração de recebimentos pendentes, mudanças de região apenas depois do stop/restart e status de membros múltiplos ainda está por fazer.


## D-064D — modelo isolado da mochila de Poké Bolas

- `capture/kantoBallPocket.ts` estabelece bolso `{version:1,quantities:{'poke-ball'?:n,'great-ball'?:n,'ultra-ball'?:n,'master-ball'?:n}}`, leitura conservadora de saves legados (`legacy-untracked`), limite para quantidades inteiras e imutabilidade de entradas.
- `spendKantoBallForAttempt` devolve **nova cópia** da mochila menos uma bola, valida a espécie/tipo, bloqueia quantidade zero e nunca aceita Master Ball automática. Está preparado para ser invocado futuramente **dentro da mesma transação de resultado de captura**; isoladamente não salva dados nem gera Pokémon.
- Não decidir por ora estoque inicial, preços ou concessões. Um save sem registro de Poké Bolas NÃO pode ser interpretado como estoque zero com captura ativada antes de migração + fonte de reposição, para evitar bloqueio de progressão.


## D-064E — simulador executável de curva longa (não ativo)
- `map/regionalEconomyDraft.ts`: funções puras `d064DraftXpThreshold`, `d064DraftBattleReward` e `d064DraftSimulateWins` reproduzem a hipótese documentada em `MAP_REGIONS_D064_BALANCE_DRAFT.md` sem alterar save, writer, XP real, moedas nem expedições.
- O simulador percorre regiões liberadas pelo nível do treinador e usa nível do Pokémon limitado à faixa regional; assume 100% vitórias e zero expedições, servindo como **estimativa otimista**, não duração real. Testes checam que Pokémon sobe consideravelmente antes do Treinador, que Treinador Nv.100 exige milhares de vitórias e que valores inválidos são recusados.
- Próximo gate: simular casos reais com derrotas, golpes, HP/SP, expedições e inventário de bolas; não ativar a hipótese na produção apenas com esta projeção.


## D-064F/G — combate regional e capturas projetadas (branch isolada, sem writers)

- `map/regionalBattlePreview.ts` usa **o mesmo simulador real** de combate D-063 e escolhe `wildSpeciesId/wildLevel` por `kantoRegionalEncounter(regionId,seed,leader.level)` da pool única declarativa. Valida nível do Treinador versus região, prepara stats selvagens oficiais e roda com resultado reproduzível. Retorna `captureDisabled:true`, **sem writer, sem XP, sem moedas e sem gravar save**.
- `simulateKantoBattle` recebe modo opcional `'regional-preview'`; por padrão permanece `'standard'` (comportamento da Arena atual intacto). A prévia não rola captura nem registra linhas dizendo que houve captura ou recompensa. Testes cobrem as dez regiões, níveis, espécies válidas, logs/frames coerentes, reproducibilidade, desbloqueio e ausência de premiação.
- `capture/regionalCaptureProjection.ts` calcula a probabilidade **teórica** `(3*HPmax-2*HPatual)*captureRate*ballModifier/(3*HPmax*255)`, usando `captureRate` do snapshot PokéAPI. **Simplificação** de geração III: não é o algoritmo de quatro shakes e não está conectado ao inventário nem a lançamentos reais. HP atual 0 é hipótese de captura após vitória, diferente do jogo principal (onde não se captura alvo derrotado). Master Ball continua indisponível.
- Por espécie, aves no Pico aparecem com frequência de `1/843`, Mew e Mewtwo no Santuário com `1/1682` cada. É uma barreira significativa. A chance de capturar exige multiplicar aparição × sucesso de vitória × chance efetiva da Ultra Ball × disponibilidade de estoque. O modelo preliminar ignora as duas últimas restrições adicionais de vitória/estoque, então oferece apenas **limite otimista** de encontros necessários.
- A seleção regional e a prévia de captura são **NÃO ECONÔMICAS**; para permitir encontros jogáveis, ainda precisamos Writer revisionado, bola consumida por tentativa, decisão de quando lançar, estoque inicial e origem renovável, esquema seguro/migração e testes E2E. Não integrar PR #88 antes disso.
