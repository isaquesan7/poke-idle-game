# D-064 — Proposta de design e balanceamento: Mapa de Regiões de Kanto

> **STATUS: AVALIAÇÃO — SEM IMPLEMENTAÇÃO DE GAMEPLAY, SEM PR PARA MERGE E SEM DEPLOY.**  
> Solicitante pediu explicitamente avaliação da ideia antes da publicação. Branch isolada contém somente este planejamento. Inventário e Economia D-054 continuam adiados.

## 1. Objetivo do jogador

Substituir na navegação o nome **Arena** por **Mapa**. Ao acessar a nova página, apresentar um mapa ilustrado ORIGINAL da região de Kanto, com percurso curvo entre pontos/regiões, indicadores de status (disponível, desbloqueado, bloqueado, concluído), faixa de níveis e informações concisas. A imagem enviada pelo usuário é **referência de composição**, não uma licença para replicar a arte. Manter o componente de batalha D-063, com animações HP/SP, diário linha a linha, cronômetro, resultado e recompensas, **dentro da região escolhida**, com botão `Voltar ao mapa`.

Visitar regiões liberadas permanece possível; a navegação por si só não altera o save.

## 2. Estado real auditado (20/11/2026)

| Área | Código e regra atuais | Implicação |
|---|---|---|
| Catálogo | `KANTO_POKEDEX` possui 151 espécies e base stats; `KANTO_BATTLE_SPECIES` possui os 151 combatentes. | É possível separar o catálogo em biomas sem nova PokéAPI em runtime. Movimentos padrão para muitas espécies continuam provisórios. |
| Encontros | `KANTO_WILD_POOL`: pool único de 54 espécies; `seed % 54`. | A lista mostrada na Arena hoje usa os 12 primeiros da pool, não um bioma. Deve ser **derivada da mesma configuração** que seleciona o inimigo. |
| Nível selvagem | `max(2,min(100,leader.level + ((seed>>>8)%5)-2))`. | Não há faixa regional; jogadores fortes podem encontrar nível 100 no primeiro cenário. |
| XP | `xpThreshold(trainer,L)=95+27L`, `xpThreshold(pokemon,L)=65+22L`. `grantXp` avança níveis até 100. | Curvas lineares por incremento e crescimento quadrático do XP acumulado. |
| Vitória | `25+3×wildLevel` moedas, `30+7×wildLevel` XP de treinador, `20+6×wildLevel` XP para o líder, afinidade 2–5. | Hoje o prêmio depende **somente do nível selvagem**, não da região nem da raridade. |
| Derrota/empate | Incrementa `losses`, sem prêmios. | Não há progressão via derrotas; teste de travamento entre regiões necessário. |
| Captura | 35% fixos após vitória, qualquer espécie atualmente na pool, duplicatas permitidas; exemplar nasce com nível selvagem e UID novo. | 35% para lendários seria excessivo se fossem adicionados diretamente à pool; rate específico exigiria decisão + validação antes de implementação. |
| Expedição | A cada 10 s: +7 moedas, +4 XP treinador, +5 XP por integrante. Até 8 horas por claim: 20.160 moedas, 11.520 XP treinador e 14.400 XP para cada Pokémon da expedição. | Regiões desbloqueadas só por nível poderiam ser puladas sem participar da jornada. Não modificar expedição nesta fase sem decisão explícita. |
| Início | Modo normal começa com treinador Nv. 1 e Pokémon Nv. 5; demonstração começa com treinador Nv. 21 e Pokémon Nv. 20. | Travar região 1 por nível do Pokémon bloquearia salvamentos novos? Não; com treinador Nv. 1 região 1 deve sempre estar aberta. |
| Insígnias | Atribuídas por vitórias totais (1/3/5/8/11/15/19/24), independentes de regiões. | Não confundir estrelas do mapa com as oito insígnias existentes. Regras das insígnias devem continuar intactas até aprovação. |
| Integridade | Resultado/bônus é processado pelo writer `playBattle` e pelo reducer `applyRewardEvent` atômico, com seed, UID e revision. | Região deve entrar no comando validado; não se pode confiar em regionId somente na UI nem em lista fictícia. |
| Histórico | `lastBattle` é persistido com frames; replay é read-only. | Incluir metadado opcional `regionId` para novos encontros e fallback explícito para combates antigos; não recalcular replay. |

### Verificação rápida da progressão

- Treinador Nv. 1→10: **2.070 XP** acumulados (sem considerar XP inicial). Apenas expedição já rende 1.440 XP/h; em ~1h26min de ciclos o jogador acumula XP suficiente para a condição de nível, sem combater.
- Treinador Nv. 1→20: **6.935 XP**; somente expedição rende isso em ~4h49min de ciclos.
- Treinador Nv. 90→100: **26.465 XP**. Sem diversidade e desafios, o fim da progressão pode se tornar repetição longa demais.
- Em vitória contra selvagem Nv. 10: 55 moedas, 100 XP treinador, 80 XP Pokémon. Contra Nv. 90: 295 moedas, 660 XP treinador, 560 XP Pokémon. Escala por nível é importante, mas não é suficiente para balancear frequência de vitória.
- A probabilidade 35% de captura após vitória implica aproximadamente 2,86 vitórias por captura em média; não é aceitável aplicar indiscriminadamente a Pokémon lendários.

## 3. Mapa proposto (10 áreas; amostras, NÃO pools aprovados)

| # | Região sugerida | Selvagens Nv. | Desbloqueio por nível do **Treinador** | Exemplos temáticos de encontro | Status |
|---|---|---|---|---|---|
| 1 | Bosque Inicial | 1–10* | 1 | Caterpie, Weedle, Pidgey, Rattata, Oddish | inicial |
| 2 | Colinas de Kanto | 11–20 | 10 | Spearow, Ekans, Nidoran♀/♂, Sandshrew, Vulpix | a confirmar |
| 3 | Caverna Rochosa | 21–30 | 20 | Zubat, Geodude, Diglett, Paras, Machop, Onix | a confirmar |
| 4 | Lagos Serenos | 31–40 | 30 | Poliwag, Psyduck, Slowpoke, Tentacool, Krabby | a confirmar |
| 5 | Planícies Elétricas | 41–50 | 40 | Pikachu, Magnemite, Voltorb, Electabuzz | a confirmar |
| 6 | Bosque Nebuloso | 51–60 | 50 | Gastly, Cubone, Koffing, Drowzee, Haunter | a confirmar |
| 7 | Costa Oceânica | 61–70 | 60 | Seel, Shellder, Staryu, Horsea, Goldeen | a confirmar |
| 8 | Reserva Selvagem | 71–80 | 70 | Rhyhorn, Tauros, Kangaskhan, Pinsir, Scyther | a confirmar |
| 9 | Pico Dracônico | 81–90 | 80 | Dratini, Dragonair, Aerodactyl, Dragonite* | a confirmar |
| 10 | Santuário Lendário | 91–100 | 90 | Articuno, Zapdos, Moltres, Mewtwo; Mew (mítico) | chefes/raridades a definir |

`*` **Políticas em aberto:** região 1 precisa permanecer jogável com Pokémon inicial Nv. 5; por padrão no início, gerar selvagens no intervalo entre Nv. 2 e 10, ponderando pela força do líder. Dragonite e lendários não devem virar comuns apenas por terem sido listados: taxas e modos de encontro ainda exigem aprovação.

**Escolhas de design:** localidades e níveis acima são uma proposta para o mundo do game, não geografia oficial nem taxas da franquia. Nomes, quantidade de áreas, composição e legendários podem ser alterados sem quebrar o catálogo de 151.

## 4. Desbloqueios: decisão recomendada

**Sugestão:** área 1 aberta sempre. Para entrar na área N+1: (1) nível do Treinador >= limite de área N+1, e (2) concluir um marco de progressão na área N (vitória especial ou número pequeno e explícito de vitórias regionais). A barreira de nível honra o pedido; a marca da área impede pular tudo com XP de expedições.

- **Região já desbloqueada permanece aberta** ao trocar líder, mudar equipe, evoluir, perder combate ou regressar à tela principal.
- Armazenar conclusão como estado persistente **aditivo** e validado, ou outra solução de progressão derivada comprovadamente segura. Não mexer no schema2/chave sem testes de migração.
- Só exigir nível do Treinador é alternativa mais simples que favorece idle; deve ser aprovada explicitamente caso seja preferida.
- Evitar requisito de Pokémon líder do nível mínimo: prejudica usar novos capturados e contradiz possibilidade de transitar em áreas antigas.

## 5. Encontros e níveis: invariantes necessários

1. Configuração **única e imutável** `REGIONS` compartilhada entre UI e domínio: `id,name,levelMin,levelMax,weightPool,unlock,visual`.
2. Sorteio determinístico pelo `seed` e `regionId`; resultados de espécie e nível **sempre na faixa anunciada**, e preferencialmente ponderados para o nível do líder dentro dessa faixa. Nos tiers iniciais, evitar inimigos Nv. 1 com motor atual que exige selvagem >=Nv. 2.
3. **A mesma pool** alimenta “Pokémon encontrados nesta região”, as raridades e o RNG de combate. Nenhum card meramente decorativo com espécie impossível de encontrar.
4. Classes raras e lendárias precisam de pesos e regras **configuradas, auditadas e testadas**; chance de captura não pode continuar 35% indiscriminadamente para lendários sem decisão.
5. O comando da batalha precisa validar região desbloqueada, espécies/níveis autorizados, ID, revisão e recompensas no domínio. Nenhum `regionId` de cliente pode conceder inimigo indevido.
6. Testar líderes abaixo e acima da faixa, os limites Lv. 1 e Lv. 100, troca de Pokémon após desbloqueio e carregamento de saves antigos.
7. O combate D-063 permanece idêntico quanto a animações, HP/SP, replay e transação, exceto pelo sorteio regional e mudanças de balanceamento explicitamente autorizadas.

## 6. Economia: riscos e política de lançamento

- **Não aumentar moedas/XP por região antes da simulação.** Usar fórmulas atuais na primeira rodada de protótipo, observando rendimento por hora/100 encontros e taxas reais de vitória por tiers, para identificar pontos de grind e spikes.
- A Expedição já gera 2.520 moedas e 1.440 XP de treinador por hora sem confronto. A proposta D064 deve explicitar se esse ritmo fica e exigir conquista regional para não saltar áreas.
- XP do líder: apenas quem batalha recebe XP (a expedição distribui para membros participantes); verificar efeito em equipes de 3 e necessidade de catch-up para capturados novos, sem alterar funcionalidade agora.
- Insígnias são baseadas em vitórias totais; não atribuir automaticamente insígnias por região enquanto não houver decisão.
- Boss lendário, prêmio e captura: sistema separado de encontro comum recomendado, com taxa/limite de tentativa ainda não definidos.
- Sem servidor antifraude a simulação permanece local; documentar essa limitação, não prometer segurança de economia competitiva.

## 7. Implementação proposta, isolada e testável

1. **D-064A — mapa navegável apenas em branch**: renomear label Arena→Mapa; tela inicial com SVG/CSS ou asset ilustrado original, caminho e 10 pontos com teclado/foco, filtros, modal de região, voltar ao mapa, bloqueios informativos; salvar só navegação local. Não fingir pools em produção.
2. **D-064B — domínio regional**: tipo/configuração do mapa, sorteio por região e ponderação de níveis, gating validado no reducer e metadado de replay; manter compatibilidade dos saves existentes.
3. **D-064C — balanceamento simulado**: cobertura de 1000+ seeds por região, starters e níveis-limite; medir vitória, XP/tempo, moedas e capturas, ajustar faixas/pesos apenas após aprovação. Legendaries separados.
4. **D-064D — revisão visual e publicação**: E2E desktop/mobile de mapa, bloqueio, reentrada, coesão lista=pool, encontros e resultados; TypeScript/Vitest, Docker, CI geral, PR reviewed, merge e Railway SHA + `/health`. **Não publicar sem o usuário validar o planejamento/balanceamento.**

## 8. Decisões abertas para aprovação

- Nível desbloqueio é **do Treinador** (recomendação), não do parceiro?
- Exigir **nível + marco na região anterior** (recomendação), ou somente nível?
- Aprovar 10 áreas de 10 níveis, incluindo design de lendários como chefes raros?
- Manter economia/XP/Expedição existentes na primeira versão, ajustando só após simulação?
- Lendários devem ter batalha de chefe com captura excepcional, não sorteio comum?

**Nenhum código de gameplay foi alterado. O mapa atual publicado (Arena) permanece operacional até haver aprovação e testes para a transição.**
