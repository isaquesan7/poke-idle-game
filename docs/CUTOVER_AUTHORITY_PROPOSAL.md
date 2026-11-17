# Proposta de transferência de autoridade do save — Poke Idle Game

**Status:** especificação proposta, NÃO autorização de migração real. **Data:** 2026-11-16. Referências: D-017–D-021, `docs/SAVE_MIGRATION_PLAN.md`.

## Problema inalterado
A página v0.1 mantém o save em `kanto-idle-lab-save-v01` e grava sem Web Locks. Uma aba antiga já aberta pode continuar modificando essa chave. A prévia React v0.2 pode coordenar apenas suas próprias abas; Web Locks, BroadcastChannel e a observação de eventos de `storage` **não interrompem** a v0.1. Não existe backend autoritativo hoje.

## Modelo proposto: duas épocas de escrita separadas
- **Época v0.1:** a chave legada continua autoritativa para o jogo atual. Nenhum comando React promove draft, substitui ou apaga essa chave.
- **Cutover futuro com escolha explícita:** usuário exporta e verifica backup fora do navegador; a UI fornece resumo da origem, riscos de abas antigas e aviso sobre bifurcação. A v0.2 começa em **chave própria versionada**, somente após a totalidade das ações ser implementada e testada.
- **Época v0.2:** somente writes cooperativos de v0.2 sob lock exclusivo + revisão monotônica são permitidos na chave v0.2, com verificação após cada commit. Se não existir Web Locks ou surgir conflito/quota, parar em modo somente leitura.
- **Aba legada que continuar gravando:** o progresso v0.1 **diverge**; não há reconciliador automático, nem transferência das recompensas recebidas em duas versões. Informar e preservar ambos os ramos.
- **Rollback:** o save v0.1 intacto pode permanecer disponível somente mediante escolha explícita; progresso conquistado em v0.2 NÃO pode ser copiado de volta ou fundido automaticamente. Backup externo deve poder ser importado em fluxo próprio somente após validação/autorização separadas.
- **Alternativa robusta futura:** backend com operações transacionais/idempotentes para recompensas, combate, comércio e sincronização entre dispositivos. Nenhuma estratégia puramente local evita fraude nem coordenará writers antigos já carregados.

## Bloqueios obrigatórios de release
1. Auditar cada função da v0.1 que altera dinheiro, itens, XP, level, equipe, atributos, insígnias, captura, batalha e expedição; garantir paridade e testes no React/game-core.
2. Adotar write path único v0.2; nunca atualizar o save v0.1 ou promover draft com mutações desconhecidas.
3. Exigir download/exportação verificável de backup fora da origem; reconhecer explicitamente que o sistema não consegue comprovar que o arquivo foi conservado pelo usuário.
4. Opt-in com conteúdo claro, sem consentimento presumido por carregamento da página.
5. Testes de duas abas cooperativas, writer legado divergente, quota real, interrupção, revisão stale, corrupção e rollback; journal `backup → candidato → marcador` não é transação entre chaves.
6. Bloqueio fail-closed em versões futuras/desconhecidas, dados parciais, alteração da origem, locks indisponíveis e falta de paridade.
7. Regressão visual desktop/mobile + CI de `main` verde + decisão de publicação específica e documentação atualizada.

## Próxima etapa concreta de implementação
Criar um **gate de elegibilidade fail-closed e somente leitura**, testado com fixtures, que reporte as razões impeditivas do cutover mesmo quando os dados são estruturalmente válidos; depois elaborar a matriz de ações/mutações v0.1→game-core→React, e portar cada ação gradualmente. Nenhum botão de salvar progresso v0.2 deverá ser ativado por esse gate até aprovação explícita de mudança de arquitetura.

## Proibições
Não executar a rotina `browserSandboxCutover.ts` fora da rota localhost exclusiva; não substituir prefixo `__kanto_lab__*` por chaves de produção, não importar o módulo na UI pública, não desativar `index.html` sem rollout aprovado, não usar `localStorage.clear()` para rollback, não tocar no repo `isaquesan7/pokedex`.


## Gate fail-closed e inventário de mutações — 2026-11-16
O gate `apps/web/src/storage/cutoverGate.ts` é propositalmente um relatório sem possibilidade de retornar `allowed`/`canMigrate:true`. Ele não recebe flags do usuário ou do UI para suprimir requisitos de release. A matriz `docs/LEGACY_MUTATION_MATRIX.md` documenta 21 eventos tratados no `index.html`, mutações diretas/indiretas, e as lacunas da Foundation v0.2. O conjunto de ações é protegido por teste Node; a paridade total do jogo ainda não foi comprovada. Para revisar a política de writer, criar decisão de arquitetura e exigir nova bateria de testes e backup externo, em vez de modificar o gate por configuração de UI.
