# D-064AA — Matriz pareada de cenários regionais (pré-release)

**Escopo:** simulação determinística de 10.000 batalhas por cenário, com 50%, 75% ou 100% de vitórias hipotéticas, equipes com 1 ou 3 UIDs e política de captura `every-win` versus `rare-only`. Seed `20261120`. Não faz parte do gameplay nem grava saves.

## Metodologia e limites

- Core: `d064SimulateRegionalScenario`, fórmulas D064 de XP/coins, `kantoRegionalEncounter`, `d064DraftBallDrop`, `resolveKantoCaptureAttempt`.
- Vitória é sorteada com frequência fixa, não calculada a partir dos golpes/atributos/SP reais. O rodízio entre UIDs também é hipotético e não representa a seleção de líder do jogador.
- Encontro/vitória usam PRNG separado do potencial de captura, com uma amostra de captura **por batalha**, independentemente da estratégia. A mesma seed, tamanho de equipe e taxa de vitória geram os mesmos encontros e resultados de combate nos dois braços.
- Desconta-se uma bola em uma tentativa após vitória **antes** de aplicar os drops daquela vitória, seguindo a ordem do reducer regional. A fonte de Pokébolas é uma hipótese, sem mercado/compra.
- Não simula custo de cura, SP, tempo, expeditions, vantagem de tipos, arbitragem de RNG do cliente ou negociação entre jogadores; não é previsão de tempo real. Uma seed manipulável não pode ser autoridade de economia.

## Desbloqueios com a curva atual

| Taxa hipotética de vitória | UIDs alternados | Região 8 (batalhas) | Região 9 (batalhas) | Região 10 (batalhas) |
|---|---:|---:|---:|---:|
| 50% | 1 | 3.091 | 4.350 | 5.521 |
| 50% | 3 | 3.513 | 4.753 | 5.968 |
| 75% | 1 | 2.101 | 2.914 | 3.718 |
| 75% | 3 | 2.354 | 3.191 | 3.992 |
| 100% | 1 | 1.545 | 2.165 | 2.772 |
| 100% | 3 | 1.743 | 2.378 | 2.990 |

**Observação:** a taxa de vitória e as sementes são cenário, não taxa histórica de jogadores. Com 75% de vitórias, distribuir XP entre 3 UIDs elevou o acesso à região 10 em 274 batalhas (~7,4%) neste recorte. O treinador chega a 100 em até 10.000 batalhas nos seis cenários; todos os UIDs também podem atingir 100, mas o momento exato depende do rodízio.

## Capturas e estoque — pontos de auditoria

- O abastecimento proposto repõe 1 Poké Ball a cada 3 vitórias na região 1–6, 1 Great Ball a cada 7 vitórias na região 4–10 e 1 Ultra Ball a cada 15 vitórias na região 7–10.
- Captura `every-win`: tenta gastar uma bola após cada vitória. No recorte a oferta é inferior à demanda; oportunidades sem bola devem ser contadas, não transformadas em concessão gratuita.
- Captura `rare-only`: gasta somente Ultra Balls em vitórias contra lendários e míticos e guarda as demais; a economia acumula estoque quando não existem outras fontes de consumo.
- A raridade acumulada das regiões 9/10 é baixa, de modo que 10.000 batalhas ainda não garantem uma captura rara. Comparar múltiplas seeds antes de decidir o balanceamento final; uma única seed não estima variância estatística.
## Resultados de estoque na execução corrigida

Todos os valores abaixo vêm do Vitest `D064AA_MATRIX` da execução CI-only #99 no commit `78bdd9997da690d9335b3a7e1ef5876a9addfa91`, seed `20261120`. As políticas são comparadas com os **mesmos encontros, vitórias e oportunidades potenciais de captura**, mas resultados dependem da seed e não devem ser extrapolados como chances empíricas de jogadores.

| Vitórias | Time | Política | Vitórias obtidas | Raros encontrados | Tentativas raras | Capturas raras | Oportunidades sem bola | Estoque final Poké / Great / Ultra |
|---|---:|---|---:|---:|---:|---:|---:|---|
| 50% | 1 | every-win | 5.032 | 11 | 0 | 0 | 3.732 | 0 / 0 / 0 |
| 50% | 1 | rare-only | 5.032 | 11 | 5 | 2 | 0 | 345 / 688 / 262 |
| 50% | 3 | every-win | 5.032 | 10 | 0 | 0 | 3.694 | 0 / 0 / 0 |
| 50% | 3 | rare-only | 5.032 | 10 | 5 | 2 | 0 | 400 / 682 / 251 |
| 75% | 1 | every-win | 7.491 | 12 | 1 | 0 | 5.676 | 0 / 0 / 0 |
| 75% | 1 | rare-only | 7.491 | 12 | 11 | 4 | 0 | 344 / 1.040 / 420 |
| 75% | 3 | every-win | 7.491 | 10 | 1 | 1 | 5.638 | 0 / 0 / 0 |
| 75% | 3 | rare-only | 7.491 | 10 | 8 | 3 | 0 | 401 / 1.033 / 411 |
| 100% | 1 | every-win | 10.000 | 11 | 1 | 0 | 7.660 | 0 / 0 / 0 |
| 100% | 1 | rare-only | 10.000 | 11 | 11 | 4 | 0 | 345 / 1.397 / 587 |
| 100% | 3 | every-win | 10.000 | 11 | 1 | 0 | 7.621 | 0 / 0 / 0 |
| 100% | 3 | rare-only | 10.000 | 11 | 11 | 4 | 0 | 401 / 1.391 / 576 |

- O número de **raros encontrados** inclui batalhas perdidas, mas a captura só ocorre após vitória. O estoque de Ultra Ball só surge das regiões 7–10 e pode acabar com tentativas normais no modo `every-win`.
- Em `rare-only`, há acúmulo de centenas ou milhares de bolas comuns porque a estratégia deliberadamente **não as utiliza**. Isto não significa economia equilibrada para um jogador que queira completar a Pokédex comum.
- Quatro capturas raras em 11 tentativas numa única seed é uma amostra extremamente pequena e potencialmente atípica. **Não usar como estimativa de taxa de captura, viabilidade de lendários ou de tempo de jogo.** Precisamos simular muitas seeds e batalhas com vitórias calculadas do motor para calibrar probabilidades.
- O resultado do teste pareado garante que combate, áreas e encontros são idênticos entre as duas políticas para a mesma seed; o resultado de tentativa de captura também usa a mesma rolagem potencial por batalha.

### Evidência do CI final

- Regressão geral / Vitest / TypeScript / navegador: `44855362160` — **SUCCESS**
- Playwright isolado desktop/mobile: `44855362227` — **SUCCESS**
- Imagem Docker D-044: `44855362294` — **SUCCESS**
- Fonte de dados: saída `D064AA_MATRIX` do job `136696165643` da regressão geral, SHA `78bdd9997da690d9335b3a7e1ef5876a9addfa91`.
- PR #99 é CI-only, **NÃO MESCLAR**; PR #98 é rascunho experimental também sem liberação.


## Decisões pendentes

1. Determinar se o atraso de 7,4% de um time de 3 UIDs no acesso à última região é desejado; jogadores com equipes completas têm mais versatilidade, porém distribuem XP.
2. Definir política de captura: tentar sempre é economicamente insustentável sem loja/reposição adicional; guardar Ultra Balls garante estoque, mas reduz capturas normais.
3. Testar várias seeds, durações e taxas de vitória derivadas de `simulateKantoBattle` antes de fixar unlocks, raridade ou drops.
4. Exigir plano de persistência versionada, recuperação real e mecanismo de autoridade para seed/encontro antes de qualquer habilitação do writer regional.

**Release:** nenhuma integração ao save, `PlayAction`, UI, main ou Railway; todas as regras seguem experimentais.
