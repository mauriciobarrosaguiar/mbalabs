# GeoMap — Arquitetura cloud-first (decisão de projeto)
Esta decisão substitui a prioridade de processamento local do README de prova de conceito. O compose local permanece apenas como ferramenta opcional de desenvolvimento. Uso privado de um administrador, sistema independente do AgroVoo, sem contratação ou implantação nesta etapa.

## Fluxo
1. Criar projeto e levantamento, selecionar produtos e parâmetros.
2. Upload direto para armazenamento de objetos privado, com URLs assinadas de curta duração, retomada de upload em partes e validação de integridade/quantidade; não transportar fotos grandes através das funções da aplicação.
3. Confirmar upload e estimativa de custo, autorizar tarefa. Persistir tarefa em fila durável no banco; enviar identificador ao navegador. O navegador pode ser fechado após confirmar upload e submissão.
4. Orquestrador independente da sessão web reivindica tarefa com lease, provisiona máquina autorizada sob demanda, registra ID do recurso, inicia NodeODM em rede privada e envia imagens. Um processamento de cada vez inicialmente.
5. Consultar API /task/{uuid}/info e logs; webhook, se usado, é apenas sinal para verificação autenticada. Persistir estado, percentual estimado fornecido pelo motor, estágio, horário, heartbeat e tempo decorrido. ETA inicialmente indisponível; depois calcular faixa aproximada por histórico de máquina, imagens e parâmetros, nunca promessa de término.
6. Após sucesso do motor, transferir produtos para armazenamento persistente, validar presença, tamanho, integridade e formatos; registrar manifesto por execução. Preparar derivados para visualização web conforme necessário. Só marcar disponível após arquivos obrigatórios verificados.
7. Enviar e-mail transacional único por evento de conclusão via outbox durável e provedor (Resend candidato, não contratado); link permanente para página autenticada do projeto/execução, nunca bucket público ou URL de download duradoura. Download individual e ZIP por URL assinada emitida após autorização; permitir reemitir links expirados.
8. Desligar/desprovisionar computação somente após cópia verificada ou tratamento seguro de falha; registrar custos e estado de limpeza. Watchdog encerra máquinas órfãs ou que ultrapassem limite aprovado; preservar originais e resultados já persistidos. Armazenamento, discos e outros recursos podem continuar cobrando.

## Estados persistidos
draft, uploading, ready, queued, provisioning, processing, finalizing, completed, failed, cancel_requested, canceled. Estado da notificação e da limpeza são independentes. Falhas não se confundem com conclusão; exibir mensagem, opção de tentar novamente e logs. Retry não deve duplicar tarefa, máquina ou e-mail; usar chaves idempotentes e reconciliação. Nova tentativa ou novo levantamento não sobrescreve arquivos anteriores.

## Interface
Meus Projetos: nome, data, fotos, produtos, status, progresso real/estimado, tempo decorrido, faixa de ETA quando disponível, última atualização. Ao finalizar, botão Abrir projeto e Baixar resultados. Página de execução com histórico, logs resumidos, produtos disponíveis e seus formatos, download individual/ZIP, visualização futura no GeoStudio. E-mail de conclusão e falha; acesso autenticado.
 
## Componentes candidatos (sem contratação)
Next.js/Vercel para interface e APIs curtas; Supabase/Postgres para dados/filas e autenticação privada; R2 ou S3 para arquivos; orquestrador/worker separado para tarefas longas; NodeODM/ODM em máquina temporária x86-64 inicialmente; Resend ou outro provedor transacional. Provedor de computação, imagem/digest, limites, região e retenção ainda a validar. Nenhuma credencial ou arquivo privado no repositório público. RLS e autorização por projeto, buckets privados, TLS, segredos no servidor. Não expor NodeODM publicamente.

## Aceite da primeira fatia vertical
- Upload interrompido pode ser retomado; imagens originais preservadas.
- Tarefa continua após fechar o navegador e pode ser consultada no dia seguinte.
- Progresso e logs vêm do motor real; ETA desconhecida é indicada claramente.
- Após validação do GeoTIFF real e cópia dos produtos, botão de download funciona com máquina desligada.
- E-mail de conclusão com link correto; falha de e-mail não invalida produto pronto.
- Falha/retry/cancelamento e recuperação do worker não duplicam cobrança nem perdem imagens; verificar recursos órfãos.
- Limite por tarefa de custo/tempo e retenção definidos antes de habilitar cobrança. Estimativas não garantem custo; nenhum provisionamento pago sem aprovação.
- Nenhuma alteração no AgroVoo, merge, migration ou deploy nesta etapa.

Referências: https://github.com/OpenDroneMap/NodeODM/blob/master/docs/index.adoc ; https://developers.cloudflare.com/r2/api/s3/presigned-urls/ ; https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-lifecycle.html
