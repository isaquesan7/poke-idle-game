# D-064AW — auditoria regional antes de rebalancear a IA

**21/11/2026 — diagnóstico puro, branch em teste.**

## Contexto verificado
D064AV, PR #123, foi integrada à main SHA `579e87019cf7ed20f8f930e2616da2fe257c4ce6`, com CI completo e Railway SUCCESS no deployment `c3ea4a83-8db0-4d12-ba5d-aba2b00ed03c`. Em D064AV, o selvagem passou a equipar até 3 ataques e 1 suporte de nível FRLG, em vez de usar exclusivamente seu único golpe legado.

## Experimento reproducível
A regressão `packages/game-core/tests/d064aw-regional-wild-balance.test.ts` cobre **10 regiões × 2 pontos de nível por região × 2 condições de treino × 3 linhas evolutivas iniciais × 12 seeds**, ou **1.440 pares de encontros, 2.880 batalhas independentes**.

- Um par usa **mesmo encontro sorteado e seed inicial**, com os mesmos combatentes e atributos do jogador e do selvagem.
- **Baseline histórica**: selvagem somente com `enemy.move` da primeira versão.
- **Nova equipagem D064AV**: selvagem com `kantoWildMoveLoadout` oficial; sem treino próprio, rank, badges nem SP adicional. Esse é o percurso real do código de batalha regional.
- Jogador hipotético: linha inicial Bulbasaur, Charmander ou Squirtle, assumindo formas evoluídas por limiares simplificados (Nv16 e 36). Movimentos são calculados por espécies e nível com até 3 ofensivos recentes mais 1 suporte; stats sem treino ou moderados (+4 por atributo próprio, +8 de treinador e afinidade60), sem itens. **Não representa um save realmente adquirido**, nem uma progressão validada por writer.
- Regiões baixas: avaliar níveis próximos do mínimo e máximo regional, mantendo a mesma amostragem padronizada. O nível de acesso do treinador é pressuposto para os cenários avançados, sem conceder acesso no produto.
- Não é A/B real de usuários nem promessa de taxa 50/50. Após o primeiro ataque divergente, a sequência RNG muda; efeito do moveset não pode ser isolado como causalidade exata por usar apenas seed pareada.

## Métricas e critérios
Relatório JSON com marcador `D064AW_REGIONAL_BALANCE_REPORT` em log CI: win-rate antigo/novo por segmento, diferença em pontos percentuais, proporção de outcomes divergentes, mudança de loadout, turno médio, linhas de replay e duração **teórica** a 900 ms/linha, contagem de ações com SP do selvagem e frames ofensivos novos. Valida todas as espécies dos encontros, seus níveis, as fichas legais por learnset e integridade dos frames, sem alterar parâmetros de batalha.

A regressão falha somente por invariantes verificáveis (golpe ilegal, erro de seed, ausência completa de mudanças, 0 uso de ataques novos, resultado corrompido). **Não** impor win-rate ideal sem decisão do usuário: relatório deve fundamentar a próxima etapa.

## Continuidade
Ler resultados reais da execução CI, registrar destaques e regiões críticas nos arquivos de documentação numa PR posterior caso necessário, sem reescrever relatórios históricos. Prática seguinte D064AX: construir cenários de posse de equipe comprovada por writer, medir a dificuldade entre progressões reais de nível/XP, e verificar tempo do BattlePlayback em navegador desktop/mobile (pausa, 1× e 2×). Não alterar economia, drop, probabilidades, captura, regiões, lenços de campeão ou GIFs nesta etapa.
