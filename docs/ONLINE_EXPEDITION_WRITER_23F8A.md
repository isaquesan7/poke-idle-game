# 23F8A — Expedições autoritativas


## ONLINE-01C-23F8A — writer privado de Expedições
- Base main #277 publicada após cinco CI SUCCESS (deploy ainda a verificar). #278 e #279 seis CI SUCCESS nos HEADs anteriores; dependências em reconciliação. Branch independente para reduzir conflito de Gym UI. Reutiliza `applyRewardEvent` e `expeditionRewards` existentes, journal efêmero de uma ação (não altera ledger online). PostgreSQL controla relógio depois do lock de save, revisão e recibo durável; duplicata retorna duplicate sem pagar e exige releitura (não simula replay de payload). Start/claim/stop privados, nenhuma rota nova. Proteções mútuas reserva regional/expedição e investimento; Gym e Coleção já bloqueiam expedição no core/writer. Teste PG18 isolado com envelhecimento apenas fixture, 8h cap, concorrência, líder único, sem afinidade, sem novos SQL. CI pendente; próxima etapa HTTP/UI CI-only e concorrência cruzada. Cadastro OFF, /play e economia inalterados.
