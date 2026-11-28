# GeoMap — Referência visual oficial
Decisão do usuário: seguir exatamente o protótipo https://skycanvas-survey-studio.lovable.app/ (Skycanvas Survey Studio). Não redesenhar nem substituir o layout por interpretação própria. Importar código-fonte autorizado do Lovable quando disponível; preservar componentes, CSS/tokens, fontes, ícones, imagens autorizadas, dimensões, espaçamento, comportamento responsivo, menus, rotas, temas e estados. Adaptar apenas integração Next.js, autenticação e dados reais, sem alterar aparência sem aprovação. Não importar dados demonstrativos como reais.

## Inspeção do protótipo publicado (28/11/2026)
Dashboard: identificação Demo, Novo projeto, oito indicadores (Projetos, Área mapeada, Fotos processadas, Em processamento, Concluídos, Expiram em 7 dias, Armazenamento, Custo computacional), mapa, processamentos e arquivos próximos da expiração.
Meus projetos: biblioteca de levantamentos, cartões com status, prazo, contratante, cidade, data, aeronave, área, fotos e produtos.
Novo projeto: assistente anunciado em cinco etapas. Primeira tela observada: nome, contratante, propriedade, operador, município, UF, responsável técnico, data, finalidade e mapa.
Central de processamento, GeoStudio e Relatórios: páginas observadas mostram "Esta tela ainda será detalhada no protótipo." Não presumir que estejam implementadas ou inventar seu design definitivo.

## Rotas observadas no menu
/ (Dashboard), /projetos, /novo-projeto, /planejamento, /processamento, /geostudio, /topografia, /visualizador-3d, /agricultura, /relatorios, /exportacoes, /equipamentos, /servidores, /armazenamento, /notificacoes, /configuracoes e /projetos/:slug.
Adaptar ao namespace /apps/geomap na MBA Labs. Rotas sem tela detalhada devem ser homologadas posteriormente com o mesmo sistema visual.

## Próxima etapa
Conectar/exportar código original do Lovable para GitHub (repositório separado; não sobrescrever mbalabs). A listagem de repositórios acessíveis não mostrou um repositório Skycanvas. Inspeção textual do site não comprova fidelidade visual de CSS nem disponibiliza código fonte editável. Aguardar acesso ao código antes de substituir interface; preservar trabalho existente (NodeODM, GDAL, geradores PDF/HTML, regra de retenção 168h, segurança). Sem merge, deploy produtivo, alteração no AgroVoo, contratação de serviços ou migrations. Validar equivalência visual desktop/mobile e navegação com dados demo marcados; manter processamento privado desabilitado até infraestrutura e requisitos aplicáveis estarem resolvidos.
