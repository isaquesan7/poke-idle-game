# D-053 — correções de UI e contrato de propriedade do inventário

## Implementado (branch D053, sem publicar)

- **Insígnias:** exibem em hover e foco teclado os bônus exatos do catálogo de Kanto; nome, requisito e estado de conquista permanecem. Bônus de cada badge são os campos `LEGACY_BADGES[*].stats`, sem inventar atributos.
- **Títulos:** substituição do select nativo pelo componente `TitlePicker` com lista customizada em estilo Kanto Dark, hover/foco exibindo `LEGACY_TITLES[*].stats` e requisitos dos bloqueados. Seleção usa `onTitle` já versionado; disponibilidade segue `legacyTitleIsUnlocked` de game-core. Navegação Escape, click fora e Tab. Sem mudar os bônus ou regras.
- **Modal Equipamentos:** renderizada com portal React em `document.body`, fora dos stacking contexts da sidebar e do perfil; camada de modal `--z-modal-overlay` declarada em `styles/tokens.css` e `z-index` máximo seguro. Mantém foco, Escape, fechar pelo overlay e retorno do foco.
- **Identificador equipado:** check Font Awesome no canto superior direito de cada cubo cujo item tenha `status === 'Equipado'`. Não exibe bônus/quantidade permanentemente.
- E2E regressão: tooltip de título/insígnia, títulos bloqueados, modal renderizada como filho de body com z-index maior que 9999 e check de equipamento equipado após ação real.

## Inventário real — primeiro gate de domínio, ainda não ativado

Criado em `packages/game-core/src/inventory/ownership.ts` um modelo **read-only/fail-closed** com `BASE_BAG_SLOTS=10`, propriedade de equipamentos versionada `{version:1,ownedEquipment:{[id]:count},extraBagSlots:number}`, distinção entre **save sem ledger** (`legacy-untracked`) e ledger vazio (`valid`), validação de IDs/quantidades, checagem de equipamento por slot e cálculo de vagas com empilhamento de itens (1 tipo=1 espaço). Testes unitários cobrem corrupção, item forjado, incompatibilidade e sobrecapacidade.

**O que NÃO foi feito:** não foi conectado ao writer de recompensa, à criação de saves, à loja ou aos equipamentos visíveis. O catálogo legado permanece disponível como laboratório, com aviso no UI. Não existem grants de equipamentos, receita/preço de item de expansão, nem contratos transacionais de consumo. Não permitir que um inventário vazio no save antigo bloqueie ou perca itens equipados; planejar uma migração explícita de compatibilidade e testes de regressão antes de ativar o gate de propriedade.

## Fase seguinte (economia)

1. Definir **origem de aquisição** e regras para equipamentos e o item de expansão (marco/loja/drop; preços, limites, quantidades e raridade) com aprovação em GDD.
2. Implementar writer atômico de **grant** com origem de evento autorizada, recibo idempotente/revisão única e validação de capacidade; não tomar item via renderização.
3. Migrar saves v0.2 legados garantindo o item que **já estava equipado**, sem converter todo catálogo de laboratório em propriedade; verificar readback/backups e persistência, ainda sem mudar a chave do save.
4. Só então ligar grid/Equipar/Remover à lista de propriedade, validar que não aceita equipamento alheio e habilitar item de expansão da capacidade.

Preservar save schema2 `kanto-idle-play-v02`, itens de evolução, 151 GIFs, avatar PNG original, combate, TM09 fail-closed e repositório `isaquesan7/pokedex`. Conferir CI geral, E2E PC/mobile e Docker no SHA final; nenhuma afirmação de merge/deploy antes de confirmação.
