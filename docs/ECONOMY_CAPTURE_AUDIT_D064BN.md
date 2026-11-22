# D064BN — auditoria de moedas, Pokébolas e capturas (22/11/2026)

**Estado:** PR de correção mínima e testes diagnósticos; NÃO anunciar publicação até GitHub CI, merge e Railway no SHA exato. Repositório autorizado: `isaquesan7/poke-idle-game`. Números abaixo são **cenários puros com fórmulas do core**, não telemetria nem preços de loja aprovados.

## Descoberta: fonte indevida de Ultra Ball por batalhas
O arquivo `packages/game-core/src/capture/draftBallSupply.ts` é usado **de verdade** pelo writer regional `apps/web/src/play/playSave.ts`, embora mantenha `draft` no nome. Antes desta PR, concedia uma Ultra Ball a cada 15 vitórias desde R7, inclusive R7/R8. A regra desejada reserva Ultra Balls obtidas gratuitamente às **expedições elegíveis no Pico Dracônico (R9) e Santuário Lendário (R10)**.

**Correção D064BN:** combate regional nunca produz Ultra Ball (inclusive R9/R10); o abastecimento regional mantém Poké Ball a cada três vitórias em R1–R6 e Great Ball a cada sete vitórias em R4–R10. Expedição mantém Poké Ball por 1440 ciclos elegíveis (=4h), Great Ball por 2880 (=8h) somente R5–R10, Ultra Ball por 8640 (=24h) somente R9–R10. Sem Master Ball, sem mudança de drop de moedas/XP ou IA. Itens previamente existentes em saves não são apagados. **A loja ainda não existe**; a política futura de venda de Ultra Ball precisa de decisão separada.

- Estoque inicial já presente: **12 Poké Balls** ao criar o save normal; não é apenas planejamento.
- Cada tentativa após vitória custa **uma** bola, capturando ou não. Nenhuma bola é consumida em derrota, nem ao escolher ignorar a captura.
- Várias derrotas não concedem XP/monetização de treinador; a aprendizagem do Pokémon Lv1 continua limitada.
- Saldo futuro de loja **não pode** ser escrito diretamente no estado React/CSS; usar o writer com revision e recibos, além de validar `0…100000` no bolso.

## Abastecimento efetivo para um jogador
| Fonte | Poké Ball | Great Ball | Ultra Ball |
|---|---|---|---|
| Criação do save | 12 | 0 | 0 |
| A cada 3 vitórias regionais R1–R6 | +1 | 0 | 0 |
| A cada 7 vitórias regionais R4–R10 | 0 | +1 | 0 |
| Expedição, por 4h elegíveis (todas as regiões) | +1 | — | — |
| Expedição, por 8h elegíveis (R5–R10) | — | +1 | — |
| Expedição, por 24h elegíveis (R9/R10 apenas) | — | — | +1 |

As fontes por vitória são *por região* (contadores `regionWins[0..9]`), não por soma de vitórias arbitrária na tela. O contador de expedição é persistido no save e só cresce quando a área gera moedas/XP de treinador positivos após arredondamento. As linhas da tabela não pressupõem que um jogador vença todos os combates ou mantenha a expedição ativa sem interrupção.

## Economia bruta de progressão com um Pokémon e apenas expedições
Cenário: treinador Lv1/XP0, Pokémon Lv2/XP0 (o inicial real nasce Lv1), um único UID, sempre a região mais avançada liberada, resgate de **8 em 8 horas**, sem batalha, sem compra e sem gasto de Pokébolas; curva Pokémon D064BM preservada. `poké` inclui as 12 bolas iniciais.

| Resgate | Região do resgate | Treinador / Pokémon após | Moedas acumuladas | Poké | Great | Ultra |
|---:|---|---|---:|---:|---:|---:|
| 1 | R1 | Nv10 / Nv21 | 8.039 | 13 | 0 | 0 |
| 4 | R4 | Nv28 / Nv43 | 66.886 | 19 | 0 | 0 |
| 20 | R7 | Nv64 / Nv74 | 533.410 | 51 | 15 | 0 |
| 40 | R9 | Nv83 / Nv90 | 1.054.319 | 91 | 35 | 0 |
| 42 | R9 | Nv85 / Nv92 | 1.140.719 | 95 | 37 | 1 |
| 53 | R10 | Nv94 / Nv98 | 1.475.985 | 117 | 48 | 4 |
| 59 | R10 | Nv100 / Nv100 | 1.752.465 | 129 | 54 | 6 |
| 60 | R10 | Nv100 / Nv100 | **1.798.545** | **131** | **55** | **7** |

As 60 coletas equivalem a **480 horas de ciclos remunerados**, não 480 horas de jogo ativo no teclado ou um prazo confiável de calendário. Comparar apenas saldos brutos **não dá lucro líquido**: lojas, pedras, itens, cura, uso de bolas e TMs ainda carecem de preços e despesas. No topo (R10, Pokémon Nv100), a expedição ainda rende 46.080 moedas por 8h, duas Poké Balls e uma Great Ball, além de 1/3 do marco de Ultra Ball. No endgame, a emissão de moedas continua mesmo após Nv100 de ambos: são necessários sorvedouros de moedas, limites de compras ou preços/regras de escala antes de publicar loja.

### Sensibilidade ilustrativa de preços — NÃO APROVAR
Se um jogador economizar todas as 1.798.545 moedas do cenário acima, poderia comprar **3.597 itens de preço 500**, **899 de preço 2.000**, **89 de preço 20.000** ou **35 de preço 50.000**. Essas são contas de divisibilidade, não recomendações de preço para Poké/Great/Ultra Ball; não contam outras despesas, estoques ou restrições.

## Dificuldade real dos cinco lendários/míticos com a fórmula publicada
O algoritmo de encontro regional atribui peso 120 às 7 espécies comuns de R9 e peso 1 a cada Articuno/Zapdos/Moltres (total 843). R10 usa peso 240 para 7 espécies comuns e 1 para Mewtwo/Mew (total 1682). A chance de captura com Ultra Ball após vitória no nível de HP=0 é `min(1, captureRate×2/255)` nesta beta; os quatro shakes tradicionais não estão implementados.

| Espécie | Chance de aparecer por batalha na sua região | Chance de capturar após vitória/Ultra | Encontros vencedores esperados até capturar |
|---|---:|---:|---:|
| Articuno | 1/843 | 6/255 (2,35%) | 35.828 |
| Zapdos | 1/843 | 6/255 (2,35%) | 35.828 |
| Moltres | 1/843 | 6/255 (2,35%) | 35.828 |
| Mewtwo | 1/1.682 | 6/255 (2,35%) | 71.485 |
| Mew | 1/1.682 | 90/255 (35,29%) | 4.766 |

Estes números **assumem vitória em 100% dos encontros e uma Ultra Ball disponível sempre que a espécie-alvo aparecer**, com tentativas apenas no alvo escolhido. Não representam uma previsão para a Pokédex completa, tampouco garantem captura após N lutas. Só as **42,5 Ultra Balls esperadas** para capturar uma espécie de capture rate 3 equivalem a **1.020h de expedições elegíveis** se obtidas unicamente por drops naturais (42,5×24h), desconsiderando fontes futuras e consumo com outros lendários. Há um risco claro de a busca de Mewtwo ser excessivamente demorada, mesmo para um lendário intencionalmente raro; revisar com a decisão da loja e dados reais da beta. **Não afrouxar raridade nesta PR sem decisão de design**.

## Matriz combinada sem preços
`packages/game-core/tests/d064bn-mixed-journey-economy.test.ts` realiza, para cada um dos três iniciais, 60 batalhas determinísticas pelo **motor real** (wilds reais do catálogo, stats-base, golpes padrão, seeds fixas), 4 resgates de 2h e tentativas seletivas de captura de novas espécies com bolso real (uma bola por tentativa, sucesso ou falha). O teste dá saída `D064BN_MIXED_ECONOMY_REPORT`; os valores medidos são diagnósticos e serão registrados após o CI. **Limitações explícitas:** sem evolução manual, sem pontos do treinador, títulos/equipamentos, sem inflação por compra, sem IA futura de jogadores, sem troca entre Pokémon capturados; começa no Lv2 após onboarding de batalha. Não é previsão de comportamento do usuário.

## Cobertura e próximos passos
1. Teste `d064bn-ball-supply-provenance.test.ts`: 10 regiões × 105 vitórias, fontes e 8640 ciclos de expedição R9/R10, sem farm de bolas em expedição economicamente zerada.
2. Teste web `d064bn-ultra-battle-writer.test.ts`: vitória de número 15 na R7 pelo writer real, confirma que não gera Ultra Ball, crédito de moedas e replay/revision bloqueados; fixture em memória exclusivamente de teste.
3. Teste `d064bn-economy-capture-sensitivity.test.ts`: 60 resgates e raridade composta das cinco espécies, com equivalência explícita de bolso inicial.
4. Validar CI TypeScript/Vitest/web/Playwright/Docker, corrigir regressões, integrar por squash e conferir Railway `SUCCESS` no SHA da main e `/health` interno.
5. Próxima D064BO: consolidar **decisão de produto** para preços, estoque/limites e outros sorvedouros de moedas por região, com testes transacionais de compra; avaliar alternativas para raridade lendária e consumo de Ultra antes de abrir loja. Backend/antifraude ainda ausentes, QA manual NVDA/VoiceOver pendente.

Nunca modificar `isaquesan7/pokedex` sem autorização.
