# Isolamento de homologação — tentativa autorizada em 23/11/2026

O titular autorizou criar branch temporária sem dados reais após cotação de US$ 0,01344/h mais utilização. Nenhuma autorização de upgrade de assinatura, interrupção de projeto existente, migration produtiva, merge ou publicação foi concedida.

## Resultado verificado

1. Organização do projeto MBA Labs: plano `free`, confirmado pelo conector.
2. `create_branch`, nome `dronegestor-homologacao-pr206-20261123`, no projeto MBA Labs: recusado com `PaymentRequiredException`, `Branching is supported only on the Pro plan or above`.
3. Alternativa: cotação de projeto separado retornou zero por mês. Tentativa de criar `DroneGestor Homologacao PR206` na mesma organização/região recusada por limite de dois projetos gratuitos ativos dos titulares.
4. Os projetos ativos encontrados são MBA Labs e MBA Sites; painel_gerencial_norte está inativo. Não pausar nem reutilizar nenhum deles automaticamente.
5. Docker, psql e CLI Supabase não estão instalados no executor verificado. Os testes isolados PGlite já existentes permanecem válidos, mas não substituem homologação de Auth/Storage e aparelhos independentes.

**Nenhuma branch ou projeto criado, upgrade contratado, projeto pausado, custo confirmado, migration executada ou dado produtivo alterado por essas tentativas.** A estimativa horária anterior não incluía o pré-requisito do plano Pro; não representa o custo total para esta conta.

## Decisão necessária

- Liberar uma vaga gratuita: o titular deve indicar expressamente um projeto ativo que pode ser pausado, ciente da indisponibilidade causada; depois criar projeto de homologação separado, sem dados reais.
- Ou aprovar separadamente a mudança de assinatura necessária: Pro começa em US$ 25/mês, com recursos e branch cobrados conforme uso. A cotação e o impacto total devem ser revisados antes da contratação; não contratar com base somente na autorização do custo horário.

Fontes oficiais consultadas: https://supabase.com/pricing e https://supabase.com/docs/guides/platform/manage-your-usage/branching .

A prévia continua sem isolamento de escrita. Cenários de 20 ha, reenvio e troca de aparelho não devem gravar testes em produção. PR #206 permanece aberta; código de referência `0cf7469e`, documentação anterior `c3ded593`.
