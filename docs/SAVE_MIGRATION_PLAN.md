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
