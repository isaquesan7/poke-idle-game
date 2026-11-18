# D-047 — contrato de TMs versionadas (proposta; **não implementado**)

**Data:** 18/11/2026 · **Status:** documento publicado na PR #67, main `fca91202bc391bc2ebd4abe31183fbefed53a2a8`, CI/Railway SUCCESS. **O sistema TM continua NÃO IMPLEMENTADO**; esta especificação prepara uma futura D-048, não habilita movimento/consumo de item nem cria API pública.

## Problema concreto e fontes

O combate da Arena v0.2 usa uma mistura *deliberada* de catálogo de espécies/learnsets da PokéAPI FRLG e metadados atuais de golpes (ex.: categoria físico/especial separada por golpe). Isso exige identificar **a origem de cada atributo** antes de incorporar TMs com efeitos diferentes entre gerações.

- **TM09 em Pokémon FireRed/LeafGreen (Geração III)** ensina *Bullet Seed*, Grass/Especial e **10 de poder por impacto**; é TM, **não** aprendizado automático ao subir nível. Fontes de versão: https://pokemondb.net/move/bullet-seed ; https://www.dittobase.com/firered-and-leafgreen/items/tm09 ; https://bulbapedia.bulbagarden.net/wiki/Bullet_Seed_(move).
- Na PokéAPI moderna, Bullet Seed aparece Grass/Físico e **25 por impacto**. A página de TM de FRLG em Pokémon Database pode apresentar uma tabela com valores **modernos** ao lado do item histórico; por isso a origem/geração deve constar campo a campo, em vez de confiar em um único quadro de UI.
- Para 2–5 acertos nas regras comuns da GenIII, frequências condicionais **3/8, 3/8, 1/8, 1/8** para 2, 3, 4 e 5, respectivamente, valor esperado **2,75**; contexto: https://bulbapedia.bulbagarden.net/wiki/Multistrike_move. A prévia de custo D-039 **2,5 impactos** é orçamento heurístico, NÃO sorteio nem regra canônica.

## Contrato de dados proposto (somente documentação)

Separar *item*, *elegibilidade de espécie* e *atributos do golpe*:
- `versionGroup: 'firered-leafgreen'`, `generation: 3`, `tmId: 'tm09'`, `moveId: 'bullet-seed'`, `learnMethod: 'machine'`, `sourceCommit` e `sourceBlob` verificados.
- `TMDefinition`: identidade de item, origem/cap de obtenção, quantidade em inventário, política **consumível uma vez por ensino** (se aprovada), e flags explícitas de disponibilidade. Sem inventar drop location/estoque comercial no idle por analogia com cartucho.
- `MachineCompatibility`: conjunto **positivo** dos IDs de espécies elegíveis, proveniente de `pokemon_moves.csv` com version_group 7 e method TM, e cadeia/evoluções permitidas; nunca inferir elegibilidade apenas de tipo/nível/forma. Se faltar compatibilidade verificada, negar.
- `MoveVersion`: `type`, `damageClass`, `powerPerHit`, `accuracy`, `priority`, `pp`, `minHits`, `maxHits`, `weightsByHits`, `effectRulesVersion`. **A escolha entre usar toda a ficha histórica GenIII ou manter a ficha moderna coerente com o motor atual ainda está PENDENTE.** Não misturar categoria especial GenIII e poder moderno25 por acidente.
- `kantoMoveSpCost` deve ser função estável para o **golpe autorizado**; a prévia `kantoPreviewMoveSpCost` não autoriza equipagem. Ao trocar regra do custo, versionar nos logs/recibos para replays antigos, não ressimular resultados.
- Catálogo de múltiplos acertos `kantoMultiHit` continua **fechado** e contém apenas `double-kick:2/2`. Quando implementado variável, a resolução deve tirar **um único sorteio inteiro da seed** de batalha conforme pesos versionados, depois executar cada impacto com dano/crítico/RNG independentes e parar imediatamente em KO/imunidade. Para mudar orçamento baseado em 2,5→2,75, será necessária decisão formal com teste de SPmax, 30 turnos e Focus.

## Escrita atômica e compatibilidade

O `reducePokemonMoveSlotsJson` atual valida apenas **golpes aprendidos por nível**, sem possuir item ou inventário TM. Portanto, **não** inserir Bullet Seed como learned-at-level 1/100, nem adicionar nome a catálogo executável para contornar o writer. Proposta para API futura:
1. Um comando explícito `teach-tm` com `pokemonUid`, `tmId`, `selectedSlot`/operação e **versão esperada** do snapshot, validando inventário, compatibilidade positiva de espécie, slots 1–4, integridade UID e presença de ao menos um golpe ofensivo.
2. Em uma transação do writer de save da v0.2: consumir **exatamente uma TM** e gravar `moveNames`/principal do Pokémon **juntos**; se falhar por slot cheio, dados malformados, revisão velha, concorrência ou curso de expedição, **nenhum efeito parcial**. Não creditar TM ou ensinar golpe em loop por reenvio. Idempotency key/receipt evita duplo consumo. Sem backend, explicitar limite de segurança do browser.
3. O catálogo aprendido/ensinado por UID precisa sobreviver à evolução e continuar legível sem reexecutar golpes; uma futura evolução de schema (se necessária) exige migrador puro e testes com saves antigos e a chave externa `kanto-idle-play-v02`. Não substituir o `version:1` interno do jogo ou a camada `schema2` até haver compatibilidade comprovada.
4. `Rng` e `BattleResult.frames` são capturados uma vez e só reproduzidos, um evento por impacto, SP debitado apenas uma vez no primeiro frame, sem duplicação de prêmio/captura. Leitor de tela tem diário de texto e não depende só da animação.
5. Testes de rejeição por ausência de TM, quantidade zero, TM adulterada, espécie não elegível, slot4/UID inexistente, golpe já aprendido, repetição do mesmo comando, conflito de revisão, atualização simultânea, sucesso e rollback de consumo. Incluir estresse 2–5 hits e KO no 1º/2º/3º/4º hit.

## Decisão da D-047

**Manter Bullet Seed, TMs e multi-hit variável como NÃO JOGÁVEIS.** A D-047 testa a barreira `KANTO_BATTLE_MOVES['bullet-seed'] === undefined`, `KANTO_MULTI_HIT_MOVES['bullet-seed'] === undefined` e writer rejeitando `add`/`replace-primary` até nível100 com prévia SP válida. O catálogo runtime, as relações de tipo, custo/PP de Recover/Double Kick e os saves não foram modificados.

**Próxima decisão D-048:** definir fonte geracional unificada de metadados para novas habilidades (FRLG histórico completo ou variante moderna do RPG), então consultar os learnsets `machine` da fonte fixa antes de elaborar um writer transacional e economia de TMs. Não afirmar que existe sistema de itens TM nesta alfa.
