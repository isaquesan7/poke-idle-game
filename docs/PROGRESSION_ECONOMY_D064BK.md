# D064BK — auditoria de progressão e economia (22/11/2026)

Status: **testes propostos em branch; execução CI/merge/Railway ainda não confirmados**.

## Escopo
Teste determinístico da função de expedição já publicada, sem alterar XP, taxa de drops, IA, PokéAPI, gravações ou interface. O teste percorre os níveis iniciais 1–100 e simula 40 resgates consecutivos de 8h com continuidade do nível, XP do treinador e contadores de bolas. São 320 horas **simuladas**, não observações de jogadores. As regiões de cada coorte são escolhidas pelo maior `levelMin` compatível com o nível do Pokémon, como cenário IDEAL; **não representa os desbloqueios de região pelo nível do treinador**, nem a disponibilidade real de cada área.

## Gate de equilíbrio a verificar
- Pokémon nível 100 nunca acumula XP adicional; XP não ultrapassa cap 100.
- Afinidade por expedição permanece zero; bolas seguem raras e Ultra Ball não pode surgir de um resgate isolado sem progresso anterior.
- Recompensas não negativas e fator zero em áreas superadas.
- Progressão dos contadores de bola persiste entre resgates sem reiniciar.
- Regras de battle anti-farm, captura e derrota permanecem sem mudanças.

## Loja futura: proposta, NÃO implementada
Antes de precificar a loja, comparar moeda adquirida por hora nas dez regiões, custo de captura efetiva e necessidade de compra versus bolas ganhas. Evitar conceder bolas grátis no cadastro ou criar preços sem medir fontes e sorvedouros. Simular cenários 0/25/50/100% de investimento das moedas em Pokébolas quando existir catálogo de preços aprovado. Recompensas de resgate, especialmente em níveis altos, precisam ser comparadas com acessibilidade real das regiões (requisito treinador + parceiro), não apenas com progressão ideal.

## Próxima ação
Rodar GitHub Actions TypeScript/Vitest/Playwright/Docker no HEAD da branch; corrigir qualquer falha. Acrescentar relatório quantitativo por região (tempo até cada nível, moedas, XP e estoque de bolas) e validar jornada com restrições de desbloqueio. Só depois propor preços, PR merge e conferir Railway no SHA exato. Auditoria manual NVDA/VoiceOver continua pendente.
