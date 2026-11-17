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

| D-018 | 2026-11-16 | CONTRATO CANDIDATO EM IMPLEMENTAÇÃO | O futuro save oficial v0.2 terá schemaVersion/revision próprios, payload integral v0.1 preservado até paridade, e backup contendo o JSON original exato com SHA-256. A ordem planejada de gravação será backup → candidato → marcador; apenas funções puras/ensaios agora. Nenhum writer de produção ou promoção de draft é autorizado antes de resolver D-017 (aba v0.1 não cooperativa), backup externo e rollout explícito. |

| D-019 | 2026-11-16 | PROTOCOLO EXPERIMENTAL EM IMPLEMENTAÇÃO | A v0.1 é writer não-cooperativo: Web Locks não bloqueiam abas antigas. O futuro save oficial v0.2 terá chave separada e revisões monotônicas sob lock exclusivo **somente entre v0.2 cooperativas**; a origem legada fica preservada. Havendo divergência pós-cópia, o sistema deve bloquear mescla/restauração automática, preservar ambos os progressos e exigir decisão explícita de rollout. Pacotes externos com SHA-256 podem ser exportados/conferidos na prévia, mas **NÃO importados para storage**, nem concedem autorização de gravação real. |

| D-020 | 2026-11-16 | LABORATÓRIO ISOLADO EM IMPLEMENTAÇÃO | Testar o futuro cutover v0.1→v0.2 exclusivamente em uma instância `MigrationMemoryLab` com Map privado e confirmação explícita; não aceitar `Storage` real nem executar as instruções do journal em localStorage/IndexedDB. Simular quota, crashes, reenvios, revision stale e mudança da origem v0.1; resultado `committed` no laboratório não é migração real nem autoriza writer oficial. UI de ensaio existe somente na prévia React. Continuam vigentes D-017–D-019. |

| D-021 | 2026-11-16 | LABORATÓRIO DO NAVEGADOR EM VALIDAÇÃO | Para verificar QuotaExceededError/Web Locks/reload reais, permitir gravações EXCLUSIVAMENTE em chave fixa com prefixo `__kanto_lab__` sob rota `/__kanto_v02_browser_lab__` em origem `http://localhost` ou `http://127.0.0.1` no Vite. O executor não é usado pela UI, não pode escrever em chaves v0.1/v0.2 oficiais, e exige consentimento; dados parciais de laboratório devem ser preservados para auditoria, rollback só por confirmação e apenas de candidato/marcador de laboratório, mantendo backup. Nem resultado committed do browser nem Web Locks garantem coordenação com antigas abas v0.1; ativação real segue BLOQUEADA. |

| D-022 | 2026-11-16 | GATE EXPERIMENTAL EM IMPLEMENTAÇÃO | A elegibilidade estrutural do save e a disponibilidade de Web Locks **não autorizam** migrar. Até existir writer único, paridade integral, backup externo verificado e decisão explícita de release, a API de gate v0.2 terá apenas resultado `blocked` / `canMigrate:false`, sem flags de cliente para desbloquear. Mapeamento obrigatório dos 21 handlers v0.1 e de escritores indiretos; teste automatizado detecta alterações no conjunto de ações, com revisão humana adicional de mutações dentro das funções. |

| D-023 | 2026-11-16 | REDUTORES PUROS EM IMPLEMENTAÇÃO | Para portar as quatro ações `stat-pokemon`, `reset-pokemon`, `add-team` e `remove-team`, criar reducer sem efeitos colaterais e que devolva novo JSON v0.1 sem modificar entrada; preservar campos desconhecidos e recursos. O Pokémon tem orçamento de **2 pontos manuais por nível adquirido**, mas a v0.1 não impõe o teto de 40 por atributo dos pontos do TREINADOR. A equipe mantém 1–3 UIDs únicos do roster e não pode mudar com expedição em andamento; treino do Pokémon continua permitido. Nenhuma ação nova pode gravar saves reais nem liberar `cutoverGate` até writer/cutover autorizado. |

| D-024 | 2026-11-17 | EVENTOS PUROS EM IMPLEMENTAÇÃO | Prototipar concessão de recompensas de batalha/captura e expedição exclusivamente em envelope RAM `{raw,revision,receipts}` com ID de evento obrigatório e revisão esperada. Evento duplicado idêntico não paga de novo, ID com payload distinto conflita, revision stale bloqueia; recompensa/captura/recibo são calculados juntos na função pura. A batalha chega pré-resolvida e NÃO é validada contra fraude; tabs independentes não compartilham autoridade e ainda divergem. Só portar o writer para persistência depois de uma transação de evento canônico e autorização de migração. |

| D-025 | 2026-11-17 | IMPLEMENTADO NO CORE, SEM PERSISTÊNCIA | Portar `move`/`upgrade-move` por UID em função sem IO. Golpes escolhidos devem constar em lista fornecida; upgrades exigem golpe ativo danoso, orçamento `floor(level/5)`, limite `min(10,floor(level/10)+1)`, mantendo ranks anteriores. Lista/poder fornecidos pelo cliente NÃO são prova autoritativa; nenhum writer real ou migração ativado. |

| D-026 | 2026-11-17 | EXPERIMENTO DE AUTORIDADE EM RAM | Ensaiar um único ledger de recompensas usando apenas Map privado e valor único contendo save+revision+recibos, com cópias de cliente sem referências mutáveis, replay idempotente, falhas antes/depois do commit e corrupção fail-closed. A serialização em um turno JS só funciona entre clientes DA MESMA instância: outros processos, navegadores, instâncias e writers v0.1 NÃO são coordenados. Checksum de teste não autentica eventos nem produz durabilidade. Não conectar a storage real nem desbloquear cutover antes de política transacional/backup/paridade completa. |

## Decisão explicitamente substituída
- **SUPERADA:** “8% a 10% aplicados diretamente ao atributo próprio do Pokémon” / “equipamentos limitados ao teto 40”.
- **VIGENTE D-004/D-005:** pontos extras entram no total do treinador; 8–10% DO TOTAL DO TREINADOR são adicionados ao Pokémon.

## Registro futuro — template
```md
| D-012 | AAAA-MM-DD | VIGENTE/PROPOSTA/SUPERADA | Contexto, decisão, justificativa e consequências. |
```
