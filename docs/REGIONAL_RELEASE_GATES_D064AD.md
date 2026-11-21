# D-064AD — Plano de release rápido, sem risco para saves

> Status: preparação da beta, NÃO autorização de merge. Fonte de verdade: PRs D064 #88–#104 e docs/PROJECT_STATE.md. Uma aprovação de CI prova apenas que o código testado passou, não que a economia ou a segurança esteja aprovada.

## Decisão operacional: dividir publicação em cortes

### Corte A — Mapa somente leitura (candidato mais rápido)

- Usar o catálogo de regiões/níveis/espécies aprovado em D064 como leitura, sem botão que gere XP, moedas, Pokébolas ou Pokémon novos.
- Não escrever NENHUM campo no save legado e não alterar schema2/chave, battle log, Arena, lojas ou Pokémon existentes.
- Proteger visibilidade com flag **desligada por padrão**, sem depender de uma seed fornecida pelo cliente como autoridade.
- Exigir QA visual desktop/mobile, navegação por teclado, screen reader (manual se disponível), fallback de GIF e acesso com save antigo/corrompido.
- Teste explícito: antes/depois de navegar pelo mapa, localStorage e revisão do save idênticos; mesma funcionalidade da Arena atual; nenhum fluxo de captura clicável.
- Só efetivar merge/deploy quando a tela estiver implementada, todos os testes passarem no SHA final e a publicação desse recorte for aprovada. **Não interpretar PR #101/#103 CI-only como release candidate**.

### Corte B — Encontros regionais sem economia (prévia/sandbox isolado)

- Exibir simulação com resultado não persistente claramente identificado; o resultado não conta como batalha jogada nem gera recibo.
- A prévia não deve chamar `PlayAction`, `createPlaySave`, `writePlaySave` nem manipular `localStorage`.
- Não conceder itens, XP, moedas, capturas ou badges; toda UI deve distinguir prévia de partida jogável.
- Testes E2E para navegar/voltar, mobile/desktop, save intacto, seed inválida e regiões bloqueadas.

### Corte C — Economia regional, capturas e writer persistente (BLOQUEADO)

Requer todas as garantias, em conjunto:
1. **Autoridade dos resultados**: hoje `RegionalBattleDraftCommand.outcome` e seed são argumentos do cliente. Gate canônico local ou RNG determinístico não é prova antifraude. Definir servidor/autenticidade e revalidar o comando contra save e resultado do combate.
2. **Migração de economia**: política explícita para XP/coins antigos e atuais. Não sobrescrever saldos legítimos ou ganhar a mesma recompensa duas vezes.
3. **Escrita versionada**: validação do envelope/revision; lock/concorrência entre abas; backup, commit marker, recuperação após crash; teste em storage REAL e falha injetada.
4. **Idempotência e atomicidade**: receipts por ID, débito de bola e eventual captura/recompensa no mesmo commit, conflitos/doubles blocked.
5. **Balanceamento aprovado**: testar softlock e progresso, tipo/stats/evolução, estoque/captura normal/raros, pelo menos múltiplas seeds, amostra real de jogo.
6. **Release gates**: TypeScript/Vitest/core/web/Playwright desktop/mobile/Docker, observação de execução Railway no SHA, plano rollback e teste save anterior.

## Principais riscos atuais observáveis

- **Softlock**: dados D064AB com stats base e sem aprimoramento mostraram 0 vitórias de 32 para Charmander Lv35 região 4 e Lv65 região 7 (não prova taxa zero real). A simulação D064AC mede se o jogador pode ficar sem vitórias suficientes para subir de nível. D064AD gera logs `D064AD_SOFTLOCK`: vitórias por região, maior sequência sem vitória e última vitória em 240 combates, comparando treino base/focused e equipe 1/3, 4 seeds.
- **Captura comum versus rara**: D064AA mostra estoque esgotado em `every-win`, e `rare-only` preserva centenas de Ultra Balls mas não permite completar Pokédex comum. Não autorizar números econômicos até existir política híbrida.
- **RNG manipulável**: semente do encontro/captura controlada pelo cliente permite escolher cenários; não liberar escritor persistente com resultado calculado apenas no cliente.
- **Escopo excessivo**: não aguardar concluir tudo para publicar uma tela SOMENTE LEITURA, mas não publicar captura/recompensa sem garantias.

## Próximas tarefas executáveis por ordem

1. Validar D064AD com CI completo e registrar resultados de softlock; decidir limites de dificuldade e mecanismo de recuperação sem mudar gameplay nesta rodada.
2. Implementar PR independente para **Corte A**: UI mapa somente leitura sob flag desligada, preservando CSS tokens e E2E save-intacto desktop/mobile.
3. Revisar Corte A e publicar somente depois do aceite explícito e CI final de uma PR independente com base adequada em main; evitar incorporar as centenas de commits experimentais por acidente.
4. Em paralelo, desenhar/validar autoridade e writer para Corte C, com provas de recuperação e conflitos; nenhum merge sem todos os critérios.
5. Após release, observar logs/feedback, manter rollback documentado e preservar a versão anterior.

**Não foram realizados merge, deploy ou gravações de gameplay durante esta etapa.**
