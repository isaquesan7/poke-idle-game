# D064BS — Auditoria e proposta de Ginásios de Kanto (22/11/2026)

**Estado:** PROPOSTA para análise do responsável. **Nenhuma mudança de gameplay, economia, insígnias, salvamento ou UI está autorizada por este documento.** Projeto: `isaquesan7/poke-idle-game`; não modificar `isaquesan7/pokedex`.

## 1. Base confirmada e continuidade

A última fase funcional documentada é D064BR (PR #149, main `7054c379...`); o checkout na main deve ser revalidado antes de iniciar código. Economia beta atual: Poké Ball 600 moedas, Great Ball 2400, Ultra Ball 16000; vitória remunerada dá uma única rolagem por batalha (R1–3: 30% Poké; R4–6: 25% Poké/14% Great; R7–8: 18% Poké/14% Great/5% Ultra; R9–10: 18% Poké/14% Great/7% Ultra). Expedição: Poké a cada 4h elegíveis, Great R5+ a cada 8h, Ultra somente R9/R10 a cada 24h; não mudar sem decisão. Save local v0.2 schema2, revision/receipt/Web Locks cooperativos, **sem backend autoritativo**.

## 2. D064BS — escopo técnico e gates (a implementar em PR próprio)

1. Auditoria de indicadores somente com consentimento explícito e padrão desligado: totais agregados de vitórias, derrotas, resgates, XP, moedas ganhas/gastas, bolas sorteadas/usadas/compradas, erros de persistência por classe (quota, conflito, Web Locks indisponível). Nunca coletar nome/UID, save bruto, localStorage, seed, identificador único, saúde ou geolocalização. Definir retenção, exportação/exclusão e servidor antes de qualquer transmissão. Sem infraestrutura/consentimento, usar apenas diagnóstico local voluntário/exportável.
2. Simular jornadas com derrotas e capturas, fontes de moeda e sumidouros, 8h e 24h de expedição, múltiplos estágios, mochila cheia, ausência de Web Locks, duas abas e relógio manipulado. Não confundir teste hipotético com telemetria de jogador.
3. Definir plano futuro de backend autoritativo para comandos (batalha/compra/captura/expedição/ginásio), revision monotônica, idempotency keys, replay, atomicidade e progressão migrável. Não alegar antifraude com localStorage.
4. **Mudança solicitada agora:** XP de expedição deve ser creditado exclusivamente ao Pokémon líder na composição da equipe no instante do início da expedição (UID persistido no registro). Outros membros recebem zero XP. Treinador mantém regra própria de XP. Mudança do líder durante expedição deve ser bloqueada ou não alterar destinatário já fixado; nunca distribuir para todos. Exigir testes de 1/2/3 membros, líder removido/alterado, claim repetido, reload, cap100, XP treinador e save revision. Não mudar afinidade (expedição não dá) nem drops/ciclos/moedas.
5. Mudanças de regras ou escritor precisam de tests core+writer+Playwright 1440/390, CI, PR, Railway SUCCESS com commit exato, e docs GDD/DECISIONS/PROJECT_STATE/CHANGELOG. **Não foi executado neste PR de documentação.**

## 3. Ginásios — contrato de jogo proposto

- Oito líderes clássicos e insígnias correspondentes, ordem obrigatória Brock→Misty→Lt. Surge→Erika→Koga→Sabrina→Blaine→Giovanni. Apenas próximo ginásio invicto elegível. Líder derrotado permanentemente indisponível para novo desafio; galeria de conquista somente leitura.
- Batalha **3×3 sequencial**, três UIDs diferentes do jogador, três Pokémon treinados do líder, um ativo de cada lado por vez. Escolher e ordenar três antes do desafio; jogador escolhe quem inicia e pode trocar entre turnos com custo de ação (a definir nos testes) e após KO gratuitamente; o rival pode trocar estrategicamente com limites anti-spam. Vitória quando os três do rival caem, derrota quando os três do jogador caem, ou política explícita para empate/time-out. Durante a luta, elenco travado; HP/SP e estados precisam persistir no escopo do confronto. Nenhuma captura, Pokébola, consumível de loja ou recompensa de batalha regional neste modo.
- Recompensas únicas e indivisíveis após vitória confirmada: insígnia correspondente, XP do treinador, XP dos Pokémon participantes conforme participação, moedas e eventual título final. Nenhum prêmio por derrota, abandono, replay, refresh, double-click ou duas abas. Evento `gym-complete` no writer com gymId, roster UID snapshot, resultado autorizado, receipt/revision e marca imutável `defeatedGyms`; valida todo ginásio anterior, nunca aceita salto/fabricação via UI.
- **Remover a concessão atual de insígnias por contagem de vitórias nas regiões**, incluindo projeções, UI, writer e testes; preservar `regionWins` para suas funções próprias. Política de saves beta legados com insígnias pré-adquiridas exige decisão explícita de migração sem destruição automática.
- Insígnias seguem permanentes e cumulativas no treinador, somadas além dos 40 pontos manuais por atributo. A contribuição ao Pokémon continua `floor(trainerTotal*(0.08+0.02*affinity/100))`. Nenhuma escala percentual multiplicativa nova.
- Recomendação de entrada: equipe >=3 Pokémon vivos e não em expedição; **não bloquear por nível absoluto se um jogador provar habilidade**. Mostrar recomendado e avisos, não autoescalar Pokémon do líder ao nível do jogador.
- Evitar farming: cada líder só concede um receipt de vitória, sem rematch; ginásio NÃO é fonte recorrente de XP/afinidade/moedas.

## 4. Roster histórico vs adaptação 3×3

Referência FRLG (elencos históricos): https://pokemondb.net/firered-leafgreen/gymleaders-elitefour e https://serebii.net/fireredleafgreen/gyms.shtml. Quando o original tem 2 ou 4/5, **o terceiro ou a redução são adaptação do Poke Idle**, não canon.

| # | Líder / Insígnia | Original FRLG | Equipe 3×3 sugerida Poke Idle (níveis propostos) | Nível recomendado ao jogador |
|---|---|---|---|---|
| 1 | Brock / Rocha (Boulder) | Geodude12, Onix14 | Geodude 12, Sandshrew 13, Onix 15 | 12–16 |
| 2 | Misty / Cascata (Cascade) | Staryu18, Starmie21 | Psyduck 19, Staryu 20, Starmie 23 | 20–25 |
| 3 | Lt. Surge / Trovão (Thunder) | Voltorb21, Pikachu18, Raichu24 | Voltorb 27, Pikachu 28, Raichu 31 | 28–33 |
| 4 | Erika / Arco-Íris (Rainbow) | Victreebel29, Tangela24, Vileplume29 | Tangela 35, Victreebel 37, Vileplume 39 | 36–41 |
| 5 | Koga / Alma (Soul) | Koffing37×2, Muk39, Weezing43 | Koffing 46, Muk 48, Weezing 51 | 47–53 |
| 6 | Sabrina / Pântano (Marsh) | Kadabra38, Mr. Mime37, Venomoth38, Alakazam43 | Mr. Mime 56, Kadabra 58, Alakazam 61 | 57–63 |
| 7 | Blaine / Vulcão (Volcano) | Growlithe42, Ponyta40, Rapidash42, Arcanine47 | Ponyta 67, Rapidash 69, Arcanine 72 | 68–74 |
| 8 | Giovanni / Terra (Earth) | Rhyhorn45×2, Dugtrio42, Nidoqueen44, Nidoking45 | Dugtrio 78, Nidoqueen 81, Nidoking 84 | 80–86 |

Os níveis acima são **novos valores propostos**, não níveis originais. Objetivo: oito marcos ao longo do cap100, mantendo espaço para endgame/Elite Four futura. Verificar contra regiões/expedição e curvas reais antes da aprovação. Preferir o líder ter Pokémon distintos em vez de duplicatas, sem uso de espécie fora das 151.

## 5. Preparação do rival: atributos e IA

- Espécies usam base stats reais da PokéAPI; aplicar fórmula do jogo, pontos de treino por nível e um perfil fixo de alocação (sem cheating), quatro golpes equipados elegíveis por learnset e SP conforme regras publicadas. **Não conceder golpes/TMs desativados nem habilidades passivas inexistentes no motor**. Para movimentos emblemáticos FRLG que ainda não existem, implementar/validar catálogo antes de equipar, ou usar alternativa legal já disponível. Nenhum golpe de status simulado apenas visualmente.
- Perfil de treino proposto, para distribuir os pontos adquiridos legalmente: Brock 35% Defense, 30% HP, 20% Attack, 15% SpDefense; Misty 40% SpAttack, 25% Speed, 20% HP, 15% SpDefense; Surge 40% Speed, 35% SpAttack, 25% HP; Erika 30% SpAttack, 25% SpDefense, 25% HP, 20% Defense; Koga 40% Speed, 25% Defense, 20% HP, 15% SpAttack; Sabrina 45% SpAttack, 35% Speed, 20% HP; Blaine 40% SpAttack, 30% Speed, 20% HP, 10% Defense; Giovanni 40% Attack, 30% Defense, 20% HP, 10% Speed. Inteiros obtidos por largest-remainder e soma exata, sem burlar orçamento.
- IA escolhe ação por informação pública/estado do turno: STAB, eficácia de tipo/imunidade, dano esperado e risco de KO, prioridade/velocidade, SP restante, defesa do rival, chance de status/controle, cura tática e custo de troca; scorings determinísticos com seed, e desempate sem olhar resultados de RNG futuros ou escolhas secretas do jogador. Penalizar Concentrar sem necessidade e trocas repetidas; respeitar limite de curas/status do motor. Dificuldade cresce pelo elenco/treino/decisões, nunca por sorte manipulada.
- Matriz de testes com três iniciais, composições contrárias/favoráveis, equipes sob/na/sobre recomendação, estratégias stall, cura, imunidade, KO duplo, logout/reload e expedição ativa. Avaliar taxa de vitória por ginásio e tempo médio, não ajustar artificialmente por uma única simulação.

## 6. Insígnias e economia — proposta para aprovação

**Valores em pontos de atributo do TREINADOR, não percentuais.** Aplicam-se cumulativamente ao adquirir cada insígnia, sem ocupar slot:

| Insígnia | Bônus de treinador proposto | XP treinador (único) | Moedas (únicas) |
|---|---|---:|---:|
| Rocha | +4 Defense, +2 HP | 120 | 1.500 |
| Cascata | +4 SpAttack, +2 Speed | 240 | 3.000 |
| Trovão | +5 Speed, +3 SpAttack | 420 | 5.000 |
| Arco-Íris | +5 SpDefense, +4 HP | 700 | 8.000 |
| Alma | +6 Defense, +4 HP | 1.100 | 13.000 |
| Pântano | +7 SpAttack, +5 Speed | 1.700 | 22.000 |
| Vulcão | +8 Attack, +6 SpAttack | 2.500 | 35.000 |
| Terra | +10 HP, +8 Attack, +8 Defense, +8 SpDefense | 4.000 | 60.000 |

Soma dos bônus propostos após as oito insígnias: **+20 HP, +16 Attack, +18 Defense, +20 SpAttack, +13 SpDefense, +12 Speed** (99 pontos cumulativos). Confirmar no core e testar antes de publicar. Valores de XP/moedas são candidatos até cruzar com curva real do `game-core`; EXP do treinador por nível pode tornar as quantias acima pequenas ou grandes. XP de Pokémon dos ginásios deve vir de fórmula de combate proporcional a participação/cap, sem valores fixos adicionais até o benchmark.

**Título "Mestre de Ginásios" (proposta):** ativável só com 8 receipts válidos, um título ativo por vez, +12 em cada um dos seis atributos do treinador; efeito **não adicional se título desativado**. É exclusivo e permanente no inventário, sem multiplicadores de XP/moedas/captura e sem desbloquear Master Ball automaticamente. Comparar com títulos já existentes para não criar escolha trivial e inflação de status.

## 7. UX e fluxo

Nova aba `Ginásios`: trilha oito cards com cadeado/vencido/próximo; insígnia, líder, tipos, desafio e recompensa única. Seleção de 3 dos UIDs elegíveis, drag/drop + alternativa acessível por botões para ordenação; cards exibem level/HP/tipos/golpes e compatibilidades. Botão `Desafiar líder` exige confirmação de roster. Combate reaproveita BattleStage, mantendo animações e a regra de foco do fluxo regional onde aplicável, mas finaliza em tela de resultado/insígnia — não apresenta captura. Registrar claramente que ginásio vencido não pode ser revisitado. Não mostrar movimentos do rival que ele ainda não revelou, apenas espécies se a estratégia de design definir prévia.

## 8. Ordem de implementação, condicionada a aprovação

D064BS-A: XP expedição exclusivo ao líder + testes de writer e correções de UI/preview. D064BS-B: auditoria local/consentimento sem transmissão e plano backend, sem alterar odds. GYM-01: limpar origem antiga de insígnias (com política de legado aprovada), catálogo de 8 ginásios, fichas de três Pokémon e validações. GYM-02: motor combate de equipe 3×3, troca, status de três UIDs e IA sem vantagem oculta. GYM-03: writer transacional `gym-complete`, insígnias/XP/moeda/título, idempotência e bloqueio sequencial. GYM-04: UI responsiva acessível e testes E2E/benchmarks; publicação após gates e aceite.

### Pontos pendentes de aprovação
1. Escalonamento proposto de níveis 15→84 ou valores diferentes após auditoria.
2. Conjuntos adaptados a três Pokémon por líder e confirmação de catálogo de golpes.
3. Custos de troca, política de timeout/abandono e distribuição de XP para participantes.
4. Pontos/XP/moedas de cada insígnia e os +12×6 do título (avaliar balanço por simulações).
5. Política para insígnias em saves de teste obtidas por vitórias regionais antes da mudança.
