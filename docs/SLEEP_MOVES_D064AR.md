# D-064AR — sono e três golpes FRLG integrados

**Data:** 21/11/2026. **Situação:** branch, pendente de gate e merge.

## Escopo
A PR #117 da auditoria de equipes foi integrada; sua branch original permanece no histórico. A PR #118 dos três suportes teve conflito de documentação após esse merge. O código de Leer, Stun Spore e Glare foi reaplicado sobre a main, preservando a auditoria D064AP.

**Novos golpes com sono:** Hypnosis (precisão 60, PP20), Sleep Powder (precisão 75, PP15) e Spore (precisão 100, PP15). Os números são do snapshot estático PokéAPI; o teach só é permitido quando a espécie e seu nível possuem registro `level-up` FRLG grupo7, método1. Não há TM desbloqueada.

## Regra própria do jogo
- Categoria `status`, `power:null` da PokéAPI normalizado para 0; custa SP no início da ação, inclusive no erro.
- Se acertar alvo sem condição, aplica `sleep` por **1 a 3 ações** perdidas, sorteadas **uma vez** pelo RNG determinístico da batalha. Não representa exatamente a cartucha Gen III e será reavaliado antes da beta.
- Em cada turno em que o adormecido deveria agir, decrementa o contador e cria log/frame `status`; depois de zerar, o **próximo momento de agir** registra despertar, limpa `sleep` e permite a ação imediatamente.
- A ação de sono tem limite de uma utilização por golpe por batalha, conforme os suportes pré-existentes; IA tenta no começo quando a condição do alvo permite, e efeitos incompatíveis não substituem outros status.
- Estado de sono e contador são apenas locais à simulação, **não** entram em save/roster; replay permanece somente leitura. A sequência de RNG dos golpes existentes sem sono não é alterada.
- Reutiliza efeitos existentes para Leer (Defesa -1), Stun Spore/Glare (paralisia) e preserva seus custos individuais. O motor não simula multi-turn switch ou held-item wake.
- Hipótese importante: o motor atual usa imunidade calculada por tipos para suportes, e um hit de dano básico simplificado; a fidelidade histórica de geração III não é alegada.

## Testes
`packages/game-core/tests/d064ar-sleep-moves.test.ts` valida whitelist, SP, escritor UID, limite de 1–3 ações, logs/frames, custo e reprodução com mesma seed. A suíte D064AO é atualizada onde Hypnosis era explicitamente bloqueado; Night Shade e TM09 continuam não equipáveis.

**Gates:** TypeScript strict, Vitest core/web, legado e E2E desktop/mobile, Playwright isolado, imagem Docker/HTTP, revisão manual. Não alegar publicação sem CI terminal do HEAD e deploy Railway no SHA exato.

## Continuidade
Próximo recorte D064AS: Night Shade com dano fixo por nível e tratamento de imunidade, testes de multiplicador, sem introduzir TM. A auditoria de progressão com writer, XP e expedição, e o tempo real do BattlePlayback em navegador, continuam pendentes.
