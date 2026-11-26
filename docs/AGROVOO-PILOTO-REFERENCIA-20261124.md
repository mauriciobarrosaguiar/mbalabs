# AgroVoo Piloto — referência de interface 24/11/2026

## Fontes e limites
- 28 capturas enviadas pelo titular nesta conversa (incluindo imagens repetidas). Interface de referência DG Piloto.
- Playlist indicada: https://youtube.com/playlist?list=PLq_LQfNvu8P0hbQReC7kycpp-XLzizgYV
- Tutorial localizado: https://www.youtube.com/watch?v=tR12VqStKhk
- Tutorial OS localizado: https://www.youtube.com/watch?v=oUlGBnKppQ4
- Descrições públicas dos dois vídeos foram consultadas; a playlist completa e as transcrições não estavam acessíveis. Não se declara análise integral de vídeos.

## Estrutura identificada nas capturas
1. Administração: módulo piloto; funcionários, autorizados PWA, quota e ativos; autorização por funcionário e e-mail; código de ativação; revogação e status.
2. Aplicativo: cabeçalho compacto, estado online/offline e conta; quatro indicadores (aplicações hoje, área total, pendentes de sync, OS ativas).
3. Seletor de OS de referência e atualização; cliente, propriedade, talhão, aeronave, cultura, receituário, área.
4. Abas receituário, aplicações e histórico. Produtos com nome, quantidade e unidade; pesquisa de produtos AGROFIT; inclusão no sistema de referência.
5. Aplicações: lista vinculada à OS e nova aplicação. Formulário vertical em seis grupos: informações básicas (data, início, fim, área), GPS, condições meteorológicas (vento, direção, temperatura, umidade, Delta T), parâmetros técnicos (altura, velocidade, faixa, volume, gota, bico), equipe (piloto e ajudante), observações. Salvar e conferir validações.
6. Histórico com hora, área, piloto, ajudante, data do registro e situação de sincronização. O exemplo offline mostra registros aguardando envio.

## Implementado nesta etapa
- Dashboard do piloto centrado na OS, quatro indicadores, seleção, três abas, resumo da referência, consultas de produtos planejados e histórico real limitado à conta.
- Indicador de fila de encerramentos e solicitações parciais no aparelho, somente leitura e condicionado ao proprietário autenticado. Não representa todas as formas de sincronização.
- Cabeçalho compacto com estado da rede e conta, abas substituem a navegação inferior na tela inicial.
- Nova aplicação encaminha para a seleção e preparação já existente, sem contornar regras.
- Identidade própria verde AgroVoo. Não usar logotipo, dados pessoais ou códigos de ativação das capturas.
- Treinamento continua separado e disponível apenas em prévia/desenvolvimento.

## Próximas entregas (não homologadas)
- Formulário de nova aplicação com composição visual dos seis blocos, preservando os controles operacionais existentes e distinguindo registro histórico de autorização de voo.
- Receituário: consultar o documento oficial, pesquisar AGROFIT, edição operacional somente quando permitida e sem substituir prescrição do RT.
- Sincronização: detalhar fila offline por OS, estados pendente/confirmado, tentativa manual usando mecanismo existente, cache seguro e teste sem rede. Não afirmar suporte completo offline com base na tela.
- Ativação de acesso: revisar módulo existente, autorização/revogação e instalação PWA; não introduzir código de acesso fraco.
- Pós-voo: foto de mapa do controle OU KML/KMZ, conferência do gestor, relatórios MAPA.
- Testes de interface com Pedro e gestor, ambiente isolado, sem dados reais ou autorização fictícia.
