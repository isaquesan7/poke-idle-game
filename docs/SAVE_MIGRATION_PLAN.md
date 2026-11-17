# Plano de migração do progresso v0.1 → v0.2

**Status:** planejamento e pré-verificação de leitura; migração real NÃO implementada.
**Data:** 2026-11-16. Registros relacionados: D-003–D-005, D-011, D-016 e D-017.

## Estado de origem
- O jogo jogável v0.1 usa o HTML legado servido por server.mjs no Railway.
- A chave localStorage **kanto-idle-lab-save-v01** mantém o progresso do navegador; **kanto-idle-lab-cache-v01** guarda dados opcionais da PokéAPI.
- A prévia React usa a chave independente **kanto-idle-lab-save-v02-draft**. O rascunho nunca é progresso oficial e não concede moedas ou XP.
- A função save() antiga grava de maneira síncrona e não participa de Web Locks; duas abas legadas podem salvar estados divergentes.
- Web Locks das abas React sincronizam apenas código cooperativo e NÃO garantem exclusividade contra a v0.1 antiga.
- setItem() do navegador é atômico para uma chave, não equivale a transação entre backup, metadados e save.
- Sem backend ou conta, não existe sincronização entre dispositivos ou domínios diferentes.

## Decisão de segurança
**Nunca** copiar workingRaw do draft para a chave v0.1 automaticamente. Não tentar CAS com getItem/setItem sem um writer único. Não apagar origem para 'corrigir' incompatibilidade. Nunca migrar no carregamento do app.
A chave canônica **proposta** para progresso oficial v0.2 é kanto-idle-lab-save-v02, distinta da origem, mas ainda não foi implementada. A v0.1 deve permanecer exportável e legível para rollback.
Se o jogador prosseguir na v0.1 depois de ativar futuramente uma v0.2 independente, os progressos podem bifurcar. É obrigatório avisar e definir política de troca de writer antes de qualquer migração.

## Fase A — preflight não destrutivo (implementada nesta branch)
- Checar estrutura, versão e atributos do save legado; conferir rascunho alinhado à origem.
- Identificar alteração da origem durante leitura, save inválido/ausente, versão futura, rascunho corrompido/stale e storage inacessível.
- Resultado candidate significa apenas **formato compatível para estudo**, não autorização para gravar.
- Testes exigem ZERO chamadas a setItem/removeItem. A UI não expõe botão de aplicar ou converter.

## Fase B — contrato oficial e backup (pendente)
- Definir schema oficial da v0.2 de forma separada do DraftEnvelope experimental.
- Manter todos os dados dos Pokémon por UID, afinidade, nível, XP, pontos, upgrades, equipe e golpes; preservar trainer, moedas, badges, seen, expedições e campos legados não conhecidos.
- Criar mecanismo de backup fiel do JSON original e de recuperação após falha parcial, sem remover a chave v0.1. Oferecer exportação manual do backup antes da ativação.
- Considerar hash SHA-256 via WebCrypto como verificação de integridade acidental, não como mecanismo antifraude.
- Testar limite/quota de storage, escrita parcial, falha após backup, reabertura e restauração pelo usuário.

## Fase C — coordenação dos writers (pendente e bloqueadora)
- Definir writer autoritativo v0.2 único, idealmente backend transacional para operações econômicas e competitivas.
- No modo local experimental, usar Web Locks e revisão persistida só entre abas v0.2, com bloqueio quando indisponíveis.
- A v0.1 antiga nunca será considerada cooperativa sem alteração e atualização de todas as abas ativas.
- Exigir política explícita de transição: encerrar writes do legado ou optar conscientemente por uma versão separada, sem auto-sincronização entre chaves.
- BroadcastChannel pode atualizar UI, mas não é lock nem fonte de verdade.

## Fase D — migração opt-in (pendente)
- Exibir resumo e riscos antes de um clique explícito; exigir backup recuperável previamente.
- Gravar APENAS nova chave canônica v0.2, validar read-back e integridade antes de indicar sucesso. Preservar a v0.1.
- Nunca transformar pontos e equipamentos simulados em progresso real sem confirmação e modelo versionado aprovado.
- Abortos em caso de versão desconhecida, quota, conflito ou corrupção devem deixar a v0.1 intacta e permitir recuperação.

## Fase E — rollout e testes (pendente)
- Antes de substituir a UI, portar e testar todas as rotinas de alteração de progresso: treinador, itens, XP, captura, Pokédex, batalha, coleta de expedição e movimento do time.
- Rodar E2E desktop/mobile, múltiplas abas, interrupção, dados faltando, reload, import/export/rollback, schemas antigos e versão futura.
- Impedir duplicação de recompensas; com backend futuro, idempotência deve ser implementada no servidor.
- Testes + revisão humana + deploy Railway monitorado + rollback definido antes de expor botão de migração.

## Critérios objetivos para habilitar gravação real
1. Backup legível, independente e recuperável; origem v0.1 nunca sobrescrita.
2. Writer canônico e coordenação de versões/corridas definidos; sem tabs antigas gravando por engano.
3. Contratos e validação de todos os campos de progresso preservados.
4. Testes de conflito, quota, recuperação, rollback e compatibilidade aprovados.
5. E2E + análise visual desktop/mobile; revisão da PR, documentação e monitoramento.

**Próxima implementação:** schema oficial v0.2 e plano de backup recuperável em funções puras e testes; nenhuma escrita de save real até a fase C estar resolvida.

## 2026-11-16 — Avanço de Fase B: contrato e journal de recuperação (branch de revisão)
- Implementado somente em funções TypeScript sem efeitos de armazenamento: contrato candidato de save oficial v0.2 (`OfficialSaveV02`) com `revision:0`, `payloadFormat:'legacy-v01'` e o estado completo incluindo campos desconhecidos. **Não representa motor de progressão v0.2 pronto**.
- `OriginBackupV02` armazena o texto original byte a byte, checksum SHA-256 de UTF-8 e comprimento. `RecoveryBundleV02` inclui backup e candidato; validação detecta corrupção da fonte e discrepâncias do progresso, devolvendo texto original para exportação/restauração manual.
- `recoveryJournal.ts`: plano de escrever em FUTURO na ordem backup → candidato → marcador de commit. Apenas gera instruções, inspeciona snapshots fornecidos e extrai backup; **não acessa window.localStorage nem executa instruções**.
- Simulações: erros antes de qualquer etapa, quota após backup, candidato sem commit, marcador danificado, versão desconhecida, save atualizado por writer legado. Mesmo sem marcador/sem candidato, backup íntegro pode ser exportado.
- Reserva de chaves para futuro plano de transição: `kanto-idle-lab-save-v02`, `kanto-idle-lab-save-v02-origin-backup`, `kanto-idle-lab-save-v02-commit`. Não ocupadas nesta entrega.
- **Limite de segurança:** checksums não são autenticação/antifraude; marcador não é transação real entre chaves; não haverá ativação antes de writer exclusivo e opt-in/rollback implementados.
- Fase B **parcial**: ainda faltam política de quota real, UX de export/import, backup independente de dispositivo e persistência recuperável. Fase C writer único, Fase D ativação opt-in e Fase E paridade total continuam pendentes.
- Próxima implementação após CI: desenho de coordenação de writers e UX de recuperação/exportação verificável, mantendo `kanto-idle-lab-save-v01` intocado.

### Resultado verificado da Fase B parcial — 2026-11-16
- PR #9 merged em `bd530666` com deploy Railway `SUCCESS` e CI completo da main `43984189208` `SUCCESS`.
- Backups SHA-256 e journal são SOMENTE contratos/validações/ensaios. Ainda não existem persistência canônica de produção, escrita transacional nem recuperação por interface.
- Restrições pendentes: writer único e coordenação entre abas, quota real e UX de opt-in/exportação, rollback; não habilitar migração até fechar esses pontos.
- Próximo primeiro arquivo a investigar: `index.html` função `save()` (writer não cooperativo), depois `apps/web/src/storage/recoveryJournal.ts` e `draftSave.ts` para conceber protocolo e testes sem tocar na chave v0.1.

## 2026-11-16 — Passo incremental de Fase C, sem habilitar writes
- Política v0.1/v0.2: o jogo v0.1 continua writer não-cooperativo na sua chave legada. **Não existe** Web Lock ou modo que garanta parar abas v0.1 já abertas. Em uma futura opção explícita de mudança, a v0.2 terá chave própria, com backup original e aviso de bifurcação. Progresso gerado depois na v0.1 NÃO será conciliado automaticamente, nem aplicado sobre v0.2.
- `writerCoordination.ts`: `inspectWriterHandoff` distingue só legado, cópia incompleta, snapshot v0.2 íntegro, divergência e journal danificado. Os cinco resultados continuam `canWriteRealSave:false`. `checkCooperativeRevision` rejeita aba stale e overflow; `withExclusiveV02Writer` faz ensaio com Web Locks exclusivo sem fallback se outro writer mantiver o lock.
- A resolução do writer único real continua PENDENTE: falta migrar ações de jogo e definir cutover, garantia de rechecagem do journal, recuperação/rollback, aviso sobre tabs legadas e nenhum backend autoritativo.

## 2026-11-16 — Exportação verificável read-only na prévia
- `prepareVerifiedRecoveryExport` gera um pacote JSON com backup exato v0.1 e SHA-256. Faz rechecagens do save ao redor da operação assíncrona; não consegue garantir ausência de uma atualização POSTERIOR por aba v0.1. Exportação não é migração.
- `inspectRecoveryFile` apenas verifica integridade/formato e compara com a origem. Retorna igual/diferente/ausente/inválido sem restaurar, transferir ou gravar; arquivos limitados a 8 MiB para contenção de recursos.
- O painel React usa comentários CSS e tokens; testes verificam íntegro/adulterado, concorrência e zero escrita nas chaves oficial, backup, marcador ou save v0.1.
- **Próxima tarefa:** laboratório opt-in de troca de writer com execução contra armazenamento TEMPORÁRIO de testes, validação read-back, interrupção/quota real e rollback. Não ligar o executor às chaves persistentes reais antes da paridade de progressão.

### Handoff pós-validação das PRs #11 e #12 — 2026-11-16
- #11 integrada em `9369e4a4`; #12 corrigiu flakiness do teste legado e foi integrada em `db10572b`. Railway `SUCCESS`, CI da main `43987571827` `SUCCESS`.
- O protocolo de lock/revisão está testado SOMENTE para writers cooperativos. A v0.1 antiga pode salvar em outra aba; divergências exigem isolamento explícito, não mescla automática.
- A prévia React pode baixar um `RecoveryBundleV02` SHA-256 e inspecionar um JSON externo; upload não é restauração. Não há executor de journal real.
- Próximo: montar teste de cutover opt-in em memória/IndexedDB isolado, simulando falhas de quota, concorrência, cancelamento e reconciliação proibida, sem ativar saves v0.2 ou modificar v0.1.

## 2026-11-16 — Laboratório de transição opt-in em RAM (sem writes reais)
- Nova implementação `MigrationMemoryLab` encapsula toda a execução simulada em um `Map` privado. O motor não recebe `StoragePort` nem possui acesso a objetos de persistência do browser. Chaves oficiais aparecem apenas como strings no Map interno, que desaparece ao descartar a instância.
- Consentimento obrigatório `SIMULAR SOMENTE EM MEMORIA` a cada execução. A interface prévia React exige checkbox e mostra resultado auditável, sem botões de restaurar ou aplicar ao jogo.
- Testes cobrem sequência backup/candidato/marcador, quota e falhas após cada etapa, read-back, double-submit e segundo envio bloqueado, origem v0.1 divergente, versão futura, revisão stale de duas abas simuladas e backup recuperável por texto.
- O laboratório permite dizer que a estrutura de journal/recuperação **foi ensaiada**, NÃO que o cutover real é transacional ou seguro entre abas v0.1; Web Locks ainda abrangem apenas clientes v0.2 cooperativos. Não há migração real, rollback automático, nem escrituração em chaves reais.
- **Próximo bloqueador fora do laboratório:** estratégia para um writer único e desligamento/convivência com abas v0.1 antigas, backup recuperável fora da origem, paridade das rotinas v0.2 e revisão de segurança antes do opt-in real. Um storage fake não substitui testes reais multi-aba/queda/quota em laboratório de navegador.

### Resultado da validação do laboratório — 2026-11-16
- PR #14 integrada no commit `455c29a9`, GitHub Actions pós-merge `43989615947` SUCCESS e Railway deploy `b621615b` SUCCESS.
- Ensaios de consentimento, read-back, quota, crash, divergência da v0.1, reenvio e revisão stale validados em `Map` privado; E2E desktop/mobile comprovou imutabilidade do storage real durante a simulação.
- **Permanecem bloqueados**: escrita de save real v0.2, importação/restauração automática, transação entre abas legadas não-cooperativas e eventual sincronização remota.
- Próxima etapa de implementação deve ser política de writer único e ativação opt-in com backup exportável fora da origem, mais testes em navegador de LAB isolado de quota real, interrupção e rollback. Não copiar o mecanismo de simulação para localStorage de produção sem revisão específica.

## 2026-11-16 — Prova isolada no browser (fase de laboratório, NÃO cutover de jogadores)
- O módulo `browserSandboxCutover.ts` foi concebido para testes em `localhost:5174` Vite no caminho `/__kanto_v02_browser_lab__`, com rota/origem verificadas e SOMENTE chaves `__kanto_lab__*`. Não é importado na interface React, nem na v0.1 pública. Não escreve saves de jogadores.
- Diferente do Map anterior, o Playwright agora exercita localStorage nativo, Web Locks reais entre abas, QuotaExceededError do Chromium, fechamento/reabertura de página, estados backup-only/staged/committed e rollback explícito que mantém backup e fonte de testes. Ausência de consentimento/rota correta bloqueia qualquer gravação.
- Ao reabrir após interrupção, o journal deve ser auditado, não repetido automaticamente. Quando uma aba altera a origem de teste, a verificação detecta divergência e não restaura/mescla.
- **Não resolve os bloqueadores de produção**: writer único, desligamento/convivência de tabs v0.1, backup verificável efetivamente baixado e recuperável FORA da origem, transações/remediação de corrupção reais, validação da paridade das mecânicas React, segurança do cutover e plano de rollback de um jogador. Sem estes, a ação oficial de migração permanece proibida.
- O novo E2E será acionado pelo workflow permanente `.github/workflows/main-regression.yml` e só será integrado após execução verde. Próximo desenvolvimento: desenho e validação de writer único / protocolo de transferência de autoridade v0.1→v0.2, sem ativar saves reais.

### Resultado do E2E real — 2026-11-16
- PR #16 merged `977d14a9`, CI da PR `43991731238` SUCCESS, CI da main `43991985570` SUCCESS e Railway `54ccff55` SUCCESS. O jogo online permanece v0.1.
- A nova suíte de Playwright provou no Chromium comportamento sob quota nativa, duas abas usando Web Locks, interrupções, reload, conflito e rollback isolado sem tocar chaves oficiais.
- **Próximo bloqueador:** decidir contrato de autoridade do writer e delimitar quando a UI v0.1 deixa de ser fonte ativa de progresso, além de paridade total no React e exportação de backup fora do navegador. Ver `docs/CUTOVER_AUTHORITY_PROPOSAL.md`. Nenhum comando de commit v0.2 deverá sair do sandbox antes da aprovação e validação desses critérios.

## 2026-11-16 — Gate de autorização explicitamente sempre bloqueado (D-022)
- `inspectCutoverGate(storage,webLocksAvailable)` acumula resultados de `inspectMigrationReadiness`, leituras repetidas das chaves legadas/draft/reservadas e indisponibilidade do navegador. Retorna SEMPRE `{status:'blocked',canMigrate:false}`.
- Bloqueios não negociáveis sem nova revisão: v0.1 não cooperativa, ausência de paridade total no React, writer oficial indisponível, backup externo não verificado, release não aprovado. Mesmo Chromium + localStorage nativo + Web Locks e pré-verificação válida não habilitam gravação oficial.
- O novo `docs/LEGACY_MUTATION_MATRIX.md` foi elaborado com 21 ações e escritores indiretos; `tests/legacy-mutation-audit.test.mjs` protege o inventário de ações contra inclusões não auditadas. Não usar este teste como prova de ausência de mutações internas nas ações existentes.
- Próxima prioridade: portar gradualmente ações v0.1 para reducers imutáveis do game-core; auditar duplicidade de rewards, capturas e claims. Após paridade testada, desenhar e aprovar formalmente transferência de autoridade/backup fora da origem e só então rever o gate.


### Fundação de regras Pokémon/equipe — 2026-11-16
O game-core agora dispõe de redutores puros que devolvem outro JSON v0.1 para treino/reset de pontos por UID, adição/remoção da equipe e validação do estado. **Nenhuma saída é aplicada ao save v0.1 ou v0.2**. São provas de paridade parcial antes de transpor ações para React. O writer v0.2, backup externo, idempotência de rewards, coordenação com abas antigas e autorização de cutover continuam pendentes e bloqueados por `cutoverGate.ts`.


### Handoff após PR #20 (2026-11-16)
Reducers de Pokémon/equipe integrados em `5e60f17b` (GitHub Actions main `43996462703` e Railway `da78ab5a` SUCCESS). Quatro ações legadas possuem equivalente puro; os requisitos de migração oficial ainda são **integralmente obrigatórios**. Próximo passo: segurança de comandos de economia/batalha/expedição com idempotência, revisão monotônica sob writer único e testes de colisão de duas abas — inicialmente sem writes reais.


### Recibos de recompensa experimentais (2026-11-17)
O game-core passou a incluir `RewardJournal` com `revision/receipts` em RAM para simular idempotência de batalha, captura e expedição. **Não é ledger durável**, nem prova antifraude; o mesmo evento em duas cópias independentes pode receber recompensa duas vezes antes de se escolher uma revisão autoritativa. O gate de migração permanece bloqueado. A transferência de autoridade requer serialização/commit transacional de revisão+evento, backup fora do navegador, engine verificável, paridade completa de todas ações e testes de concorrência antes da ativação.


### Resultado dos testes de antirreplay em RAM (2026-11-17)
PR #22 merged no SHA `989c2cdc`; GitHub Actions pós-merge `44057278833` SUCCESS; Railway `5b76abc6` SUCCESS. Os testes demonstram replay idêntico sem crédito adicional, recusa de revision stale, captura com UID único por evento serializado e expedição sem claim repetido no mesmo cursor. **Cuidado:** duas cópias independentes de `RewardJournal` ainda podem divergir; qualquer sistema de recompensas real exige transação de writer autoritativo e validação do resultado, sem alterar saves antigos ou liberar `cutoverGate` prematuramente.

## Ensaio de ledger de recompensas em Map privado (2026-11-17)
A nova `RewardAuthorityMemoryLab` serializa em RAM (única entrada de Map) revision+recibos+progresso e permite simular two-clients/stale revision, double-submit, lost-ACK após commit e corrupção fail-closed. Os testes não usam storage real. **Não conclui fase C nem dá durabilidade real**; dois Map independentes ainda divergem. A fase C exige transações em fonte canônica persistente, autenticação de recompensa, atomicidade entre ledger e estado e política para abas v0.1 não cooperativas. Todas as fases de backup externo e cutover continuam pendentes.
