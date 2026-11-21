# D-064 — auditoria quantitativa do balanceamento regional

> **2026-11-20 | Análise experimental, não autorizada para produção.**
> Este documento registra os valores *atuais do código*, sem alterar regras, saves, UI, RNG ou economia. Fonte: `regionalEconomyDraft.ts`, `draftBallSupply.ts`, `kantoRegions.ts`.

## Premissas da projeção

- Treinador começa no nível 1 e Pokémon no nível 5, XP zero.
- Todas as batalhas são vencidas; não há derrotas, cura, tempo real, compras, expedições, revezamento de Pokémon, captura ou custos.
- Região escolhida é a mais alta já desbloqueada pelo nível do treinador.
- Nível do selvagem é `max(region.levelMin, min(region.levelMax, pokemon.level))` (aproximação já usada em `d064DraftSimulateWins`).
- Ganhos por vitória: moedas `5 + nivelSelvagem`, XP treinador `10 + ceil(1.5*nivelSelvagem)`, XP Pokémon `22 + ceil(3.5*nivelSelvagem)`.
- São limites **otimistas** de batalhas necessárias, não estimativas de duração nem garantia de progressão jogável.

## Marcos aproximados de desbloqueio

| Região | Desbloqueio de treinador | Vitórias otimistas acumuladas | Nível projetado do Pokémon |
| --- | ---: | ---: | ---: |
| 1 · Bosque Inicial | 1 | Inicial | 5 |
| 2 · Colinas de Kanto | 6 | 40 | 14 |
| 3 · Caverna Rochosa | 12 | 97 | 23 |
| 4 · Lagos Serenos | 20 | 193 | 35 |
| 5 · Planícies Elétricas | 30 | 354 | 51 |
| 6 · Bosque Nebuloso | 42 | 619 | 69 |
| 7 · Costa Oceânica | 55 | 1.005 | 88 |
| 8 · Reserva Selvagem | 69 | 1.546 | 100 |
| 9 · Pico Dracônico | 82 | 2.166 | 100 |
| 10 · Santuário Lendário | 93 | 2.773 | 100 |

A simulação otimista indica **descompasso importante**: o Pokémon pode alcançar nível 100 antes da abertura das regiões 9 e 10, enquanto o treinador ainda precisa de muitas vitórias. O teto de XP das Expedições é uma projeção separada e **não é aplicado às recompensas de batalha regional** nesta fase. Esta hipótese precisa de testes com derrotas, troca de equipe e ritmo de XP antes do lançamento.

## Raridade e abastecimento do rascunho

- Região 9: 7 espécies comuns peso 120 e 3 lendárias peso 1. Probabilidade agregada das três aves: `3 / 843 ≈ 0,356%` por encontro; cada espécie ≈ `1 / 843`.
- Região 10: 7 comuns peso 240 e 2 míticas/lendárias peso 1. Probabilidade agregada de Mew/Mewtwo: `2 / 1682 ≈ 0,119%` por encontro; cada espécie ≈ `1 / 1682`.
- Kit inicial **hipotético**: 12 Poké Balls. Região 1–6: +1 Poké Ball a cada 3 vitórias naquela região; região 4–10: +1 Great Ball a cada 7 vitórias; região 7–10: +1 Ultra Ball a cada 15 vitórias. O abastecimento depende de vitórias da região, não do total global.
- Como só as Ultra Balls podem capturar lendários no plano, haverá longos períodos de exploração até os raros aparecerem. A taxa de sucesso de captura, consumo de bolas, capacidade do bolso e derrotas não estão refletidos na estimativa de raridade acima.
- O RNG regional é derivado de `seed % somaPesos`. **No protótipo, a seed é fornecida pelo cliente**: isso permite escolher resultados. Mesmo que um candidato seja revalidado pelo motor local, não existe antifraude; não utilizar como economia autoritativa.

## Bloqueios de release / decisões pendentes

1. Validar a cadência real de batalha e derrotas; 2.773 vitórias otimistas não equivalem a tempo de jogo.
2. Decidir se o Pokémon deve atingir nível 100 antes do treinador chegar às últimas áreas; testar teto de batalha/expedição e progressão com equipe de 1–3 UIDs.
3. Simular probabilidade completa de captura (por espécie/bola, estoque consumido e drop) e garantir sustentabilidade do ciclo de Ultra Balls.
4. Definir autoridade dos encontros e da seed (hoje não há backend), bem como persistência real, backup, Web Locks e política para saves existentes.
5. Somente após consenso explícito do balanceamento e testes completos: habilitar write regional e planejar release. O repo `isaquesan7/pokedex` segue intocado.

**Status CI documentado:** PR #95, commit `a8d5f90273ab5cd1be074ec413e95c1e09035001`: workflows `44852547201` (regressão), `44852547212` (Playwright) e `44852547230` (Docker) concluídos em SUCCESS. Esta evidência não equivale a aprovação de balanceamento/publicação.
