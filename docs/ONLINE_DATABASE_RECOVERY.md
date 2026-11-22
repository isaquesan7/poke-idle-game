# ONLINE-01C-2 — Backup / recuperação do PostgreSQL

**Status 22/11/2026: ainda NÃO confirmado.** Criar o volume e migrar 001/002/003 não equivale a ter backup. API privada sem cadastro real até completar e atestar as etapas abaixo.

## Agendamento no Railway

1. Abrir o projeto Railway `kanto-idle-lab`, ambiente de produção, serviço **Postgres** (não o web nem a API).
2. Abrir a aba **Backups** e configurar pelo menos os backups diários e semanais para o volume persistente. Registrar data da primeira cópia e política de retenção.
3. A documentação Railway indica que os backups agendados são Daily (retenção ~6 dias), Weekly (~27 dias) e Monthly (~89 dias); verificar limites, custo e espaço de armazenamento conforme plano.
4. Se o recurso estiver disponível no serviço Postgres, considerar **Enable PITR** na aba Backups. PITR arquiva WAL em bucket e permite restauração para ponto no tempo, mas gera egress/storage e redeploy. Não habilitar automaticamente sem verificação de custos/efeitos.
5. Verificar no painel que existe uma cópia **concluída**, com data. Uma configuração de agendamento sem cópia gerada ainda não libera usuários.

## Exercício de restauração — sem afetar produção

- **Nunca executar Restore sobre o volume do Postgres de produção para testar.**
- Para PITR, usar a opção de restauração, que cria um serviço irmão com volume próprio sem alterar o banco fonte. Validar em ambiente isolado sem conectar a aplicação pública. Se backups de volume forem usados, o restore da aba Backups pode preparar substituição de volume no mesmo serviço: revisar patches antes de qualquer Deploy e não aplicar sobre produção como teste.
- Na instância restaurada, verificar schema e índices, journal `game_schema_migrations` contendo as migrations esperadas, políticas de conexão e leitura de saves de teste (sem dados pessoais reais, enquanto cadastro público está desligado).
- Registrar horário da cópia, duração do restore, perda de dados máxima observada (RPO), tempo de recuperação (RTO), hash/checksum da migration e usuário responsável.
- Repetir após mudanças estruturais importantes. O acesso à chave de restauração e aos snapshots deve ficar restrito a administradores.

## Confirmação operacional pendente

- [ ] Backup diário agendado e primeira cópia concluída
- [ ] Backup semanal habilitado
- [ ] PITR avaliado e, se ativado, archiver saudável + primeiro backup base
- [ ] Restauração segura em instância independente concluída
- [ ] Banco restaurado auditado e testes de leitura executados
- [ ] RPO/RTO e responsável documentados

Fontes técnicas: https://docs.railway.com/volumes/backups e https://docs.railway.com/volumes/point-in-time-recovery

As ações de backup/PITR não foram realizadas nesta branch: a integração Railway disponível não expõe operações de agendamento ou restauração. Não registrar SUCCESS antes de verificar no painel.
