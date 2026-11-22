# D064BQ — drops aleatórios por vitória e checkout da loja (22/11/2026)

**Status:** **PUBLICADA EM PRODUÇÃO** pela PR #147, merge squash `337ce1cbd1ca44021e92370f325ef0615f2c2b53`, HEAD testado `57280d0a4bab43cbde1bf308a8c7171111925dfe`. GitHub Actions geral `45034879515`, Playwright isolado desktop/mobile `45034879419`, Docker `45034879435` **SUCCESS**. Railway deployment `856530c2-8c30-4c82-9098-49adccb7e188` **SUCCESS** no commit funcional exato, `/health` **interno** aprovado e serviço online (1 réplica running, 0 crashes). O GET HTTP externo `/play` não foi verificado diretamente. A primeira CI anterior falhou em duas expectativas de teste porque o writer removia o campo transitório `battleBallDrops` antes de preencher `lastBattle.ballDrops`; corrigido no HEAD final sem reroll de recompensa.

## Decisão explícita que substitui marcos fixos de vitória

O usuário determinou: **Poké Ball, Great Ball e Ultra Ball devem ser farmáveis aleatoriamente nas regiões, não por contadores fixos de vitórias**. Esta decisão **SUPERA** os marcos de combate D064BO (1 Poké/3, 1 Great/7, 1 Ultra/15) e todas as descrições anteriores deles. Continua valendo a **exclusividade da Ultra Ball a partir da R7 nas batalhas**. A regra de Ultra Ball **na expedição só em R9/R10** não foi alterada.

### Tabela exata por vitória regional elegível

| Região | Poké Ball | Great Ball | Ultra Ball | Nada | Total de chance de receber item |
|---|---:|---:|---:|---:|---:|
| R1–R3 | 30% | 0% | 0% | 70% | 30% |
| R4–R6 | 25% | 14% | 0% | 61% | 39% |
| R7–R8 | 18% | 14% | 5% | 63% | 37% |
| R9–R10 | 18% | 14% | 7% | 61% | 39% |

**Uma única rolagem para 0 ou 1 bola por vitória válida**, categorias mutuamente exclusivas. Primeira vitória pode dar item; 15ª vitória pode não dar nada. O percentual vale por tentativa e **não implica garantia** ao longo do tempo. Vitórias sem recompensa econômica devido à régua anti-farm continuam sem bola. Derrotas e empates não geram bola. O cap histórico `regionWins[i]=100000` continua saturado para integridade do save, **mas não interrompe drops em novas vitórias remuneradas**; não existem mais marcos a repetir. Mochila no limite 100.000 de um tipo não bloqueia batalha: crédito daquele item é saturado em 100.000.

**Anti-replay:** `d064BattleBallRoll(regionId,seed,battleId)` gera roll 0–9999 a partir da seed do combate e do ID persistido do encontro, por hash isolado de dano/captura. `d064DraftBallDrop` usa a mesma rolagem no ensaio e no writer de `finish-regional-battle`; `applyRewardEvent` mantém recibos anti-duplicação e `expectedRevision`; replays/relançamento de botão não podem rerolar o mesmo encontro. RNG é determinístico **e manipulável por cliente malicioso** enquanto o jogo é local; não alegar antifraude/autoridade de servidor.

**Expedições, sem mudança:** Poké Ball 1/4h elegíveis em todas as áreas; Great Ball 1/8h nas áreas R5–R10; Ultra Ball 1/24h **apenas nas R9/R10**. Estas são fontes de expedição por ciclos e NÃO dependem de vitórias regionais. Master Ball não tem drop nem venda convencional. Kit inicial permanece 12 Poké Balls.

## Loja beta com transação íntegra

O catálogo anterior da D064BP passa a ter preços **BETA v1**. Não há moeda real, não são preços de Pokémon oficial e podem ser rebalanceados antes de lançamento conforme dados de partidas.

| Item | Custo beta por bola, moedas | Desbloqueio pelo treinador | Máx. por operação |
|---|---:|---:|---:|
| Poké Ball | **600** | Lv1 | 50 |
| Great Ball | **2.400** | Lv20 | 25 |
| Ultra Ball | **16.000** | Lv55 (R7) | 10 |
| Master Ball | **Não à venda** | — | — |

Estes valores aproximam a hipótese de sensibilidade testada na D064BP: 600/2.400/16.000. Evitam venda gratuita, permitem recompor estoque com moedas e dão saída econômica à geração de moeda em expedições. Necessário acompanhar ganho líquido real, gasto e raros antes de definir valores finais, desconto por lote, reset de estoque ou itens adicionais. Todos preços vêm de `KANTO_BALL_SHOP_PRICE_POLICY` imutável no core com `version:1`; nenhum preço vem dos controles do navegador. A categoria de Ultra é liberada na loja a partir do treinador Lv55 (R7); limitação de Ultra em expedição a R9/10 não limita comércio.

**Atomicidade e idempotência:**
- `PlayAction(type:'buy-ball',purchaseId,ballId,quantity)` não aceita preço do jogador.
- `updatePlaySave` usa `applyRewardEvent` com tipo `shop-purchase`: revalida bolso, saldo, treinador e quantidade na revisão atual. `quoteKantoBallShopPurchase` usa a tabela oficial beta do core; subtrai moedas e acrescenta unidade no MESMO estado. `RewardJournal.receipts` recebe ID/fingerprint e aumenta revision **no mesmo JSON armazenado**; o snapshot externo aumenta uma revisão via CAS.
- Rev stale de duas abas ou receipt repetido não debita nem duplica item. Mesmo ID reutilizado com payload diferente rejeitado. Se faltar moedas, estiver bloqueado pelo nível, quiser Master, houver erro de quantidade, cap do bolso ou replay pendente: transação bloqueada sem alterar save. `navigator.locks` protege navegadores cooperativos; fallback CAS local não oferece operação atômica entre contextos não cooperativos.
- O save **não é autoridade antifraude de backend**. No alfa local o usuário pode adulterar localStorage, seed e relógio; isso exige backend em etapa própria se for lançado modo competitivo/economia compartilhada.
- UI apresenta preços, saldo, estoque, quantidades em lotes 1/5/10/25/50 respeitando limite, botão de compra habilitado somente conforme saldo/progressão/cap, custo total, feedback. Ao vencer, recompensas de batalha exibem bola sorteada ou 'Nenhum nesta vitória'. A UX de foco palco→captura→botão permanece idêntica.

**Testes:** estatística de 10.000 encontros de cada banda de regiões, limites por região e chance zero quando bloqueada, resultados independentes de marco, determinismo da rolagem, anti-farm, 3×8h de expedição, core quote, writer de compra real, preços forjados, nível/trava, cap 100k, replay, stale, duas abas, store intocado após bloqueio. Playwright desk/mobile: loja exibe preço, bloqueio sem fundos, compra de Ultra e Poké, recibos e sem duplicação após recarregar.

## Próxima etapa depois de CI verde

Auditar a distribuição de recursos e consumo reais em uma jornada maior com compras ativas e drops aleatórios, ajustar a curva de preços e verificação mobile manual. Não alterar taxa rara de Pokémon, IA, XP/afinidade ou expedições sem decisão. Nenhum arquivo do repositório `isaquesan7/pokedex` deve ser modificado. Confirmar CI/merge e Railway no SHA real antes de alegar publicado.
