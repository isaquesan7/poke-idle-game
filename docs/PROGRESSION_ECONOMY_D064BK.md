# D064BK — auditoria de progressão e economia (22/11/2026)

**Situação:** etapa em PR #137, branch `test/d064bk-progression-economy-audit`; merge/deploy ainda exigem CI final e confirmação. Os números abaixo são **simulações determinísticas** da função publicada, não telemetria de jogadores nem garantia de tempo real.

## Contrato real
- 10 regiões, com `trainerUnlockLevel` = 1, 6, 12, 20, 30, 42, 55, 69, 82, 93 e `levelMin` do Pokémon = 2, 11, 21, 31, 41, 51, 61, 71, 81, 91.
- Na UI de expedição, a região fica disponível somente se **ambos** os requisitos forem cumpridos. O Pokémon inicial no Lv1, antes de chegar ao Lv2, ainda não pode iniciar a primeira expedição. Não mudar o nível de captura ou o nível do encontro para contornar essa regra sem decisão de produto.
- 8h por resgate, 10s/ciclo, teto 2.880 ciclos. A recompensa por ciclo considera o nível do Pokémon antes de cada ciclo. Níveis 1–100 e limites de ganho testados.
- Os resultados abaixo partem de **treinador Lv1, Pokémon Lv2, ambos XP0**: o Pokémon precisa conseguir Lv2 por batalha/treino inicial. Não presumir disponibilidade de expedição quando ele está no Lv1. Caminho escolhe sempre a maior região permitida por **ambos os níveis**, sem batalhas entre resgates; usa um só Pokémon.
- Afinidade permanece exclusivamente de batalha (nunca em expedição), Poké Ball por 1.440 ciclos elegíveis, Great Ball por 2.880 nas regiões 5–10, Ultra Ball por 8.640 somente nas regiões 9–10; drops persistem em transação, sem Master Ball.

## Resultado quantitativo: jornada apenas com expedições
| Resgate (8h) | Região | Treinador após | Pokémon após | Moedas ganhas | XP treinador | XP Pokémon |
|---|---|---:|---:|---:|---:|---:|
| 1 | 1 — Bosque Inicial | 10 | 21 | 8.039 | 4.164 | 5.833 |
| 2 | 2 — Colinas de Kanto | 15 | 31 | 8.772 | 5.593 | 6.260 |
| 3 | 3 — Caverna Rochosa | 19 | 40 | 10.654 | 7.070 | 8.257 |
| 4 | 3 — Caverna Rochosa | 19 | 41 | 203 | 203 | 203 |
| 5–40 | 3 — Caverna Rochosa | 19 | 41 | 0 | 0 | 0 |

**Após 40 resgates (320 horas simuladas):** total **27.668 moedas**, **5 Poké Balls**, **0 Great Ball**, **0 Ultra Ball** e Pokémon Lv41 / treinador Lv19. Não são 320h de progresso produtivo: a progressão pelo modo expedição para após a quarta coleta. Para entrar em R4, o treinador precisa de Lv20; nesse estado a jornada exige **batalhas com XP positivo**, não uma compensação artificial em idle. Isto é uma **dependência de design**, não travamento total do jogo.

## Regressão de Pokébolas de ciclo vazio — correção D064BK
A regra anterior verificava só `leaderFactor > 0`: em R3, um líder Lv41 recebia fator 0,1, mas `floor(9×0,1)=0` moedas, `floor(6×0,1)=0` XP treinador e `floor(7×0,1)=0` XP Pokémon. Mesmo assim os contadores das Pokébolas continuavam subindo em cada ciclo. Era possível receber **2 Poké Balls por resgate de 8h**, indefinidamente, sem gerar progresso do jogo. O core agora conta ciclos de bola apenas quando, após aplicar redução e arredondamento, o líder efetivamente recebe **moedas ou XP de treinador**. Isso mantém bolas de regiões adequadas, inclusive para Pokémon Lv100 em regiões altas com moedas/XP do treinador válidos; impede farm em ciclos economicamente zerados. O writer já persiste os contadores e drops atomicamente, sem mudança de esquema.

## Análise de sensibilidade para futura loja (NÃO é tabela de preços)
Saldo cumulativo hipotético após quatro resgates acima: **27.668 moedas**, sem compras/despesas. Simulando um preço unitário *não aprovado* de Poké Ball:

| Preço ilustrativo | Máximo comprável com todas as moedas |
|---:|---:|
| 250 | 110 |
| 500 | 55 |
| 1.000 | 27 |
| 2.000 | 13 |

Nenhuma dessas quantidades supõe gasto em itens, cura, TMs, pedras ou equipamentos. A referência do máximo teórico bruto por 8h vai de **20.160 moedas em R1** a **46.080 em R10** quando o fator não cai, mas o ganho real pode ser muito menor por evolução durante o ciclo; o preço da loja não deve se apoiar apenas no teto. Cenários ideais que ignoram desbloqueio do treinador produzem aceleração irreal, logo não servem para precificação.

## Gates / próximos passos
1. CI final: TypeScript, Vitest, Playwright desktop/mobile, teste de imagem Docker. Confirmar os números exatos no teste automatizado.
2. Revisar o primeiro encontro inicial: Lv1 exige evolução a Lv2 antes da expedição. Manter esta observação explícita até decisão sobre UX.
3. Simular jornadas combinadas com batalhas reais (vitórias, derrotas, encontros regionais, taxas de captura), múltiplos Pokémon, afinidade e custos de captura; só então decidir se a trava do treinador é adequada ou excessiva.
4. Definir fontes e gastos das moedas, preços e estoque das bolas via decisão de produto separada, com garantia de que a loja não dá XP/afinidade, nem Master Ball grátis.
5. Validar CI de HEAD, integrar PR com gate verde, conferir Railway SHA/deploy/healthcheck após merge. Nenhuma alteração em `isaquesan7/pokedex`. Auditoria manual NVDA/VoiceOver segue pendente.
