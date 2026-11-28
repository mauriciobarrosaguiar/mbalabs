# GeoMap — Política de retenção temporária

Decisão de produto: arquivos de mapeamento disponíveis por sete dias. Aplica-se ao administrador desde o MVP e aos futuros clientes. Complementa CLOUD-ARCHITECTURE.md e substitui qualquer pressuposto de retenção indefinida de arquivos. Documento de requisitos, não implementação.

## Prazo
- Proposta: completed_at (publicação de resultados verificados) + 168 horas, em UTC. Apresentar data/hora local e contador na interface.
- O prazo é fixo por execução e não reinicia ao acessar, baixar ou receber um novo e-mail. Cada novo levantamento possui seu próprio prazo.
- Originais, resultados, ZIP, PDF, modelos 3D, prévias, tiles e demais derivados temporários ficam sujeitos ao prazo. Não excluir durante tarefa ativa legítima.
- Para impedir acúmulo de uploads abandonados, falhas ou cancelamentos, proposta de prazo adicional de sete dias após abandono ou estado terminal; definir timeout máximo de upload, fila e processamento antes da implementação. Retries não devem permitir retenção ilimitada.
- Preservar somente histórico leve: identificador, nome, datas, status, parâmetros, quantidades, indicadores e custos. Nenhum arquivo, mapa completo ou link de download funcional permanece. Retenção de metadados sujeita a futura política de privacidade e exclusão de conta.

## Fluxo de expiração
1. Ao concluir a tarefa, persistir available_at e expires_at em uma transação e exibir o prazo no painel e e-mail de conclusão.
2. Enviar lembrete sugerido 24h antes, uma única vez por execução, com link autenticado para o projeto. Falhas de e-mail não prorrogam automaticamente o prazo.
3. A partir de expires_at, bloquear visualização/download e novas URLs assinadas no servidor; limitar validade das URLs emitidas ao menor valor entre TTL usual e tempo restante. Downloads iniciados antes do prazo podem ter comportamento dependente do provedor.
4. Worker/cron durável periódico, independente de navegador, reivindica execuções expiradas de forma idempotente e remove objetos pelo manifesto/prefixo exclusivo, incluindo arquivos intermediários, thumbnails, tiles, ZIPs, versões antigas, uploads multipart abandonados e cópias temporárias que existam. Não excluir arquivos de outras execuções.
5. Validar ausência dos objetos; registrar deleted_at, contagem, bytes removidos e falhas. Repetir falhas automaticamente, alertar administrador e manter acesso bloqueado. Estados de retenção: available, expired, deleting, deleted, deletion_failed; separados do status de processamento.
6. Configurar lifecycle do armazenamento como proteção adicional compatível com o prazo contado da conclusão; não utilizar regra baseada somente na criação dos originais que possa removê-los durante processamento. Considerar versionamento, replicação, caches, backups e soft-delete; validar exclusão física e custos conforme o provedor. Remover discos temporários do worker após persistir resultados, sem aguardar sete dias.

## Interface e notificações
- Exibir "Disponível até DD/MM/AAAA HH:mm", tempo restante e ações de download individual/ZIP enquanto disponível.
- Após vencimento: "Arquivos expirados — prazo de armazenamento encerrado"; histórico permanece; sem botão funcional de download ou visualização do mapa excluído.
- Aviso antes de iniciar tarefa e no e-mail de conclusão: baixar e guardar localmente; exclusão definitiva, sem restauração garantida. Reprocessamento exige novo envio se não houver originais.
- Sem extensão automática, contratação ou exceção comercial na primeira versão. Exportações já baixadas pelo usuário não são afetadas.

## Aceite
- Testar prazo simulado com relógio controlado, inclusive mudança de fuso e limite exato de 168h.
- Testar bloqueio de acesso no vencimento mesmo se worker estiver indisponível.
- Testar exclusão efetiva de originais, derivados, versões e temporários sem afetar outro projeto; verificar redução de bytes armazenados.
- Testar reexecução idempotente, recuperação após falha parcial, lembrete não duplicado e histórico preservado.
- Testar uploads abandonados, falhas, cancelamentos e processos ativos; configurar limites e monitoramento de órfãos.
- Não criar serviços pagos, aplicar migrations, modificar AgroVoo ou publicar nesta etapa.
