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

## Decisão explicitamente substituída
- **SUPERADA:** “8% a 10% aplicados diretamente ao atributo próprio do Pokémon” / “equipamentos limitados ao teto 40”.
- **VIGENTE D-004/D-005:** pontos extras entram no total do treinador; 8–10% DO TOTAL DO TREINADOR são adicionados ao Pokémon.

## Registro futuro — template
```md
| D-012 | AAAA-MM-DD | VIGENTE/PROPOSTA/SUPERADA | Contexto, decisão, justificativa e consequências. |
```
