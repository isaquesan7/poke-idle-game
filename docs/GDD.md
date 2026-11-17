# Game Design Document — Poke Idle Game
**Season 1: Kanto | Estado:** regras de produto acordadas + protótipo experimental v0.1 | Atualizado: 2026-11-16.

Este documento diferencia explicitamente **acordado** (intenção confirmada pelo usuário), **implementado** (presente na v0.1) e **proposta** (ainda precisa de implementação/ajuste de balanceamento).

## Visão
RPG idle de coleção e progressão com os 151 Pokémon da região de Kanto (Pokédex Nacional 1 a 151). Dados-base de espécie, tipos e movimentos obtidos via PokéAPI. O jogador evolui treinador, Pokémon, habilidades, equipamentos, títulos, insígnias e afinidade. Projeto não oficial; sem autorização de exploração comercial da marca.

## Atributos
Seis atributos para treinador e Pokémon: `hp`, `attack`, `defense`, `specialAttack`, `specialDefense`, `speed`.
Os `base_stat` oficiais da PokéAPI não são modificados. Cada Pokémon capturado tem seu próprio UID, XP, pontos, afinidade e upgrades.
- **Implementado v0.1:** para HP, `floor(2*base*level/100)+level+10+2*allocatedHP`.
- **Implementado v0.1:** demais, `floor(2*base*level/100)+5+allocatedStat`.
- Crescimento próprio: +2 pontos de distribuição por nível no protótipo, atributo de treinador limitado a **40 investidos manualmente por atributo**; não confundir com o valor total.
- **Clarificação do comportamento v0.1:** Pokémon individuais também recebem 2 pontos manuais por nível adquirido (`(level-1)*2`), distribuídos por UID. A v0.1 NÃO aplica o teto de 40 por atributo do treinador ao Pokémon; só limita pelo orçamento total. Ação de redistribuição é gratuita no protótipo. Na equipe, 1–3 UIDs distintos e trocas bloqueadas durante expedição. Os reducers puros do core reproduzem essas regras, mas não salvam progresso.
- Nível máximo do protótipo: 100. Balanceamento final poderá ser revisado com testes.

## Atributos efetivos do treinador — ACORDADO
Para cada atributo `S`:
```text
treinadorTotal[S] =
  pontosManuais[S]                  // no máximo 40 para S
  + bonusEquipamentos[S]           // SEM teto 40
  + bonusTituloAtivo[S]            // um título ativo
  + somaBonusTodasInsignias[S]     // todas as insígnias conquistadas
```
Não limitar `treinadorTotal` a 40 e não reduzir bônus de itens acima do limite manual. Insígnias acumulam, NÃO são uma escolha de uma só insígnia ativa.

## Afinidade / transferência — ACORDADO
Afinidade pertence à **instância de Pokémon** (0–100). Ao evoluir, deve persistir.

```text
taxa = 0.08 + 0.02 * afinidade / 100
bonusPontos[S] = floor(treinadorTotal[S] * taxa)
pokemonFinal[S] = pokemonProprio[S] + bonusPontos[S]
```
A transferência é **ADIÇÃO DE PONTOS** ao atributo do Pokémon. NÃO aplicar 8–10% sobre o atributo do Pokémon e NÃO usar um limite de 8%–10% sobre a soma de equipamentos.
Exemplo por atributo: 40 pontos manuais +6 equipamentos +1 título +3 insígnias = 50; afinidade 0 => +4 pontos; afinidade 100 => +5 pontos. Um outro Pokémon do mesmo treinador pode ter afinidade diferente.
- **Implementado:** fórmula acima em `computedStats()`; afinidade sobe em vitórias e expedições.
- **Proposta:** curva específica de afinidade, interação/cuidado, limites antiabuso, não perder afinidade por inatividade (padrão inicial).

## Equipamentos, títulos e insígnias — ACORDADO
- Nove slots: chapéu, jaqueta, luvas, calça, sapatos, colar, anel 1, anel 2 e par de brincos.
- Cada equipamento poderá ter raridade e atributos; definir drop/raridade/catálogo em etapa FUTURA.
- Um título equipado por vez e seus atributos são adicionais.
- Insígnias conquistadas somam bônus PERMANENTES; não há insígnia ativa única.
- **Implementado v0.1:** dados de itens/títulos com atributos provisórios; 8 insígnias obtidas por vitórias na arena. **Futuro:** líderes de ginásio reais e respectivas conquistas.

## Batalhas
- **Implementado v0.1:** encontros selvagens, combate simplificado por turnos, uso de dano físico/especial, tipagem via PokéAPI quando disponível, STAB ×1,5, crítico ×1,5 (chance 6,25%), variação ×0,9–1,0, imunidades e efetividades, limitação a 30 turnos; participação do Pokémon ativo.
- **Planejado:** sistema automático completo, IA para escolher golpes, até 4 golpes equipados, equipe completa com substituições, efeitos de status e estratégia agressiva/equilibrada/defensiva. Não descrever esses recursos como concluídos.
- **Implementado:** um golpe ativo com pontos de melhoria e +5% poder/rank. **Proposto:** até rank 10 e 4 golpes; efeitos de suporte requerem lógica própria, não apenas 'power'.
- Fórmula simplificada de base de dano v0.1: `floor(((2*level/5 + 2)*power*(attack/defense))/50 + 2)`, seguida de STAB, críticos, tipo e variação. Ver função `hitDamage()` para comportamento exato.

## XP, equipe e idle — valores PROVISÓRIOS da v0.1
- XP necessário por nível do treinador: `95 + level*27`.
- XP necessário por nível de Pokémon: `65 + level*22`.
- Modo normal: treinador 1, Pokémon inicial 5; demo: treinador 21, Pokémon 20.
- Time até 3; combate atualmente usa integrante ativo.
- Uma expedição dura até 8h de recompensa acumulável por resgate: até 2880 ciclos de 10 segundos, 7 moedas +4 XP treinador +5 XP Pokémon por ciclo, afinidade aumenta conforme participação.
- Esses números são de laboratório e podem mudar após simulações de balanceamento.
- Persistência local apenas: navegador/localStorage, sem antifraude.
- Evolução de espécies e condições especiais não estão implementadas; quando forem, conservar pontos, nível, XP, afinidade e habilidades por instância.

## Roadmap alto nível
1. **v0.2 Foundation:** arquitetura modular, TypeScript, UI React, game-core e testes, paridade com v0.1.
2. **Progressão:** curvas definitivas XP/níveis, afinidade, treino e status.
3. **Combate:** habilidades múltiplas, efeitos e substituições; testes determinísticos.
4. **Economia e itens:** inventário, raridades, drops, upgrades e equipamentos definitivos.
5. **Ginásios e Kanto:** desafios, líderes e insígnias por progressão real.
6. **Backend:** autenticação, banco PostgreSQL, transações, combate validado, salvamento entre dispositivos.
7. **Season 2+:** apenas após Season 1 estabilizar.

## Modelagem de recompensas idempotentes — protótipo core (2026-11-17)
- **Paridade v0.1 em reducer puro, não jogabilidade ativa:** vitória na Arena: +`25+3*nívelSelvagem` moedas, +`30+7*nívelSelvagem` XP treinador, +`20+6*nívelSelvagem` XP do Pokémon ativo, afinidade +2–5, badges segundo vitórias, captura opcional vinculada à MESMA vitória, novo UID de `nextUid`. Derrota e empate por limite de turnos contam como 1 derrota e não concedem recursos. Probabilidade de captura da v0.1 é 35%, mas o novo reducer **não** faz rolagens e deve receber resultado legitimado futuramente.
- **Expedições:** `start` registra horário/snapshot do time; `claim` exige ciclo completo (10s) e calcula até 2880 ciclos (máx 8h por resgate); cursor `lastClaimAt` torna-se o horário explícito da operação, como a v0.1; `stop` faz último claim quando houver ciclo e encerra mesmo sem ciclo. Todos os valores são provisórios.
- **Proposta técnica para a v0.2:** recibos de eventos com ID+revision evitam replays no mesmo envelope em RAM, não constituem backend autoritativo, comprovante de vitória ou proteção entre abas independentes. Cutover real continua proibido.

## Paridade de golpes por UID — laboratório (2026-11-17)
Ações v0.1: trocar `moveName` não apaga ranks antigos; aprimorar o golpe equipado custa 1 ponto do orçamento `floor(level/5)`, exige poder base positivo e rank inferior a `min(10,floor(level/10)+1)`. O aumento do poder é +5% por rank. A função pura de v0.2 receberá lista de movimentos e poder do golpe de camada externa; esses valores não autorizam persistir progresso sem writer e validação confiáveis.

## Testes de não duplicação de recompensa — laboratório (2026-11-17)
Nenhum valor de XP, moedas, afinidade ou captura foi alterado. Uma simulação com autoridade ÚNICA em memória testa reenvio da mesma vitória ou claim: somente o primeiro evento altera save, enquanto replay com mesmo ID/payload retorna duplicado. A simulação NÃO verifica se a batalha foi vencida legitimamente, NÃO é ledger durável e NÃO executa recompensas na UI pública; backend de validação e combate determinístico permanecem planejados.

## Fase de jogo alfa v0.2: primeira jornada (decisão D-027 — 2026-11-17)
O projeto ainda **não possui jogadores reais**. A prioridade aprovada é publicar uma experiência utilizável antes do lançamento, não manter indefinidamente a v0.1 por compatibilidade hipotética.
- Nova rota `/play`, criação de treinador com nome de 2 a 24 caracteres, escolha inicial Bulbasaur/Charmander/Squirtle (normal treinador Lv.1, parceiro Lv.5; demonstração opcional treinador Lv.21, parceiro Lv.20).
- Páginas iniciais: visão geral, treinador (atributos/teto manual 40 e slots de equipamentos), Pokémon (2 pontos manuais por nível adquirido), expedição (10 s por ciclo; mesmas recompensas v0.1).
- Equipamentos disponíveis apenas como catálogo provisório de teste, **não** representam inventário/drop/loja definitiva. Sem combate v0.2, evolução, negociação ou multiplayer nesta fase. Batalhas e captura ficam para a próxima etapa jogável.
- Progresso ALFA local exclusivamente em `kanto-idle-play-v02`; reinicialização manual de dados de teste é permitida, sem importação ou escrita da chave `kanto-idle-lab-save-v01`. Enquanto não houver backend, relógio local/coin/XP podem ser alterados manualmente: não prometer antifraude.

## Arena automática da v0.2 alfa — D-029 (2026-11-17)
**Mecânica implementada em branch PR #32, ainda NÃO liberada até CI/merge/deploy:** combate por turnos automático entre Pokémon ativo e selvagem. O motor puro recebe dois combatentes com níveis, stats calculados, tipos, golpe e seed uint32; não usa Math.random, Date, PokéAPI nem estado global. Turnos até 30, ordem por prioridade/velocidade (empate por sorteio determinístico), precisão por golpe, dano `floor(((2*level/5+2)*power*attack/defense)/50+2)` seguido de STAB ×1,5, crítico chance 6,25% ×1,5, efetividade de tipos 0/0,25/0,5/1/2/4×, variação 90–100%; rank de golpe +5% por ponto. Simulação resulta em vitória, derrota ou empate, com captura 35% SOMENTE após vitória; afinidade +2–5 nas vitórias.
- Recompensa existente v0.1 é reaproveitada, na mesma revisão: `25+3*wildLevel` moedas, `30+7*wildLevel` XP treinador, `20+6*wildLevel` XP parceiro, todas as insígnias pelos patamares de vitórias, UID único após captura. Um evento registra recompensa e `lastBattle` (log/resultados) em UMA escrita do save local Alfa; derrotas/empates incrementam perdas.
- **Pool PILOTO** de 8 selvagens: Caterpie #10, Pidgey #16, Rattata #19, Pikachu #25, Vulpix #37, Oddish #43, Poliwag #60, Geodude #74. Iniciais Bulbasaur/Charmander/Squirtle. Snapshot de base stats/tipos/golpes; não afirmar que os 151 combates estão presentes.
- Comando de interface NÃO recebe/venda resultado ou espécie arbitrária, apenas seed sorteada com Crypto browser. Entretanto quem controla o navegador pode manipular a seed ou o save: **sem autenticação, backend, antifraude ou salvação em nuvem**. Não existe suporte a múltiplos golpes/efeitos/status, nem cura/item de batalha; combate automático resolve integralmente uma partida e persiste diário.

### Publicação da primeira Arena v0.2 (2026-11-17)
A PR #32 foi integrada à `main` SHA `6bf399ac` e publicada no Railway com healthcheck aprovado. A Arena automática está funcional para 8 encontros selvagens piloto e registra XP, moedas, afinidade, insígnias, vitórias/perdas, capturas por UID e diário no save de TESTE v0.2. A simulação determinística **não equivale a antifraude**: seed é gerada no cliente. Próxima prioridade de produto: coleção visível por UID, equipe de 1–3 e expansão do catálogo Kanto.

## Coleção e gerenciamento da equipe v0.2 (D-030, PR em revisão, 2026-11-17)
- **Identidade:** cada captura cria um UID próprio, incluindo duas capturas da mesma espécie com níveis, XP, afinidade, move e pontos individuais. O jogador pode visualizar os cards por UID, buscar por nome/ID/UID e filtrar equipe/reserva.
- **Equipe:** exatamente 1–3 integrantes distintos, primeiro UID é o líder/atacante da Arena; só um combate automaticamente por vez neste ciclo (os outros ainda não atacam). Escalar reserva adiciona ao fim; retirar integrante mantém os demais e nunca permite remover o último; selecionar novo líder traz um UID já escalado para o início mantendo ordem relativa do restante.
- **Expedições:** qualquer adicionar/remover/trocar líder é bloqueado durante expedição ativa (preserva snapshot do time); distribuição de pontos por UID continua permitida. Selecionar Pokémon para TREINO não troca o líder.
- **Stats:** painel de Pokémon permite escolher qualquer instância; mostra seus próprios pontos/afinidade e, quando há dados-base no catálogo local, stats finais com bônus **aditivo** do treinador. A Arena sempre utiliza `team[0]`. Os Pokémon sem dados-base confiáveis não ganham stats inventados.
- **Catálogo:** mantém piloto de 3 iniciais e 8 espécies selvagens até ampliar base verificável para os 151. Evolução, troca, múltiplos golpes e participação de todos os 3 em uma batalha seguem pendentes.
