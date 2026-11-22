# D064BR — auditoria da economia, resgate com mochila cheia e clareza de chances (22/11/2026)

**Estado: PUBLICADA EM PRODUÇÃO** pela PR #149, merge squash funcional `7054c3790800ee4e71c2ee597ca9a576e5f9c90c`; HEAD da branch funcional `ef0a020b8a8dbbcbc76ec22cb9360fffdcc90c1e` testado no GitHub Actions: regressão geral `45037200926`, Playwright isolado desktop/mobile `45037200948`, Docker `45037200949`, os três **SUCCESS**. Railway deployment `5f3bc6d4-a8ea-470e-b4bc-89a98ae3c6be` **SUCCESS** no commit exato, `/health` **interno** aprovado, serviço online com 1 réplica running, 0 crashes, sem trabalho pendente. GET público externo `/play` não foi testado diretamente.

## Política preservada nesta fase

**Nenhuma chance de drop, custo da loja, captura, raridade, XP, afinidade ou desbloqueio foi modificada.** Os drops por vitória continuam sendo uma única rolagem de zero ou uma bola, e não marcos garantidos. Expedições seguem com ciclos próprios; Ultra em expedição só R9 e R10. A Master Ball continua indisponível para venda e para o drop.

| Região | Poké Ball | Great Ball | Ultra Ball | Nenhuma bola |
|---|---:|---:|---:|---:|
| 1–3 | 30% | 0% | 0% | 70% |
| 4–6 | 25% | 14% | 0% | 61% |
| 7–8 | 18% | 14% | 5% | 63% |
| 9–10 | 18% | 14% | 7% | 61% |

Os valores de compras beta continuam Poké **600**, Great **2.400**, Ultra **16.000** moedas do jogo, desbloqueio por treinador Lv1/Lv20/Lv55. Somente vitórias **economicamente elegíveis** geram rolagem; zero moedas/XP por diferença de nível impede farm de bola em região fácil.

## Defeito de economia identificado e corrigido

Na versão D064BQ, se um resgate de expedição concedesse qualquer bola além do teto **100.000 por tipo**, `claimExpedition` lançava uma exceção e **recusava TODO o resgate**, inclusive moedas, XP e avanço do cursor do tempo. Isso poderia prender jogadores de endgame com mochila cheia.

D064BR corrige o writer `packages/game-core/src/legacy/rewardEvents.ts`:
- Continua rejeitando quantidades inválidas, negativas, acima do teto **já presentes** ou tipos corrompidos.
- Com bolsa válida mas cheia, cada tipo recebe **no máximo a quantidade que cabe**. O restante do resgate (moedas, XP, progressão e recibo único) segue sem bloqueio.
- `lastClaim.ballDrops` registra **a quantidade efetivamente creditada**, e não as bolas que o algoritmo teria sorteado/produzido antes do teto; os contadores de expedição `expeditionBallProgress` avançam normalmente para não acumular prêmios fantasma para o resgate seguinte.
- Mesma política anti-travamento já aplicada aos drops regionais em D064BQ, agora consistente entre fontes.

A prévia de expedição no `PlayApp.tsx` e `ExpeditionScreen.tsx` desconta o estoque atual dos drops previstos, mostra apenas quantidades que cabem e apresenta aviso acessível sobre o excesso. Moedas e XP previstos permanecem intactos; nenhum save é mutado por visualizar a prévia.

**Regressões:** teste real de writer com R10, líder Lv100, 1 ciclo elegível cruzando todos os limiares de bolas; Poké/Ultra já 100k, Great 99.999 ⇒ creditar só Great +1 e todo o pagamento em moedas. Testar também os três bolsos já no teto (0 bolas, moedas mantidas), bolso inválido (transação inteira bloqueada) e captura de Mewtwo com Ultra consumida uma única vez, bloqueando Poké/Master e replay do lançamento.

## Auditoria econômica reproduzível

`packages/game-core/tests/d064br-mixed-economy-audit.test.ts` executa **cinco cenários simulados** (R1, R4, R7, R9 e R10) com regras REAIS de sorteio regional, `kantoRegionalEncounter`, `battleProgressFactor`, moedas de vitória, `expeditionRewards` por 8h, `quoteKantoBallShopPurchase` com preços beta e `resolveKantoCaptureAttempt` com consumo inclusive em falha. Para tornar a comparação determinística, supõe **1.000 vitórias remuneradas com 100% de sucesso**, um Pokémon mantido artificialmente no teto da região, uma tentativa de captura a cada três vitórias, reposição de Poké Balls de cinco em cinco quando necessário, compra de Ultra se aparece lendário sem estoque e nenhuma evolução/treinamento/derrota/tempo real de jogo. Isso é **cenário de estresse controlado**, não telemetria e não representa os resultados reais de um jogador.

Verificações: por cada bola, `estoque final = 12 iniciais (Poké somente) + drops de vitórias + drops de expedição + compras − bolas gastas`. Moedas finais = moedas de vitórias + moedas da expedição − custo de compras. Capturas jamais excedem tentativas; nenhuma moeda/bola negativa, roll sem garantia, não é possível obter Ultra antes da região7. Rodar o mesmo cenário duas vezes deve retornar resultado idêntico. As taxas observadas numa amostra de 1.000 vitórias podem oscilar em relação à média, sem constituir garantia.

### Expectativas matemáticas por 1.000 vitórias elegíveis, *antes de capturas, compras e expedição*

| Faixa | Poké esperadas | Great esperadas | Ultra esperadas | Valor hipotético do lote pelo preço beta* |
|---|---:|---:|---:|---:|
| R1–3 | 300 | 0 | 0 | 180.000 |
| R4–6 | 250 | 140 | 0 | 486.000 |
| R7–8 | 180 | 140 | 50 | 1.244.000 |
| R9–10 | 180 | 140 | 70 | 1.564.000 |

*Valor equivale apenas à soma dos preços unitários atuais, **não é pagamento em moedas** e não significa que haja sistema de revenda. O jogador não pode vender esses itens, e os números não são recompensas garantidas: são valores esperados, com variância.*

**Pressão inflacionária:** R10, com expedição 8h plenamente remunerada, ainda gera **46.080 moedas** e em média permite comprar 2 Ultra Balls sem considerar batalhas, com sobra. Com **3 resgates de 8h elegíveis (24h)** a expedição também entrega 1 Ultra Ball. Em batalha R9/R10, uma Ultra Ball é encontrada, em média, a cada `1/0,07 ≈ 14,29` vitórias remuneradas; isso não é um marco garantido e pode haver sequências muito maiores sem drop. A raridade de Articuno/Zapdos/Moltres e Mewtwo/Mew permanece independente e muito mais severa que a oferta de Ultra: **não reduzir a raridade dos lendários nem alterar os preços automaticamente nesta fase**. A eventual necessidade de novos destinos de moedas/ajuste de drop exige observar sessões reais, tempo de vitória e consumo de captura antes de uma alteração de economia deliberada.

### Segurança

O `RewardJournal` com recibos, revisão de save e `navigator.locks` cooperativo protege compras contra callbacks repetidos e duas abas participantes. **Ainda NÃO é backend autoritativo nem CAS real entre abas em navegadores sem Web Locks.** Um usuário pode manipular seu próprio localStorage, seed e relógio; não alegar antifraude ou economia competitiva segura. Próxima melhoria estruturante será autenticação e writer em servidor, caso se decida lançar progressão competitiva ou comércio entre jogadores.

## UX de transparência

Na aba **Loja**, abaixo dos itens, uma tabela acessível apresenta exatamente as chances reais consultadas de `d064BattleBallDropRates`, incluindo regiões com Ultra a partir da 7. O texto explicita que nenhuma vitória garante item e que se recebe no máximo uma bola. Layout compacto e sem overflow horizontal de página em dispositivos móveis.

## Critérios de liberação

A entrega funcional exige CI geral TypeScript/Vitest/E2E, Playwright isolado desktop/mobile e Docker verdes, squash merge para `main`, Railway SUCCESS no SHA publicado, saúde interna `/health` e ausência de crashes. Depois registrar o release real com CI e deployment exatos. CI geral, Playwright isolado, Docker, squash merge, Railway e healthcheck interno **confirmados após validação**; ver status no topo. GET público externo não aferido. Repositório `isaquesan7/pokedex` não será alterado.

**Próxima fase proposta D064BS:** monitoramento opt-in de indicadores agregados e auditáveis, análises de falhas por navegador e opções para operação no servidor; eventual revisão de preços e chances somente com decisão explícita, sem reintroduzir drops fixos.
