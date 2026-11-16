# Kanto Idle / LAB — protótipo v0.1

Protótipo experimental **não oficial** de RPG idle baseado nos dados públicos da [PokéAPI](https://pokeapi.co/docs/v2).

## Versão online

https://kanto-idle-web-production.up.railway.app/

A URL acima é um serviço Railway independente. **Nesta versão, a publicação não está conectada automaticamente ao GitHub**: atualizações futuras do repositório não irão para o servidor até que o serviço seja configurado para implantar a partir do repositório.

## Executar localmente

- **Modo estático:** abra `index.html` no navegador (com internet).
- **Modo servidor:** com Node.js >= 18, execute `npm start` e abra http://localhost:3000.
- **GitHub Pages:** publique o `index.html` da raiz em uma branch habilitada para Pages, se desejado.

## Incluído no protótipo

- Dados de espécies e golpes da PokéAPI (Kanto, 151 Pokémon; consulta sob demanda)
- Escolha do inicial e modo de teste
- Níveis, atributos treináveis e experiência do treinador e de Pokémon
- Bônus de equipamentos, título ativo e insígnias cumulativas
- Afinidade individual entre treinador e Pokémon (8% a 10% dos atributos totais do treinador são transferidos)
- Pokédex, batalhas simples, expedições e recompensas idle
- Salvamento local no navegador (`localStorage`)

## Limitações

- Protótipo de laboratório sem autenticação, banco de dados, servidor de regras ou antifraude.
- Batalhas, recompensas, economia e itens possuem regras provisórias.
- Não há salvamento entre dispositivos; limpar dados do navegador apaga o progresso.
- Necessita de internet para PokéAPI e sprites remotos.
- A PokéAPI disponibiliza dados, mas **não concede licenças sobre Pokémon**. O jogo não é oficial e não está autorizado para exploração comercial com a propriedade intelectual da franquia.
- Sem garantias de disponibilidade ou compatibilidade; projeto experimental.

## Original preservado

Este é um projeto **separado** do repositório `isaquesan7/pokedex`. Nenhuma alteração foi efetuada naquele repositório.
