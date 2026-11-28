# Definição de infraestrutura — 28/11/2026
## Homologação
V0.10: screenshots do administrador confirmam título corrigido, teste de conexão e JPEG público, inventário completo com 0 objetos / 0 MB. Não há evidência de faturamento total nem de uploads multipart incompletos.
## Computação de testes
Hetzner Cloud CX53, Alemanha, x86_64, 16 vCPU compartilhadas, 32 GB RAM, 320 GB disco, Ubuntu 24.04 LTS, Docker, NodeODM já fixado por digest. Preço de referência €0,0473/h (sem IVA e IPv4), confirmar no checkout; alternativa CPX62 se CX53 indisponível, sujeita a nova aprovação de custo. A cobrança continua com VM desligada; excluir VM e recursos acessórios após teste. Não criar recurso sem aprovação do orçamento. Meta inicial: uma VM e uma tarefa, até 2 horas de existência por teste, com watchdog externo a implementar; sem garantia de custo zero. Sem volumes/snapshots persistentes por padrão. Somente amostra pública licenciada e fixada no manifesto. R2 privado ENAM, token temporário separado e restrito ao bucket; injetar credenciais em runtime, jamais GitHub, logs ou shell history. NodeODM acessível apenas em loopback; firewall sem porta 3000 pública. Transferências com hash e manifesto; limpeza verificada. Worker ainda não executado no servidor.
## Produção
A Portaria GM-MD 3.703/2021, art. 41, veda computação em nuvem para OA abrangidos e exige processamento/armazenamento nacional por entidade inscrita. Não basta selecionar AWS São Paulo. Manter imagens privadas bloqueadas até esclarecimento formal do enquadramento. Para OA abrangidos, avaliar infraestrutura física própria ou dedicada em território nacional sob entidade habilitada, com parecer sobre conformidade. Retenção de sete dias vale para cópias de trabalho permitidas, não substitui obrigações de guarda do OA. R2 internacional apenas para testes públicos. 
## Metas futuras
Fila durável, reserva atômica de bytes e jobs, limite preventivo 8 GB, controle de custos, watchdog independente, expiração 168h após disponibilização, lembrete 24h antes, exclusão com verificação, reprocessamento sem reiniciar vencimento. Ainda não operacionais. 
## Referências
https://www.hetzner.com/cloud/cost-optimized/
https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/
https://docs.hetzner.com/cloud/billing/faq/
https://docs.opendronemap.org/installation/
https://mdlegis.defesa.gov.br/norma_html/?ANO=2021&NUM=3703&SER=A
https://www.gov.br/defesa/pt-br/assuntos/aerolevantamento
