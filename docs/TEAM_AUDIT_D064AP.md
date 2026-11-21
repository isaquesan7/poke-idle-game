# D-064AP — auditoria determinística de opções de equipe nas regiões finais

**Data:** 21/11/2026. **Status:** teste diagnóstico proposto em branch, sem alteração funcional.

## Recorte executado pelo teste

- Regiões 8, 9 e 10; níveis de Pokémon 81/90/100; quatro espécies hipoteticamente disponíveis: Venusaur #3, Charizard #6, Blastoise #9 e Gengar #94.
- Dois perfis de treino: base sem investimento e moderado (4 pontos próprios e 8 do treinador por atributo, afinidade 60). **Não foram reconstruídos saves, capturas, pedras de evolução ou trajetória do nível 1.**
- 32 encontros fixos por estrato; 3 × 3 × 2 × 32 × 4 = **2.304 batalhas independentes**. Todas as espécies, golpes e metadados vêm exclusivamente do catálogo publicado no repositório; até 4 slots legalmente aprendíveis por nível; sem TM.
- O selvagem também usa seu conjunto de golpes liberados na simulação, cenário de pressão deliberadamente diferente da D064AN; **não comparar win-rates entre relatórios como A/B**.
- Em cada encontro: (1) líder fixo Venusaur; (2) líder rotacionado de forma pré-determinada pelo índice da amostra; (3) limite superior *oracle*, uma hipótese contrafactual em que um jogador já soubesse qual dos quatro ganharia o combate. O *oracle* **não é jogável nem representa troca automática de Pokémon**.
- Métricas: taxas de vitória por estratégia, XP de treinador por tentativa com derrota valendo zero, número de espécies selvagens na amostra, linhas de replay e duração **teórica** a 900 ms por linha. Nenhum tempo real de navegador é medido.
- A comparação acontece nas mesmas seeds e encontros, mas movimentos diferentes consomem RNG de modo diferente. A seleção de moves é heurística da fixture, não IA ótima de equipe.

## Segurança e interpretação

O teste valida que o teto oracle é maior ou igual a cada estratégia individual, sem assumir que uma rotação arbitrária supera um líder fixo. Isso separa três questões: a força dos novos golpes, a escolha de um líder antes da batalha e a acessibilidade de uma equipe realmente adquirível. Um aumento do teto oracle **não autoriza** alterar a batalha para permitir trocas, conceder espécies automaticamente ou reduzir a dificuldade regional.

Não houve mudança em combate, taxas, treinador, XP, expedição, Pokébolas, chance de lendário, writer, schema2, interface, assets ou repositório `isaquesan7/pokedex`.

## Gate e continuidade

O teste em `packages/game-core/tests/d064ap-team-audit.test.ts` imprime `D064AP_TEAM_AUDIT_REPORT` para leitura em CI. **Os resultados numéricos, CI, PR, merge e produção devem ser confirmados no HEAD real antes de registrar sucesso.**

Próxima D064AQ: construir trajetórias válidas de posse/evolução/treino com writer e recompensas reais, comparar alternativas de equipe sem oracle, e medir BattlePlayback em navegador desktop/mobile com relógio real e pausa/2×. Somente depois avaliar mudança de parâmetros econômicos ou desbloqueios.
