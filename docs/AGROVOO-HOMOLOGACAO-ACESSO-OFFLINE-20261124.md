# AgroVoo — roteiro de homologação de acesso e offline
## Alterações no código (não implantadas na produção)
- Reativação somente do vínculo existente, da mesma empresa, com conta global ativa, e-mail coincidente e perfil piloto/aplicador CAAR inativo.
- Não cria usuário, não altera senha, não altera perfil. Alterações condicionais e tentativa de compensação se o segundo registro falhar. A compensação não é uma transação atômica; falhas e concorrência devem ser testadas em ambiente descartável.
- Autorizações ausentes são negadas; cadastro novo ainda recebe os padrões explicitamente definidos.
- Reconexão exige reconciliação inicial confirmada antes de enviar a revisão local. Preserva alterações offline e conflito entre versões.
## Testes integrados obrigatórios, em ambiente separado
1. Gestor cadastra e autoriza piloto fictício. Piloto entra com sua conta. Outra empresa não vê cadastro nem pode alterar vínculo.
2. Revogar acesso de piloto sem operação ativa; verificar APIs e páginas. Não executar esta ação em conta produtiva.
3. Reativar mesmo vínculo, mesma senha, mesmo perfil; negar usuário global inativo, e-mail divergente, perfil alterado e empresa diferente.
4. Verificar alteração concorrente e falha entre gravações de vínculo e cadastro. Confirmar ausência de duplicatas em registros históricos.
5. Perder rede em operação de treinamento, preservar cargas e ocorrências; reconectar e conferir revisão, sem recriar registros.
6. Simular resposta perdida, tentativa concorrente em duas abas, troca de usuário e conflito de versão. Não descartar a fila.
7. Instalar PWA Android/iOS; verificar abertura inicial, sessão revogada e retomada de operação carregada. O PWA não garante abertura fria offline.
8. Verificar mapa pós-voo e relatório MAPA. Separar evidências reais de treinamento.
## Limites
- Sem migração, escrita em banco produtivo, merge ou deploy manual.
- Compilação da Vercel bloqueada pelo limite de builds na última consulta.
- Código de ativação individual e cotas por contrato não implementados; dependem de política de licenciamento e desenho seguro do ciclo de vida do acesso.
- Formulário integral editável vertical e abertura fria offline não concluídos. A revisão completa de segurança/RLS e homologação com banco isolado continuam obrigatórias.
