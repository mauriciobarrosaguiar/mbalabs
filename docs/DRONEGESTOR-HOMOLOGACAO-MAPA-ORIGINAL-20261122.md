# Modelo original MAPA2026 - continuação de22/11/2026

## Arquivo recebido

O usuário forneceu 3. PLANILHA RELATÓRIO MENSAL v.01-01-2026.xlsx (4.059.389 bytes). SHA256 6702aa0bd04e1e33bfc17bad7745dc0b4a59ff00ccb5d10941b4a737404b4ef5. O original não foi modificado nem substituído.16 abas,311.660 fórmulas,108 regras de validação. A origem foi o anexo fornecido pelo usuário; a estrutura passou nas verificações de compatibilidade do exportador.

## Sistema publicado

Sessão Pulveriza63 da empresa E2E TESTE - DroneGestor QA confirmada. Modelo cadastrado pela interface com nome MAPA_original_01-01-2026.xlsx, somente nesta empresa fictícia. Sem nova permissão, migration ou RLS. Nenhum envio ao MAPA/SEI.

Após clicar Atualizar, a tela mostrou modelo2026,0 operações aprovadas,0 pendências bloqueantes e botão Baixar XLSX oficial habilitado. O botão gerou e baixou o XLSX do mês sem atividade. Isso aprova cadastro/download do modelo no caminho produtivo, não um relatório com aplicação concluída. A empresa é fictícia e a OS de Pedro permanece em preparação.

## Ensaio com aplicação fictícia

O handler real recebeu em memória o modelo original e os dados fictícios já definidos (1,5ha,15L,produto100mL/ha,150mL,24min efetivos). As consultas, sessão e aprovação desse cenário são fixtures, sem escrita de conclusão em produção. A saída foi anexada pela interface à OS-20261121-71DF6 como HOMOLOGACAO_MAPA_ORIGINAL_PREENCHIDO.xlsx. A OS passa de16 para17 anexos.

Download desse anexo pelo sistema confirmou bytes idênticos: SHA256 c14d35e33fbf8f174cac8d71dc3147b69b57bcb19400a318afd5120a8b16dfb3. O operador no arquivo está marcado HOMOLOGAÇÃO - SEM VALIDADE OFICIAL. Não enviar essa saída ao órgão.

## Defeito real e correção ainda não publicada

A regravação integral por ExcelJS duplicava intervalos de validação: por exemplo B6:B1000 recebia também B10:B1000 com INDIRECT($A6), afetando o comportamento relativo da lista de municípios. Ordenação diferente de mesclagens por si só não era perda, mas as validações sobrepostas justificaram a correção.

Agora o exportador mantém a validação de estrutura/dados existente e preenche somente os valores autorizados diretamente no arquivo XLSX original. Não reserializa estilos, listas, relacionamentos, fórmulas ou outras partes. Texto usa inlineStr com escape XML, inclusive conteúdo iniciado por sinal igual. Nenhum dado é interpretado como fórmula nova.

Comparação independente confirmou alteração apenas em xl/workbook.xml (recalcular ao abrir), sheet1.xml (identificação do operador) e sheet14.xml (novembro). Todas as demais partes originais ficaram idênticas byte a byte. As311.660 fórmulas e108 regras de validação foram preservadas, assim como mesclagens e metadados fora de sheetData nas abas alteradas.

Uma versão intermediária do novo parser perdeu uma fórmula após célula vazia adjacente durante o desenvolvimento. A comparação do original detectou o problema antes da entrega; regex corrigida e caso de regressão incluído. Saída final passou na comparação.

## Validação e limites

12 testes direcionados aprovados:8 regressões dos handlers com fixture,3 testes de preservação/escape/referências e1 teste com o original recebido. Este último é opcional na suíte e exige DRONE_QA_ORIGINAL_XLSX e DRONE_QA_OUTPUT, pois o arquivo do usuário não foi incorporado ao repositório. O teste confere fórmulas, partes ZIP e recursos das abas. Build Next.js/TypeScript aprovado. ESLint0 erros e4 avisos preexistentes de funções não usadas no exportador. Sem repetição de testes aprovados sem relação com a mudança.

Não foi aberto Excel nativo nem recalculada sua aba TOTAL nesta sessão. A saída preserva fórmulas/caches do original e exige recálculo no Excel ao abrir (fullCalcOnLoad=1). Não apresentar isso como conferência visual completa ou recálculo validado no Excel.

A correção do XLSX e a correção de fuso anterior estão na PR204, sem merge/publicação. O download sem atividade em produção usa ainda o exportador anterior. A planilha com aplicação simulada foi gerada com o código corrigido em teste e disponibilizada como anexo, não criada a partir de uma OS concluída no banco produtivo.

Continuam pendentes: fluxo completo com aplicação concluída/conferida pela interface publicada, sessão do piloto nos novos anexos, encerramentos, recálculo no Excel e demais lacunas de segurança já registradas. Não houve operação real nem protocolo oficial.

## Limpeza

Manter os17 anexos fictícios e o modelo da empresa de homologação para revisão. Remover posteriormente pelo fluxo autorizado, sem tocar empresas/dados reais.
