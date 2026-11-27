# Mega Evoluções — planejamento e implementação
Decisão do proprietário, 26/11/2026: transformação permanente, sem duração, sem retorno automático ou alternância durante combate. Primeiro escopo limitado às linhas dos três iniciais de Kanto.
- Venusaur → Mega Venusaur.
- Blastoise → Mega Blastoise.
- Charizard → Mega Charizard X OU Y; escolha explícita do jogador. Uma forma escolhida por exemplar, sem alternância automática. Possibilidade de reversão manual ainda não decidida.
- Não disponibilizar Megas de outras espécies nesta fase, inclusive Mewtwo.
- Proposta futura (a decidir): desbloqueio endgame, nível/maestria/afinidade, Mega Pedra específica, confirmação. Preservar UID, nível, XP, golpes, afinidade, treino e maestria da família; espécie-base Kanto permanece identidade da Pokédex, forma separada. Usar atributos/tipos da forma da PokéAPI fixados em catálogo. Sem captura de forma Mega, sem runtime externo. Balanceamento, requisitos, aquisição de pedras e arte ainda pendentes. MEGA01: catálogo e contrato puro implementados na candidata; ainda sem writer, estoque, drops, UI ou ativação online.


## MEGA01 — base canônica
- IDs de forma PokéAPI 10033–10036 (somente arte/perfil), identidade nacional permanece 3/6/9; campo individual proposto `megaForm` ausente em Pokémon normal. Validação rejeita forma incompatível e impede qualquer nova escolha após Mega. Nenhum timer, reversão ou transformação durante luta. Catálogo contém pedra específica e atributos/tipos conferidos nos CSV da mesma revisão fixada usada em Kanto; +100 BST em cada forma, HP inalterado. Não criar Pokémon capturáveis adicionais, habilidades passivas, nem alterar a maestria familiar.
- Nível, afinidade, maestria, insígnias, obtenção/consumo de pedra e Key Stone continuam a definir: sugestões anteriores não são requisitos aprovados. Quote puro de compatibilidade não autoriza transformação. Próxima entrega: requisitos/economia, persistência por UID e validação transacional, integração stats/combate/UI, proteção de espécime Mega em pesquisa, depois CI e publicação coordenada.

## MEGA02 — regra candidata de endgame e transição
- Após autorização de continuidade, adotada como candidata a proposta anterior: nível 100, afinidade 100%, Maestria V da família, oito insígnias oficiais e uma Mega Stone da forma. Não exige Key Stone adicional; nenhuma reversão/alternância. Ajustável antes de lançamento. Estoque independente opcional `megaStoneStock` (como TMs), sem concessão inicial. Transição pura rejeita incompatibilidade, ocupado, estoque inválido e forma já escolhida; consome uma pedra e altera exclusivamente megaForm do UID. Validador comum rejeita pares inválidos; pesquisa protege Mega mesmo fora da equipe/favoritos. Projeção lista opções e requisitos; nenhum HTTP, drop ou efeito de combate publicado ainda. Próximo: aquisição endgame, writer com locks/revisões/recibos e integração de stats/arte/UI.
- Inventário de assets conferido: 151 GIFs em assets/pokemon-gifs, sem IDs 10033–10036. Proprietário dispõe de GIFs das quatro Megas; aguardar envio para integração visual, sem bloquear desenvolvimento funcional.
