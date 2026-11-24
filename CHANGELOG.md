# D-056 — melhorias no Pokémon

## D-064BA — coortes de progressão dos três iniciais (21/11/2026)
- Diagnóstico de 36 perfis NORMAIS, 3.456 batalhas, comparando os 3 iniciais e seis sequências independentes com ou sem 8 expedições de 15 minutos de tempo simulado. Mede primeiro Nv2, Nv6 do treinador/desbloqueio R2, Nv16, evolução manual real com UID estável, vitórias e cadência por fase; progresso exclusivamente por writer.
- Não altera a IA, atributos, XP, regiões, recompensas ou animações. Relatório em `D064BA_STARTER_COHORT_REPORT`: sem expedições, Bulbasaur 37,50%, Charmander 50,35%, Squirtle 31,77%; com expedições, respectivamente 70,49%, 75,17%, 70,49%; 18/18 perfis com expedição evoluíram legalmente e abriram R2. Sem alterar stats/moves/XP/IA; detalhes em `docs/STARTER_PROGRESSION_COHORTS_D064BA.md`. CI/merge/deploy finais são gates antes de declarar publicação.


## D-064AZ — progresso inicial nível 1 sem bloqueio (21/11/2026; branch)
- Após auditoria encontrar 0/72 vitórias para Bulbasaur e Squirtle e 1/72 para Charmander, a regra de onboarding garante +22 XP apenas ao Pokémon Nv1 por derrota ou empate, via writer/replay, interrompendo no Nv2. Quatro não-vitórias bastam para Lv2 e expedição regional, sem moedas/afinidade/XP de treinador, e sem alterar o combate ou a IA. UI da primeira região explica.
- Nova auditoria `apps/web/tests/d064az-level1-writer-journey.test.ts`: 3 iniciais nível1, 72 encontros regionais por espécie (216 no total), XP/níveis/capturas e recibos reais do writer, desbloqueio de expedição no nível2 e guardrails para região e evolução prematuras.
- Documentação `docs/LEVEL1_PROGRESSION_D064AZ.md`. Somente testes e docs: não muda gameplay, IA, XP, raridades, captura ou saves. Relatório numérico em `D064AZ_LEVEL1_WRITER_REPORT` no CI: todos alcançaram Nv2 na tentativa 4 e liberaram expedição; Bulbasaur 15/72 vitórias, Charmander 35/72, Squirtle 17/72 nas jornadas determinísticas. Nenhum ajuste na IA ou nos stats dos iniciais.


## D-064AY — Pokémon inicial nível 1 (21/11/2026)
- Novo perfil normal: Bulbasaur, Charmander e Squirtle iniciam no **nível 1**, XP0, UID1. Treinador continua nível1. O modo demonstração (apenas testes) permanece Pokémon nível20 e treinador nível21.
- Somente novos perfis são afetados; saves existentes, XP/recompensas, regiões, IA, captura, raridades e TM09 não foram alterados. Testes cobrem os três iniciais, persistência e bloqueio de evolução prematura. CI/merge/Railway são gates antes da publicação.


## D-064AX — writers e tempo real do replay (21/11/2026; branch)
- Auditoria de evolução, pontos de treinamento e 12 batalhas regionais por inicial em save real com UID e recibos; cenário sem demo confirma bloqueio de evolução precoce e região9.
- Playwright Chromium desktop/mobile agora registra intervalos reais entre registros do replay em 1× e 2×, conferindo preservação do save e testes de pausa/GIF/HP/SP. Resultados em marcadores `D064AX_BROWSER_PLAYBACK` dos logs CI. Não altera gameplay, economia, chances ou UI. Documentação `docs/REAL_PROGRESSION_PLAYBACK_D064AX.md`.


## D-064AW — auditoria de equilíbrio regional da IA selvagem (21/11/2026; branch)
- Teste diagnóstico novo `d064aw-regional-wild-balance.test.ts`: 10 regiões, 2 níveis, 2 perfis de treinamento, 3 linhas de starters e 12 seeds = 1.440 pares de simulações da IA antiga (um golpe selvagem) versus IA D064AV (até quatro golpes legais), total 2.880 batalhas.
- Relatório determinístico em log CI com win-rates, uso de novos golpes/SP, duração média e métricas por região; documentação `docs/REGIONAL_BALANCE_D064AW.md`. Nenhuma alteração funcional, recompensas, captura, save ou GIFs. CI, merge e Railway pendentes.


## D-064AV — justiça da IA e golpes dos selvagens (21/11/2026; branch)
- Auditoria identificou selvagens com apenas um golpe padrão enquanto jogadores tinham até 4 slots. O novo `kantoWildMoveLoadout` equipa ofensivos e suportes que a mesma espécie pode aprender naquele nível FRLG (até 3 ofensivos recentes + 1 suporte). Fallback provisório somente quando não há ofensiva disponível.
- Mesmos SP, IA, precisão, prioridade e efeitos por impacto dos jogadores, sem rank/bônus ocultos nem TMs; testes determinísticos cobrem 151 espécies e uso real de Twineedle selvagem. A dificuldade pode aumentar; sem mudança de captura, XP, economia ou salvamentos. Documentação `docs/WILD_AI_FAIRNESS_D064AV.md`, CI/merge/deploy pendentes.


## D-064AU — Twineedle por impacto (21/11/2026; em validação)
- Beedrill aprende Twineedle no Nv20 FRLG: dois impactos de poder 25, PP20, chance de envenenamento 20% por impacto efetivo, com uma ação/precisão/custo SP e frames individuais. Imunidades e estado único do alvo preservados; sem efeito após KO.
- Whitelist multi-hit e SP atualizados; novos testes de UID/nível, seed, logs/frames, poison/Steel, payload adulterado e TM09 indisponível. Detalhes em `docs/TWINEEDLE_D064AU.md`. Sem mudar economia, XP, capturas, expedição ou save. CI/merge/Railway ainda pendentes.


## D-064AT — 11 ataques múltiplos FRLG (21/11/2026; BRANCH)
- Novos 2–5 hits de level-up: Double Slap, Comet Punch, Fury Attack, Pin Missile, Spike Cannon, Barrage, Fury Swipes, Bone Rush, Icicle Spear, Rock Blast; Bonemerang com 2 hits. Double Kick preservado.
- Sorteio determinístico de 2/3/4/5 impactos 37,5%/37,5%/12,5%/12,5%; precisão/SP uma vez, log/frame por impacto, encerra no KO. IA e SP calculam 3 hits esperados. Writer UID e anti-adulteração revisados, TM09/Bullet Seed e Twineedle continuam bloqueados. Sem impacto em XP/capturas/save/economia.
- Testes em `d064at-frlg-multi-hit.test.ts`, documentação `docs/MULTI_HIT_D064AT.md`. CI/merge/deploy pendentes.


## D-064AS — Night Shade com dano fixo (21/11/2026; branch)
- Catálogo FRLG nível/Gastly/Haunter/Gengar: Night Shade (PokeAPI power null) equipável via writer validado por UID, dano igual ao nível sem crítico/STAB/variação/resistências, preservando imunidade Ghost vs Normal; custo SP próprio e IA que reconhece a habilidade. Replay preserva log/frame de cada golpe.
- Novos testes de dano, níveis, SP, imunidade e determinismo; D064AO ajustado para nova elegibilidade. Nenhum ajuste de XP, economia, captura, expedição, save schema, TM09, GIFs. Detalhes docs/FIXED_DAMAGE_D064AS.md. CI/merge/deploy a verificar.


## D-064AR — sono e integração dos novos status (21/11/2026; BRANCH)
- Novos suportes Hypnosis, Sleep Powder e Spore aprendíveis apenas com registro FRLG verificado, custo SP, turnos de sono 1–3, log/frame de adormecer/acordar e proteção de save. Leer/Stun Spore/Glare da PR #118 reaplicados em branch a partir da main com auditoria D064AP integrada.
- Testes de aprendizado, slots UID, determinismo e regressão; o motor não concede XP/itens extras, não altera TM09, captura, animações, GIFs ou progresso. Detalhes em docs/SLEEP_MOVES_D064AR.md. CI/merge/deploy ainda pendentes.


## D-064AP — auditoria hipotética de equipe (21/11/2026; branch, NÃO PUBLICADA)
- Novo teste determinístico de 2.304 duelos nas regiões 8–10, com quatro possíveis líderes, golpes FRLG realmente liberados, 3 níveis e 2 treinos, para comparar líder fixo, rotação pré-definida e teto contrafactual (oracle). Reporta vitórias, XP/tentativa e duração de replay apenas teórica; não é telemetria nem prova de equipe adquirida.
- Nenhum ajuste de combate, economia, XP, captura, expedições, save, interface, GIFs, runtime ou Pokédex externa. Metodologia: docs/TEAM_AUDIT_D064AP.md. PR/CI/merge/deploy ainda pendentes; D064AQ deve validar trajetória com writer e playback browser real.


## D-056 — refinamento das telas Pokémon (19/11/2026, BRANCH, NÃO PUBLICADA)
- Perfil: informações/arte do Pokémon e Treinamento lado a lado no desktop, com empilhamento no mobile e tokens do root. Identidade, GIF, UID e afinidade preservados.
- Treino: novo PokemonTraining.tsx com prévia, desfazer, cancelar, confirmação e aviso por revisão stale, isolado por UID. Writer pokemon-invest-batch agrega múltiplos pontos em UM commit/revisão, revalidando todos pelo reducer core. Não modifica orçamento, limite, atributos, regras de combate ou save schema2.
- Evolução: nova frase 'Treine seu Pokémon para que ele possa evoluir.'; retirados kit de pedras e indicação de estoque da interface. Requisitos genuínos, condições e consumo de pedras continuam no writer.
- Golpes: removidas explicações técnicas internas, reorganizados em Golpes equipados (até quatro slots, vazios visíveis) e Golpes aprendidos (ataque/suporte), com ícones, cards, indicador de principal/equipado e botões de ação aprimorados. Writers e lógica de golpes preservados.
- Novo teste de domínio apps/web/src/play/pokemonBatch.test.ts e regressão Playwright com previews/undo/cancel sem save + confirmação em uma revisão, layout PC/mobile e alterações de texto. Escopo detalhado em docs/POKEMON_UI_D056.md.
- Itemização, raridades, crafting, drop, loja e D054 PR #78 seguem pendentes e separados; não alterar TM09, v0.1, save key/schema, GIFs, avatar nem isaquesan7/pokedex. Publicar somente após testes e autorização.

# D-055B — telas Pokémon separadas

## D-055B — separação visual da tela Pokémon (19/11/2026, PR #79 sem publicação)
- Menu interno agora é exclusivamente `Perfil | Evolução | Golpes` com botões/abas acessíveis, não âncoras; renderiza **somente a seção selecionada**, jamais os três painéis de uma vez. Perfil mostra GIF original/identidade/afinidade/atributos; Evolução mostra apenas requisitos e controles de evolução; Golpes apenas slots/PP/SP/ranks e treino de golpes.
- Navegação por essas telas não altera save/revisão. Menu principal Pokémon e abrir UID pela Coleção retornam à seção Perfil. Atualizados PlayApp.tsx e PlayApp.module.css com estilo de aba selecionada, painéis de largura total e regras mobile, sempre reutilizando tokens Kanto Dark.
- E2E Playwright reforçado: ausência de seções ocultas, captura das três telas desktop/mobile e preservação dos cenários existentes de evolução, reabertura por UID e treino de golpes. Mais detalhes em docs/POKEMON_UI_D055.md. Loja/drop/crafting, catálogo de itens e D054 PR #78 continuam PENDENTES e independentes.

# D-055 — visual da tela Pokémon (em revisão)

## D-055 — tela Pokémon, primeira passagem UI (19/11/2026, branch ainda não publicada)
- Nova tela do Pokémon em `apps/web/src/play/PlayApp.tsx`: hero com GIF original da espécie e efeitos de halo ciano/violeta, nível, UID, afinidade com medidor, papel líder/equipe/coleção; navegação interna entre Atributos, Evolução e Golpes. Painéis seguem todos os comandos e requisitos reais, sem alterar writer nem gameplay.
- CSS responsivo no `PlayApp.module.css` com SOMENTE os tokens `styles/tokens.css` definidos anteriormente e Font Awesome. GIF local `poke_<id>.gif` preservado (jamais modificar `isaquesan7/pokedex`).
- E2E captura `pokemon-profile-desktop.png` e `pokemon-profile-mobile.png`, confirma arte carregada, IDs de navegação e +1 DEF Pokémon gerando uma revisão como antes. Detalhes, limitações e gates: `docs/POKEMON_UI_D055.md`.
- **Pendências econômicas mantidas**: itens, raridades, drops e crafting sem decisão numérica; D054 PR #78 independente. Nunca inferir que o design do Pokémon altera regras de combate, save schema2 ou TM09.

# D-053 — interface e propriedade de inventário em preparação (2026-11-18)

## D-053 — bônus em hover, título estilizado, portal de modal e propriedade de itens (branch, ainda NÃO publicada)

- UI: `TitlePicker.tsx` substitui select nativo por lista acessível, estilizada com paleta root, opções bloqueadas com requisitos e bônus originais de `LEGACY_TITLES` visíveis em hover/foco, seleção ainda validada pelo writer existente. `LEGACY_BADGES` agora exibem bônus reais em hover/foco no perfil.
- Modal Equipamentos agora é portal React para `document.body`, acima da aplicação via token `--z-modal-overlay` no root; corrige controles cobrindo modal. Item `status==='Equipado'` ganha ícone `fa-circle-check` no canto superior direito do cubo, sem deixar nome/quantidade sempre visíveis.
- Teste E2E validando estilos e estados da lista, bônus de badge, overlay portal/z-index, equipar/remover real e marcador; segue abrangendo desktop/mobile, saves/revisões, GIFs e v0.1.
- Primeira fundação de **inventário real** em `packages/game-core/src/inventory/ownership.ts`, apenas lógica pura/de leitura: versões, IDs e quantidades válidos, capacidade inicial de 10, pilhas e proibição de equipar sem posse em ledger versionado. **Nenhuma migração, grant, expansão, mudança de save ou restrição ao catálogo legado aplicada**: sistema continua em modo laboratório até serem definidas as regras de aquisição. Design/regras pendentes: `docs/INVENTORY_OWNERSHIP_PLAN_D053.md`.
- Não alterar `isaquesan7/pokedex`, sistema de TM09, combate, chave/schema v0.2, avatar ou 151 GIFs. Exigir CI completo e screenshots desktop/mobile no HEAD da PR antes de merge/deploy.

# D-052 — Inventário visual em cubos (em branch)

## D-052 — Mochila e Equipamentos em cubos (18/11/2026, branch, NÃO PUBLICADA)

- Nova grade **reutilizável** em `InventoryGrid.tsx` e CSS Module: cubos com estados cheio/vazio, destaque ciano, tooltip com **nome, quantidade, descrição** somente em hover/foco/toque, painel de ocupação e navegação por teclado; todos os efeitos usam tokens existentes de `styles/tokens.css`. `InventoryDialog` abre detalhes compactos com fechar/cancelar, Escape, clique no fundo e foco retido/devolvido.
- Mochila com **10 espaços iniciais de exibição**, contador `ocupados / 10` e espaços vazios visíveis, 1 pilha de item=1 espaço. Apenas `evolutionStones` já persistidos são projetados como itens; nenhum item de cura/Pokébola/TM foi concedido. Caso haja mais de 10 tipos persistidos, exibir TODOS e aviso sem descartar itens.
- Capacidade 10 **ainda é apresentação**, não limitação de recebimento, pois o inventário/economia real não têm writer e schema de capacidade. O item de expansão será criado em etapa independente, com regra versionada e validação do lado do domínio.
- Equipamentos em cubos compartilham o mesmo estilo; filtro `Todos/Equipados`, tooltip com atributos e estado, clique abre modal **Equipar/Remover/Cancelar**. Ação reutiliza o escritor já existente `trainer.equip` (revisão, slot e validação existentes). Nenhum outro efeito de jogo introduzido.
- **Importante limitação da fase atual:** o jogo ainda não armazena equipamentos adquiridos. Portanto o grid de equipamentos é explicitamente identificado como **catálogo do laboratório**, preservando as seleções disponíveis antes; ele **não afirma que os 14 equipamentos foram conquistados**. Uma etapa futura deve criar inventário real de propriedade, grants e validação de equipe possuída antes de liberá-lo como inventário autêntico.
- Teste E2E verifica 10 espaços vazios iniciais na Mochila, modal de Boné de Kanto e Cancelar sem alterar revisão, além da jornada anterior. O tooltip não expõe quantidade ou descrição no cubo; apenas na interação.
- Não alterar save schema/key, economia, TMs, combate, 151 GIFs, avatar, repositório `isaquesan7/pokedex` ou rota legada `/`. Gates: CI completo no HEAD final, revisão de telas desktop/mobile; PR independente, sem merge/deploy até validação.


## D-051.1 — títulos selecionáveis, Font Awesome e acabamento luminoso (18/11/2026, PR #75 ainda aberta)
- Títulos na seção Perfil agora podem ser **selecionados pelo jogador** através de um `select`, com opções indisponíveis marcadas e requisitos informados. Mesmas regras legadas: `aprendiz` livre, `veterano` após 4 vitórias, `explorador` após 10 vistos, `mestre` após 8 insígnias. A função `legacyTitleIsUnlocked` foi centralizada no catálogo e usada tanto pela UI quanto pelo writer `trainer`, sem confiar na seleção enviada pelo cliente.
- Novo comando de domínio `TrainerDraftAction {type:'title', titleId}` usa `editLegacyTrainerJson`, `validLegacyTrainerDraft` e a gravação versionada atual. Apenas `trainer.title` pode mudar, com pré-condições atuais e revisão igual; não concede XP, moedas, capturas nem insígnias. Projeção existente passa a refletir o bônus correto do título selecionado.
- Ícones do `TrainerScreen` adotaram **Font Awesome Free 6.7.2**: CSS com URL versionada em `apps/web/index.html`, classes `fa-solid` decorativas e nomes textuais acessíveis. Sem JavaScript remoto; **observação:** webfont precisa da CDN; futura melhoria pode empacotar asset local para offline.
- Reforço da referência visual enviada: iluminação ciano/violeta, halo e grade ao redor da arte original do treinador, bordas e sombras dos cards, reflexo nos botões e paleta inteiramente centrada em tokens novos `--trainer-*` no `styles/tokens.css`. A imagem PNG original **não foi alterada**.
- Testes Vitest do catálogo/draft/writer cobrem bloqueio, troca habilitada, segurança contra recompensa forjada e revisão obsoleta; E2E cobre seletor e classes Font Awesome.
- Não modificar `isaquesan7/pokedex`, nem alterar TMs, combate, inventário, economia, save schema2, chave v0.2, rota `/` ou GIFs. Exigir CI completo e revisão visual PC/mobile antes de merge e Railway; esta nota não é prova de publicação.

# D-051 — polimento da tela do treinador (18/11/2026, em branch)

## D-051 — primeira rodada de polimento do Treinador (branch, ainda não publicada)

- Continuidade visual da D050: reduz sombra excessiva dos painéis, melhora hierarquia tipográfica, distribuição entre colunas, espaçamento e contraste usando **apenas tokens existentes** em `styles/tokens.css` (sem introduzir hex ou paleta paralela).
- Arte `/assets/trainer-original.png` permanece **idêntica**: imagem maior/centralizada, halo e base sutis. Os nove equipamentos ficam simétricos nas laterais; tooltip não é mais cortado por `overflow:hidden` e pode ser revelado no hover/foco/toque. Usamos botão com nome acessível no lugar de `div tabIndex`.
- Barras de atributos distinguem valor salvo (verde) e **aumento ainda não confirmado** (ciano); cada ponto de prévia pode ser desfeito individualmente com botão `−`, além de Cancelar global. Save só muda ao clicar em Confirmar; recibos, revisão e writer continuam os da D050.
- Título ativo recebe cartão de destaque compacto dentro do perfil; contagem de equipamentos equipados visível na aba correspondente e aba Mochila com rótulo de estoque real. Insígnias mantêm seus IDs e bônus de catálogo.
- Ajustes para 1200/700/430px, teclado e telas pequenas. E2E desktop/mobile amplia cobertura: PNG carregado, tooltip por foco, adicionar/remover ponto sem gravar, cancelar e confirmar em revisão única.
- Não foram alterados GIFs, catálogo de TM, combate, economia, save schema/chave, dados de jogador, nem o repositório `isaquesan7/pokedex`.
- **Gate:** abrir PR, validar CI completo (Node, Vitest/TypeScript, E2E, Docker), revisar a captura do navegador e só depois decidir merge/produção. D049B continua em PR separada.

## D-050 — tela do Treinador, prévia segura e Mochila (BRANCH, NÃO PUBLICADA; 18/11/2026)
- Layout Perfil/Equipamentos/Mochila, títulos e insígnias diretamente no perfil, equipamentos com bônus em hover/foco, responsivo usando root tokens oficiais.
- Prévia de distribuição sem salvar; confirmar aplica todos os pontos validados em uma revisão do writer, com rollback completo. Removida mensagem genérica de sucesso do treinador e Pokémon.
- Chip /health verifica status real antes de mostrar Servidor Online. Mochila não inventa consumíveis ou itens que não existem.
- **Pendente antes da publicação visual:** transferir arte original anexada do jogador para `apps/web/public/assets/trainer-original.png` (PNG binário), para que Vite a inclua no dist e Docker; fallback acessível temporário. Não dizer que a imagem está publicada.
- Preservados combate, economia/TMs, save schema2/chave, v0.1, 151 GIFs, repositório pokedex; detalhes em `docs/TRAINER_UI_D050.md`.

## [v0.2-alpha — D-049 preparação de compatibilidade TM09] — 2026-11-18 (BRANCH, NÃO PUBLICADA)
- Adicionado extrator offline `scripts/extract-tm09-compatibility.mjs` que verifica hash Git do snapshot PokéAPI pinado antes de extrair a compatibilidade TM09 de `pokemon_moves.csv`, limitada a Kanto 1..151, grupo7, método4, golpe331. Produz JSON somente em caminho novo, não altera dados de jogo.
- Adicionados testes Node sintéticos de hash, filtro estrito e falhas fechadas (CSV malformado, duplicado, vazio, checksum incompatível). CSV original grande ainda precisa ser obtido/verificado; **não há allowlist positiva real, item, consumo, teach ou novo golpe liberado**.
- Planejamento detalhado em `docs/TM_WRITER_PLAN_D049.md`: origem fechada de compatibilidade, opções de aquisição, contrato idempotente com slot/UID/revisão e gates D049-B/C/D antes da liberação; nenhuma economia foi ativada.
- Correção de parsing antes de publicar: coluna `order` vazia é válida em linhas de máquina do CSV; testes positivos de `level=0,order=''` e negativo para valor textual de `order`. Não confundir ausência de `order` com coluna ausente.
- Código de combate, inventário, writer, saves/replays, UI, animações, GIFs e produção preservados; validação CI/merge/deploy ainda pendente.

## [v0.2-alpha — D-048 política de geração e preview TM09 sem desbloqueio] — 2026-11-18 (PUBLICADA PR #69)
- **Decisão:** preservar o catálogo de movimentos jogáveis (metadados PokéAPI atuais, SP original), mas usar metadados históricos GenIII explicitamente para futuras TMs do recorte FRLG; evitar mistura silenciosa de poder25 Físico moderno com poder10 Especial da TM09.
- Novo `catalog/kantoTmPreview.ts` e exports read-only: TM09 grupo7/método machine4/item313/Bullet Seed Move331 do snapshot fixo, ficha histórica Grass/Especial/power10/PP30/acc100, pesos 2–5 =3/8,3/8,1/8,1/8, todos **NÃO executáveis**; gate de ensino falso nas 151 espécies até compatibilidade verificada e inventário/writer TM implementados.
- **ERRATA importante:** esperança matemática GenIII dessa distribuição é **3,0 impactos** (não 2,75 declarado nas docs D044–D047). Corrigidas referências antigas, com teste de 8.000 rolls (3.000/3.000/1.000/1.000). Prévia SP moderna 2,5 impactos não muda e não autoriza TM.
- Testes `kanto-d048-tm-version-policy.test.ts` verificam IDs/sha, política, imutabilidade, probabilidade e erros, recusa de ensino e integridade de coins/UID/pedras/save. Nenhuma funcionalidade de ensino, drop ou consumo de TM foi implementada. Bullet Seed continua BLOQUEADO.
- Sem mudanças na simulação de combate, IA, Focus, dano de Recover/Double Kick, writer de nível, save v0.2 schema2, / v0.1, /play, CSS/animações FULL, GIFs 151, Docker, ou `isaquesan7/pokedex`. Referência de política em `docs/TM_VERSION_POLICY_D048.md`. **Release confirmada:** PR #69 MERGED main `0c05087f87b31eef33dacf6759901d46f271dd4f`, CI `44375419460 SUCCESS` geral e `44375419484 SUCCESS` Docker, Railway `197a7a69-1089-4749-92f9-2b8f51223136 SUCCESS` SHA exato com build Vite Docker e /health interno. GET público externo /play não verificado diretamente.

## [v0.2-alpha — D-047 estratificação Fighting, Recover crítico e TM versionada] — 2026-11-18 (PUBLICADA PR #67)
- **Double Kick** analisado por tipo em 1.152 pares (2.304 lutas) com 6 formas Nidoran, 3 níveis, 8 rivais e 8 seeds: ×2 vitória 61,81→86,81% (+25p.p.), ×1 62,50→79,86% (+17,36p.p.), ×0.5/×0.25/×0 IA não escolheu Double Kick, resultados iguais dos duelos-base. Ainda não são dados reais de jogadores e não justificam nerf.
- Comparação **sintética e NÃO equipável** de dois golpes 30 vs um golpe Fighting60 usando `kantoDamage`: ×2 dano médio 54,06 vs 51,31, ×1 28,22 vs26,81, conforme arredondamentos independentes. Não altera preço SP, catálogo, ações ou UI.
- Recover em fixture com HP crítico e SP>=36 cura no máximo1 vez, sem SP suficiente não cura mesmo HP baixo, HP alto também não cura. Fixture Staryu com Mega Kick é APENAS teste (não aprendido por espécie).
- Barreira negativa de TM09: prévia SP moderna Bullet Seed não desbloqueia golpe via `reducePokemonMoveSlotsJson`; docs `BALANCE_D047.md`/`TM_SYSTEM_DESIGN_D047.md` planejam versão histórica GenIII vs moderna, método TM, compatibilidade, inventário e escrita atômica/idempotente. **Bullet Seed segue BLOQUEADO**.
- Nenhuma mudança no motor, IA, RNG, SP/PP, recompensas, writer, `kanto-idle-play-v02` schema2, / legado, CSS, GIFs ou Docker; `isaquesan7/pokedex` intocado. **Release confirmada:** PR #67 MERGED `main` SHA `fca91202bc391bc2ebd4abe31183fbefed53a2a8`, GitHub CI final `44363512579 SUCCESS` (core/web/v0.1/React/GIFs/Chromium desktop+mobile) e Docker `44363512763 SUCCESS`, Railway Docker deployment `2172dd7f-50e5-4fe0-bda2-0517b22e53f3 SUCCESS` SHA exato, Node porta8080 e /health interno succeeded. GET externo público /play não verificado diretamente; E2E /play local e Docker CI passaram.

## [v0.2-alpha — D-046 auditoria pareada de Recover e Double Kick] — 2026-11-18 (PUBLICADA PR #65)
- Acrescentada suíte Vitest diagnóstica `kanto-d046-ability-balance.test.ts`: **4.608 pares / 9.216 duelos** com seed/nível/matchup iguais entre controle e habilidade nova (2 espécies de Recover + 6 Double Kick, níveis15/30/60, 8 rivais/8 seeds). Modos normal, fortified e pressure — os dois últimos artificialmente reforçam stats só nos testes. Verifica HP/SP, custo por ação, evento de cura e impactos 1:1 e determinismo.
- `D046_BALANCE_REPORT` no log: normal Recover vitórias 63,54→65,36% (+1,82p.p., 96 curas); Double Kick 56,25→75,87% (+19,62p.p., 1.856 ações). Em fortified Recover não foi usado; em pressure Double Kick praticamente não mudou vitórias. Total 150 curas/15.960 eventos de Double Kick/1.137 críticos nas 9.216 simulações. São FIXTURES, não telemetria de usuários: **sem nerf ou buff automático**.
- A primeira CI `44355944329` falhou pelo Vitest default 5s após gerar os dados em ~22s. Corrigido `it(...,60000)`; CI do código `44356247481 SUCCESS` (18 arquivos Vitest core +11 web, build, Node legado/GIFs/Chromium desktop/mobile) e Docker `44356247562 SUCCESS`; CI final com docs, PR/merge/Railway ainda não concluídos.
- Em `docs/BALANCE_D046.md` registrada divergência histórica: Bullet Seed em FRLG é TM09/Especial/poder10 por hit, mas dados modernos são Físico/poder25; GenIII 2–5 hits média3,0 vs prévia D039 2,5 para SP. **Bullet Seed/Soft-Boiled continuam NÃO disponíveis.**
- Nenhuma alteração de `simulateKantoBattle`, IA/catálogos, PP/SP, escritor/replay, localStorage schema2, / v0.1, GIFs, CSS, Docker ou repo `isaquesan7/pokedex`.
- **Entrega verificada:** PR #65 MERGED na main `db1fe0601275d2840a7355e26f97433fc2589e0c`; CI final `44357355587 SUCCESS` (inclui browser /play PC/celular) e `44357355602 SUCCESS` (Docker mínimo), Railway Docker deployment `81d23805-40ba-4eb6-a4ab-281946a483c0 SUCCESS` no SHA exato com /health interno aprovado. Teste D046 rodou 9.216 simulações em ~18,5s (limite60s isolado). Nenhum GET público externo /play verificado manualmente; próximo D047 analisar +19,62p.p. em amostras pareadas por tipo antes de alterar valores.

## [v0.2-alpha — D-045 Recover e Double Kick] — 2026-11-18 (PUBLICADA PR #63)
- **Recover** habilitado para Staryu Nv15/Starmie Nv1: autocura de 50% HP máximo com teto, IA somente quando HP<=50%, até turno26, 1 vez por encontro, custo único 36 SP. Frame `heal` e SP/HP sincronizados; contra Ghost funciona por mirar o próprio Pokémon.
- **Double Kick** habilitado por nível para Nidoran♀/♂, Nidorina/Nidorino e evoluções por pedra. Física/Fighting, 2 impactos fixos de poder30, 1 precisão por ação, crítico/variação por impacto, 18 SP por ação; segundo frame tem custo0 e `hitIndex/hitTotal`; interrupção em KO/imunidade.
- Fonte dados recorte FRLG e PP do snapshot PokeAPI, writer de 1–4 slots/UID continua validando nível e espécie. O PP de Recover no snapshot atual (5) difere do histórico GenIII (20), e SP continua sistema original. **Bullet Seed e Soft-Boiled NÃO habilitados**.
- UI mostra cura e 2 impactos; novos 7 testes Vitest de catálogo/limites/seed/receipts e E2E /play desktop/mobile equipando golpes pelo UI e reassistindo sem novos prêmios. `/` v0.1, save v0.2 schema2, logs antigos, GIFs e Docker isolado preservados.
- CI inicial D-045 encontrou quebra de linha literal `\\n` em TypeScript; corrigida. **Release confirmada:** PR #63 MERGED `main` SHA `974deae211e14005acedad8938f200180803f5c1`, CI final Docker `44352492345 SUCCESS`, geral `44352492250 SUCCESS`, Playwright container `44352492311 SUCCESS`. Railway Docker `ceae48ce-27cf-43c4-a247-15212f7fd99f SUCCESS` no SHA exato, build Vite no stage BUILDER e Node porta8080 com /health interno aprovado. GET público externo não testado; E2E /play e Docker HTTP internos passaram.

## [v0.2-alpha — D-044 isolamento de build/runtime e desenho de cura/multi-hit] — 2026-11-18 (PUBLICADA PR #61)
- Removido `npm prestart` que recompilava React cada vez que Railway iniciava o servidor. `npm run build:web` agora acontece em estágio de **build** do Dockerfile, enquanto a imagem final executa `node server.mjs` / `npm start` com somente arquivos públicos, sem `node_modules`, Vitest, Vite, lockfile ou fontes TS, como usuário sem privilégios `node`.
- `/health` da aplicação é readiness da rota React compilada: 200 com `apps/web/dist/index.html`, 503 se faltar, bloqueando release que sirva v0.1 mas quebre /play.
- CI específica cria a imagem final, confirma ausência de ferramentas de desenvolvimento, roda `npm start` real e testa endpoints /, /play, /play/, JS/CSS, GIFs, e acesso negado a arquivos privados. Primeira execução `44306624915 SUCCESS`, checks finais/merge/Railway ainda pendentes.
- Picomatch `4.0.7` ainda é latest npm e vulnerável em build; Docker isola ferramentas da execução pública mas não corrige o upstream. Nenhum `npm audit fix --force`, novo `railway.json`, mudança de dependências ou segurança declarada absoluta.
- Criado `docs/COMBAT_HEAL_MULTIHIT_DESIGN.md` com plano não-executável de heals e multi-hit: learnsets FRLG, `power:null`, custo SP, RNG, cura sem loop, até30 turnos, frames/log 1:1, replay seguro. **Recover/Bullet Seed continuam NÃO jogáveis**; motor, save, fórmula SP, 151 GIFs e animações sempre ligadas permanecem idênticos.
- **Entrega validada:** PR #61 MERGED `main` SHA `7741139c38ef72c6783faa8a9661dee6381cf994`. GitHub CI `44307631387` imagem Docker isolada SUCCESS, `44307631334` npm audit SUCCESS, `44307631440` regressão completa SUCCESS e `44307631491` Playwright desktop/mobile SUCCESS. Railway deployment Docker `d7344470-eb96-48a5-92b0-1f0ef59cdc1c SUCCESS` SHA exato, build Docker multi-stage confirmado em logs, Node 8080, /health interno aprovado. URL pública externa não acessível no ambiente da verificação; sem alegar teste manual externo.

## [v0.2-alpha — D-043 revisão de dependências Vite/Vitest] — 2026-11-18 (PUBLICADA PR #59)
- Tarefa de segurança isolada após D-042: Vitest `3.2.4 → 4.1.12` nos dois workspaces para corrigir vulnerabilidades em Vitest/mocker/tinypool. Lockfile **gerado via npm 11**, validado por `npm ci` e auditado: **0 críticos, 5 altos** no conjunto de desenvolvimento, 0 alertas no `--omit=dev`. Picomatch 4.0.7 ainda não tem 4.0.8 oficial publicada na pesquisa de 18/11, não aplicar override imaginário.
- Workflow temporário de PR `d043-lockfile-resolve.yml` gerou o lockfile reproduzível no Actions (`44303650680`), registrou a auditoria e foi **removido da PR antes do merge** no commit `3d5c0f1`. Não persiste workflow com permissão `contents:write` na main. O game runtime, CSS, SP, saves, v0.1, 151 GIFs e replays não são alterados. Não afirmar zero CVEs nem deploy antes dos relatórios.
- **D-043 publicada:** PR #59 MERGED na main SHA `51d1354d1ae828933655fbcc604fe16c20cca7ff`. CI completa no container Playwright `44304209612 SUCCESS`, npm audit `44304209767 SUCCESS`; Railway `ee2dc75c-fdbd-453e-9ea7-992df52614b5 SUCCESS` no SHA exato, Vite build 2.07s, Node 8080 e healthcheck INTERNO /health aprovado. Restam 5 avisos altos (cadeia Picomatch) e 0 críticos/moderados no audit; 0 em `--omit=dev`. O workflow temporário de lockfile com write não foi incorporado. CI convencional `44304209655` ainda exigia checagem separada; suite equivalente completa `44304209612` validada. GET externo /play não testado diretamente.
- **D-042 já publicada:** PR #58 MERGED `main` SHA `7c170589ce7a274eb49ca77c056b7b517c21d730`; CI completa `44302672917` e `44302672967` SUCCESS (Vitest, Node legado, GIFs, E2E desktop/mobile), Railway deployment `71eedcbe-5210-4c47-9194-ae8eeaaf6201 SUCCESS`, healthcheck interno /health aprovado. Animações full permanentes sem seletor; 384 duelos de stress artificial com média 27,86 turnos/p95 30, 88,8% chegaram ao limite; não são stats jogáveis nem dados de usuários.

## [v0.2-alpha — D-042 animações sempre ativas e teste de duelos longos] — 2026-11-18 (BRANCH; ainda não publicada)
- Por decisão do proprietário, os efeitos CSS da Arena ficam **sempre em modo completo em desktop/mobile**, mesmo se Windows/Edge solicitar reduced motion. Removeu-se a lista de opções e o estado/localStorage da antiga escolha; a marcação estática `data-motion="full"` mantém os estilos da D-041, com GIF estável entre frames. A chave antiga `kanto-idle-ui-motion-v01` fica **ignorada, não apagada**, e nenhuma preferência ou save do usuário é modificada. Nenhum botão de controle de animações disponível. A decisão reduz opções de acessibilidade por movimento; feedback textual, live region opt-in, controles de teclado e HP/SP permanecem.
- E2E Chromium desktop/mobile atualizado para conferir sem seletor, animação ativa mesmo sob `reducedMotion:reduce`, GIF não remontado, preferência antiga `reduce` ignorada e save preservado.
- Matriz D-042 adicional: 384 duelos determinísticos de **stress artificial** (8 espécies × 3 níveis × 8 seeds × 2 modos fortificados/status), medindo duração, p95, chegada ao turno 30, SP, Concentrar e status. Não representa distribuição real, não altera algoritmo, recompensas nem HP dos Pokémon no jogo; roda somente no Vitest e publica `D042_LONG_BATTLE_REPORT`.
- Atualização de dependências Vite/Vitest **ainda pendente de PR isolada com lockfile reproduzível**, após conferência de advisories e regressão completa; não usar `npm audit fix --force`.
- TypeScript, Vitest, E2E, merge e Railway desta branch aguardam resultados. `/` v0.1, 151 GIFs, save schema2 e repo `isaquesan7/pokedex` intocados.

## [v0.2-alpha — D-041 GIFs estáveis e efeitos visuais por dispositivo] — 2026-11-18 (PUBLICADA PR #56)
- Corrigido palco da Arena que desmontava/remontava GIF do Pokémon a cada registro do diário, reiniciando a animação (risco especialmente em PC); wrapper permanece montado e apenas o efeito CSS é reiniciado via Web Animations API no frame correspondente. Sprites grandes/ativos carregam sem lazy loading; não altera asset GIF nem fonte `isaquesan7/pokedex`.
- Novo controle visual `Padrão do dispositivo / Exibir animações / Reduzir movimento` no painel da Arena (visível também no mobile). Padrão respeita `prefers-reduced-motion` do SO (possível diferença Windows/Android), escolha explícita de movimento completo reativa CSS da Arena; preferência fica em chave INDEPENDENTE `kanto-idle-ui-motion-v01`, sem tocar no save v0.2. Reduzir movimento mantém números/feedback textual.
- E2E adicionado: confirmar GIF de Kanto carregado, elemento `img` idêntico ao avançar linhas no desktop/mobile, efeito CSS interrompido no `reduced-motion`, override explícito, retorno para padrão e persistência da escolha sem mudar moedas/XP/receipts.
- Workflow adicional de navegador `.github/workflows/animation-regression.yml` usa a imagem oficial Playwright `v1.56.1-noble` (Chromium/libs prontos) para executar **também** TypeScript, Vitest, Node legado, 151 GIFs e as cinco jornadas Chromium (legado, prévia, rascunho, sandbox e /play) com browser/bibliotecas pré-instalados, evitando dependência do `apt-get --with-deps` lento. É um segundo gate reproduzível; o workflow original não foi removido.
- Segurança: `docs/DEPENDENCY_SECURITY_REVIEW.md` detalha os 7 alertas de ferramentas Vite/Vitest e propõe plano de atualização coordenado, sem `npm audit fix --force`, sem downgrade Vite nem alteração de lockfile.
- **Validação e release:** PR #56 MERGED `main` SHA `5e8bc89e15829a693f386197a831a7577184192e`; E2E visual desktop/mobile CI `44294495900 completed/success`; regressão completa com container Playwright CI `44294850947 completed/success` incluindo TypeScript, Vitest, build, 151 GIFs, Node legado e cinco jornadas Chromium. Railway deployment `4146f3d5-466e-45a2-91f3-d4e5b8aced65 SUCCESS` no SHA exato, build 1.23s, runtime Node 8080 e healthcheck INTERNO `/health succeeded!`. Sem mudança de combate, prêmios, writer, PP/SP, schema2 ou v0.1. Workflow legado de instalação Chromium com `--with-deps` teve demora; a regressão completa equivalente usando o browser pré-instalado está verde. Navegação física Edge/Chrome e GET externo ainda precisam ser verificados.

## [v0.2-alpha — D-040 Diagnóstico de balanceamento e inventário npm] — 2026-11-18 (PUBLICADA PR #54)
- Novo teste somente diagnóstico: mede vitórias/derrotas/empates, turnos médio/mediano/p95, 30 turnos, usos de ataque básico, skills pagas, Concentrar e saldo SP por nível/cenário nas **mesmas 1.920 combinações determinísticas** de D-039. Imprime relatório estruturado `D040_BALANCE_REPORT` nos logs Vitest/CI; NÃO é telemetria real de jogadores.
- Workflow npm audit separa vulnerabilidades do lockfile de produção (`--omit=dev`) e ferramentas de desenvolvimento; gera resumo no GitHub Actions e artifact JSON, **sem npm audit fix nem mudanças de versões**. Relatório é triagem, não garante explorabilidade; a decisão de atualização depende de análise humana e regressão.
- Nenhum ajuste de fórmula, catálogo, movimentação, autenticação, schema/localStorage, RNG, prêmios ou replays. Nova leitura de tela humana NVDA/VoiceOver permanece pendente antes da beta.
- **Publicação verificada:** PR #54 MERGED `main` commit `799082efe77ce67f343843182284844c8c76e064`; CI PR `44287743706 completed/success`, workflow npm audit `44287744000 completed/success`; Railway deployment `0cbd486b-ce82-4208-8f18-561e23e6f191 SUCCESS` SHA exato, Node 8080 e healthcheck INTERNO `/health succeeded!`. PR docs #53 de release D-039 também integrada com E2E corrigido, CI `44286926669 SUCCESS`. CI pós-merge D-040 ainda não confirmada e GET público externo /play não testado diretamente.
- **Métricas amostra determinística:** 1.920 jogos, vitórias 46,61%, derrotas 52,86%, empates 0,52%, média 4,19 turnos, mediana 4, p95 9, nenhuma luta chegou ao limite 30, Concentrar em 13,39% das batalhas. Não há dados de usuários reais.
- **`npm audit` efetivo:** produção 0 alertas, inventário completo 7 (2 críticos: tinypool/vitest; 4 altos: fdir/picomatch/tinyglobby/vite; 1 moderado: @vitest/mocker). Recomendações automáticas do npm incluem versões de Vite/Vitest com risco de mudanças de dependência; nenhuma atualização aplicada; investigar advisory e árvore antes de alterar lockfile.

## [v0.2-alpha — D-039 Acessibilidade Arena, preparo de cura/multi-hit e SP mínimo 50] — 2026-11-17 (PUBLICADA PR #52; CI PR/main e Railway SUCCESS)
- **SP:** piso por Pokémon 40→50, base 30→36, teto100 conservado, mantendo fórmula por nível/espécie e garantia de poder pagar uma habilidade com custo até40 mesmo no nível1. Concentrar (recarga30%, 2x, cooldown4) e ataque básico neutro preservados.
- **Movimentos futuros, sem disponibilizá-los na Arena:** função pura de prévia `kantoPreviewMoveSpCost` para /move/{id} com `power:null`, `meta.category.name=heal` (+18 SP; Recover PP5 custa36), multi-hit 2..5 com fator2.5 (Bullet Seed PP30/power25 custa18 em vez de11), inputs inválidos rejeitados. Gameplay dos 29 movimentos não muda.
- **Acessibilidade:** teclado em painel Diário (Espaço para pausar/continuar, seta direita para avançar se pausado), botão passo-a-passo, leitura assistiva opt-in a 3s por evento com anúncios polite; log e timer com live off para evitar anúncios insistentes; +SP Concentrar ganhou banner e destaque de barra com reduced-motion/aria. Replay e save schema2 mantidos sem recálculo/prêmio.
- **Teste:** 1.152 duelos gerais + 768 de suporte/níveis/tipos (1.920), todos 151 limites de SP, custos de cura/multi-hit preview, E2E desktop/mobile em Chromium com foco/teclado/reduced-motion e save intocado. **Release:** PR #52 MERGED em main código e136b5b6673e3e57b048a80901a0aa6b2a9d8fa7, CI PR 44224407708 SUCCESS; CI pós-merge main 44224881723 SUCCESS; Railway deploy 447ce16b-80a0-4335-a162-e3b69e6094a1 SUCCESS no SHA exato, healthcheck INTERNO /health succeeded!; URL externa /play não verificada por ferramenta. Docs e handoff no PR posterior.

## [v0.2-alpha — D-038 SP híbrido PP/Poder, Concentrar e neutro básico] — 2026-11-17 (PUBLICADA PR #50)
- PP oficial de todos os 29 movimentos habilitados (snapshot versionado do PokéAPI/pokeapi moves.csv blob a55116329ca22f230fea953de94c2d1dffe2ad0e) integrado ao custo próprio de SP junto de potência, efeitos e prioridade, respeitando diferenças de golpe e suporte. MaxSP agora varia por espécie e nível com HP/SpAtk/SpDef base oficial (40..100), sem regeneração passiva.
- Nova IA Concentrar (abre mão do ataque, recupera 30% de SP, até 2 vezes e intervalo 4 turnos, condições de HP/viabilidade); básico sem tipo ofensivo (STAB1, efetividade1), sem travar contra Ghost. Continua dano físico custo zero e sem slot/rank.
- Arena exibe concentração linha a linha com SP restaurado e pulso ciano acessível; painel Pokémon exibe PP oficial separado de custo SP, cap individual; histórico v0.2 com HP/SP anterior continua fiel, sem recálculo de replay nem prêmios novos. Mesmo schema2/key e / v0.1 intocados.
- Testes de PP/custos/status, todas as 151 espécies para SP, 1.152 duelos determinísticos por níveis/tipos e pausa/replay/compatibilidade. **Publicado:** PR #50 MERGED em main 0b8e73ad8e8b79ea218e9309085e175f4c1106bc; CI PR 44217630211 SUCCESS e CI pós-merge main 44217888940 SUCCESS; Railway deployment 59233a8f-47cc-4572-bf0d-3d0d45a709bd SUCCESS com healthcheck INTERNO /health aprovado (GET externo não testado).

## [v0.2-alpha — SP compartilhado, ataque básico e feedback de golpes] — 2026-11-17 (PUBLICADO PR #48)
- Reserva de SP individual por Pokémon em cada combate: 40+floor(nível/4), 40–65 pontos; habilidades equipadas consumem 14–30 SP por poder/efeito/prioridade, suportes Growl/Tail Whip=16, Poison Powder=22, Thunder Wave=24. Ataque básico gratuito (Normal físico, poder30) não ocupa slot nem ganha rank. IA intercala básico/skills, alterna turnos e usa só básico quando falta SP; reset apenas por encontro.
- Novas trilhas SP/HP sincronizadas na Arena com duas barras numéricas, custos por movimento no treino, crítico/efetividade por tipo em overlay, reduced motion. SP debitado mesmo em erro/imunidade, não em paralisia que impede agir. PP oficial da PokéAPI é por movimento; SP é regra própria do Idle.
- Dados antigos sem SP permanecem legíveis com HP e diário, mesmo esquema/key v0.2 e nenhuma transação/recompensa extra ao reassistir. Testes core e E2E desktop/mobile para fórmula/limite/pausa/skip/replay/legado.
- **Publicado:** PR #48 merged em 63857d0776798d46551e01a04a884c5d7f5267d9, CI PR 44210240157 SUCCESS, Railway 3ef0e839-934d-43cb-ada5-d896260362e2 SUCCESS e healthcheck interno /health aprovado. CI da main 44210525723 completed/success. Regressão completa e implantação confirmadas. Próxima etapa: balanceamento por espécies/tipos e auditoria de acessibilidade da Arena.

## [v0.2-alpha — HP e impactos sincronizados] — 2026-11-17 (PUBLICADO PR #46)
- Trilha visual persistida com uma entrada por linha no diário: HP dos dois combatentes, tipo do evento, dano/cura, identidade histórica do parceiro e HP máximo. Não muda regras de dano, RNG, captura, XP ou recompensas.
- Palco responsivo mostra HP numérico, animações de impacto, cura e status vinculadas ao progresso do diário (pausa, 2x, pular, replay). Sem novos recibos nem escrita visual. Saves anteriores sem trilha mostram o log completo sem HP inventado.
- Tokens CSS no :root e prefers-reduced-motion, testes core/web e Chromium desktop/mobile aprovados. PR #46 merged em 82ae9f4837ff5c9448bdfa115fb2bc4ac77c6a52, CI PR 44203666664 e main 44204910003 SUCCESS; Railway a9dafccf-3be1-4381-9137-3fdb7044e3f2 SUCCESS e /health interno aprovado. Próxima etapa: UX/acessibilidade e efeitos por tipo.

## [v0.2-alpha — quatro golpes e IA determinística] — 2026-11-17 (PUBLICADO PR #44)
- Até quatro slots de golpes por Pokémon UID, com ações de adicionar, retirar e definir principal. Saves anteriores com só `moveName` carregam como slot único; `moveNames` opcional, sem novo schema. O golpe principal anterior e seus ranks permanecem intactos até edição consciente.
- Primeiro catálogo de suporte baseado em learnset FireRed/LeafGreen: Growl, Tail Whip, Thunder Wave e Poison Powder para quatro espécies validadas; IA escolhe suporte viável nos dois primeiros turnos e depois golpe de melhor dano estimado, com stats, tipos e imunidades, sem RNG adicional fora da seed.
- Logs de suporte e ataque continuam no diário gradual com replay sem novas recompensas. `playSave` valida espécie/nível/slots por UID, persiste uma revisão sem afetar `/` legado. Efeitos temporários, sem PP, backend, jogadores reais ou antifraude.
- Adicionados testes Vitest core/write e E2E Chromium desktop/mobile com 2 golpes, seleção após reload e combate automático. **PUBLICADO:** PR #44 merged `a22ffd7e0348c29caa354189961f09b13741e167`, CI PR `44182880749` e CI main pós-merge `44183213221` ambas SUCCESS (TS, Vitest, build, legacy, 151 GIFs, Chromium desktop/mobile); Railway `0eacb457-f0f5-4c54-8d2d-ae629e5ba50d` SUCCESS no SHA e healthcheck interno `/health succeeded!`. Próxima etapa: animações HP/ataques e expansão gradual dos efeitos.

## [v0.2-alpha — combate com status] — 2026-11-17 (publicado: PR #42)
- Novos efeitos secundários em golpes ofensivos: queimadura de Ember, paralisia de Thunder Shock, envenenamento de Poison Sting (Weedle nível 1), Absorb recupera 50% do dano e Bubble pode reduzir Speed; metadados de `moves.csv`/`move_meta.csv` da PokéAPI versionados.
- A simulação pura de combate aplica dano residual, limitação por paralisia e velocidade efetiva, imunidades básicas, RNG determinístico por seed e logs de efeito uma linha por vez; estados são temporários, não alteram UID ou inventário e nunca duplicam recompensas ao reassistir.
- Perfil Pokémon mostra chances de efeitos; Arena mostra condições finais como histórico. Novo teste Vitest de status/imunidades/seed e E2E da descrição de Ember; CI PR `44176054785` e main pós-merge `44176408588` **SUCCESS** (TS, Vitest, build, legado, 151 GIFs e E2E Chromium desktop/mobile). PR #42 merged na main `a597619c69b321fdb22afc9982ddac4ca9b0b287`; Railway `60d9f834-ea75-489d-aa89-8b33ec58cca7` **SUCCESS** no SHA exato, healthcheck interno `/health succeeded!`.
- Não altera o legado `/`, saves v0.1/v0.2, estrutura de recompensas nem antifraude (inexistente). Golpes sem dano, quatro moves, regras completas e animações HP ficam para próximas fases.

## [v0.2.0-alpha — evolução por UID] — 2026-11-17 (publicado: PR #40)
- Evolução manual com requisitos reais de nível/pedra por espécie Kanto, a partir de `pokemon_evolution.csv` da PokéAPI em commit imutável. Evolução por troca listada como pendente, sem substitutos inventados.
- Preservação do UID, nível, XP, afinidade, pontos manuais, golpe, ranks e equipe; pedras consumidas uma vez e save v0.2 revisionado na mesma transação. Evolução bloqueada durante expedição.
- Histórico de espécies capturadas na Pokédex preservado após evolução; campos opcionais no mesmo save local, nenhuma migração de v0.1.
- Kit único de pedras rotulado como TESTE para ensaios enquanto inventário/loja não estão definidos; sem novas moedas, XP ou recibos de batalha.
- Testes core/web e Chromium desktop/mobile aprovados na CI da PR #40 `44125547394` **SUCCESS**; PR #40 merged em main `aee2cd7572d0cb97f3a7e691354f426ef5e50022`. Railway deploy `91e0f618-6456-4630-ab75-ae8bdf22e377` **SUCCESS** no SHA exato; Vite build ~1,00s, servidor Node na porta 8080, healthcheck interno `/health succeeded!`. Regressão pós-merge da main também será acompanhada. Próxima etapa: status/efeitos e HP/ataques visuais.

# CHANGELOG — Poke Idle Game
Histórico de entregas. **Toda atualização futura deve acrescentar uma entrada aqui** e atualizar `docs/PROJECT_STATE.md` no mesmo trabalho. Não reescrever/ocultar histórico. Use data, escopo, commit, testes, deploy e pendências.

## [Unreleased]
- **2026-11-17 · RELEASE batalha em tempo de apresentação e golpes por nível:** PR #38 merged `8748d31560a103c4a40d003cfe137e7fc51bcf5b`, CI `44120721898` **completed/success** (TS/core/web/Vitest/Vite/Node/GIFs e Playwright Chromium desktop/mobile, incluindo log gradual/cronômetro/pausa/2×/pular/reassistir sem crédito duplo, moves/ranks). Railway deploy `d175dac4-ebf7-4330-b446-bd60c8a95fe8` **SUCCESS** no SHA exato, Vite build ~1,33s e healthcheck interno `/health succeeded!`. Em `/play`, Arena apresenta cada ataque/log a cada ~900ms (ou 450ms), cronômetro de tempo **visual**, mantém prêmios calculados uma vez e desfecho oculto até concluir. Perfil permite seleção/upgrade por UID de moves por nível da PokéAPI FireRed/LeafGreen (recorte ofensivo de 24 golpes, 125 espécies com elegíveis em algum nível); outros movimentos mantêm fallback. Sem backend/antifraude, nem jogadores reais; `/` antigo intocado. Próxima prioridade: evolução por UID. GET público não verificado diretamente por ferramenta.
- **2026-11-17 · Golpes por nível e batalha apresentada golpe a golpe (PR em validação):** snapshot de `pokemon_moves.csv` FireRed/LeafGreen (version group 7) e `moves.csv` da PokéAPI fixados em `ac2f1acb`: 24 golpes ofensivos simples selecionados, 125 espécies com golpes elegíveis em algum nível (as outras seguem com fallback da alfa); recorte documentado, sem simular status/efeitos secundários. No perfil Pokémon, selecionar golpe desbloqueado e gastar pontos de rank por UID e nível via `reduceLegacyPokemonMoveJson` com dados canônicos, sem aceitar `availableMoves` ou `movePower` do botão. Arena salva combate uma única vez e revela cada linha/evento a cada ~900ms, cronômetro de **apresentação**, pausa, modo 2×, pular e reassistir; efeitos de UI não alteram journal/XP/captura/recompensas. Testes de snapshot de moves e Playwright expandido para ritmo/pausa/replay/ranks. CI, merge e Railway pendentes neste registro.
- **2026-11-17 · RELEASE Pokédex 151 e 54 encontros:** PR #36 merged `9a7cd309dda3f1763d188b1729aefbf8bf1020d8`, CI `44114454859` **SUCCESS** cobrindo TS/Vitest/core/web/legacy/Vite/GIFs e Chromium E2E desktop/mobile, Railway `5c122500-56b9-4150-8ab3-f9e19a19c9cb` **SUCCESS** com `/health` interno aprovado. Catálogo estático de 151 nomes/tipos/6 stats da PokéAPI `ac2f1acb`, 54 espécies selvagens não lendárias, tela Pokédex 151 (???/visto/capturado) com busca/filtros/detalhes e progresso sem duplicar UID. Os 11 golpes originais da Arena foram preservados; golpes das demais espécies são **PROVISÓRIOS** e não representam learnsets oficiais. Sem jogadores reais, contas, backend ou antifraude. GET público externo não verificado via ferramenta. Próximo: movesets e evolução.
- **2026-11-17 · Pokédex nacional 151 (em validação):** snapshot de dados PokéAPI `PokeAPI/pokeapi@ac2f1acb` das 151 espécies de Kanto (nome inglês, tipos modernos, seis stats, pré-evolução, captureRate, lendário/mítico) em `game-core/src/catalog/kantoSpecies.ts`, com source SHA documentado e testes de completude/integridade. Arena passa a ler atributos das 151 e sorteia **54 espécies selvagens** não lendárias em lugar de 8 (pool anterior preservado no início); **golpes padrão das espécies adicionadas são temporários**, ainda NÃO validamos learnsets. UI `/play` ganha Pokédex 151 com desconhecidos ocultos, vistos, capturados, busca, filtros, ficha de espécie e contagem independente de UIDs. E2E desktop/mobile amplia testes de vistos/capturados, recarregamento e espécies duplicadas. Sem novo writer, migração, contas ou backend; CI/merge/Railway pendentes nesta linha.
- **2026-11-17 · RELEASE coleção/equipe v0.2:** PR #34 merged SHA `e6ee20b545386fe9f9f1a174d1c7800d129317ab`, CI `44081662800` **completed/success** com core, web, build, GIFs, Node legado e E2E Chromium (inclui 2 Pokémon mesma espécie com UIDs diferentes, troca de líder e Arena após reload); Railway deploy `047d2ee9-ba49-43d8-bbac-c5a11e8fcec4` **SUCCESS**, build Vite e healthcheck `/health` aprovados. Nova aba Coleção na `/play` com time 1–3, busca, filtros, treino por UID, travamento durante expedição e líder refletido na Arena. GET HTTP externo não disponível por esta ferramenta; sem contas, backend, jogadores reais ou antifraude. Próximo: ampliar Kanto e construir Pokédex.
- **2026-11-17 · Coleção e equipe v0.2 (em revisão):** React `/play` ganha aba Coleção com cards de instâncias **por UID**, filtro Todos/Na equipe/Reserva, busca por nome, espécie ou UID, slots de 3 Pokémon e ação para definir o líder da Arena. Os reducers puros `pokemonTeamReducer` adicionam `set-active` (mover apenas UID já escalado para o início) com validação de duplicatas, limite 1–3, bloqueio de mudanças durante expedição e preservação de XP, afinidade, manual e roster. A aba Pokémon agora treina instâncias selecionadas sem confundir com líder e usa catálogo local de batalha para stats reais de capturas da pool piloto. E2E desktop/mobile cobre dupla captura da mesma espécie por UID, líder no comando de batalha e replay após reload. **CI/merge/Railway em validação**, sem alterar `/` ou chave de save legada. Sem contas/backend/antifraude.
- **2026-11-17 · RELEASE Arena v0.2 publicado:** PR #32 merged `6bf399ac2ee15f4923072378c00db62fc8c0f111`, CI `44071892270` **SUCCESS**, Railway `1e30e03e-4de7-48f9-b999-2206919a43b7` **SUCCESS** com Vite build, `node server.mjs` e healthcheck interno `/health` aprovado. `/play` agora contém Arena automática com 8 encontros selvagens, simulação determinística de até 30 turnos, capturas 35%, XP, moedas, insígnias, afinidade, diário e persistência local, validado por Playwright desktop/mobile (reload do save). `/` v0.1 e chaves legadas intactas. GET externo não confirmado (URL inacessível por ferramenta); usuário pode testar via link. Próximo: coleção de capturados, equipes até 3 e expansão do Kanto. Sem usuários reais/backend/antifraude.
- **2026-11-17 · Arena v0.2 Kanto (PR #32 EM VALIDAÇÃO):** `/play` ganha combate automático determinístico com seed, 30 turnos, prioridade/velocidade, precisão, dano físico/especial, STAB 1,5, crítico 6,25% ×1,5, variação 90–100%, efetividade 0–4×, afinidade +2–5, 35% de captura após vitória. `game-core` novo `combat/kantoBattle.ts` (3 iniciais + 8 selvagens piloto); a UI mostra confrontos, GIFs, recompensas, insígnias e diário reabrível. `playSave.ts` resolve resultado internamente, usa recibos/revisão do journal e salva XP/coins/captura/seen/lastBattle numa única escrita v0.2. Testes determinísticos e E2E ampliados. Sem backend, seed do navegador manipulável; alfa pré-lançamento sem jogadores. CI/merge/deploy pendentes neste registro.
- **2026-11-17 · v0.2 Alpha publicada + Node 22 validado:** PRs #29 e #30 integradas; SHA da `main` `9536860e`. CI PR #30 `44068373957` **SUCCESS** incluindo testes Playwright da rota `/play`; Railway deploy `025abdf3-454e-4203-83b4-277ff1403d33` **SUCCESS**, runtime Node 22.23.4 instalado, Vite compilado, `node server.mjs` executando, healthcheck `/health` aprovado. Disponível em `https://kanto-idle-web-production.up.railway.app/play` (endereço externo não validado por GET nesta sessão); `/` continua v0.1. Nenhum usuário real ou backend. Próxima prioridade: batalhas/capturas determinísticas e coleção v0.2.
- **2026-11-17 · Release alfa React v0.2 e runtime Node 22 (configuração em revisão):** PR #29 integrada `684ebf43`, CI `44067662663` SUCCESS incluindo `/play` desktop/mobile e regressão legado, Railway `fd9cd32a-1486-45b9-8e88-6381aeb6008f` SUCCESS com `/health` interno aprovado. `npm prestart` compilou Vite, porém runtime Node 18.20.8 gerou aviso de incompatibilidade de suporte: fixar Node >=22.12 <23 no `package.json` e lockfile. Sem mudança de regras nesta correção. Rota pública alfa `/play` ativa, `/` legado preservado; GET externo não testável deste ambiente.
- **2026-11-17 · Primeira jornada jogável React v0.2 (PR em validação):** aprovado pré-lançamento sem jogadores reais (D-027), com prioridade em jogabilidade/UX em vez de migração complexa. Nova rota `/play` no `server.mjs` com build Vite no `npm prestart`; `PlayApp` responsiva Kanto Dark permite criar treinador, escolher Bulbasaur/Charmander/Squirtle, demo opcional, distribuir pontos de treinador e Pokémon, equipar itens de teste e iniciar/claim/stop expedição idle. `playSave.ts` usa chave local v0.2 própria, revisão monotônica, reducers core e recibos de expedição; reinício só mediante confirmação e sem tocar chave antiga. Testes Vitest + novo E2E desktop/mobile de rota real no CI. / v0.1 permanecerá ativa até validação do loop completo. **Não há contas, backend nem batalha real na v0.2.**
- **2026-11-17 · Laboratório de autoridade única integrado:** PR #27 merge `de6b84e`, CI `44063137880` **SUCCESS** (TS, Vitest, build, 151 GIFs e Playwright legado/React/draft/sandbox), Railway deploy `667ad1f3-8535-44d7-9c4d-b163f342895a` **SUCCESS**, healthcheck interno `/health` aprovado. Entrega restrita ao `game-core` e documentação; UI pública/saves v0.1 intocados, sem writer v0.2. Próximo: simulador de batalha determinístico e arquitetura de autoridade transacional durável em laboratório, sem cutover.
- 2026-11-17 · **Laboratório de autoridade única de recompensas (branch `feat/v02-reward-authority-memory-lab`, CI/PR pendentes):** `RewardAuthorityMemoryLab` mantém UM envelope (save+revisão+recibos) em Map privado, sem IO, localStorage, Web Locks oficiais nem backend. Dois clientes do mesmo Map simulam corrida de revisões, com primeiro commit aceito e segundo stale; reenvio com ID igual é duplicate. Falha antes do commit não concede recursos; falha após commit perde o ACK, mas replay reconhece recibo sem conceder novamente. Corrupção bloqueia; clones da resposta não modificam ledger. Testes Vitest de concorrência, captura, expedição e 2 Map independentes evidenciam limite: dados desaparecem ao destruir instância e vitória não é autenticada. Sem deploy funcional ou writer real ativado; next: validar CI e integrar.
- **2026-11-17 · PR #25 de golpes por UID integrada:** merge `851fe85f`; CI PR `44059077306` **SUCCESS** (TypeScript, Vitest, Node, build React, GIFs Kanto e Playwright legado/React/draft/sandbox); Railway `8cbf036f-c96b-4e03-8a86-eda948710de5` **SUCCESS**, healthcheck interno `/health` aprovado. `package.json` passou a fixar `csstype@3.2.3` via override para corrigir 404 no `npm install` extra do Playwright. Nenhum save, sprites, servidor, UI pública ou writer oficial alterado. Próxima: laboratório de autoridade única/ledger com concorrência, sem gravar progresso real.
- 2026-11-17 · **Golpes por UID em PR #25 (CI em validação, sem merge):** reducer puro para seleção/upgrade com orçamento `floor(level/5)`, teto `min(10,floor(level/10)+1)` e preservação de recursos; testes Vitest adicionados. Metadados de golpes são parâmetros sem prova de origem. Sem gravação nem alteração na UI pública. Próximo: validar CI/PR; continuar paridade e contrato de writer único.
- **2026-11-17 · Eventos idempotentes puros validados:** PR #22 merged em `989c2cdc`, CI PR `44056942594` e CI pós-merge `44057278833` SUCCESS, Railway `5b76abc6` SUCCESS. Envelopes RAM com replay/id/revision para batalha pré-resolvida/captura e expedição; nenhuma mudança na v0.1 pública nem writer v0.2. Próximo: autoridade única e motor de combate verificável.
- 2026-11-17 · **Eventos de recompensas idempotentes em RAM (branch `feat/v02-idempotent-reward-events`, CI pendente):** `RewardJournal` com `revision`, `receipts` e IDs por evento, captura atômica em resultado de batalha resolvido, eventos para iniciar/resgatar/encerrar expedição, progressão XP via core, 8 insígnias cumulativas e afinidade. Replay idêntico retorna `duplicate`; ID conflitante e revisão stale são recusados. Sem persistência, RNG, autoridade de combate nem garantia entre envelopes separados. `cutoverGate` segue bloqueado, sem UI/save v0.2 oficial.
- **2026-11-16 · Paridade parcial de Pokémon/equipe validada:** PR #20 merge `5e60f17b`, Railway deploy `da78ab5a` SUCCESS; GitHub Actions pós-merge `43996462703` SUCCESS. Reducers puros sem side effects, budget Pokémon `(level-1)*2`, UIDs por instância, equipe 1–3 e bloqueio em expedição; sem writer real. Próximo: batalha/expedição idempotentes e segurança de writer único.
- 2026-11-16 · **Redutores puros de Pokémon/equipe (branch `feat/v02-pokemon-team-pure-reducers`, PR em validação):** módulo `game-core/src/legacy/pokemonTeamReducer.ts` com treino +1 por UID, redistribuição por instância, adição/remoção de equipe e regras do legado (2 pontos por nível; **sem teto 40 por atributo para Pokémon**; equipe 1–3, congelada em expedição). Validação de UID, budget, estrutura e versão; preservação de XP, moedas, afinidade, insígnias, golpes e campos desconhecidos. Testes Vitest de integridade, falhas e determinismo. Somente funções puras: nenhum save ou rota pública alterado. CI, PR e Railway pendentes.
- **2026-11-16 · Gate de ativação v0.2 aprovado e integrado:** PR #18 merged SHA `64992f90`, Railway deploy `4009f1a4-6dd9-4a4f-9859-7bc92684caa7` SUCCESS e CI da main `43994224019` SUCCESS. Diagnóstico React fail-closed, matriz de 21 ações legadas e teste Node para detectar alterações não auditadas. Jogo público e save v0.1 intactos, sem writer oficial. Próximo: reducers de gameplay e controle de idempotência antes de cutover.
- **2026-11-16 · Gate de cutover fail-closed + auditoria de mutações v0.1 (PR em revisão):** `cutoverGate.ts` sempre bloqueia ativação, inclusive com save válido/Web Locks, expõe motivos do preflight, dados reservados v0.2, fonte instável e pré-requisitos de release; painel React informa bloqueios sem botão de migração. Nova matriz `docs/LEGACY_MUTATION_MATRIX.md` documenta 21 ações e escritores indiretos do `index.html`, com teste de regressão da lista. Vitest + Playwright do gate. Zero alteração de saves, runtime público ou GIFs. CI/merge ainda a validar.
- **2026-11-16 · Browser sandbox validado e integrado:** PR #16 merged `977d14a9`. Railway `54ccff55-8225-4057-b7ee-82756487d94d` SUCCESS; CI pós-merge `43991985570` SUCCESS (core, web, GIFs e E2E do jogo, React, draft e browser sandbox). Exercícios reais em origem localhost com Web Locks entre abas, erro QuotaExceededError, crash/reload e rollback apenas de dados de teste. Nenhuma alteração na interface ou save público v0.1. Próximo: gate de writer único, cutover opt-in e paridade total antes de permitir progressão real v0.2.
- 2026-11-16 · PR de laboratório de navegador real: `browserSandboxCutover.ts` usa somente chaves `__kanto_lab__*` e exige `http://localhost`/`127.0.0.1` na rota `/__kanto_v02_browser_lab__`. Ensaios Web Locks entre abas, crash/reload, quota nativa do Chromium, revisão de journal, conflito legado e rollback explícito preservando backup. Novo E2E automatizado na `main-regression.yml`; sem importação no React público, sem tocar chaves v0.1/v0.2 e sem writer oficial. Ainda em PR, sem deploy nesta entrada.
- **2026-11-16 · Laboratório seguro de migração v0.2 integrado:** PR #14 merged `455c29a9`, Railway deploy `b621615b` **SUCCESS**, CI da `main` `43989615947` **SUCCESS**. Cenários de quota, crash, writer v0.1 divergente, double-submit e revisão stale somente em `Map` privado com confirmação; E2E desktop/mobile e capturas revisadas. Jogo público/saves v0.1 preservados. Próximo: política de cutover/writer único e rollback real antes de ativar qualquer gravação.
- 2026-11-16 · **Laboratório opt-in de cutover v0.1→v0.2 (branch `feat/v02-cutover-memory-laboratory`):** classe `MigrationMemoryLab` com `Map` privado e nenhuma dependência de armazenamento do navegador, confirmação explícita, ensaio de backup → candidato → marcador, quota limitada ou falha injetada, crashes em três etapas, conflito com aba legada, double-submit e revisão stale entre abas simuladas. Painel React exclusivamente experimental e E2E desktop/mobile conferem zero gravações nas chaves reais. Não ativa migração, restauração nem writer v0.2. CI e revisão pendentes nesta entrada.
- **2026-11-16 · Finalização do protocolo experimental v0.2:** PRs #11 (recuperação SHA-256, bloqueios/revisões Web Locks) e #12 (E2E de fallback GIF sem cache intermitente) integradas até `db10572b`. Railway deploy `293781a0-ded3-4b72-906f-feab1baca563` SUCCESS e CI `main` `43987571827` SUCCESS. Runtime público e save v0.1 preservados, sem migração real; próximo: laboratório de cutover opt-in isolado.
- 2026-11-16 · **PR #11 integrada:** SHA `9369e4a4`, Railway deploy `ae239947-8f72-4827-b277-4846495879a2` SUCCESS. CI da PR `43986588480` SUCCESS, screenshots revisadas; UI pública v0.1 permanece inalterada, backup/coordenação restritos à prévia e testes.
- 2026-11-16 · **Correção de flakiness no E2E legado (branch `fix/legacy-e2e-fallback-cache-and-handoff`):** CI pós-merge `43986967633` falhou esperando fallback PNG de #25 porque rota 404 foi instalada após o navegador cachear GIF na Pokédex. Simulação 404 agora começa antes de `page.goto`. Apenas teste/docs, sem mudança do jogo ou saves; nova CI pendente.
- 2026-11-16 · **Proteção de writer e recuperação verificável v0.2 (PR #11 em revisão):** contrato de coordenação Web Locks só para abas v0.2 cooperativas, revisão monotônica, identificação de divergência v0.1/v0.2 sem mesclar dados. A prévia React exporta JSON de recuperação com SHA-256 e confere arquivos externos SOMENTE em memória, sem importar/restaurar. Vitest de concorrência, corrupção, quota/erros e E2E desktop/mobile; **nenhuma gravação oficial habilitada**. Ainda não publicado, aguardando CI.
- **2026-11-16 · Release do contrato de save v0.2 no repositório:** PR #9 merged SHA `bd530666`; Railway deploy `dfca3072-3ef3-4c5f-8113-f525abebc4b1` `SUCCESS`; regressão da `main` workflow `43984189208` `SUCCESS` (TS, Vitest, 151 GIFs, build React, E2E legado/React/draft). Página pública v0.1 não alterada; backup/journal só funções puras e testes, sem gravações nem migração real.
- 2026-11-16: PR #9 aprovada no CI `43983797980` (TypeScript, Vitest inclusive backups, build, GIFs e E2E legado/React/draft). Nenhuma gravação real habilitada; revisão do diff concluída; aguardando merge e deploy.
- **2026-11-16 · Contrato candidato v0.2 e backup recuperável (branch `feat/v02-official-save-backup-contract`):** tipos do save oficial futuro, origem v0.1 copiada fielmente, SHA-256 UTF-8, validação de pacote e simulação de journal com backup, snapshot e marcador final. Testes de crashes/quota/conflito/corrupção; sem executor de escrita, sem alteração de chaves do jogo, sem deploy nesta branch. Próxima etapa: CI e política de writer único.
- **2026-11-16 · Release foundation v0.2 no repositório (runtime v0.1 preservado):** PRs #3–#7 integradas à `main` até commit `b099e750`; último deploy Railway `13d5dd6f-e802-421a-8dc5-1e85ad37577f` em `SUCCESS`; CI permanente em `main` workflow `43982463671` em `SUCCESS` (TS, Vitest, Vite, 151 GIFs, E2E v0.1/React/draft). UI pública continua sendo a v0.1, sem migração de saves; análise de migração futura é apenas leitura.
- 2026-11-16: branch `feat/v02-migration-preflight` adiciona análise somente leitura de prontidão estrutural de saves, testes de conflitos/falhas, relatório na prévia, CI duradouro para main e `docs/SAVE_MIGRATION_PLAN.md`. Não promove rascunho, não grava no progresso real e não está publicada.
- 2026-11-16: PRs #3, #4, #5 e #6 integradas à main (`8fbaf415`, `48977b01`, `0d4bc823`, `af81fdb4`) com deploy Railway SUCCESS em cada etapa. Entrada pública segue sendo o jogo v0.1.
- **2026-11-16 · PR #6 CI aprovado:** workflow `43978606016` em `SUCCESS` (TypeScript, Vitest, build, GIFs, regressão v0.1 e E2E React/draft desktop/mobile), screenshots artifact `14281376764`; SHA verificado `7e353da9`. A PR continua em revisão, sem merge e sem deploy; progresso v0.1 preservado.
- Corrigido invocador Playwright E2E de draft para usar um único argumento serializável em `page.evaluate`; sem alterar o runtime de jogo ou armazenamento.
- Ajuste do type guard TS no editor puro de treinador para garantir `trainer.manual` como objeto antes da atribuição. CI da branch reexecutado; sem efeito em produção.
- 2026-11-16 · **Simulação v0.2 versionada (PR #6 em revisão)**: core puro para distribuir pontos e trocar equipamentos, chave independente `kanto-idle-lab-save-v02-draft` com fonte original e revisão, bloqueio Web Locks, detecção de conflitos, descarte explícito e testes Vitest/Chromium. Nenhuma alteração no save v0.1, sem deploy; CI pendente.
- 2026-11-16: workflow `43975797448` da PR #5 em `SUCCESS`; validações TypeScript, Vitest, build, GIFs e Playwright do jogo antigo e da prévia React aprovadas. Lockfile atualizado em `3754a5ab`, capturas arquivadas em artifact `14281131270`. PR aberta, sem deploy. Revisão visual humana pendente.
- 2026-11-16: branch `feat/react-trainer-overview-v02` contém catálogo fiel de Kanto v0.1, projeção read-only usando `@kanto/game-core`, telas React de visão geral e treinador, paridade e CI desktop/mobile. Sem mudanças no save ou deploy; aguardar validação CI.
- Foundation v0.2: workflows `43969729234` (core), `43970439739` (build React) e `43971040708` (Playwright React/backup) em `SUCCESS`; lockfile e screenshots versionados/arquivados nas branches. PRs #3/#4 seguem abertas; sem deploy de v0.2.
- Ajuste de asserção em Playwright para rótulo real `Nível treinador` da prévia React. Não altera app nem save.
- PR React: adicionada regressão Playwright desktop/mobile, download de backup JSON byte a byte e garantia de storage inalterado. Screenshots arquivados no CI; aguardar execução.
- **Prévia React v0.2 em branch**: workspace `apps/web`, TypeScript/Vite, shell com leitura segura de save v0.1 e exportação do JSON original; CSS Modules usando tokens oficiais, testes Vitest e workflow CI. Não publicada, sem modificar `server.mjs` ou saves. Depende da PR #3 de core.
- Ajuste TypeScript na suíte do game-core: fixture usa spread em objeto escalar em vez de `structuredClone` (não declarado no lib ES2022 puro); sem impacto no jogo.
- **Foundation v0.2 (branch `refactor/foundation-v0.2`)**: primeiros módulos de domínio TypeScript (`stats`, `affinity`, `progression`, `rewards`) e testes Vitest, workspaces npm e CI com lockfile versionado. Sem mudança no runtime, save local ou deploy. Aguardar GitHub Actions e PR.
- **Produção v0.1 atualizada**: PR #1 CSS (`ec94f7ce`) e PR #2 GIFs (`f410011f`) integradas; Railway deploys `07b1754a` e `c0d23c33` ambos `SUCCESS`. Regressão Chromium `43968276615` em `SUCCESS`.
- CI E2E fixado no runner `ubuntu-24.04` compatível com Playwright 1.56.1; o ambiente `ubuntu-latest` usava 26.04 não suportado pela versão fixada.
- Ajuste CI: evitar `--with-deps` do Playwright 1.56.1 em Ubuntu 26.04 (instalador incompatível), mantendo instalação de Chromium e testes E2E.
- 2026-11-16: criados testes Chromium de regressão para desktop/mobile, GIFs e fallback, Pokédex 151, teto manual 40, compatibilidade de save v0.1 e novo jogo; screenshots anexáveis ao workflow. Aguardar CI antes de merge.
- **2026-11-16 · PR de GIFs Kanto em preparação:** branch `feat/kanto-animated-gifs-v01`
  empilhada sobre a PR #1 de CSS. A interface passa a preferir
  `assets/pokemon-gifs/poke_ID.gif` para #001–#151; fallback estático,
  rota HTTP allowlist, importador fixado em SHA, testes, verificador e
  GitHub Actions para copiar os arquivos na branch. Importação **confirmada**
  em `f33122df` (151/151 GIFs, 56.582.531 bytes); workflow
  `43965699462` em `success`, verificador e testes aprovados.
  Segundo workflow `43966345901` em `success`: smoke-test HTTP real de
  `/health`, JS e GIFs 1/151, com HTTP 404 para IDs 0/152.
  **Pendente:** navegador desktop/mobile e compatibilidade manual de save v0.1.
  Salvas locais intocadas. **Deploy:** nenhum para esta branch.
  **Próxima ação:** validar o workflow, testes e as duas PRs antes de merge.
- PR em revisão na branch `refactor/css-tokens-comments-v01`: CSS retirado do HTML, `:root` com tokens de cores/sombras/raios/espaçamentos, classes documentadas, rotas CSS explícitas e testes de contrato; sem alteração de lógica de jogo, sem deploy na `main`.
- Planejada a refatoração v0.2 Foundation: módulos, React/TS/Vite, game-core e testes; **nenhum código de v0.2 implantado ainda**.
- Catálogo de raridades de itens, evolução, ginásios, motor completo de combate e backend pendentes.

## [docs-1.0] — 2026-11-16
**Escopo:** somente documentação e continuidade, sem mudanças de mecânica, JavaScript ou servidor.
- Adicionado `AGENTS.md` como guia obrigatório para novos chats.
- Adicionados documentos de estado, GDD, decisões, arquitetura, design system, convenções e checklist de release.
- Criada referência `assets/README.md` para futuros ativos visuais.
- Atualizado README para corrigir informação antiga: GitHub `main` **já está conectado** ao Railway.
- Registro das diferenças entre o jogo v0.1 implementado e funcionalidades apenas planejadas.
- **Testes desta entrega:** verificação documental e dos arquivos/serviço atuais; nenhum teste funcional novo.
- **Deploy:** verificar resultado terminal da implantação documental e registrar em `docs/PROJECT_STATE.md` no próximo registro de trabalho; não confundir alteração de documentação com nova versão jogável.

## [v0.1.0] — 2026-11-16
- Protótipo HTML/CSS/JS com treinador e Pokémon, stats distribuíveis, afinidade, itens/título/insígnias, Pokédex Kanto, Arena e expedições idle.
- Dados de espécies e golpes pela PokéAPI, com fallback mínimo dos iniciais.
- Primeiro projeto de hospedagem Railway `kanto-idle-lab` e URL pública.
- Usuário confirmou que protótipo está funcional.
- Criado repositório independente `isaquesan7/poke-idle-game`, primeiro commit de publicação `227a079ba3e7bce5740606321b2efa2bb20427a9`.
- GitHub `main` conectado ao serviço Railway; primeira implantação pela fonte GitHub `51d7a571-0adc-4339-ad11-c8fb02343d8e` em `SUCCESS`, com `/health` HTTP 200; commit `9076a3e745ee58a34c5a40e338fc9e45002d9753`.
- Sem backend, sem testes automatizados reais do jogo, sem preservação entre dispositivos; código ainda centralizado em `index.html`.

## Modelo para próximas entradas
```md
## [vX.Y.Z] — AAAA-MM-DD
- Objetivo:
- Alterações (arquivos/funcionalidades):
- Regras ou decisões alteradas:
- Testes executados / não executados:
- Branch e commit:
- Deploy Railway: status e ID (se aplicável):
- Pendências/alertas:
- Próxima ação:
```

- D050 UI compatível da rota legada `/`: retirado somente o card informativo de protótipo (botão de reinício continua presente), o selo "Dados locais" e o rótulo "PokéAPI conectada"; a disponibilidade do servidor agora vem de `GET /health`, independente da PokéAPI. O loop, ações e saves da v0.1 não foram modificados.

- Gate de release D-050: `tests/trainer-original-image.test.mjs` exige presença do PNG original em `apps/web/public/assets/trainer-original.png` e SHA-256 `661fec876c4305f55cd9b6a0321bdaec74cdc908166cd14e05dafe0cf18435f3`. O teste **DEVE FALHAR** enquanto o binário ainda não estiver versionado; não contornar, modificar checksum nem aprovar merge com fallback. A rota `/assets/trainer-original.png` é coberta pelo servidor Vite/Docker depois do arquivo copiado. Pacote ZIP local com PNG original preparado para transferência.

- **Polimento adicional de navegação (mesma PR #75):** sidebar e topo do React `/play` adotaram ícones Font Awesome por aba, bordas e brilho ciano seguindo a referência do usuário, sempre com tokens globais. Textos e nomes acessíveis das ações foram mantidos para não quebrar navegação/testes. O stylesheet é CDN versionado, não incluímos fontes no repositório.

- QA visual das capturas reais da D052: grade de equipamentos desktop estava com células excessivamente grandes (expandindo 5 colunas pela largura toda). Ajustada para cubos compactos de largura máx. ~78px com auto-fill, mantendo 4 colunas mobile e 3 em telas muito estreitas. Preserva slots quadrados, hover/toque e contador. Testes de screenshots desktop/mobile continuam gates da PR.

- Cobertura E2E D052 ampliada: em contextos independentes desktop/mobile, usar o modal para **Equipar** o Boné de Kanto (revisão +1) e **Remover** (revisão +1), conferir `trainer.equipped.hat`, moedas, equipe e título preservados; além de confirmar Cancela sem gravação no fluxo principal. Não altera a fonte de estoque/ownership existente.

- **D053 gate opt-in conectado (sem migração/concessão):** se o JSON `journal.raw` possui `inventory:{version:1,ownedEquipment,extraBagSlots}` válido, `TrainerScreen` lista apenas equipamentos com quantidade positiva, exibe `10+extraBagSlots` de capacidade e `editLegacyTrainerJson` + `validLegacyTrainerDraft` impedem equipar qualquer item não possuído. Ledger corrompido bloqueia equipagem. Saves sem campo `inventory` preservam laboratório e os equipamentos antes equipados; NÃO adicionamos automaticamente nenhum ledger ou item. O limite de capacidade continua informativo até writer de aquisição; expandir de fato depende de fonte de recompensa autorizada. Testes unitários contra forgery e E2E desktop/mobile com fixture de ledger injetado apenas no teste.

- Ajuste de precisão D056: a prévia de status Pokémon usa obrigatoriamente pokemonFinalStats do game-core sobre os pontos manuais projetados, inclusive HP (+2 finais por ponto manual) e contribuições do Treinador/afinidade; evita prévia numérica linear incorreta. E2E confirma HP preview +2, desfaz e garante zero escrita antes do commit.

- E2E D056: jornada de dois Pidgey independentes por UID atualizada para usar prévia + confirmação de SPD (não mais incremento imediato). Confirma revisão intacta antes do commit, depois incremento somente no UID selecionado, preservando o primeiro exemplar.


## D-057 — acabamento das telas Pokémon (2026-11-19)
- Reduzida a exibição do GIF do Pokémon, preservando proporção intrínseca no desktop e mobile.
- Evolução: frase introdutória aparece só quando existem opções; mensagem final simplificada para “Nenhuma evolução disponível para este Pokémon.”.
- Golpes: ação Equipar omitida para golpes já nos slots; custo de aprimoramento explícito de 1 ponto com saldo restante, sem mudar writer ou rank.
- Testes E2E atualizados; CI/merge/deploy dependem dos gates da nova PR.


## D-058 — aprimoramento dos golpes nos quatro slots (2026-11-19)
- Corrigido bloqueio de aprimoramento de golpes ofensivos equipados fora do slot principal. Reducer puro valida agora o conjunto equipado do UID sem modificar o principal.
- Interface apresenta motivos específicos quando não é possível aprimorar (não equipado, rank máximo, pontos insuficientes); custo 1 ponto permanece inalterado.
- Testes core de rank secundário e E2E de treino real sem troca do principal. Publicação/CI/Railway a confirmar no SHA final da PR.


## D-059 — refinamento visual da Coleção (2026-11-19)
- Novo destaque visual da equipe e do líder, cartões individuais por UID com status, nível/afinidade e GIF proporcional, painel de contadores de captura e espécies.
- Busca/filtros existentes preservados, com ordenação local por captura recente, nível, afinidade ou número da Pokédex; filtros mostram contagens e estado vazio permite limpar.
- Novos testes e screenshots desktop/mobile; nenhuma mecânica de equipe, save ou economia alterada. Branch em revisão, sem publicação automática.


## D-060 — refinamento de Coleção e Treinamento Pokémon (2026-11-19)
- Coleção: afinidade agora exibida apenas em porcentagem nos cartões e slots; removidas barras redundantes.
- Slots da Equipe atual permitem Treinar, Retirar e Tornar líder (quando não líder), com as regras já vigentes de expedição e equipe mínima.
- Treinamento Pokémon adota layout e estados visuais dos Atributos do Treinador: +1 brilhante ao hover, controles com mesmas dimensões/cores, − contextual, barras e resumo de pontos harmonizados. Nenhum cálculo ou writer alterado.
- Cobertura E2E desktop/mobile para ações do topo, brilho e ausência de barra. CI e deploy a verificar.


## D-061 — Pokédex Kanto como mini enciclopédia (2026-11-20)
- Cartões da Pokédex visualmente refinados, com tipos visíveis após descoberta, selo de status e indicação de ficha.
- Clique em Pokémon visto/capturado abre modal acessível por teclado/toque, inspirado na referência `isaquesan7/pokedex`, porém implementado de forma independente com os tokens Kanto Dark.
- Ficha: seis stats-base, tipo/ID/arte GIF, linha evolutiva respeitando espécies ocultas, vantagens e fraquezas de tipos, resistências/imunidades e golpes por nível do recorte local FireRed/LeafGreen; sem solicitação de API em tempo real e sem alterar saves.
- Testes E2E para privacidade da Pokédex, modal, foco, Escape, dados e responsividade. CI/merge/deploy a validar.


## D-062 — barras de rolagem Kanto Dark (2026-11-20)
- Unificadas barras de scroll da página, painéis internos e modal da Pokédex: trilho escuro, indicador arredondado e destaque ciano no hover (quando suportado pelo navegador).
- Tokens de design compartilhados entre `/play` e `/`, com suporte CSS para Firefox e Chromium/Edge/Safari, preservando scroll nativo e mobile.
- Teste E2E verifica estilos do documento e da modal; nenhuma mudança funcional ou de save. Publicação sujeita ao CI.


## D-063 — UX/UI da Arena de batalha (2026-11-20)
- Arena redesenhada com líder da equipe, resumo de vitórias/derrotas/insígnias, botão de batalha destacado e descrições concisas sem fórmulas internas de energia.
- Palco e GIFs proporcionais, cartões HP/SP, resultados, recompensas, diário turno a turno e amostra de encontros harmonizados ao Kanto Dark, inclusive layout mobile.
- Nenhuma mudança no core de combate, ritmo do replay, chance de captura, saves ou economia. Teste E2E para indicadores e cards, screenshots desktop/mobile; CI e deploy pendentes.


### D-064AE — catálogo regional em recorte de release independente (não publicado)
- Nova rota /regions com dez áreas acessíveis, teclado e exemplos de GIFs, link navegável no /play. Sem batalhas/capturas/recompensas regionais nem escrita de save.
- Servidor Node entrega /regions pelo HTML React; E2E desktop/mobile confere localStorage intacto. Release condicionado aos gates e aceite explícito; sem deploy.


### D-064AF — laboratório de batalhas regionais sem escrita (não publicado)
- `/regions` passa a oferecer simulação de combate do motor Kanto entre um starter escolhido e espécie ilustrativa da região, com níveis selecionáveis, GIFs, HP e diário gradual. Mensagens do motor que sugerem recompensa/captura real são retiradas da demonstração. Nem save nem inventário recebem alterações.
- Vitest prova determinismo e rejeição de seed inválida; Playwright desktop/mobile executa demonstração e comprova localStorage intacto.


### D-064AG — batalha regional real no writer da Arena (não publicada)
- Nova ação `regional-battle` selecionável pela Arena; desbloqueio por nível no save, espécies e faixas regionais canônicas da prévia, e recompensa pela transação já existente de Arena. Batalha clássica não foi alterada.
- Lendários não são capturados gratuitamente; não existe bolso/custo de bolas neste corte. Registro visual log/frames preservado.
- Testes Vitest e E2E desktop/mobile garantem região bloqueada, commit único, idempotência por revisão e persistência pós-reload. Economia D064 avançada segue separada e não publicada.


### D-064AH — Pokébolas e encontros regionais completos (não publicado)
- Adiciona catálogo de 151 espécies regionais, pesos de encontro e bolas de captura com estoque versionado, 12 bolas iniciais, reposição por vitórias regionais e consumo apenas após vitória. Resultado de captura, XP/moedas e consumo no mesmo writer com recibo único. Lendários só com Ultra Ball. Sem Master Ball automática.
- Arena mostra estoque e seleção de captura, E2E/regressão e testes de integridade de revisão. Semente ainda é local e regras econômicas continuam beta. Arena clássica preservada.


### D-064AI — tela de Regiões funcional com a Arena (não publicada até CI)
- Nova tela Regiões na navegação do jogo e na rota /regions com dez áreas desbloqueadas por nível, catálogo ponderado real de 151 Pokémon, descoberta e capturas por região, vitórias e estoque do bolso; UI responsiva com tokens e navegação por teclado.
- Botão de combate usa a MESMA ação regional do writer da Arena; retorna à Arena para animação, diário gradual e recompensas do save já validado. Rota /regions substitui a demonstração sem save por gameplay de perfil real.
- Vitest e Playwright desktop/mobile verificam locked/unlocked, bolso, leitura sem mutação, batalha com recibo único e persistência após reload.


### D-064AJ — combate exclusivamente regional e curva de XP do treinador (em revisão)
- Remove a entrada direta da Arena e o ataque selvagem genérico; combate abre somente após seleção de uma região, nome regional no cabeçalho, lista de encontros do pool escolhido, botão de retorno e replay do último combate sem recompensas.
- Palco verticalmente centralizado, rolagem automática até o topo ao entrar na luta. Nomes/títulos consistentes com a região real.
- XP treinador desacelerado via threshold quadrático e prêmio por batalha menor, fonte compartilhada entre domínio e replay; XP Pokémon intacto. Vitest e E2E cobrindo nível55, Costa Oceânica, domínio, navegador e responsividade. **Nenhum merge ou deploy até gates**.


## D-064AK (21/11/2026) — em validação, não publicado
- Expedições iniciadas pela interface agora exigem região desbloqueada pelo treinador e nível mínimo do Pokémon líder.
- Writer de recompensas valida região e Pokémon diretamente no snapshot; salva `regionId` e UID de expedição para impedir troca indevida de beneficiário.
- Expedições antigas sem região permanecem resgatáveis; valores e temporização das recompensas seguem idênticos. Cobertura de testes de rejeição, recibos e idempotência.
- Pendente CI/PR/merge/deploy; esta entrada não declara publicação.


## D-064AL (21/11/2026) — auditoria em validação
- Testes determinísticos de avanço pelas dez regiões com nível do treinador e Pokémon, cenários de 20 vitórias/h apenas batalha e modelo hipotético batalha+expedição.
- Novo relatório `docs/PROGRESSION_AUDIT_D064AL.md` com hipóteses, número de vitórias/horas e advertências metodológicas.
- **Nenhuma alteração em runtime, recompensas, desbloqueios, saldo, save ou interface.** PR/CI/deploy pendentes; D064AK foi integrada na main pelo PR #112 com três gates SUCCESS.


## D-064AM — auditoria regional avançada (21/11/2026; em validação)
- Teste determinístico de 4.608 confrontos no motor Kanto nas regiões 7–10, por líder, nível, treino e seed, com métricas de vitórias, derrotas, turnos, duração teórica do replay e XP médio por encontro.
- Documentação em `docs/BALANCE_D064AM.md`. Não modifica gameplay, níveis, chances, XP, save, Pokébolas, expedição, GIFs ou rota pública.
- Publicação apenas após CI e Railway confirmados no commit de integração.


- Resultado D064AM medido em CI no motor: 4.608/4.608 combates, taxa de vitórias da matriz 7=68,06%, 8=63,54%, 9=43,06% e 10=57,73%; p95 teórico normal por região até 26,1 s. Identificado Pico Dracônico como foco da próxima auditoria; sem modificar dano, XP, raridade ou limite de nível.


## D-064AN — auditoria avançada de golpes (21/11/2026; validação)
- Adicionado teste determinístico de 9.216 batalhas no motor das regiões 8–10 com slots realmente equipáveis por nível, comparação default vs learned pareada por seed, XP com derrotas e previsão teórica de apresentação.
- Relatório técnico `docs/BALANCE_D064AN.md`, sem mudanças em gameplay, recompensas, níveis, chances de captura, Pokébolas ou saves.


- D064AN CI de 9.216 confrontos: no Pico, +8,27 pontos percentuais de taxa de vitória ao usar golpes aprendidos equipáveis na matriz pareada (47,26%→55,53%). Sem alteração de parâmetros; consultar documentação e limitações de amostra em `docs/BALANCE_D064AN.md`.


## D-064AO — expansão de golpes PokéAPI (21/11/2026; em validação)
- Snapshot oficial fixo de learnsets FireRed/LeafGreen: 151 espécies, 1.536 entradas por nível e 273 nomes de golpes (metadados de golpe atuais da PokéAPI).
- Amplia os golpes equipáveis de level-up pelo subconjunto de 52 técnicas ofensivas de efeitos já simulados; completa PP e secundários para os novos golpes, preservando os movimentos anteriores e a política de TMs.
- Sem criação de efeitos não suportados, alteração de XP, recompensas, drops, capturas, save v0.2 ou GIFs. Auditoria e fontes em `docs/POKEAPI_MOVES_D064AO.md`.

## 2026-11-21 — D064BB (proposta em PR; NÃO publicada)
- Bosque Inicial: dois encontros aquáticos adicionais, Psyduck #54 e Poliwag #60, em lugar de Rattata #19 e Meowth #52. Rattata passa à região 3 e Meowth à região 4; 151 espécies permanecem exclusivas de uma região.
- Sem pesos diferentes por inicial; 15 espécies de Bosque continuam equiprováveis. Não altera tipo, força, golpes, IA, XP, captura, raridade, níveis, saves ou ativos.
- Testes de cobertura 151, lendários finais, sorteio determinístico e contagem uniforme; resultado da CI e efeito nas vitórias ainda não verificados. Sem deploy.

- D064BB: teste adicional de 3.456 batalhas reais via writer, com mesmas coortes, seeds e políticas de D064BA para comparar taxas de vitória após diversificar o bosque. CI nova ainda pendente, sem deploy.

- D064BB: coortes após mudança em 3.456 batalhas: sem expedição Bulbasaur 43,75% (+6,25 p.p.), Charmander 48,78% (-1,57), Squirtle 38,72% (+6,95); diferença máxima de 18,58 a 10,06 p.p. Nos testes da branch, regressão e Docker/HTTP SUCCESS. Ainda sem deploy até merge/Railway confirmado.


## 2026-11-21 — D064BC (teste em branch; sem gameplay)
- Coortes com movesets ofensivos aprendidos legalmente em FRLG pelo writer e equipes montadas apenas com capturas efetivas; política comparativa de líder único e rotação fixa, 2.592 encontros determinísticos, métricas de vitória/receipts/UID e perfil. Nenhum catálogo, IA, XP, raridade, captura, save, UI ou sprites foi alterado. CI, relatório final e deploy pendentes.

- D064BC: primeiros 2.592 encontros writer passaram na CI; metodologia de seleção de golpes refinada para evitar alternância artificial; relatório final condicionado à nova CI. Nenhuma mudança de gameplay.

- D064BC: CI corrigida aprovada (regressão `44971956167`, Docker `44971956153`) em 2.592 batalhas por writer; políticas isolado vs capturas com rotação: Bulbasaur 38,89/30,09%, Charmander 48,38/32,64%, Squirtle 33,80/30,56%. Sem alteração funcional. Estratégia de rotação arbitrária reduz XP do líder; não é indicação de nerf/buff.

## 2026-11-21 — D064BE (proposta em branch)
- Resultado de batalha regional passa a ser confirmado após o replay via estado pending salvo no writer; vitória/nível/XP permanecem anteriores durante exibição. Capture uma única vez **depois da vitória**, ou dispense a tentativa; a Pokébola escolhida é consumida na ação pós-combate, preservando chances/limitação de raros.
- Histórico independente por UID (vitórias/empates/derrotas), exposto na Arena e no perfil; a Arena deixa de mostrar o bloco de insígnias. Dados históricos sem UID não são redistribuídos artificialmente.
- Melhorias visuais de seletores e estoque, botões e mensagens responsivos. Revisão CI/deploy ainda pendente.

- D064BE — validação funcional confirmada no HEAD `be8b7d1e...`: `44974994526` regressão SUCCESS, `44974994537` Playwright desktop/mobile SUCCESS e `44974994525` Docker SUCCESS. Confrontos postergam créditos até finalizar apresentação; uma tentativa de captura após vitória; histórico UID por Pokémon e seleção estilizada. Release condicionado a merge e Railway SHA exato.

## 2026-11-21 — D064BF (em validação no branch)
- Perfil Pokémon com barra de XP real, nível, XP restante e estado de nível 100; regra de captura alterada para piso evolutivo da espécie (Ponyta nível 1, Rapidash nível 40; Mew/Mewtwo nível 1), independente do encontro. Capturas passadas não são modificadas.
- Arena com indicação visual de nocaute (cinza, só no frame de HP zero) e celebração de Level Up **após confirmação** da batalha. Sem mudanças em probabilidades, recompensas ou IA selvagem. Adicionados testes de progressão/captura e regressão desktop/mobile. Publicação condicionada à CI e Railway.

## 2026-11-22 — D064BG (em branch, CI pendente)
- Exploração com fluxo separado de seleção → Entrar na região (sem encontro) → Batalhar na região (sorteio real), botão de entrada no próprio cartão escolhido para facilitar uso no celular; arena sem adversário mostra ?.
- Captura pós-vitória movida para imediatamente debaixo dos combatentes, sem misturar com a seção de recompensas. Uma tentativa e chances anteriores mantidas.
- Afinidade por UID com derrota −3, empate −1, vitória +2–5 preservada; se ficar 48h sem batalha, −1 no segundo dia e −1 por dia seguinte, até zero. Save guarda relógio e dias descontados, sincronizando sem duplicidade em reload. Saves sem timestamp não recebem desconto histórico presumido. Testes de writer/E2E em execução; nenhuma alteração de IA, captura/XP ou recompensas.

- **D064BG publicado (22/11/2026):** PR #133 merged `4473d93a`, CI `44980487555`/`44980487554`/`44980487602` SUCCESS e Railway `341dc04b-f28c-4a82-a73d-227eeedcdaa7` SUCCESS. Fluxo regional de entrada sem encontro, combate explícito, captura junto do palco, perdas de afinidade por derrota/empate/inatividade idempotentes por UID. Sem mudanças na IA, chance de captura ou XP.

## 2026-11-22 — D064BH (branch/PR)
- Expedição Kanto redesenhada com ícones, layout responsivo, cartões de recompensa, seletor e parceiro estilizados, progresso para próximo ciclo e timer de **tempo total da expedição HH:MM:SS** (persistente desde `startedAt`, sem zerar no resgate, inclusive acima de 24h). Mantida economia e limite de 8h por resgate. Perfil de Pokémon exibe duração até a próxima perda por inatividade, sem alteração da regra. Adicionados testes Vitest e browser. Publicação pendente de CI/merge/Railway.

## 2026-11-22 — D064BI (em PR)
- Acessibilidade Expedição: campos com descrições, estrutura navegável por teclado, foco visível, timer sem anúncios repetidos, status de espera e barra de ciclo acessível. Após atingir teto de 8h pendentes, mostra aviso de resgate em vez de prometer próximos ciclos; tempo total permanece. Refinada a legibilidade em telas pequenas. Sem alteração de XP, moedas, resgates ou save. Testes regressivos pendentes.

## 2026-11-22 — D064BJ (em PR)
- Recompensas de expedições agora aumentam gradualmente por região e são reduzidas quando o Pokémon excede o teto; 8h recalculadas ciclo a ciclo. Não há mais ganho de afinidade ocioso. Pokébolas escassas por ciclos válidos (Poké 4h, Great 8h R5+, Ultra 24h só R9/R10), com contadores transacionais persistentes entre resgates.
- XP, moedas e afinidade das batalhas regionais dependem da diferença de nível do inimigo; a partir de +12 níveis de vantagem, progresso e contagem de histórico bloqueados. UI apresenta régua/região e resultados ajustados. Sem mudança na IA selvagem, chance de captura, níveis dos Pokémon capturados ou XP absoluto Lv100. CI e publicação pendentes.

- **D064BJ PUBLICADO (22/11/2026):** PR #136 SHA `3e62a721`, regressão `45019043101` SUCCESS, Playwright `45019043064` SUCCESS, Docker `45019043071` SUCCESS e Railway `30c73023-e94d-4c0d-8e84-be56a3c76072` SUCCESS no mesmo SHA. Escalonamento regional 7/4/5 → 16/13/14, caps de XP/afinidade/moedas/contagens por nível, XP de expedição recalculado por ciclo, sem afinidade passiva, Poké/Great/Ultra Ball raras por horas válidas. Economia idempotente e testes concluídos.

### 2026-11-22 — D064BK (em branch; não publicado)
- Testes diagnósticos de progressão e economia das expedições para níveis iniciais 1–100 e 40 resgates, com contadores persistidos de Pokébolas.
- Documento `docs/PROGRESSION_ECONOMY_D064BK.md` registra premissas e próximos gates da futura loja.
- Sem alterações funcionais, sem deploy confirmado; CI pendente.

### D064BK — ajustes após auditoria (22/11/2026, PR #137, CI/deploy por confirmar)
- Expedições deixam de acumular progresso de Pokébolas em ciclos cuja recompensa integral efetiva é zero após redução e arredondamento (corrige farm passivo com Pokémon no limite da área).
- Testes de requisitos duplos treinador/Pokémon, progressão travada em R3 antes de Lv20 do treinador, 40 resgates de 8h com totais exatos e cenários de sensibilidade da loja ainda hipotéticos.
- Relatório quantitativo e limites de decisão em `docs/PROGRESSION_ECONOMY_D064BK.md`. Não houve mudança de taxa-base, UX, IA, dados salvos ou preços de loja. A publicação depende dos testes, merge e Railway no SHA correto.

- D064BK UX: a tela de Expedição agora evidencia os próximos marcos de Poké/Great/Ultra Ball em **ciclos elegíveis** e avisa quando redução regional mais arredondamento zera o rendimento e pausa o contador de bolas. SSR e E2E do novo rótulo incluídos. Verificação CI/merge/deploy do último HEAD ainda pendente.

- D064BK testes adicionais: writer de resgate com rendimentos zerados preserva mochila/progresso de bolas e receipt idempotente; grupo dos próximos marcos nomeado para leitores de tela. Sem migração/schema alterados.

### 2026-11-22 — D064BK publicada
- PR #137 integrada por squash na main em `cc3ae7d1abf9e13561be7cdaac87c926c59a563c`, CI (regressão geral, Playwright, Docker) SUCCESS no HEAD `da1973ed8fb1eb5b0dbcd06bc9ccfe50df773e3c`.
- Railway Docker deploy `b5316053-3a63-4ce7-b19b-d6a722051092` **SUCCESS**, `/health` interno aprovado; HTTP público não confirmado diretamente. Correção do contador de Pokébolas em rendimento zero e marcos UI em ciclos elegíveis agora publicados.

### 2026-11-22 — D064BL (laboratório em PR)
- Novos testes diagnósticos de progressão mista expedição+batalha identificam possível softlock de líder único na transição R3→R4 (treinador Lv19 ainda bloqueia R4 ao ficar sem recompensas na R3).
- Não altera gameplay, IA, economia, desbloqueio, save ou release; documenta cenários ideais de recuperação e necessidade de testar o motor de combate de verdade.

- D064BL: amostra adicional de 120 combates determinísticos com motor real, starters evoluídos e rivais da R3; diagnóstico de viabilidade de vitórias, sem alterar IA nem resultados. Ajustados asserts de XP para incluir implicitamente metadata `gainedLevels`; CI do HEAD novo pendente.

- D064BL adicional: teste de sensibilidade R1–R10 compara gates de treinador atuais com hipótese de recuperação (SOMENTE em teste). Cenário alternativo desbloqueia R10 mas antecipa Pokémon Lv100 para 32–80h de expedição, dependendo da cadência de resgate. Nenhum requisito real foi alterado. CI anterior sucesso geral/Docker, novo HEAD exige validação.

### D064BL — publicação do diagnóstico (22/11/2026)
- PR #138 integrada em main SHA `0cc799a1c59b94256abe31aa93b0ff2d102e2a2f`; CI geral `45023267167` e Docker `45023267171` SUCCESS no HEAD `34a987fa`. Railway deployment `fe12885f-f80a-4328-b270-5cf19c73d14f` SUCCESS no merge, sem alterar gameplay. Evidência de softlock da curva antiga e risco de aceleramento caso apenas baixassem os gates de treinador.

### D064BM — correção sistêmica do XP Pokémon (22/11/2026; BRANCH, pendente de release)
- A partir do nível 21, Pokémon passa a exigir `65+22L+7×max(0,L−20)²` XP para subir, mantendo níveis1–20 idênticos. A curva do treinador, ganhos regionais, IA, limite Nv100, afinidade, rareza/ciclos de Pokébolas, captura, saves e desbloqueios do treinador permanecem intactos.
- Cenários determinísticos com resgates 5m/2h/8h passam por todas 10 regiões sem softlock, com alvo de Pokémon100 em 399–440h e treinador100 em 433–472h de ciclos elegíveis; nenhuma XP/grant retroativa. Relatório `docs/POKEMON_XP_CURVE_D064BM.md`.
- Ampliados testes para compatibilidade de saves antigos, recuperação de treinador Lv19/Pokémon Lv41 e novos totais de 40 claims/loja, sem definir preços. CI/merge/deploy **ainda não verificados para D064BM**.

- Novo teste de integração com writer real verifica que 67 vitórias regionais elegíveis recuperam treinador Lv19/Pokémon Lv41 sem reprocessar o mesmo receipt, sem XP de captura ou afinidade gratuita.

### D064BM — release confirmado (22/11/2026)
- PR #139 `feat/d064bm-pokemon-xp-curve-unlock-safety` MERGED na `main`, SHA `a26bde2ce55b98a455e6845e0a800ac4c0375d54`; HEAD testado `dd84dba96ad6f2bba30a24f19db2982e13326f17` com GitHub CI geral `45024095411` e Docker `45024095537` **SUCCESS**.
- Railway deployment `e5d8c22d-c101-4f65-8d75-30238a03d090` **SUCCESS** no commit exato, build Vite OK, Node porta8080, `/health` interno OK, 1 réplica online. GET externo público não confirmado; warning não fatal de chunk frontend >500kB registrado para futura otimização.
- Entregue a curva gradual de XP Pokémon pós-Lv20, mantendo early game, treinador, desbloqueios, sistema de regiões, combats, bolas, raridade e saves. Simulação e testes completos em `docs/POKEMON_XP_CURVE_D064BM.md`.

### D064BN — balanço de moedas e Pokébolas (22/11/2026; EM PR)
- Corrigida a fonte gratuita de Ultra Ball: `d064DraftBallDrop` é **ativo no writer**, apesar do nome histórico, e antes concedia Ultra a cada 15 vitórias nas regiões R7–R10. Agora vitórias de qualquer região **não** geram Ultra; só expedições elegíveis de R9 e R10 a cada 24h geram Ultra. Sem mudança de Poké a cada 3 vitórias R1–R6, Great a cada 7 vitórias R4–R10, XP, IA, raridade, save ou saldo antigo.
- Cobertura de 10 regiões/105 vitórias, writer real da 15ª vitória R7, 60 resgates de 8h e 3 coortes de iniciais com motor real de batalha + consumo de bolas. Simulação bruta 60 claims: 1.798.545 moedas, 131 Poké (12 iniciais), 55 Great, 7 Ultra; preços da loja NÃO definidos.
- Relatório `docs/ECONOMY_CAPTURE_AUDIT_D064BN.md` registra queda de disponibilidade de Ultra e raridade extrema da combinação aparição×captura de Mewtwo; decisão futura de loja/raridade pendente. CI/merge/Railway não concluídos para esta branch.

- Correção de integridade adicional: limitar `regionWins[i]` a 100.000 no writer com constante core compartilhada. Antes, a vitória nº100001 podia corromper a elegibilidade do save e impedir futuras batalhas. Agora XP/moedas e confrontos válidos continuam; a contagem saturada não gera novas bolas nem altera os recibos anteriores. Teste web no teto por duas vitórias. Sem migração destrutiva.

### D064BN — release publicado e auditado (22/11/2026)
- PR #141 MERGED por squash em main SHA funcional `b36d967090207c5cf62c6e5f69506a3d6125488a`; HEAD final `1b5cd91c8cb289d7af66b2eb951f05947e2c02b4` testado com GitHub Actions **SUCCESS**: regressão geral `45026142968`, Playwright isolado desktop/mobile `45026142970`, Docker `45026142964`.
- Railway `22a96b5c-1434-463e-bcb3-132052d08d73` **SUCCESS** no commit exato, `/health` interno aprovado, serviço online com uma réplica e zero crashes. HTTP público externo não conferido diretamente.
- Ultra não sai mais de vitórias regionais em nenhum mapa; permanece só em expedições elegíveis R9/R10 a cada 24h. Contador de vitórias regional saturado em 100.000 sem invalidar save nem replicar drops. Moedas, XP, IA, captura/raridade, outras bolas, slots e saves preservados. Testes de economia e cap documentados em `docs/ECONOMY_CAPTURE_AUDIT_D064BN.md`.

### D064BO — correção da Ultra de combate e foco UX da arena (22/11/2026; BRANCH/PR)
- **Errata explícita D064BN:** restaurado drop de Ultra Ball a cada 15 vitórias regionais **desde R7**; restrição R9/R10 e 24h vale **só para EXPEDIÇÃO**, mantida integralmente. `d064DraftBallDrop` e `d064DraftBallSupply` e testes core/web ajustados, sem tocar no histórico/cap100k ou remoção de bolas obtidas.
- Removida rolagem ao topo do `PlayApp` a cada revisão; ao entrar/iniciar/reassistir combate, foco/rolagem vai ao palco; ao vencer ou tentar capturar, fica na área de captura, inclusive falha, em mobile e desktop, com foco programático sem abrir teclado.
- Cartão grande de level up substituído por `LEVEL UP!` animado sobre o sprite do parceiro por ~2,3s, depois desaparece; `prefers-reduced-motion` respeitado. O aviso depende do writer e não duplica XP/recompensa.
- E2E regional com foco no palco/captura e nível verdadeiro no writer adicionado; documento `docs/D064BO_COMBAT_FOCUS_AND_ULTRA_POLICY.md`. Sem implementação da loja/preços; CI, PR, merge e Railway ainda a verificar.

### D064BO — correções publicadas (22/11/2026)
- PR #143 MERGED na main SHA `230c78b8312593ba1eae7820e2fc40cafde127f2`, HEAD `04ba433caf31911f641922449530e8e0f702224c` aprovado em regressão geral `45028737965`, Playwright desktop/mobile `45028737971` e Docker `45028738017` **SUCCESS**.
- Railway deployment `7a144fd5-b4b0-4ebc-ab1a-e0b16a03d536` **SUCCESS** SHA exato, `/health` interno OK, 1 réplica online sem crashes. GET público externo não verificado.
- Ultra por vitórias regionais desde R7 restaurada (+1 a cada 15), Ultra de expedição ainda exclusiva de R9/R10 (24h elegíveis); navegador foca palco/captura e não sobe ao topo; LEVEL UP flutuante e breve sobre sprite aliado, cartão removido. Teste obsoleto `scrollY===0` corrigido e revalidado na CI final. Nenhum preço/compra de loja alterado.

### D064BP — loja em prévia e foco do ciclo de batalha (22/11/2026; em PR)
- Entrar/iniciar batalha continua focando arena; vitória com captura pendente foca Pokébola; após captura com sucesso/falha, ignorar captura, derrota ou empate, o foco agora **retorna ao botão “Batalhar na região”** e sua posição de viewport, acessível no celular. Mudança de foco aguarda botão reabilitado após writer; não toca RNG/XP/afinidade/captura e preserva LEVEL UP sobre sprite.
- Nova aba Loja com catálogo Poké/Great/Ultra, saldo/bolso reais e preços ainda a definir, sem controles de compra. Core quote puro exige política confiável e valida moeda, nível, lote, bolso, teto100k, sem mutar. No runtime preços não estão ativados; tests usam preços **ilustrativos**, nenhum débito/receipt ainda. Master Ball não vende.
- Política R7+ Ultra por vitórias regionais e R9/10 Ultra por expedições permanece intacta. Documento `docs/D064BP_SHOP_AND_BATTLE_LOOP.md`; PR CI/merge/Railway pendentes.

### D064BP — release confirmado (22/11/2026)
- PR #145 merged squash em main funcional `2fd92cabf543a7bb226b6f538f16b90c6dfbae4f`; HEAD `28954addd5efbdcec36cf07497fa62ed961b165a` CI geral `45031998462`, Playwright `45031998427`, Docker `45031998410` **SUCCESS**.
- Railway prod `c4f31170-a222-4f9a-b7cc-0a0c58178ccf` SUCCESS SHA exato, `/health` interno OK, 1 réplica online, 0 crashes. Foco no botão “Batalhar na região” após captura resolvida/pulada ou derrota/empate; vitrine Loja read-only com catálogo/saldo/estoque, **sem preços aprovados/compras**. Nenhuma alteração da regra de Ultra por modo, XP ou capturas.

### D064BQ — drop aleatório e loja beta transacional (22/11/2026; EM PR)
- Vitória regional remunerada agora sorteia **0/1 Pokébola**, sem marcos fixos de 3/7/15: chances R1–3 Poké30%; R4–6 Poké25%/Great14%; R7–8 Poké18%/Great14%/Ultra5%; R9–10 Poké18%/Great14%/Ultra7%. O seed+battleId reproduz a rolagem no writer, receipt impede duplicata, drop exibido na recompensa. regionWins satura 100k sem interromper drops se vitória elegível, bolso satura 100k sem bloquear combate. Expedição inalterada, Ultra apenas R9/10 nesse modo.
- Loja deixa de ser só vitrine: preços beta V1 Poké600/Great2400/Ultra16000 moedas, desbloqueios Lv1/20/55, lote 50/25/10 e Master fora da venda. Compras por `RewardCommand shop-purchase` calculam preço confiável em core e salvam débito/crédito/recibo/revisão em uma transição; guardas replay, stale, falta de fundos, mochila cheia e duas abas. UI desktop/mobile com seleção de quantidade e feedback. Sem garantia antifraude de servidor na alfa local. Documento `docs/D064BQ_RANDOM_DROPS_SHOP.md`. CI/merge/Railway pendentes.

### D064BQ — release confirmado (22/11/2026)
- PR #147 merged squash em main `337ce1cbd1ca44021e92370f325ef0615f2c2b53`; HEAD final `57280d0a4bab43cbde1bf308a8c7171111925dfe`, GitHub CI geral `45034879515`, Playwright desktop/mobile `45034879419` e Docker `45034879435` **SUCCESS**.
- Railway deploy `856530c2-8c30-4c82-9098-49adccb7e188` SUCCESS SHA exato, `/health` interno OK, 1 réplica running, 0 crashes. Drops aleatórios 0/1 bola por vitória remunerada e chances regionais 30% Poké R1–3, 25% Poké/14% Great R4–6, 18% Poké/14% Great/5% Ultra R7–8, 18%/14%/7% R9–10. Sem prêmios por marco fixo; expedição inalterada. Loja beta funcional em moedas Poké600/Great2400/Ultra16000 com recibo, atomicidade de saldo+item, quantidade e trava de compras duplicadas.

### D064BR — correção de resgate e auditoria econômica (22/11/2026; EM PR)
- Corrige bloqueio total de expedição com mochila de Pokébolas lotada: agora satura o tipo em100k, entrega moedas/XP normalmente e avança o cursor; `lastClaim.ballDrops` e prévia mostram só unidades realmente recebidas, com aviso no UI mobile/desktop.
- Adiciona teste longitudinal sintético de 1.000 vitórias por faixa (R1/4/7/9/10) cruzando drops RNG, 8h de expedição, preços beta, compra e captura real, garantindo contabilidade e sem vender essa amostra como telemetria. Testa captura rara única no writer e bolso inválido bloqueado sem perda de save.
- Exibe taxas regionais no catálogo Loja com tabela acessível, extraída da mesma função de drop do core. **Sem alterar os percentuais 30 /25+14 /18+14+5 /18+14+7, preços 600/2400/16000 ou regras de Ultra em expedição R9/R10**. CI/merge/Railway pendentes.

### D064BR — release confirmado (22/11/2026)
- PR #149 `7054c3790800ee4e71c2ee597ca9a576e5f9c90c` merged squash; HEAD CI geral `45037200926`, Playwright `45037200948`, Docker `45037200949` todos SUCCESS. Railway deployment `5f3bc6d4-a8ea-470e-b4bc-89a98ae3c6be` SUCCESS SHA exato, `/health` interno OK, 1 réplica running e 0 crashes.
- Mochila no limite100k não recusa mais todo o resgate de expedição: moedas/XP e cursor mantidos, drops reais saturados e aviso/preview corrigidos. Testes de captura lendária sem repetição, auditoria sintética de moeda/bola/loja/captura e chances transparentes no UI. As porcentagens de bola, economia de expedição e preços beta continuam intactos.


## D064BS — XP da expedição para Pokémon líder (22/11/2026, EM PR)
- Cálculo regional concede XP apenas a `pokemon[0]` e devolve zero nas demais posições; writer faz crédito exclusivo ao primeiro UID da expedição, inclusive no fallback de saves sem região.
- Testes de claim/stop preservam XP de reservas e verificam no core ciclos, nível máximo e anti-farm. Nenhuma mudança em XP treinador, moedas, Pokébolas, preço da loja, insígnias, Pokémon selvagens ou combate.
- **Sem merge/deploy confirmado neste registro.**


## GYM-01 — catálogo estático dos Ginásios Kanto (22/11/2026; EM PR)
- Novo `gyms/kantoGyms.ts` com oito líderes históricos, equipes adaptadas 3×3, níveis fixos, recompensas candidatas e regra pura de acesso sequencial que rejeita saltos, repetição e histórico inválido.
- API exportada no core, testes Vitest verificam espécies, ordem, bônus cumulativos (99 pontos) e título planejado (+12 em seis atributos).
- **Sem combate de Ginásio, escritor, insígnias concedidas, reset de saves ou alteração do jogo publicado.** CI/PR/merge/deploy a verificar.


## GYM-02A — base da IA e preparação 3×3 (22/11/2026, EM PR)
- Novo core `gyms/gymTactics.ts`: escolher três UIDs em ordem sem duplicatas, alocar somente os pontos legais do líder, selecionar golpes disponíveis na versão FRLG e pontuar ações com dano médio, imunidade, custo de SP, cura/status e troca limitada.
- Testes de oito elencos, orçamento de pontos, indisponibilidade de UIDs e ausência de mutação. **Não é ainda uma batalha 3×3 executável; não há writer, UI, insígnias, XP ou moedas.**

- Durante validação, detectado bloqueio legítimo da equipe Sabrina: Kadabra/Alakazam precisam de suporte a efeitos dos golpes psíquicos (77/73); teste confirma bloqueio explícito em vez de moveset fabricado. Corrigido cálculo temporário de dano da IA para TypeScript `exactOptionalPropertyTypes`. Uso de Concentrar com SP baixo é escolha tática válida.


## GYM-02B — HP persistente em Ginásios e SP condicionado à troca (22/11/2026; EM PR)
- Core puro `gyms/gymBattleState.ts` mantém 3 HP/SP individuais por lado, sem restaurar HP ao trocar, ao vencer Pokémon ou ao retornar. Troca voluntária custa uma oportunidade, até 3 por equipe; apenas o Pokémon recolhido recebe até 20% SP máximo, uma única vez por confronto. KO obriga substituição gratuita sem recuperação de SP. Limites simétricos jogador/líder.
- Vitest `gym02b-persistent-team.test.ts`: ausência de cura automática, volta à arena com HP anterior, SP sem duplicação, 3 trocas, KO sem recarga, vitória após 3 KOs, mesmas regras para ambos os lados.
- Ainda não implementa combate por turnos 3×3, integração com UI/writer, insígnias ou recompensas; nenhum efeito nas lutas regionais. CI/merge/Railway pendentes.


## GYM-02C1 — rodada 3×3 determinística sem recompensas (22/11/2026, EM PR)
- Novo resolvedor puro `gyms/gymTurn.ts`: ações ofensivas equipadas, básico grátis e troca de membros, com iniciativa por prioridade/velocidade/seed, custo de SP, dano existente, HP individual persistente e KO com substituição obrigatória sem turno grátis.
- Testes `gym02c-turns.test.ts` verificam troca consumindo ação, alvo recém-entrado recebendo dano, SP sem reset, recusa de movimentos inválidos, substituição forçada e determinismo.
- **Ainda NÃO há combate completo 3×3**: efeitos de suporte/status/secundários, multi-hit, Concentrar, integração IA, UI/save e recompensas pendentes; nenhuma alteração em regiões/capturas/insígnias.


## GYM-02C2a — Focus, cura ativa e multi-hit (22/11/2026, EM PR)
- `gymBattleState.ts` passa a guardar `focusUses`, `lastFocusTurn` por instância e `turn` global; `focusGymSp` limita Concentrar a 2 usos com intervalo mínimo de 4 turnos, sem reset por troca; `healGymHp` aplica cura apenas explícita.
- `gymTurn.ts` aceita ação Concentrar, Recover equipado e golpes multi-hit, com custo único por ação, acerto por ação e danos por impacto; status e efeitos secundários ainda bloqueados até suporte fiel.
- Testes `gym02c2-focus-heal-multihit.test.ts` cobrem quotas SP, cooldown que persiste após troca, ausência de cura automática, Recover por ação e golpes duplos. Sem interface, insígnias ou writer; CI/merge/deploy a confirmar.


## GYM-02C2b1 — status, imunidade e estágios em Ginásios (22/11/2026; EM PR)
- Criado `gyms/gymEffects.ts`: status da instância, imunidade de tipo, quedas de Attack/Defense/Speed limitadas a seis estágios. A estrutura `GymFighterState` guarda estágios por Pokémon, persistindo após troca.
- `gyms/gymTurn.ts`: suporte de veneno/paralisia, golpes com efeito secundário permitido de poison/burn/paralysis, quedas de velocidade, debuffs, drenagem e residual por burn/poison; paralisia altera iniciativa. Golpes de sono, efeitos psíquicos não suportados e Twineedle ainda bloqueados.
- Novos testes `gym02c2b-status-effects.test.ts` para estado individual, resistência, dano residual, estágio máximo e recusa de efeitos pendentes. Nenhuma UI, insígnia, save ou reward nesta etapa; CI/merge/deploy a verificar.


## GYM-02C2b2 — Sabrina, confusão e Psychic (22/11/2026; EM PR)
- `gyms/gymPsychicMoves.ts` expõe três golpes psíquicos verificados por nível no snapshot FRLG: Confusion e Psybeam (10% confusão), Psychic (10% queda de Sp.Def).
- `gymTactics.ts` passa a preparar legalmente Kadabra e Alakazam, liberando a montagem dos oito elencos planejados; não altera catálogo dos combates regionais.
- `gymEffects.ts` guarda `confusionTurns` por Pokémon, com duração de 2–5 ações próprias, pausa na reserva e 50% de chance de autoacerto; `GymEffects` passa a contemplar Special Defense.
- `gymTurn.ts` aplica efeitos após acerto e usa o modificador de Sp.Def no dano especial. Testes `gym02c2b-psychic-sabrina.test.ts`; CI, merge e Railway pendentes.


## GYM-02C2c — sono, Twineedle e duplo KO residual (22/11/2026; EM PR)
- `GymFighterState.sleepActions` guarda sono por instância (1–3 ações próprias), respeitando recolhimento; `gymApplySleep/gymTickSleep` e motor de turnos resolvem sono sem custo de SP ao perder a ação.
- Twineedle não é mais bloqueado no motor de Ginásios: precisão/SP uma vez por ação; poison 20% após cada hit com dano real, interrompendo após KO.
- `applyGymResidual` aplica dano residual dos dois ativos de forma atômica, com resultado `draw` quando ambas as equipes completas desmaiam juntas; substituição forçada simétrica quando ambos têm reservas.
- Vitest dedicado `gym02c2c-sleep-twineedle-residual.test.ts` inclui sono/trocas, poison por hit, empates e 12 duelos 3×3 completos; teste anterior de sono atualizado. Regiões, expeditions, recompensas, writer e UI inalterados. CI/merge/deploy a verificar.


## GYM-02D — IA legal dos líderes e limite de 120 rodadas (22/11/2026, EM PR)
- `gymTurn.ts` disponibiliza `gymLegalTurnActions` como fonte única para jogador e IA, sem contornar SP, cooldown, equipagem ou quota de troca. Confrontos restantes na rodada 120 terminam em `draw`; substituições obrigatórias não avançam o turno.
- `gymAiTurn.ts`: adaptador determinístico do `gymAiDecision`, filtrando golpes e reservas para ações legais, respeitando Concentrar e escolhendo substituição pós-KO pelo percentual de HP da reserva, sem RNG futuro; `resolveGymAiTurn` executa ação do treinador contra a IA.
- 32 confrontos completos com seeds fixas entre equipes dos oito líderes, verificação de legalidade e budgets, replay idêntico, troca forçada e empate técnico em `gym02d-ai-turn-policy.test.ts`. Sem writer, badges, UI nem mudança no motor regional. CI/merge/Railway a verificar.


## GYM-03A — base atômica para recompensas dos oito Ginásios (22/11/2026, EM PR)
- `legacy/rewardEvents.ts` ganha `gym-victory` com idempotência e revisão do `RewardJournal`: valida sequência, UID/propriedade da equipe, vitória e KO dos três oponentes oficiais; moedas/XP do catálogo e insígnia em um único receipt. Replay não duplica prêmio.
- A concessão automática de badges por vitórias nas regiões/selvagens foi removida. `LEGACY_TITLES.mestre` tem +12 em HP, Attack, Defense, Sp.Atk, Sp.Def, Speed; projeção do treinador, combate e painel de Insígnias usam agora `KANTO_GYMS.badgeStats` e mostram líderes/desbloqueio por Ginásio.
- `gym03a-badge-reward-journal.test.ts` cobre sequenciamento, idempotência, adulterações, oito recompensas e 24 vitórias regionais sem insígnia. **Não ativado no PlayAction nem na UI de Ginásios** até um writer que gere estado de batalha e prova local a partir de comandos de turno; não é antifraude de servidor. CI/merge/deploy pendentes.


## GYM-03B — sessão versionada, ações reproduzíveis e recompensa única (22/11/2026, EM PR)
- `apps/web/src/play/gymSession.ts` reconstrói equipe de UIDs próprios a partir do save, bônus de treinador e moves equipados, IA/seed inicial, reproduz transcript completo e valida cada ação de turno. Comandos `gym-start/turn/finish/abandon` persistidos no próprio snapshot v0.2; não aceitam estado ou resultado do navegador.
- `updatePlaySave` preserva controle de revisão/CAS e bloqueia todas as ações não-Ginásio enquanto uma sessão estiver ativa; vitória efetivamente simulada chama `gym-victory` do GYM-03A com recibo no mesmo commit final, com sessão removida. Abandono/empate/derrota não concedem badges nem dinheiro.
- `gymSession.test.ts` cobre equipe inválida, sessão exclusiva, mutação paralela negada, persistência por reload, transcript adulterado, derrota/abandono e recompensa única após 3×3. **Sem UI de Ginásio e sem backend/antifraude remoto.** CI, merge e Railway a verificar.


## GYM-04A — tela de Ginásios integrada e jogável (22/11/2026, EM PR)
- Nova aba `Ginásios` em `PlayApp` com oito desafios sequenciais, líder/cidade/bônus, escolha de três Pokémon distintos, estado 3×3, HP/SP, troca, Concentrar, golpes legais, finalização e abandono confirmado.
- `GymScreen.tsx` reproduz histórico do `gymSession` para exibir turno e resultado, sem transferir HP/dano ou recompensa ao writer; `GymScreen.module.css` aplica responsividade e rótulos acessíveis. `PlayApp` impede navegação indevida e não sincroniza afinidade durante uma sessão.
- Teste Playwright `playable-route.mjs`: aba Ginásios acessível desktop/mobile, próximo líder Brock, Misty bloqueada, seleção insuficiente não inicia nem muta save. Os testes GYM-03B seguem cobrindo sequência real e recibo. CI/merge/deploy pendentes.

## 2026-11-22 — GYM-04C: reformulação visual da batalha (em PR)
- Depois de iniciar o Ginásio, a lista de líderes sai de cena e abre um painel de duelo dedicado, inspirado na Arena regional: um Pokémon ativo por lado, GIF maior, HP/SP, status e VS.
- Os dois reservas de cada lado aparecem abaixo em mini-cartões com HP/SP próprios. Os Pokémon do jogador oferecem Trocar quando a ação é legal (inclusive substituição forçada); habilidades e Concentrar ficam em bloco separado.
- Nenhuma alteração no motor de combate, na IA, no writer, no RNG, no limite de trocas, nas insígnias ou nas recompensas. Desktop/mobile responsivos. CI e deploy pendentes.

- GYM-04C: ensaio E2E adicional com trio de teste, recarga de duelo, combate completo Brock e recibo único de insígnia em desktop/mobile (resultado CI ainda pendente).

## 2026-11-22 — GYM-04D, integração sobre arena publicada (PR pendente)
- Diário de combate mostra últimas oito ações calculadas do transcript/seed pelo mesmo motor, sem gravar estado extra.
- Foco retorna às habilidades após ação normal, às reservas após KO e ao botão Finalizar ao terminar.
- Preserva integralmente layout GYM-04C da main, sem alterar regras, recompensas ou limites. Teste de trace determinístico, sem mutação de storage. CI/merge/Railway desta etapa pendentes.

## 2026-11-22 — GYM-05: efeitos visuais sem RNG novo (em branch)
- Após GYM-04D, replay do Ginásio calcula deltas reais de HP, SP, entrada e KO para cada ação. Em cada novo turno confirmado, a UI exibe breve impacto/cura/recarga/entrada usando CSS, mantendo os GIFs ativos montados; abrir sessão após reload não dispara efeitos falsos.
- Animações FULL em todos dispositivos, preservando escolha de produto D042. Nenhuma mudança no motor, ações, seed, writer, recompensas ou persistência.
- Vitest confere dados de delta e E2E no desktop/mobile verifica cue apenas após ação, imagens GIF com identidade preservada e ausência de cue ao recarregar. CI, merge e deploy ainda pendentes.


## 2026-11-22 — GYM-06 (em PR; ainda NÃO publicada)
- Nova experiência dos Ginásios 3×3 reusa diretamente `BattleStage` e `BattlePlayback` das regiões, inclusive nocaute, barras de HP/SP, diário e seus controles. Removidas as animações CSS GYM-05 duplicadas. Arena e reservas receberam sombra, brilho e ícones dentro da paleta Kanto Dark.
- Os três Pokémon do jogador batalham pela mesma IA legal do líder. Ambas podem trocar defensivamente em HP crítico, respeitando três trocas voluntárias por lado, recuperação SP limitada e KO sem cura. Iniciar desafio ativa a IA automaticamente; há pausa/retomada, sem ações manuais.
- Sessão conserva seed/transcript, writer CAS/idempotente e avaliação de recompensas somente na vitória; projeções before/after por turno sustentam o palco comum. Novos testes simétricos no core e jornada Chromium desktop/mobile usam IA, diário, reload e recibo único. CI/PR/merge/deploy a confirmar.

- GYM-06 evolução dos efeitos: frames de ataque, crítico, tipo, cura, Concentrar, troca e KO agora sincronizados por linha real do log do Ginásio, no formato do `BattleStage` regional. `BattlePlayback` ganhou `initialVisible` opcional para manter diário acumulado e só revelar novos eventos; regiões mantêm default anterior. Finalização bloqueada visualmente até terminar a apresentação. Teste browser cobre KO do palco regional, diário cumulativo e recompensas únicas.

## 2026-11-22 — GYM-07 + ONLINE-01A (em PR, sem release confirmado)
- Ginásios: cabeçalho agora usa `<Líder> × <Nome do treinador>`; novas frases do diário distinguem treinador em troca/KO e Pokémon em golpes, traduzindo `basic-attack` para `Ataque Básico` e `lower-attack` para `Ataque`, sem modificar o log técnico ou replay determinístico. Reservas KO usam grayscale/escurecimento/deslocamento e selo de nocaute no padrão regional. Testes do formatador adicionados.
- `/` não serve mais o protótipo v0.1; nova `landing.html` provisória reserva cadastro/login e aponta para `/play`. `/index.html`, CSS e JS legados devolvem 410; `/play` mantém experiência v0.2. Docker runtime não copia mais HTML/CSS/JS do protótipo; apenas landing, servidor, GIFs e bundle React.
- ONLINE-01: criado serviço PostgreSQL pelo template Railway no projeto existente; serviço `Postgres` ID `c1411126-70c6-40c1-84c0-817f8323edea`, deployment `14040f35-5e4a-4d22-b266-3c41ed847e2c` SUCCESS. SQL inicial, API isolada com registro **OFF** por padrão, scrypt/sessões e testes de helpers, sem salvar estado enviado pelo navegador.
- Não haverá migração/importação do save local. **SQL não foi aplicado, API não foi implantada/ligada ao `/`, cadastro/login não estão disponíveis, jogo em `/play` continua local**. Ver `services/api/README.md` e docs/PROJECT_STATE. CI/merge/Railway do site ainda pendentes.

### GYM-07 / ONLINE-01A — release confirmado (22/11/2026)
- PR #173 squash-mergida na main `3b4fd73d5bf1e9916da64e90ed844ab0e7a2a797`. HEAD de código `ebf8712b31db7153cf8aee0d428bdf107a73a1ac`: CI geral `45076485548`, Playwright `45076485510`, Docker `45076485516` e audit `45076485574` todas **SUCCESS**.
- Railway `kanto-idle-web` deployment `5cdd9baf-5add-4a8c-90b5-773b89b513aa` **SUCCESS** no SHA exato, runtime Node ouvindo na porta 8080, sem staged pending; Docker smoke validou `/` landing, v0.1 410, `/play`, GIFs/JS/CSS. GET público externo não foi validado diretamente.
- PostgreSQL Railway serviço Postgres também SUCCESS e volume persistente anexado. **Banco NÃO recebeu a migration SQL; API está inativa e não existe conta/save online.** Continua proibida importação de saves locais.

## ONLINE-01B — API isolada e banco testado (22/11/2026; em PR #175)
- Migração SQL 001 corrigida para **não abrir transação dentro da transação do runner**; `migrate.mjs` aplica DDL com advisory lock, checksum imutável e journal de migrações, repetição idempotente.
- Novo `services/api/package-lock.json` gerado e verificado pelo GitHub Actions usando npm, fixando `pg@8.23.1`; API possui Dockerfile próprio Node 22 Alpine, rootless, sem Vite/React, GIFs, código ou saves do cliente. Workflow específico testa npm ci, auth/scrypt, Postgres 18 real, migration 2 vezes, HTTP login/logout, CSRF/origin, no-save-import e imagem API isolada.
- Guarda de segurança: registro/login **só podem ser habilitados em NODE_ENV=test** nesta etapa, mesmo se ONLINE_REGISTRATION_ENABLED=true em produção. Autenticação pública não disponível; não foram criados jogadores reais nem ativado PUT arbitrário de save.
- Deploy API, migração no Railway e backup ainda requerem confirmação; o banco e web existentes não foram alterados por esta branch. Nenhum save local será migrado.

### ONLINE-01B — release privado confirmado (22/11/2026)
- PR #175 integrada na `main` por squash `5eb734b8909cebae24f8b7e7222d1a413706189f`; HEAD `4ed45c1726bcac7e32b24ca855bd7955e0040989`. CI: API PostgreSQL 18 `45078485312`, regressão geral `45078485401`, Playwright `45078485366`, Docker web `45078485325`, audit `45078485380`, todas **SUCCESS**.
- Novo Railway `kanto-idle-api` serviço `b1d8ce7b-a837-4c02-98e6-a36e6d0cdb1d`, deployment `09114505-7588-434e-9e4f-624c278beede` **SUCCESS** na mesma SHA; pre-deploy log `ONLINE-01 migration aplicada: 001_online_foundation.sql`. Healthcheck `/health` configurado; runtime Node na porta8080 com log `registro desabilitado`.
- Serviço API **sem domínio público, sem proxy frontend**, conectando Postgres via Railway private env reference. Serviço Postgres e web igualmente SUCCESS e nenhum pending work. Não há login/registro visíveis e `/play` continua local; saves de teste NÃO importados. Backups/recovery drill, verificação de e-mail, rate limit e escrita autoritativa pendentes antes de abrir contas reais.

## ONLINE-01C — proteção de contas antes da abertura pública (em PR)
- SQL 002: contadores PostgreSQL de tentativas e tokens de verificação de e-mail com hash, executados pelo mesmo migrator atomicamente com checksum/ledger. Rate limiting distribuído para login, cadastro e verificação usando UPSERT e HMAC para identificadores de IP/e-mail.
- Em CI somente, registro entrega token de teste de uso único (não há entrega de e-mail ainda); login exige `email_verified_at`; reuso do token falha e excesso de login produz 429. Produção continua **hard-locked**, sem registro/login aberto e sem persistência originada do cliente.
- CI Postgres18 expandida com cenários de verificação, replay de token e bloqueio distribuído, mantendo root / e /play inalterados. Backups/PITR e envio real de e-mail são gates futuros; não há migração de saves locais.

### ONLINE-01C-1 — release privado confirmado (22/11/2026)
- PR #177 MERGED por squash em `4420fd4d29cd90241380fb39f9d1132eaf002cbb`; HEAD da PR `0da69e50baf2c75e4e1d1a4f3e655e7ee06c5915`. CI específica API/PostgreSQL18 `45079651579` e regressão web completa `45079651455`: ambas **SUCCESS**.
- Railway serviço privado `kanto-idle-api` deployment `e84f5562-ebb4-4068-bdc3-c39761cc1276` **SUCCESS** no mesmo commit. Logs de predeploy: `migration já aplicada: 001_online_foundation.sql` e `migration aplicada: 002_auth_limits_verification.sql`; runtime `registro desabilitado` na porta 8080. Web e Postgres também SUCCESS.
- A schema passa a conter `game_auth_throttles` (contadores atômicos por digest) e `game_email_verifications` (tokens únicos com hash). Verificação real por e-mail e backups/restore seguem **não confirmados**; cadastro de produção permanece bloqueado; `/play` local e sem importação de saves.


## ONLINE-01C-2 — recuperação de senha e adaptador Resend (em PR)
- Migration 003: token 30 minutos, uso único e SHA-256. Redefinir a senha revoga as sessões anteriores. Request de email inexistente não revela conta e recebe rate limiting por IP/email.
- Adaptador HTTP de emails Resend com Idempotency-Key; teste unitário via fetch injetado, sem env secret no GitHub. Envio desligado por padrão, autenticação de produção bloqueada.
- Testes PostgreSQL reais de reset e cookie revogado. Sem implantação de tela de contas e sem importação de saves de /play.


### ONLINE-01C-2 — release privado confirmado (22/11/2026)
- PR #179 integrada por squash na main SHA 611d928d7954c8b08bd4a01f3afc3aa99ef9141b, HEAD validada edd129f417ca7f0d2f1660af5c28bb959fe0c7a5. CI API PG18 45081671999 SUCCESS, regressão geral/Chromium 45081672028 SUCCESS.
- Railway serviço privado kanto-idle-api deployment 89f64284-2d9e-4d5a-aa73-d8677d9add02 SUCCESS no SHA exato. Logs: migrations 001/002 já aplicadas, 003_password_reset.sql aplicada; runtime inicializado com cadastro desabilitado.
- Recovery testada no banco descartável e adapter Resend testado via mock, mas remetente/credenciais de e-mail real ainda NÃO configurados, envio real NÃO realizado. Backups e restauração ainda não confirmados, /play local e nenhum save importado.


### ONLINE-01C-3 — save inicial autoritativo (branch, CI pendente)
- `initialAdventure.mjs` constrói perfil novo 1/4/7 lv1 só a partir de perfil autenticado + relógio do servidor. Endpoint test-only `POST /api/v1/adventure/start` aceita apenas starterId e grava save + receipt em transação PostgreSQL com unicidade por conta; dupla tentativa retorna 409 sem remuneração duplicada. Conta existente não pode sobrescrever save.
- Testes unitários dos 3 iniciais, integração PG de rejeição de payload forjado e corrida de duas solicitações. Workflow executa `pg_dump` + `pg_restore` num segundo banco CI descartável para simular recuperação lógica, não se confunde com backup/restauração real do Railway.
- Não habilita cadastro de produção, não conecta /play à API e não migra localStorage. Limite de nome API alinhado com /play em 24 caracteres.

## ONLINE-01C-4 — proxy privado same-origin (branch; NÃO publicado)
- Novo `online-api-proxy.mjs` permite encaminhar apenas rotas `/api/v1` explicitamente autorizadas ao serviço interno, quando `ONLINE_API_INTERNAL_URL` for configurada de forma privada. Sem variável, retorna 503 e nenhuma conexão é feita.
- Preserva cookies de sessão e `Origin`, elimina cabeçalhos Forwarded não confiáveis, limita corpo a 16 KiB, não expõe CORS e impede proxy genérico. Docker runtime inclui o módulo. Testes Node verificam isolamento e encaminhamento.
- Nenhuma alteração no `/play`, nos saves locais, nas regras de ginásio ou na ativação de contas. A API de produção mantém autenticação bloqueada. CI, revisão e deploy ainda pendentes.

## ONLINE-01C-5 — interface de contas preparada (branch, não publicada)
- Landing `/` redesenhada como portal de treinadores responsivo com login, cadastro e recuperação; `/verify-email` e `/reset-password` servem o mesmo shell de autenticação.
- Formulários desabilitados por padrão; somente podem executar chamadas same-origin se `/api/v1/status` retornar explicitamente `registrationEnabled:true`. Ambiente real ainda retorna false/503. URLs com token são limpas do histórico ao iniciar e sem referrer.
- Nenhuma migração de saves `/play`; nenhum cadastro habilitado e nenhum endpoint de escrita de progresso local alterado. Smoke Docker estendido; testes e merge pendentes.


## ONLINE-01C-6 — primeira ação incremental autoritativa (branch, sem deploy)
- Nova operação de API `POST /api/v1/trainer/invest` apenas em harness test-only: recebe somente `actionId`, `expectedRevision`, `stat`. A conta vem da sessão, os pontos vêm do nível e do save no servidor; não aceita moedas, XP, badges ou save arbitrário. Regras: +2 pontos por nível acima do 1, limite de 40 pontos manuais por atributo.
- Transação com `SELECT FOR UPDATE`, `revision` esperado e recibo único por conta/ação. Concorrência e retries não duplicam investimento. Atualiza JSON envelopado e revisão junto do recibo em PostgreSQL; sem mutação do `/play`.
- Testes unitários e integração PostgreSQL 18 cobrem orçamento, payload malicioso, origem, corrida, replay, revisão e preservação do inventário/recompensas. Rotas disponíveis apenas no harness, produção permanece bloqueada. CI e merge ainda pendentes.


## ONLINE-01C-7 — entropia privada para batalhas no backend (branch)
- Utilitário interno da API `createPrivateBattleRandom`: fluxo reprodutível de HMAC-SHA256, chave exclusivamente do servidor com >=32 bytes, separado por conta/encounter UUID/etapa, seleção inteira sem viés de módulo, limites estritos de entrada. Testes Node cobrem reprodução, domínios e parâmetros inválidos.
- Nenhum endpoint novo, nenhum encontro concedido, nenhuma batalha/captura simulada e nenhum lançamento de contas. Antes de usar o utilitário, o servidor PRECISA persistir/reservar encounter ID e recibo em transação, derivar contexto de sessão, aplicar motor oficial da batalha e gravar resultado/efeitos na mesma sequência transacional. Nunca aceitar seed, batalha, recompensa ou resultado do navegador.
- Produção e `/play` preservados; PR e CI ainda pendentes.

## ONLINE-01C-8 — reserva persistente de encontros (branch, sem rota pública)
- Migração PostgreSQL `004_encounter_reservations.sql` cria identificador UUID de encontro gerado no banco, restrição `UNIQUE(account_id,action_id)`, histórico por conta e índice único parcial de encontro reservado pendente.
- Serviço interno `reserveEncounter` verifica revisão e recibo de ação, serializa modificações pelo lock da linha `game_saves`, reserva a primeira região somente, grava encounter+revision+receipt na mesma transação e devolve o mesmo UUID a retries do mesmo actionId.
- Nada é sorteado nem concedido: sem espécie, recompensas, HP ou consumo de Pokébolas. Não há endpoint de criação/fechamento de encontro; não permite criar outro encontro enquanto o anterior está reservado. Teste PG18 cobre concorrência, stale, replay e invariantes de não-recompensa.
- Não altera `/play` nem migra save local. CI, merge e deploy pendentes.

## ONLINE-01C-9 — materialização do primeiro encontro no backend (PR, sem acesso público)
- Migração `005_encounter_materialization.sql` acrescenta espécie, nível, versão do RNG e data de materialização a reservas já persistidas; um CHECK exige os quatro campos juntos, sem estados parciais.
- Serviço INTERNO `materializeReservedEncounter` lê reserva do banco com `FOR UPDATE`, escolhe espécie/nível R1 com HMAC privado do servidor e persiste antes de responder. Retries/worker concorrente (ou chave trocada) retornam espécie e nível já gravados, sem reroll. Pool e faixas da região 1 são verificadas contra a fonte game-core em teste automatizado.
- Não é batalha/captura nem recompensa; não adiciona endpoint, não configura segredo de produção, não altera `/play`. Testes PostgreSQL 18 verificam concorrência, replay, preservação do inventário/progresso e constraint SQL.

## ONLINE-01C-10 — preparação persistida do combate (branch)
- Migração `006_battle_snapshot.sql`: congela dados mínimos do encontro preparado em `battle_snapshot` JSONB e data, com CHECK exigindo materialização prévia completa.
- Serviço INTERNO `prepareReservedBattle` lê a conta/UUID de reserva pertencentes ao servidor; valida o save, líder de equipe, nível, atributos manuais e espécie/nível já materializados. Persiste no banco uma fotografia da equipe ativa e do adversário; chamadas repetidas/concorrentes retornam a mesma fotografia.
- Não calcula dano, status, SP, IA, drops ou XP; não abre endpoint, não grava seeds, não expõe cálculo arbitrário do cliente, não altera save ou recibos. Os cálculos oficiais de combate/moves/stats devem ser reutilizados do game-core no próximo estágio.
- Testes Node/PG18 cobrem campos esperados, dados ilegais, concorrência, replay após modificação do save, CHECK e ausência de recompensas. CI e merge ainda pendentes.

## ONLINE-01C-11 — adaptador puro de combate canônico para snapshots online (branch)
- Adicionado `packages/game-core/src/combat/serverFrozenBattle.ts`: valida contrato da fotografia `ONLINE-01C-10`, reconstrói combatentes exclusivamente com catálogo Kanto, atributos oficiais, pontos manuais e aprendizado de golpes FRLG permitido para o nível, e monta conjunto de golpes selvagens pela mesma regra usada em `/play`.
- `previewFrozenWildBattle` usa o MESMO `simulateKantoBattle` com seed uint32 fornecida pelo backend; retorna HP/SP, resultado e log/frame, mas NÃO expõe a captura automática do simulador legado, afinidade ou moedas. Não escreve nenhuma recompensa ou save; nenhuma rota HTTP foi aberta.
- Testes Vitest verificam paridade exata de motor, estatísticas, IA selvagem, validação de golpes de nível futuro, orçamento de pontos e resultados reproduzíveis. CI e merge pendentes.

## ONLINE-01C-12 — bundle privado canônico e prévia persistida (branch)
- A imagem da API privada agora compila `serverFrozenBattle.ts` usando esbuild do lockfile do monorepo em estágio Docker separado, copiando apenas o bundle ESM para a imagem runtime Node + pg; sem React, Vite, TS ou node_modules de desenvolvimento no runtime.
- Novo módulo interno `previewReservedBattle`, sem endpoint: exige UUIDs do banco/conta, chave HMAC de servidor e snapshot validado; resolve o combate pelo bundle canônico, salva `battle_preview` e `battle_preview_at` na migração 007. Retries e trabalhadores concorrentes recebem exatamente o resultado persistido, mesmo com troca de chave.
- Prévia contém resultado/turnos/HP/SP/log/frames, sem seed, captura automática, afinidade, moedas ou recompensas. Reserva continua `reserved`, sem recibo de conclusão ou mudança no save. CI PG18 testa concorrência, replay e ausência de grants.
- Cadastro público hard-disabled, sem rotas novas, `/play` local independente. CI, revisão e merge ainda pendentes.

## ONLINE-01C-13 — selagem transacional do desfecho, SEM recompensas (branch)
- Nova migração `008_battle_outcome_seal.sql` registra resultado do combate, ID da ação, revisão e horário de selagem, exigindo prévia já materializada e desfecho coerente com a prévia. ÍNDICE único por conta+ação bloqueia repetição com outra reserva.
- Serviço INTERNO `sealReservedBattle` autentica identidade apenas a partir da futura camada de sessão: usa account/encounter UUID e actionId como chave idempotente, nunca recebe ou confia em outcome do navegador. Faz `FOR UPDATE` primeiro no save, depois na reserva, confere receipt/revision, insere receipt `battle-seal` e sobe apenas `revision` de save+journal, sem mexer em `journal.raw`.
- A reserva permanece `reserved` mesmo após selar. Não é encerramento com premiação: outra batalha continua bloqueada até existir liquidação autoritativa de recompensas e fechamento. Testes PG18 verificam concorrência, replay, colisão de receipts, integridade SQL, não criação de novos encontros e ausência de grants. Sem endpoint HTTP, cadastro público continua desativado.

## ONLINE-01C-14 — cotação autoritativa de recompensas, sem crédito (branch)
- `quoteFrozenBattleRewards` reutiliza EXATAMENTE as fórmulas Kanto de `battleProgressFactor`, `scaledRegionalReward`, `battleTrainerXp`, `beginnerBattleXp` e as penalidades de afinidade. Inclui moedas, XP treinador/Pokémon, variação da afinidade, histórico de batalhas e fator de região; nenhum método de captura/insígnia ou reembolso.
- Bundle privado de Node passa a exportar a função pura juntamente com `previewFrozenWildBattle`; nenhuma mudança de jogabilidade em `/play`.
- Migração `009_battle_reward_quote.sql` grava a proposta uma única vez, somente depois do resultado selado. Serviço interno `quoteSealedBattleRewards` produz o sorteio 2–5 de afinidade somente com RNG HMAC do servidor, sob row lock do encontro; retries de qualquer processo/chave retornam a mesma proposta persistida.
- Testes Vitest de taxas, loss/draw e cap de overlevel; testes PG18 de corrida, rollback, imutabilidade, integridade e ausência de grants. Não fecha reserva nem avança revisão do save. Merge/CI pendentes.

## ONLINE-01C-15 — pagamento transacional, sem captura nem abertura de novo encontro (branch)
- Redutor puro `applyFrozenBattleRewardQuote` reutiliza `grantXp` e reconfirma cotação congelada frente a todas as quatro rolagens de afinidade possíveis calculadas pelo core, rejeitando valores extras, overlevel, estado divergente e saldo estourado. Atualiza moedas, XP, níveis, afinidade, wins/losses/draws, histórico do UID e vitórias da região 1, até o cap de 100k. Não cria Pokémon, Pokébolas nem insígnias.
- Migração `010_battle_payout.sql` registra ação idempotente, revisão de pagamento, recibo e instante em encontro; CHECK exige resultado selado e reserva pendente. Serviço interno `paySealedBattleRewards` trava save e encontro, verifica receipt/revisão, modifica `journal.raw`, `revision` e receipt `battle-payout` em uma só transação PG18. Replay da mesma ação retorna o crédito original sem creditar novamente; actionId novo não paga de novo.
- Após pagamento, encontro continua `reserved`: finalização e escolha de captura serão passos separados; evita repetir encontros/capturas antes de concluir a saga com débito de bolas. Sem rota HTTP ou abertura de cadastro. Testes core e PG18 cobrem crédito único, concorrência, limites, integridade SQL, sem captura ou novo encontro.

## ONLINE-01C-16 — uma tentativa de captura ou desistência; encontro encerrado (branch)
- Redutor puro `finalizeFrozenWildEncounter` compartilha as regras existentes `resolveKantoCaptureAttempt`/bolso/catálogo/captura por HP. Captura só após vitória, com inimigo derrotado; uma Poké/Great/Ultra Ball é descontada inclusive na falha; Master Ball não é liberada. Vitória com captura cria um único Pokémon (UID novo, nível inicial canônico, golpe legal, sem XP/afinidade/insígnias extras). Decisão `skip` preserva bolso e elenco e também finaliza.
- Migração `011_capture_finalization.sql` permite que reserva selada e paga passe de `reserved` a `completed` somente com decisão + ação/revisão/recibo íntegros. Ajusta CHECKs anteriores sem modificar migrações imutáveis, mantém unique index de uma reserva ativa por conta e cria índice único da ação final.
- Serviço INTERNO `finishPaidWildEncounter` bloqueia primeiro save, depois reserva, confere actionId/revision/receipt/resultado/cotação paga; deriva RNG privado HMAC da fase `wild-capture`; faz débito/UID/save/revisão/status/comprovante num só COMMIT. Retry da mesma ação devolve resultado persistido; ação diferente não consegue tentar outra bola após falha.
- Testes unitários de acerto, falha, desistência, inventário insuficiente, derrota, UID e bolso; testes PostgreSQL 18 de concorrência, recibos, replay, captura e liberação de próximo encontro. Sem novo endpoint HTTP e registro público desativado.

## ONLINE-01C-17 — drop aleatório canônico de Pokébolas no backend (branch)
- A função `d064BattleBallDropFromRoll` reutiliza as taxas D064BQ já publicadas, sem alterar o hash/seed do jogo local: R1–R3 30% Poké; R4–R6 25% Poké + 14% Great; R7–R8 18% Poké + 14% Great + 5% Ultra; R9–R10 18% Poké + 14% Great + 7% Ultra. Em qualquer vitória elegível, **no máximo uma bola**, sem marcos fixos de vitórias.
- O serviço privado `quoteSealedBattleRewards` deriva uma rolagem uniforme 0–9999 de HMAC SHA-256 na fase separada `wild-battle-ball-drop`, congelando `ballDropId` na cotação persistida. Empate, derrota ou diferença de nível que zera o fator não geram bola. Repetição da cotação não sorteia novamente.
- O redutor `applyFrozenBattleRewardQuote` reconfirma o drop contra todos os buckets canônicos e credita uma bola **na mesma transação do payout** já protegida por actionId, revisão e receipt. Ao atingir 100.000 unidades/100.000 vitórias na região, somente o drop adicional é limitado, sem bloquear demais recompensas. Cotações PG anteriores à mudança, sem `ballDropId`, permanecem aceitas com zero drop.
- Testes Vitest das 10.000 rolagens/buckets por grupo de região, overlevel, inventário e quote adulterada, além de integração PG18 com HMAC, vitória, corrida de pagamentos, persistência, encerramento sem captura e nova reserva. Sem rota pública, alteração de UI ou migração de saves locais.

## ONLINE-01C-18 — sessão inicial de combate selvagem por turnos (branch)
- Novo contrato PURO `createFrozenWildTurnSession` no game-core reaproveita combatentes, tipos, atributos, golpes equipados e SP do motor Kanto canônico; registra estado inicial HP/SP máximo, status, contador de turnos/foco e até quatro golpes do selvagem vindos do learnset FRLG. O jogador atualmente tem UM golpe efetivamente equipado por snapshot v1; não inventar quatro slots liberados. `initialFrozenWildTurnActions` mostra básico gratuito e golpe equipado com custo canônico; Concentrar não aparece com SP cheio.
- Migration append-only `012_wild_turn_session.sql` cria estado JSONB do turno e instante; CHECK impede coexistência com prévia automática, selagem, cotação, payout ou finalização. Inicialização interna `startReservedWildTurnSession` trava save→encontro, reconfere que snapshot congelado ainda corresponde ao save, grava sessão uma vez e devolve replay estável. Prévia automática recusa encontro iniciado em modo de turnos.
- Sem aplicar ações ainda, sem simular turno, HP/SP/dano, IA tática por ação, resultados de batalha, recompensas ou capturas no novo modo. Isso será recorte posterior; fluxo automático legado continua funcional para encontros não iniciados em modo de turnos. Nenhuma nova rota HTTP nem alteração em `/play`/saves locais.
- Testes Vitest do contrato canônico e PG18 de corrida, replay, incompatibilidade de modos, integridade SQL e preservação integral de saldos e receipts; schema 12 em CI/restore descartável.

## ONLINE-01C-19 — rodadas selvagens transacionais pelo resolvedor Kanto existente (branch)
- O adapter puro `resolveFrozenWildTurn` utiliza o **mesmo** `resolveGymAiTurn`/`gymLegalTurnActions` para ataque básico, golpe equipado, Concentrar, prioridade, dano, condições, limite de SP e IA tática. Confronto online R1 é 1×1; dois slots KO-sentinela em cada lado impedem trocas fictícias sem payload real de três Pokémon. 30 rodadas no máximo, estado vivo de HP/SP/status/efeitos persistido, log e frames juntos, sem RNG exposto.
- `013_wild_turn_receipts.sql` cria auditoria append-only por ação e número do turno, com constraints/UNIQUE; `applyReservedWildTurn` valida ação estrita, save/revisão, snapshot congelado, fase e modo; deriva seed privado HMAC `wild-turn-N`, revalida ações via game-core e grava estado/recibos/revisão de forma atômica no PostgreSQL. Repetição de actionId e payload devolve recibo original mesmo com chave HMAC diferente; actionId reaproveitado com outra ação é bloqueado.
- Sessão final com `phase='resolved'` preserva outcome mas NÃO gera `battle_preview` legado, NÃO sela, NÃO paga/permite captura: a ligação segura entre término interativo e economia ficará para fase separada. Sem HTTP, sem contas públicas, sem migração de /play.
- Testes Vitest de rodadas, golpes ilegais, cooldown e deterministicidade; PG18 de corrida, replay, SQL, imutabilidade de raw save, ausência de recompensas e bloqueio do caminho automático. Migrações: 13.

## ONLINE-01C-20 — certificado transacional do combate por turnos (23/11/2026, branch)
- Migração 014 e serviço privado `wildTurnCertificate.mjs` conferem histórico de recibos, HP/fases e resultado real da sessão selvagem concluída. SHA-256 persistido apenas como identificador de integridade do transcript; sem payout, captura, fim da reserva ou alteração do save bruto.
- Recibo único `wild-turn-certificate` e revisão transacional; testes PG18: sessão não resolvida, histórico adulterado, corrida/replay, constraints, créditos zero e nova reserva bloqueada. Workflow de restore descartável passa a esperar 14 migrações.
- Sem abertura de contas, sem rota pública, sem migração de /play. PR/CI/merge/deploy pendentes, backup real e email remetente ainda não validados.

## ONLINE-01C-20 — release privado confirmado (23/11/2026)
- PR #201 merged `main` `02664059f9000f4ebda0cf1a95f7b8d0f790f83c`; CI PostgreSQL18 `45161503524 SUCCESS` e regressão geral `45161503432 SUCCESS`. Tentativa anterior falhou no assert de 13 migrations, atualizada e revalidada com 14.
- Railway API privada `abe302ea-4166-4476-958f-ba31dc29506e SUCCESS` (migração 014 aplicada, registro OFF) e web `0ff38a72-4e8c-4c95-a55d-c6ad1ca6e6ec SUCCESS` no mesmo SHA. Sem teste HTTP externo do site neste registro.
- Certificado de desfecho de turnos é interno, sem recursos, sem concluir encontro, sem alterar `/play`. Próximo: liquidação por turnos com verificação independente; gates de backup/Resend/LGPD e abertura de contas permanecem pendentes.

## ONLINE-01C-21 — liquidação privada de combate interativo (23/11/2026, branch)
- Adiciona `wildTurnSettlement.mjs` com replay independente e determinístico por ação/ordem usando motor Kanto + RNG HMAC privado; compara 100% dos turnos e estado terminal com o histórico, sem assumir que digest SHA-256 basta. Chave trocada sem histórico bloqueia o prêmio.
- Após validação, reutiliza somente a **política pura de recompensa** do core para calcular XP/moeda/afinidade e uma bola aleatória de vitória elegível, em transação única `journal.raw + revisão + wild-turn-payout receipt + quote/receipt PG`. Não grava `battle_preview` e não usa o writer legado de preview.
- SQL append-only 015 e CI 15 migrações, testes concorrência/replay/fraude estrutural/HMAC/PG18/restore descartável. Cadastro real e captura/skip nesse modo NÃO liberados; `/play` local sem migração. PR/CI/merge/Railway a verificar.

- Segurança adicional: prova HMAC-SHA256 persistida no primeiro turno de combate, comparada em todo turno posterior e antes do pagamento. Protege também contra chaves diferentes que, por coincidência, produzam o mesmo log/HP; replays de receipt permanecem idempotentes.

## ONLINE-01C-21 — payout autoritativo por turnos confirmado (23/11/2026)
- PR #203 merged `main` `1d3e69d8b5ad0f7f5030c68567975d3c1a649264`. GitHub Actions API PG18 `45164653052 SUCCESS`, geral React/Chromium `45164653117 SUCCESS`. Migrar schema 015/15 e restaurar banco DESCARTÁVEL/testes do fluxo HMAC/payout OK.
- Railway API privada `616bbb6d-4027-44d0-8ead-4d307442879a SUCCESS`: logs SQL 015 aplicada e cadastro desabilitado. Web `67daaf7b-7776-447a-af28-35c691a0c31c SUCCESS` mesmo SHA funcional; HTTP público externo não conferido.
- Payout de batalha por turnos é somente interno, exige prova HMAC histórica e replay integral antes de aplicar política pura de recompensa. Receipt idempotente, sem captura/skip, sem concluir reserva ou abrir novos encontros; `/play` local sem migração. Próxima ONLINE-01C-22 finalização segura por turno e snapshots completos.

## ONLINE-01C-22 — captura ou desistência após luta por turnos (branch, 23/11/2026)
- Novo writer backend `finishPaidWildTurnEncounter`: exige pagamento de turno certificado, prova HMAC histórica, reexecuta todos os turnos e revalida cotação antes de permitir `skip` ou uma única captura após vitória. RNG privado separado `wild-turn-capture`; usa política pura do core, sem persistir `battle_preview` ou ativar as ações do combate automático.
- Migração 016 append-only permite `reserved → completed` exclusivamente quando há um recibo de finalização próprio `wild-turn-finish`. Resultado, gasto de 1 Pokébola (sucesso/falha), Pokémon capturado/UID/Pokédex e save são gravados em uma única transação; idempotência garante zero gasto duplo. `skip` não altera recursos. A próxima reserva é permitida **somente** após fechamento.
- CI PG18 e restore descartável agora verificam 16 migrations; testes vitória/derrota, fraude, corrida, replays/UID/bolsa/captura/skip. Nenhuma conta pública nem rota HTTP, `/play` local sem migração; PR, CI e Railway a confirmar.

## ONLINE-01C-22 — finalização de batalha por turnos publicada (23/11/2026)
- PR #205 MERGED `main` `6c90334725e0e8e866282d935d18bd0d41ea1504`, CI API PostgreSQL18 **`45167796707 SUCCESS`** (16 migrations/pg_dump/restore descartável/CI Docker, scripts de captura/skip/antifraude/atomicidade) e regressão React/Chromium **`45167796811 SUCCESS`**.
- Railway API privada deployment **`9d54d7fb-7674-45b1-80db-ec79c41a2418 SUCCESS`** (SQL **016 APLICADA**, cadastro OFF) e web **`17707d45-4cf8-4724-b907-28d7c98efcf0 SUCCESS`** SHA exato, sem HTTP externo verificado.
- Uma batalha interativa paga pode terminar em `skip` ou uma captura depois da vitória: replay canônico+HMAC com quote conferida antes do débito/UID/Pokédex, tudo no mesmo commit/receipt, sem reroll; encerra reserva e permite próxima batalha. Serviço apenas interno, sem rota HTTP, saves `/play` continuam locais e sem migração. Próximo ONLINE-01C-23 snapshots completos de 4 golpes/equipe/bonificações e política de keyring HMAC; backup/PITR real, Resend e LGPD ainda bloqueantes.

## ONLINE-01C-23A — quatro slots de golpes canônicos, somente servidores privados (23/11/2026, branch)
- Snapshot v2 de combate preserva exatamente 1–4 golpes **equipados** por UID com validação FRLG de espécie/nível e suporte, sem auto-equipar todo o learnset, sem TM ou status fictício. Snapshot v1 e `/play` mantêm a forma anterior. Motor Kanto e IA de Ginásio são reutilizados no combate por turnos para as quatro escolhas.
- Writer interno `equipPokemonMoves` com lock e revisão de save, ação idempotente, bloqueio de qualquer encontro pendente e receipt transacional por UID/ordem de golpes, em `017_pokemon_move_loadouts.sql` append-only. Nenhuma moeda, XP, bolsa, insígnia ou Pokémon criado ao equipar.
- CI passa a validar 17 migrações PG18 e restore descartável, e testes integram equipamento→snapshot→turnos→certificação→payout→skip. Equipe 3v3, equipamento/título/insígnia e keyring HMAC seguem próximos recortes ONLINE-01C-23B/C; PR/CI/Railway a verificar. Cadastro OFF, saves de `/play` não serão migrados.

## ONLINE-01C-23A — loadouts FRLG explícitos publicados (23/11/2026)
- PR #207 integrada à `main` SHA **`42560b5662bcf2d4d4c31aa6ba471d45c3e0652b`**. CI API PG18 **`45172698646 SUCCESS`**, regressão geral React/Chromium **`45172698865 SUCCESS`**, Docker/HTTP web **`45172698624 SUCCESS`**. 17 migrações, testes de snapshot v1/v2, seleção canônica 1–4 FRLG, writer com receipts/lock, batalha completa por turnos, restore PG18 descartável.
- Railway API privada **`9104c194-c2ca-4ebe-9e40-598b20fe7e71 SUCCESS`**, logs `017_pokemon_move_loadouts.sql APLICADA` e `registro desabilitado`; web **`69c9f793-a9e2-46c6-bec6-ce9c8d38c310 SUCCESS`** mesmo SHA. Sem verificação externa HTTP independente.
- Somente golpes realmente equipados são usáveis: v1 preserva um golpe, v2 congela seleção de 1–4 por Pokémon e nunca usa golpe não aprendido/TM/futuro. `equipPokemonMoves` interno é idempotente e bloqueia mudanças durante encontro. Próximos 23B equipe 3v3/bônus e 23C keyring HMAC. `/play` segue local, sem migração, cadastro público OFF; backup/PITR/restore Railway real, Resend e LGPD pendentes.

## ONLINE-01C-23B1 — equipe real no combate selvagem (23/11/2026; branch)
- Snapshot v3 para 2–3 Pokémon reais equipados, posição/UID/nível/HP/SP/status/slots próprios. Reutiliza o motor e IA dos Ginásios, com troca voluntária limitada, substituição forçada gratuita após KO, HP não curado automaticamente e recuperação limitada de SP ao recolher.
- Certificação e replay de batalha por turnos avaliam resultado da equipe inteira; o selvagem permanece único, sem membros fictícios que possam lutar. Recompensa regional considera maior nível de todos os membros para impedir farm com reservas overlevel, mas atribui R1 uma única vez ao UID de abertura até política de participação própria. SQL 17 migrations intactas, sem novos endpoints ou migração local.
- Testes unitários e PG integração 3 membros/KO/forged/turno/quote/payout/skip; CI, merge e Railway ainda a confirmar. Próximo 23B2 writer de equipe e buffs legítimos, depois 23C keyring HMAC.

## ONLINE-01C-23B1 — equipe real no combate selvagem publicada (23/11/2026)
- PR #209 MERGED na `main` SHA **`ecc2ae614dba4b616141fe317227fba05ca7a402`**. CI API PostgreSQL18 **`45182209591 SUCCESS`**, React/Chromium **`45182209686 SUCCESS`**, produção web/HTTP **`45182209628 SUCCESS`**. Testou equipe de 3, 3 trocas, reservas preservadas, KO forçado gratuito, derrota/resultado, captura com débito exatamente 1 bola, HMAC, replay, payout e 17 migrations/restore PG18 descartável.
- Railway API privada **`dad71ac3-dee6-46db-a784-0ff9c3ef820b SUCCESS`** (SQL 001–017 já aplicadas, registro OFF) e web **`813597ab-1e5f-4b32-ab82-c9b68139b873 SUCCESS`** SHA exato; não houve HTTP externo independente.
- Snapshot v3 (2–3 Pokémon verdadeiros, 1 selvagem), mesma IA/motor dos Ginásios, HP/SP/status por UID e troca/KO sem cura automática; score R1 continua exclusivo ao lead enquanto maior nível da equipe controla o fator regional anti-farm. `/play` local intacto e sem importação. Próximo 23B2 writer de equipe + equipamento/títulos/insígnias e distribuição, 23C keyring HMAC; backups/PITR+restore real, Resend/LGPD pendentes.

## CORREÇÃO — Regiões 1v1, Ginásios com trio definido na Coleção (23/11/2026; branch)
- Reverte a funcionalidade indevida de três Pokémon em encontros selvagens introduzida em ONLINE-01C-23B1; restaura snapshot 1v1 v1/v2, sem ação de trocar Pokémon nas Regiões, preservando os quatro golpes FRLG equipados por UID do 23A.
- Ginásios passam a usar EXATAMENTE a equipe de três Pokémon previamente salva na Coleção. `gym-start` só recebe seed e copia a ordem de `game.team`; rejeita lista arbitrária de UIDs. `GymScreen` retira picker/checkboxes, apresenta trio atual e botão de navegação à Coleção; alterações de equipe após entrar na sessão impedidas.
- Testes de regressão JS+PostgreSQL18+Chromium para impedir retorno do 3v1 regional e seleção dentro do Ginásio; 17 migrações preservadas; CI/PR/Railway por confirmar. Cadastro OFF, sem migração de `/play`, sem tocar no repositório Pokedex.

## Correção publicada — Região solo e equipe de Ginásio pré-definida na Coleção (23/11/2026)
- PR **#211** integrada `main` SHA **`ef1e352cb713aea8e9809145028767a2ca3bd34b`**. GitHub Actions API PG18 **`45198748359 SUCCESS`** (rerun após conflito de porta Docker do runner), React/Chromium **`45198748631 SUCCESS`**, Playwright isolado **`45198748457 SUCCESS`**, imagem web **`45198748704 SUCCESS`**. Railway API privada **`80943569-c41a-4a60-89c1-6ab08e721809 SUCCESS`** e web **`60212b46-ea81-4d50-8d4e-fef04abb5199 SUCCESS`** mesmo SHA; API confirma migrações 001–017 existentes e registro OFF.
- **Regiões:** restaurado 1 Pokémon ativo por batalha (v1/v2, até 4 golpes FRLG equipados, sem ações de troca) e removido desvio 3v1 de #209. **Ginásios:** três Pokémon já escalados na **Coleção** antes do desafio, não na tela do Ginásio. Writer `gym-start` congela a ordem do save e rejeita `uids` enviados; UI apenas mostra lineup prévia e acesso à Coleção; equipe travada até fim/abandono, motor HP/SP e IA Gym preservados.
- Testes PG18, Vitest e E2E desktop/mobile asseguram que não haja 3v1 regional nem seleção ad hoc no Ginásio, sem mudanças SQL. Próxima etapa online: writer de equipe na Coleção + bônus legítimos, jamais equipe de três em encontro selvagem; keyring HMAC posterior. `/play` LOCAL intacto, sem migração, cadastro OFF, provas Railway backup/PITR restore, Resend/LGPD pendentes.

## ONLINE-01C-23B2A — equipe da Coleção salva pelo servidor (23/11/2026; branch)
- Novo writer privado de equipe `setCollectionTeam` com 1–3 UIDs únicos e realmente próprios; preserva ordem e altera somente `raw.team`, revisão/journal e dois recibos idempotentes com lock. Impede mudanças durante encontro `reserved`, captura, Ginásio e expedição; sem XP/moeda/itens/roster gerados.
- SQL **018** append-only + workflow de 18 migrações PostgreSQL18 e restore descartável, testes de replay, concorrência, UID alheio, payout intacto e Região 1v1 `team[0]` SEM substituições. Ginásio segue usando seleção feita antes na Coleção; nenhum novo seletor Ginásio.
- CI/PR/merge/Railway pendentes; sem API pública/registro nem migração do `/play`. Próximos bônus server-authoritative equipamentos/títulos/insígnias no Ginásio, writer Ginásio e chave HMAC versionada.

## ONLINE-01C-23B2A — writer da equipe da Coleção publicado (23/11/2026)
- PR **#213** MERGED `main` SHA **`163e79ed956fd294f30d664a554f1a68ef82fd91`**, HEAD CI `40978991`; workflows API PostgreSQL18 **`45216790631 SUCCESS`** e geral React/Chromium **`45216790610 SUCCESS`**. Inclui SQL 018 append-only, 18 migrations testadas/reaplicadas, pg_dump/restore descartável e regressões completas `/play`/regiões/Arena.
- Railway API privada **`b9bc080a-6ed4-4407-b64b-6b7eff182926 SUCCESS`**, logs `018_collection_team_receipts.sql APLICADA`, registro OFF; web **`34f3e0aa-68ee-4e18-a3c6-553fdbbc39ff SUCCESS`**, ambos no SHA funcional. Não se verificou HTTP externo independente em produção.
- `setCollectionTeam` seleciona 1–3 UIDs da própria conta na Coleção, com ordem/CAS/receipt/replay e bloqueios sob encontro, captura, expedição e sessão de Ginásio. **Regiões continuam 1v1 apenas `team[0]`**, Ginásios usam trio da Coleção previamente definido, sem picker. Nenhum HTTP público nem migração de save local. Próximos bônus server-only (equipamentos/títulos/insígnias), writer online Gym e keyring HMAC; restore Railway REAL, Resend/LGPD pendentes.

## ONLINE-01C-23B2B — bônus canônicos e prévia Gym server-only publicados (23/11/2026)
- PR #215 MERGED `main` SHA **`eca304aa5a0f0abe94928418d46575da0f6ef0c3`**; CI API PostgreSQL18 **`45220610134 SUCCESS`**, regressão React/Chromium **`45220610031 SUCCESS`**, imagem D-044 **`45220609940 SUCCESS`**. Railway API privada **`6469daa6-9a42-4bb4-a08d-16aaca63fb21 SUCCESS`** (SQL 001–018 já aplicadas, registro OFF) e web **`c46a2ba8-5214-493b-9e2b-703c095e81b0 SUCCESS`** no SHA funcional. SQL não mudou, restore PG18 só descartável.
- Criado cálculo puro de bônus do treinador no Ginásio a partir de catálogos Kanto: itens exigem inventário versionado COM POSSE, títulos devem estar desbloqueados e insígnias no histórico sequencial; nenhum atributo arbitrário do navegador. Próximo Gym 3v3 usa os três UIDs predefinidos na Coleção e HP/SP/golpes aprendidos pelo motor Gym; leitor privado PostgreSQL `inspectNextGym` é somente leitura/sem escrita de premiação ou sessão.
- Regras preservadas: **Regiões 1v1 só team[0], sem switch**; **Ginásios 3v3 da Coleção sem escalação no Gym**. `/play` local intacto sem migração, cadastro público OFF. Próximo 23B2C reservar Ginásio com estado congelado e writer/receipts/locks, depois turnos HMAC/selagem/payout e keyring. Backups/PITR e restore REAL Railway, Resend/LGPD pendentes.


## ONLINE-01C-23E9 — revisão do limite por IP atrás do proxy (24/11/2026; branch)
- Registra a jornada Resend sandbox da PR #250 integrada e amplia testes de spoofing e colisão da cota por peer em proxy HTTP local. Nenhuma alteração de runtime, cadastro ou save. CI/revisão pendentes; gate de proxy permanece bloqueado.
