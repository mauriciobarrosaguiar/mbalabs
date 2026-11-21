# DroneGestor: corrigir concorrência no pré-voo e atualização de OS

O painel podia exibir uma liberação pré-voo de um snapshot antigo após edição local e deixava a lista de OS desatualizada após criação. Esta alteração descarta respostas antigas, invalida a indicação de liberação durante a consulta e atualiza o painel e a seleção de responsáveis depois de novos cadastros.

A seleção de OS para atribuição passa a exigir escolha explícita. A navegação de campo apresenta oito fases das telas existentes, os botões de inativação ganham nomes acessíveis e uma substituição enganosa sobre a disponibilidade do mapa foi removida.

Validação: 37 testes DroneGestor aprovados; TypeScript e build aprovados; lint dos arquivos alterados sem erros (avisos legados). Capturas e relatório da navegação autenticada em produção estão em docs/DRONEGESTOR-HOMOLOGACAO-PRODUCAO-20261121.md. São evidências do commit base, não homologação das correções em produção.

Bloqueios: RLS core_logs por papel ainda não corrigido no banco; encerramento parcial ausente; perfis e isolamento não testados com contas específicas; matriz de resoluções bloqueada no navegador; Drive/SARPAS/modelo oficial MAPA pendentes.

Abrir em rascunho. Não fazer merge nem deploy. Nenhuma migration ou alteração de permissões produtivas foi aplicada. A branch fix/* tem deploy automático desativado na configuração existente.
