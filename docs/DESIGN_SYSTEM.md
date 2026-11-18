# Design System — Kanto Dark (v1.0)

**Situação:** tokens e estilos globais extraídos para `styles/tokens.css` e `styles/app.css` na branch de revisão `refactor/css-tokens-comments-v01` (ainda não mesclada). CSS Modules em componentes React continuam planejados para v0.2.

## Paleta oficial
| Papel | Valor | Uso |
| --- | --- | --- |
| `--color-bg` | `#0C111B` | fundo geral |
| `--color-surface` | `#151C29` | painéis |
| `--color-surface-raised` | `#1C2635` | cartões, menus |
| `--color-border` | `#2A3648` | separadores, bordas |
| `--color-text` | `#F2F5FA` | texto principal |
| `--color-text-muted` | `#9BAEC6` | apoio e legendas |
| `--color-primary` | `#69D6E5` | CTAs, foco, seleção |
| `--color-success` | `#55D5A8` | ganhos, recompensas |
| `--color-gold` | `#F2C36E` | conquistas, destaque de valor |
| `--color-danger` | `#FC7C86` | erro, dano, perigo |
| `--color-affinity` | `#B49AFF` | vínculo, progressão especial |

Cores de tipo Pokémon (Fogo, Água, etc.) devem ser tokens próprios, distintos dos estados semânticos; não presumir que 'vermelho' sempre seja Fogo ou erro.

## Normas de componentes
- Espaçamento baseado em 4px: 4/8/12/16/24/32.
- Bordas: 10px inputs, 12–16px cartões e 16px painéis maiores; consistência acima de modismos.
- Tipografia: `system-ui` de fallback, hierarquia clara e pesos consistentes.
- Visual: RPG responsivo dark, não painel corporativo. Botão principal ciano, recompensas verdes, conquistas douradas, afinidade violeta, erro coral.
- Interações: foco visível, hover, disabled, erro e loading; alvos de toque adequados.
- Acessibilidade: contrastes revisados; texto normal com meta >=4,5:1; navegação teclado, `aria-label` onde necessário.
- CSS Modules nos componentes; CSS global somente reset/tokens/utilitários muito gerais.
- PROIBIDO hardcode de hex/rgb avulsos dentro de componentes, exceto gráficos/tipos por tokens especializados.
- Layout mobile-first para navegação, equipe, batalha e inventário.

## Componentes base pretendidos
`Button`, `Card`, `Modal`, `Badge`, `ProgressBar`, `StatRow`, `PokemonCard`, `EquipmentSlot`, `Tooltip`, `Toast`, `Tabs`.

## Implementação futura em CSS (exemplo)
```css
:root {
  --color-bg: #0c111b;
  --color-surface: #151c29;
  --color-surface-raised: #1c2635;
  --color-border: #2a3648;
  --color-text: #f2f5fa;
  --color-text-muted: #9baec6;
  --color-primary: #69d6e5;
  --color-success: #55d5a8;
  --color-gold: #f2c36e;
  --color-danger: #fc7c86;
  --color-affinity: #b49aff;
}
```

## Implementação atual em revisão — v0.1
- `styles/tokens.css`: um `:root` com tokens semânticos, tons especiais de cada componente, gradientes, sombras, raios, escala de espaçamento e tipografia. Valores preservam a aparência da v0.1.
- `styles/app.css`: seletores com comentários explicando a função de cada classe e divisões por componentes/telas. **Cores e sombras não podem ficar hardcoded neste arquivo.**
- O `index.html` importa os dois estilos. O servidor Node expõe apenas essas rotas CSS conhecidas, sem servir caminhos arbitrários.
- Continuar usando tokens em futuras alterações. Ao migrar para React, componentes podem passar a CSS Modules, mas devem referenciar os mesmos tokens globais.
- Nota: a paleta contém muitos tons legados específicos para preservar a comparação visual. Consolidar somente com validação explícita de contraste e screenshots.


## Recuperação de save — prévia React v0.2 (experimental)
O `RecoveryExchangePanel` usa somente variáveis semânticas existentes do `styles/tokens.css`, CSS Modules com comentário português por seletor e layout flexível para desktop/mobile. Ações explicitam **baixar/conferir**; não desenhar botões de "restaurar"/"migrar" enquanto a coordenação de writers não estiver autorizada.


## Painel do laboratório em memória — prévia React v0.2
`MigrationLabPanel` usa somente tokens de cor, espaçamento e raio do `:root`, CSS Modules com comentários em português e layout de uma coluna adequado a desktop/mobile. Os textos e o checkbox distinguem explicitamente **executar ensaio** de **migrar progresso**, e o botão inicia desabilitado até confirmação.


## Diagnóstico do gate fail-closed (prévia React)
Na seção de compatibilidade, título `Migração v0.2 bloqueada` e motivos em lista textual acessível. Reutiliza tokens CSS (`--color-text`, `--color-text-muted`, espaçamentos) e comentários por seletor; não usar badge verde, ação de 'migrar' ou visual que sugira liberação. Mostrar que 'formato compatível' não é autorização de write.


## D-036 — UI de HP por evento (2026-11-17)
- Barras de HP textual e role=progressbar com aria-valuenow/valuemax, uma por Pokémon. Impacto, cura e status são marcados pelo frame mostrado e reiniciam com a chave do índice do log.
- Paleta Kanto Dark preservada, sem hex fora de styles/tokens.css. Durações battle-health, battle-impact e battle-float ficam no :root. prefers-reduced-motion remove flash, shake, floating e transições, mantendo os valores e os logs. Layout mobile não pode gerar overflow horizontal.

## D-037: barras SP e feedback de efetividade na Arena (17/11/2026)
- Barra SP abaixo do HP por combatente com texto `SP atual / máximo`, `role=progressbar`, `aria-valuenow` e `aria-valuemax`. Usa `--color-primary` ciano do Kanto Dark; HP continua verde. Quando SP=0, aviso textual de ataque básico. O indicador só aparece se `frames` e `maxSp` válidos foram persistidos no combate original.
- Impacto crítico tem animação curta própria e aviso `CRÍTICO!`; efetividade dupla, resistência e imunidade têm rótulos semântico/cores de tipo via tokens `--color-tag-*`. O diário guarda os mesmos fatos em texto e o overlay decorativo tem `aria-hidden`; a informação nunca depende exclusivamente da cor. `prefers-reduced-motion: reduce` desliga shakes, flashes e transições de HP/SP sem perder números/rótulos.
- Mesmo grid da Arena e limites responsivos mobile, sem hex/rgb hardcoded no CSS Module; tokens ficam no `:root` de `styles/tokens.css` quando houver novos valores visuais.
