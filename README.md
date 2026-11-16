# Poke Idle Game — Kanto Idle / LAB v0.1

Protótipo experimental **não oficial** de RPG idle com Pokémon da região de Kanto, utilizando dados da [PokéAPI](https://pokeapi.co/docs/v2).

## Links oficiais deste projeto
- **Repositório de desenvolvimento:** https://github.com/isaquesan7/poke-idle-game
- **Jogo online:** https://kanto-idle-web-production.up.railway.app/
- **Ponto de entrada para novos chats/agentes:** [AGENTS.md](AGENTS.md)
- **Estado atual / próximos passos:** [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md)
- **Histórico de atualizações:** [CHANGELOG.md](CHANGELOG.md)

## Documentação do projeto
| Arquivo | Conteúdo |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Regras de continuidade e atualização obrigatória para novos chats |
| [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md) | Implementado, infraestrutura, pendências, próximo passo |
| [docs/GDD.md](docs/GDD.md) | Mecânicas acordadas vs. propostas e fórmulas |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Registro de decisões e regras substituídas |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitetura atual e migração planejada |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Paleta Kanto Dark e componentes |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | Padrões de código, comentários e testes |
| [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md) | Checklist antes de merges, deploys e troca de chats |
| [assets/README.md](assets/README.md) | Diretrizes para futuros assets visuais |

## Executar localmente
Requer Node.js >=18.
```bash
npm start
# abrir http://localhost:3000
```
Opcionalmente, abrir `index.html` diretamente no navegador com internet.

## Estilos organizados (revisão em branch)
Na branch `refactor/css-tokens-comments-v01` a camada visual foi dividida em `styles/tokens.css` (variáveis globais) e `styles/app.css` (classes comentadas e organizadas). A mudança permanece em revisão até ser aprovada/mesclada. Detalhes em [Design System](docs/DESIGN_SYSTEM.md) e [Estado](docs/PROJECT_STATE.md).

## Como está publicada a versão atual
- A branch **`main` está conectada ao Railway**, e novos pushes podem iniciar deploys automáticos.
- Serviço: `kanto-idle-web`; start: `npm start`; healthcheck `/health`.
- Mudanças na `main` precisam de testes e validação; preferir branch + PR para código.
- Nenhum backend ou banco de dados está presente no protótipo: progresso salvo no `localStorage` do navegador.
- A arquitetura React/TypeScript/Vite é **plano para v0.2**, ainda não implementada.

## Funcionalidades da v0.1
- Catálogo 151 Pokémon Kanto sob consulta à PokéAPI e inicial Bulbasaur/Charmander/Squirtle.
- Treinador com nível/XP, atributos distribuíveis e bônus de equipamentos, título e **todas** as insígnias.
- Pokémon com nível/XP, treino individual, afinidade, golpe melhorável e instâncias únicas.
- Transferência de 8%–10% dos atributos totais do treinador em **pontos adicionais** para cada Pokémon, segundo afinidade.
- Pokédex, Arena simplificada, captura experimental e expedição idle com limite de 8h por resgate.
- Modo de teste e salvamento local.

## Limitações e propriedade intelectual
- Regras de combate, drops, itens e economia são de laboratório; não existe antifraude de servidor.
- Nenhum sincronismo entre dispositivos; excluir dados do navegador apaga progresso.
- Requer internet para PokéAPI e sprites remotos (alguns dados dos iniciais têm fallback).
- Pokémon, personagens e marcas pertencem aos respectivos titulares. A PokéAPI fornece dados, mas **não licencia o uso comercial da franquia**.

## Repositório original intocado
`isaquesan7/pokedex` é projeto separado de referência. **Não modificar** sem autorização expressa e específica.


## GIFs animados de Kanto — alteração em revisão
Na branch \`feat/kanto-animated-gifs-v01\`, as imagens de Pokémon #001–#151
passam a apontar para \`assets/pokemon-gifs/poke_ID.gif\`; se o GIF não estiver
disponível, a interface utiliza a arte estática da PokéAPI como fallback.
O repositório original \`isaquesan7/pokedex\` é usado SOMENTE como fonte de leitura.
Os arquivos binários (~56,6 MB) são importados por um workflow na branch de
desenvolvimento; confirmar seu sucesso e os 151 arquivos antes do merge.

Com Node >=18: \`npm run sync:gifs\`, \`npm run verify:gifs\`, \`npm test\`.
A integração depende da PR #1 (tokens CSS); não publicar na \`main\` sem revisão
e testes. A licença e os direitos sobre Pokémon e ilustrações continuam dos
respectivos titulares, não havendo permissão comercial implícita.
