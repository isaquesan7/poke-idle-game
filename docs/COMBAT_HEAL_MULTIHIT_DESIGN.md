# Cura e golpes de múltiplos acertos — desenho técnico pré-implementação (D-044)

**Estado em 18/11/2026: PLANEJADO.** Este documento **não habilita** Recover,
Soft-Boiled, Bullet Seed, Double Kick ou novos golpes no /play. A mecânica
jogável permanece a lista validada de 29 golpes com Concentrar e 4 slots por UID.
Nenhuma alteração na função `simulateKantoBattle`, nas probabilidades, nos
learnsets ou no writer será introduzida por este documento.

## Fontes e limites

- Metadados oficiais da PokéAPI em `GET /api/v2/move/{id}`: `pp`,
  `power` (pode ser **null**), `damage_class.name`, `accuracy`,
  `priority` e `meta.category.name`, `meta.healing`,
  `meta.min_hits`/`max_hits`; referência:
  https://pokeapi.co/docs/v2#moves
- Catálogo atual e learnsets Kanto usam o snapshot commit
  `PokeAPI/pokeapi@ac2f1acb055026e3dff1e0aca743bb46256a810a` e
  restrições FireRed/LeafGreen. Não consultar a API em tempo de combate.
- `kantoPreviewMoveSpCost` aceita metadata parcial sem equipar e estima
  **2,5 acertos para faixa 2..5** (heurística de custo D-039, não a distribuição
  probabilística dos jogos). A simulação futura precisa escolher uma
  distribuição explícita versionada; para a regra da Geração III as chances
  comuns de 2, 3, 4 e 5 acertos são 3/8, 3/8, 1/8 e 1/8, com expectativa
  de **2,75** acertos. Fonte de contexto:
  https://bulbapedia.bulbagarden.net/wiki/Multistrike_move .
  Não alterar silenciosamente o custo de SP já publicado só por este dado.

## Contrato planejado (não implementado)

1. **Catálogo confiável**: enumerar apenas golpes efetivamente aprendíveis por
   espécies/níveis de Kanto em FRLG, com nome, PP, categoria, mínimo/máximo de
   hits, porcentagem de cura, dano base, precisão, prioridade e fonte/version.
   Não inferir cura ou multi-hit somente de `power:null`. Dado ausente,
   `null`, malformado ou contraditório bloqueia equipar e gera teste.
2. **Cura de HP**: validar alvo/elegibilidade. Heal consome SP por **tentativa**
   elegível e cede todo o turno, sem ataque em paralelo, sem curar acima de HP
   máximo e sem SP negativo. Avaliar teto inicial de **1–2 usos por batalha**,
   HP abaixo de um limiar, cooldown e incompatibilidade com cura quando HP
   cheio; o turno máximo 30 garante limite absoluto mas não uma boa cadência.
   Recover com 5 PP tem **prévia 36 SP** no recorte atual, por escassez
   de PP + bônus +18. Esse valor não é custo oficial da PokéAPI nem aprovação
   para liberar o golpe. A IA só seleciona cura quando aumentar sobrevivência,
   não em loops infinitos; caso incapaz, ataque básico continua disponível.
3. **Múltiplos acertos**: única decisão de ação e custo SP uma vez, uma
   checagem de precisão conforme regra validada; número de hits selecionado
   pelo RNG seed do encontro, na ordem definida e congelada. Cada impacto
   calcula dano/critical/variance conforme a regra adotada, ajusta HP no mesmo
   momento, interrompe após HP0 e não gera hits fantasmas. Documentar
   decisões de efeitos por hit (status, drain, recoil), vulnerabilidades e
   compatibilidade com imunidade por tipo; não transplantar heurística 2.5
   do preview de custo para a seleção aleatória de hits.
4. **Trilha visual 1:1**: cada linha adicionada ao `log` produz exatamente
   um `frame` com HP/SP, ator, golpe, target e valores. Uma ação multi-hit
   pode adicionar múltiplas linhas/frames sem aumentar `turns` além do
   turno original. Cure usa `kind:'heal'`, `amount` positivo e
   `target:'player'|'wild'`. SP debitado **uma** vez; sobrescrever
   `spCost` em cada hit distorce estatísticas e deve ser evitado.
   Replays antigos (sem frames/SP) continuam só leitura, sem recalcular.
5. **Compatibilidade de saves**: versão schema2/chave
   `kanto-idle-play-v02` e `moveName` principal/matriz `moveNames`
   existentes devem permanecer legíveis. Evolução, troca do líder e
   capturas não podem sobrescrever um combate gravado. Não reexecutar
   combate a partir do playback. O recorte de golpes não foi ampliado.
6. **Balanceamento pré-beta**: comparar matriz normal de 1.920 duelos D-040
   com stress artificial de 384 duelos D-042 (88,8% chegaram a 30 turnos
   **somente** no ambiente fortificado). Medir após habilitação:
   duração média/p95, empates, HP residual, habilidades pagas, taxa de
   cura por confronto, fração de Focus, 30-turn cap, vitória por matchup,
   custo real multi-hit e efeito de buffs/debuffs. Nenhuma estatística
   artificial fundamenta aumento de duração no jogo normal.

## Gates de aceitação para uma PR futura de motor

- Testes de determinismo: mesma seed, catálogo e combatentes => mesmo log e
  mesmos frames (incluindo per-hit), independentemente do viewport e replay.
- Limites: zero HP negativo, zero cura acima do máximo, SP entre 0 e SPmax,
  Focus até 2 usos e cooldown 4, hits entre min/max e sem golpes após KO.
- Casos adversariais: precisão0/100, power null, acertos 2..5, fixo2,
  imunidade Ghost/Normal e burn/poison, cura HP cheio, sem SP,
  paralysed impedindo ação, crítico e hit fatal intermediário.
- Testes unitários para tabela de learnsets FRLG por espécie e nível,
  rejeição de golpe não aprendido/UID adulterado, custo preview vs real,
  e snapshots de economia de SP sem regressão nos 29 golpes atuais.
- E2E Arena desktop/mobile: apresentação ataque por ataque, cronômetro,
  pausa/2x/skip/replay; recibo de recompensa/captura **uma vez**, sem
  segundo write ao reassistir. Leitura assistiva não pode anunciar
  centenas de microeventos num único instante.
- Build, Vitest, Node legado, 151 GIFs e Docker runtime isolado devem passar
  antes de merge e healthcheck Railway SUCCESS no SHA exato.

**Próxima decisão necessária antes de implementar:** escolher o primeiro
subconjunto verificado de golpes e fechar a IA de cura (teto/cooldown),
a distribuição por geração e o protocolo de logs por hit; atualizar a
fonte fixa de dados com revisão pública. Nenhuma mecânica fica
disponível somente por existir uma prévia de custo.
