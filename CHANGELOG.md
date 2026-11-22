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
