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
