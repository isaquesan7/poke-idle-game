# D-064AN — Golpes equipáveis, derrota e progressão no Pico Dracônico

**Data:** 21/11/2026. **Estado:** auditoria em branch; nenhuma alteração de runtime ou economia.

## Objetivo e regras
A D-064AM encontrou taxa média de vitória de 43,06% no Pico Dracônico em matriz com seis líderes. Esta etapa compara o golpe padrão com até três golpes adicionais realmente aprendidos pelo catálogo atual, respeitando quatro slots, o primeiro como principal e o mesmo motor de IA, sem inventar golpes. O catálogo de golpes FRLG ainda é incompleto e não contém TMs ativas.

## Matriz determinística
- Regiões 8, 9 e 10, Pico Dracônico como foco.
- Líderes: Venusaur #3, Charizard #6, Blastoise #9, Pikachu #25, Gengar #94, Gyarados #130, Starmie #121 e Dragonite #149. Posse/captura de cada um é hipótese, não demonstrada.
- Níveis de líder: 81, 90 e 100. Na batalha a região é desbloqueada por nível do treinador; ao contrário da expedição, não há requisito separado de nível mínimo do Pokémon. Assim, Nv81 na região 10 é cenário deliberado de subnível.
- Perfis: base sem pontos, moderado com 4 pontos próprios e contribuição de treinador de 8 por atributo, afinidade 60; sem equipamento, badge ou rank de golpe.
- Loadouts: default (golpe inicial do catálogo) vs learned (inicial e até três golpes de kantoLevelMoves/kantoSupportMoves elegíveis por nível, priorizados por poder/STAB para construir fixture, não um moveset ótimo).
- 32 seeds por cenário: 3 regiões × 3 níveis × 8 líderes × 2 perfis × 2 loadouts × 32 = 9.216 batalhas. Pares usam mesmos encontros e seed; movimentos podem divergir no consumo posterior de RNG.
- Selvagem por kantoRegionalEncounter, stats próprios sem treino, golpe atual da espécie.

## Medidas
Win/loss/draw, média e p95 de turnos/linhas do diário, estimativa de exibição a 900 ms por linha após a primeira, XP de treinador por tentativa (derrotas com XP zero), XP/h teórico a 20 tentativas/h e horas hipotéticas para somar XP Lv82→93. Não confundir com telemetria de jogadores, duração real, nem tempo garantido de progressão; não inclui expedições, novos Pokémon, capturas, estoques, escolhas ou pausas.

## Limites e continuidade
O perfil moderado não é um save validado do nível 1 até o fim. O acesso a Dragonite, Starmie e outros líderes depende de captura/evolução. Os learnsets são um recorte incompleto, lendários podem não aparecer nessas seeds. A simulação não altera chances, XP, drops, equilíbrio ou persistência. O BattlePlayback mede tempo de apresentação, não cálculo. Testar depois com perfis/saves completos, composição de equipe e Playwright desktop/mobile instrumentado.

## Gate de publicação e próxima etapa
Registrar resultados do CI do HEAD (TypeScript, Vitest, React, /play, /regions, Docker). Depois de sucesso, comparar Delta de vitória e XP/ tentativa por região e por build para decidir se é necessário propor ajuste separado. Próxima D-064AO: trajetórias de equipe e tempo de apresentação em dispositivos, sem alterar números antes de evidência.
