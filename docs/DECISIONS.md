# Registro de decisões (ADR leve)
Histórico append-only: não apague decisões antigas; marque SUPERADA e inclua a nova decisão que a substitui. Toda decisão deve ter data, status e impacto.

| ID | Data | Status | Decisão e justificativa |
| --- | --- | --- | --- |
| D-001 | 2026-11-16 | VIGENTE | Isolar o jogo em `isaquesan7/poke-idle-game`; NÃO alterar `isaquesan7/pokedex`. Preserva projeto original. |
| D-002 | 2026-11-16 | VIGENTE | Season 1 usa Pokémon nacionais #001–#151 e dados da PokéAPI, respeitando que IP/marcas não são liberadas para uso comercial. |
| D-003 | 2026-11-16 | VIGENTE | O treinador possui nível, XP e seis atributos; pontos investidos manualmente têm teto 40 por atributo. |
| D-004 | 2026-11-16 | VIGENTE | Equipamentos, título ativo e TODAS as insígnias conquistadas somam atributos do treinador ALÉM do teto manual de 40. Insígnias são cumulativas, sem slot de insígnia ativa. |
| D-005 | 2026-11-16 | VIGENTE | Afinidade é por instância Pokémon (0–100), e transfere `floor(treinadorTotal*(0,08+0,02*afinidade/100))` em pontos **aditivos** ao Pokémon. |
| D-006 | 2026-11-16 | VIGENTE | Um título ativo, nove slots de equipamentos; raridade, status finais e drops de itens ficam para fase posterior. |
| D-007 | 2026-11-16 | VIGENTE | Manter o protótipo v0.1 operacional; `main` conectada ao Railway e deploy por push, sem alterar domínio. |
| D-008 | 2026-11-16 | DIRETRIZ APROVADA, A IMPLEMENTAR | Migrar gradualmente para React + TypeScript + Vite, CSS Modules/tokens, `packages/game-core` puro, Vitest/Playwright. Não declarar implementado até concluir. |
| D-009 | 2026-11-16 | DIRETRIZ APROVADA, A IMPLEMENTAR | Design Kanto Dark, paleta em `docs/DESIGN_SYSTEM.md`. |
| D-010 | 2026-11-16 | VIGENTE | Documentar TODAS as futuras atualizações em `CHANGELOG.md` e handoff `docs/PROJECT_STATE.md`, além dos arquivos técnicos afetados, para continuidade entre chats. |
| D-011 | 2026-11-16 | VIGENTE | Mudanças de código devem preferir branch+PR+testes; publicar após validação; preservar saves locais v0.1. |
| D-012 | 2026-11-16 | APROVADA E PUBLICADA | Preferir GIF local para Pokémon #001–#151 com PNG estático da PokéAPI como fallback; sincronizar apenas por leitura da origem `isaquesan7/pokedex` em SHA fixado, mantendo o projeto original intocado. Importar via workflow no PR e validar binários antes de merge. |

| D-013 | 2026-11-16 | EM IMPLEMENTAÇÃO | Iniciar a v0.2 com game-core TypeScript puro e Vitest em branch independente; manter servidor e save v0.1 sem alteração até obter paridade e testes de UI. Introduzir npm workspaces gradualmente. |

| D-014 | 2026-11-16 | EM IMPLEMENTAÇÃO | Criar prévia React/Vite em workspace independente com adaptador de save v0.1 somente leitura e backup; não mudar `server.mjs` nem UI publicada até paridade comprovada. Usar CSS Modules e tokens globais existentes. |

| D-015 | 2026-11-16 | EM IMPLEMENTAÇÃO | Migrar primeiro as telas React de visão geral e treinador em modo somente leitura. Fórmulas no game-core e catálogo de compatibilidade fiel à v0.1; sem cache não inventar base_stat. Escrita do save requer persistência versionada e testes prévios. |

| D-016 | 2026-11-16 | EM IMPLEMENTAÇÃO | Persistência experimental v0.2 deve usar rascunho independente versionado, com `sourceRaw` v0.1 imutável, revisão e conflito se o original mudar. Só distribuir pontos/equipar dentro da simulação, sem promover ao save real até existir mecanismo de persistência seguro aprovado. Escritas exigem Web Locks no navegador; sem suporte, somente leitura. |

| D-017 | 2026-11-16 | DIRETRIZ DE SEGURANÇA EM IMPLEMENTAÇÃO | Migração v0.1→v0.2 exige pré-verificação não destrutiva, backup fiel e chave oficial distinta. Não promover rascunho diretamente para v0.1. A v0.1 não usa Web Locks, logo CAS localStorage/Web Locks só no React NÃO asseguram cooperação com abas antigas. Migração real depende de writer único/política de rollout e testes de falha/rollback (ver `docs/SAVE_MIGRATION_PLAN.md`). |

## Decisão explicitamente substituída
- **SUPERADA:** “8% a 10% aplicados diretamente ao atributo próprio do Pokémon” / “equipamentos limitados ao teto 40”.
- **VIGENTE D-004/D-005:** pontos extras entram no total do treinador; 8–10% DO TOTAL DO TREINADOR são adicionados ao Pokémon.

## Registro futuro — template
```md
| D-012 | AAAA-MM-DD | VIGENTE/PROPOSTA/SUPERADA | Contexto, decisão, justificativa e consequências. |
```
