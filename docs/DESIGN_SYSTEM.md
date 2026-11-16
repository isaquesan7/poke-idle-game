# Design System — Kanto Dark (v1.0)

**Situação:** paleta-base já existe na v0.1; padronização de tokens e CSS Modules aprovada como direção para a v0.2, ainda não implementada.

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
