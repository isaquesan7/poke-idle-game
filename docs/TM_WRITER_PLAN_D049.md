# D-049 — contrato de compatibilidade, estoque e escritor de TMs (projeto, NÃO jogável)

**18/11/2026 · Branch de pesquisa `feat/v02-d049-tm09-compatibility-extractor` · PR #72.** As regras publicadas da D-048 prevalecem; este texto não autoriza grants, desbloqueio de espécies, modificações de save ou novo movimento.

## 1. Fonte de verdade e geração da allowlist

- Entrada: `data/v2/csv/pokemon_moves.csv` do commit fixo `PokeAPI/pokeapi@ac2f1acb055026e3dff1e0aca743bb46256a810a`, objeto Git blob **`f66f614adf535af6940c65f434efe5ddeec4687a`**.
- O comando `node scripts/extract-tm09-compatibility.mjs <pokemon_moves.csv> <novo-resultado.json>` confere SHA-1 de **blob Git com cabeçalho**, depois lê as 6 colunas e seleciona: `pokemon_id` entre 1 e 151, `version_group_id=7`, `move_id=331`, `pokemon_move_method_id=4`.
- O JSON resultante carrega origem, contagem de linhas, IDs únicos ordenados e `status:'verified-snapshot-only-not-released'`. Criá-lo em caminho **novo**: o comando não sobrescreve artefatos existentes e não consulta PokéAPI em runtime.
- **Gate ainda ausente:** obtenção integral do CSV e comparação humana dos IDs; o conector de leitura do arquivo gigante retorna conteúdo vazio, embora confirme o SHA. Enquanto isso `kantoTmIsTeachEnabled` continua a negar TODAS as espécies. Nunca declarar `Bulbasaur aprende TM09` por inferência de tipo.
- Se o campo `pokemon_id` do arquivo de fonte mapear formas e não espécie, auditar essa distinção antes de conectar IDs ao catálogo Kanto; não usar o conjunto positivo automaticamente como autorização de ensino.

## 2. Modelo de inventário (decisões ainda pendentes)

**Recomendação de desenho:** `machineStock: Record<TmId, nonNegativeSafeInteger>` em domínio do jogador e registro de `receipts` por evento, com versão de esquema explícita. Um ensino bem-sucedido consome uma unidade de TM09 **se** a política consumível for aprovada. Estoque não pode ser derivado de coins, drops ou PokeAPI sem regra de economia do jogo.

Opções para aquisição futura, nenhuma executada:
1. **Recompensa única por marco de progresso** (controlada por receipt do marco): evita farm não supervisionado; menos repetível para múltiplos Pokémon.
2. **Loja com moedas e limite por jogador**: previsível, mas exige precificação, custo de oportunidade e proteção da transação moeda↔TM.
3. **Drop em batalha**: repetível, porém exige probabilidade, regra antirreplay, auditoria de inflação e limite de inventário.

A escolha deve ser explicitada no GDD/DECISIONS com preço/taxa/limite e testes antes do primeiro `grant-tm`. **Não gerar estoque inicial nem criar migração retroativa de recompensa sem decisão.**

## 3. Contrato proposto da ação teach-tm

Entrada de comando: `{ actionId, expectedRevision, pokemonUid, tmId, slotIndex, compatibilityRulesVersion }`; `slotIndex` é índice explícito 0..3, associado ao conjunto de quatro movimentos. Não confundir `uid` do Pokémon capturado com ID da espécie.

Pré-condições aplicadas ao snapshot atual, todas falham fechado:
- `actionId` único com receipt de resultado persistido na mesma revisão; reenvio de ação confirmada retorna o **mesmo receipt**, sem segunda baixa. Reuso de `actionId` com payload diferente é conflito, não sucesso.
- `expectedRevision` do writer canônico precisa bater; duas abas com cópias diferentes não podem aplicar consumos separados em paralelo.
- Pokémon por UID único e válido no save, pertencente ao jogador; nível e espécie obtidos do próprio save; não está em expedição/conflito nem bloqueado por batalha em andamento.
- TM deve existir no registro de máquinas habilitadas, compatibilidade positiva e versionada verificada para espécie/forma; preview ou custo SP não autorizam. `stock[tmId]>=1` é obrigatório.
- `slotIndex` precisa designar slot válido e explicitamente escolhido para substituição ou vazio permitido pelas regras. Impedir duplicar movimento, exceder quatro e deixar moveset inválido; se for o golpe principal, sincronizar `moveName` e `moveNames` de modo consistente.
- Efeitos atômicos em um ÚNICO candidato: alterar slot do UID, baixar estoque exatamente 1, incrementar revisão exatamente 1 e gravar receipt vinculado à revisão/payload. Nenhum efeito lateral sobre moedas, XP, insígnias, pedras, batalha ou outros Pokémon.
- O commit do candidato precisa ser serializado com controle de versão/lock do writer ativo e read-back. Se persistência falhar, **não** relatar sucesso. A garantia real precisa incluir recuperação de journal após queda; um reducer puro sozinho não equivale a transação durável em localStorage.

## 4. Sequência de implementação — gates independentes

**D049-A (esta PR):** extrator/checksum, testes e especificação; sem uso runtime. **D049-B:** obter snapshot integral, revisar os IDs e fixar artefato gerado e checksum do resultado, testes de allowlist por espécie/forma; sem ensinar. **D049-C:** decisão de economia no GDD e preparação de schema de estoque + recibo, com leitura de saves legados sem perda. **D049-D:** implementar writer `teach-tm` no armazenamento canônico com testes de falta de estoque, stale revision, repeat/lost-ack, corrupção, expedição, slots e rollback; manter TM09 bloqueada até motor novo. **D050:** motor variável de 2–5 hits e custo SP aprovado, log/frame por hit, testes determinísticos/balanceamento e reprodução apenas leitura. **D051:** liberação conjunta por feature flag depois dos gates e E2E desktop/mobile.

**Invariantes permanentes:** não modificar `isaquesan7/pokedex`; não apagar `kanto-idle-play-v02`; não usar `localStorage.clear()`; preservar `/` v0.1, 151 GIFs e animações full. NVDA/VoiceOver em dispositivos reais ainda exigem validação humana; o laboratório não equivale à experiência assistiva real.

**Detalhe de formato validado:** nas linhas de método `machine`, o campo CSV `order` pode ser vazio; as seis colunas continuam obrigatórias. O extrator aceita sexto campo vazio, exige os cinco primeiros numéricos e rejeita sexto campo não numérico não vazio.
