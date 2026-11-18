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

## D-038 — Concentrar e PP no palco/treinamento (17/11/2026)
- No painel de golpes, exibir **PP PokéAPI** e **custo SP do jogo** em rótulos distintos, inclusive golpes de suporte; capacidade SP individual calculada de espécie/nível. Informar ataque básico gratuito e neutro (Poder 30), sem regeneração passiva e Concentrar máximo 2 vezes (30% da capacidade, cooldown 4 turnos).
- Em `BattleStage`, `focus` aciona pulso curto no próprio combatente e overlay textual `+X SP` ciano com os mesmos tokens `--color-primary`, `--duration-battle-impact`, `--duration-battle-float`, `--shadow-pokemon-art`. Não criar números de SP derivados de texto; somente leitura do frame `playerSp/wildSp`. Diario tem a linha completa acessível; overlay `aria-hidden` para não anunciar duplicado. `prefers-reduced-motion` remove todas as animações sem esconder números.
- O label `SP 0` passa a indicar **ataque básico ou Concentrar** porque Concentrar é uma alternativa de recuperação. Medidores conservam `role=progressbar`, nome, valor atual/máximo e responsividade. Saves D-037 preservam aparência e números históricos, saves anteriores sem trilha não inventam SP.

## D-039 — A11y do diário e visual de Concentrar (17/11/2026)
- **Concentrar:** usar badge estático com `✧ CONCENTRAR +X SP` no palco; realçar contorno do medidor por `--color-primary` sem depender só da cor (texto de recuperação/sem atacar ao lado da barra). Informações vieram exclusivamente do frame que o motor armazenou, nunca derivar por leitura de texto. Overlay duplicado `aria-hidden=true` para não repetir anúncios; texto real do log permanece consultável. `prefers-reduced-motion:reduce` desliga animação do badge, mantém números.
- **Reprodução acessível:** controles com botões nativos (pausa/continuar, velocidade, leitura assistiva, passo único se pausado, pular) e rótulos acessíveis; ao focar painel (Tab) Espaço alterna pausa e seta direita avança uma linha se pausado. Foco visível em `--color-primary`; instrução textual em linguagem simples. Com modo assistivo opcional a reprodução passa a 3s/linha e anuncia `aria-live=polite` por região separada, evitando a fila de anúncios contínua em modo padrão. Timer e lista de eventos têm `aria-live=off`, mas continuam navegáveis pelo leitor de tela; progresso usa `role=progressbar`.
- **Cores e motion:** nenhuma cor hardcoded, usar tokens; a badge se adapta a largura mobile, reduced-motion remove animação e mantém os eventos visíveis. Legacy replays sem HP/SP não fabricam informação visual. Novo código não altera o tema de / v0.1.

## D-041 — continuidade do GIF e controle de efeitos (18/11/2026; publicada PR #56)
- GIFs da Arena devem conservar a **mesma instância HTMLImageElement** a cada linha do diário. Chaves de frame podem ser usadas em overlays/transições, nunca no ancestral da imagem animada. Arte grande utiliza `loading="eager"`; imagens de grades permanecem lazy para poupar rede.
- O CSS usa `--duration-battle-impact`, `--duration-battle-float`, `--duration-battle-health`, `--duration-fast` e tokens existentes, sem novas cores hardcoded. A Arena oferece preferência visual, inclusive no mobile onde a barra lateral de rodapé é oculta: `Padrão do dispositivo` mantém o `prefers-reduced-motion`, `Exibir animações` reativa impactos CSS apenas por escolha do jogador, `Reduzir movimento` desliga impactos/transições independentemente do SO. A propriedade `data-motion` fica na raiz React e não constitui estado de batalha.
- GIFs são recursos de imagem que continuam animados se suportados pelo navegador; o seletor controla **efeitos CSS** e não consegue obrigar Edge/Windows a reproduzir GIFs bloqueados por preferências ou políticas do navegador. Não suprimir rótulos de HP, SP, críticos, tipo ou Concentrar em qualquer modo.

## D-042 — animações sem seletor (18/11/2026; branch)
- O modo completo de CSS da Arena é estático e vale para todos os dispositivos, inclusive quando o SO indica reduced motion. Não há controle ou preferência visual editável; a UI do seletor D-041 foi revogada por decisão de produto. Manter GIFs estáveis, overlays legíveis, números de HP/SP, feedbacks textuais e leitura assistiva. Isso remove a opção de reduzir movimento e é ponto de revisão futura de acessibilidade antes da beta.
