# DroneGestor — auditoria e critérios de liberação (21/11/2026)

## Escopo e limites
Inspeção estática do repositório main e das documentações de agosto. URL de produção exige autenticação; não houve homologação autenticada nesta revisão. Não declarar bugs históricos como ainda presentes sem reteste. A nova biblioteca é uma primeira versão temática, não a reprodução integral do PDF Piloto Pro, que não foi localizado.

## P0 — liberação segura
- Revalidar integralmente o fluxo cliente/fazenda/talhão → OS → piloto → calda → segurança/calibração/checklist → documentos/SARPAS → campo → conferência → fechamento → relatório MAPA.
- Testar gestor, RT, piloto 1, piloto 2 e empresa distinta em sessões independentes: acesso direto às APIs, anexos, mapas, IDs externos e isolamento offline.
- Inspecionar banco correto: core_logs ainda é utilizado por APIs atuais; revisar RLS e migrações pendentes, integridade, índices, idempotência, backup e rollback. Não aplicar migração em produção sem ambiente de teste e aprovação.
- Validar perda de rede, reabertura, conflitos 409, duplicidade de carga, troca de aparelho/conta, conclusão pendente e retomada. Nenhuma autorização deve ser presumida offline.
- Reconciliar permissões específicas do app em todas as APIs; revisar endpoint de modelo oficial MAPA que ainda usa tipo global em canManage.
- Testar cancelamento, interrupção por condição insegura, área parcialmente tratada com justificativa, complementação por OS vinculada sem fabricar 100% da área.
- Revisar cálculo e unidades (L, mL, kg, g), tanque parcial, misturador, arredondamento e limites. Conferir vazão com parâmetros válidos.
- Validar status SARPAS, período, geometria e aeronave sem confundir registro interno com autorização oficial.
- Conferir modelo MAPA oficial vigente, preenchimento XLSX, totais, competências, anexos e protocolo externo; relatório interno não substitui documento oficial.
- Verificar responsividade 360/390/768/1440 px, telas sob sol, acessibilidade, ausência de erros no console e no servidor.

## P1 — completar produto comercial
- Definir identidade e relação MBA AgroDoc/DroneGestor, separar menu operacional e administrativo por papel; evitar duplicação de telas.
- Mapas: verificar o que já existe, completar importação KML/KMZ/GeoJSON e arquivos DJI reais, desenho/edição, área geodésica, obstáculos, buffers, validação de geometria e evidências; não prometer integração DJI sem API validada.
- Frota: manutenção por horas, ciclos de bateria, histórico, peças e alertas de validade.
- Financeiro: orçamento, preço/ha, deslocamento, custo de insumos e baterias, margem, contas a receber e painel por cliente/OS/ha. Confirmar módulos existentes antes de criar.
- Documentos: alertas, versionamento, armazenamento privado, exportação, controle de acesso e política de retenção/LGPD.
- PWA/offline: confirmar suporte real nos dispositivos e UX de sincronização.

## P2 — biblioteca Piloto Pro
- Implementada rota autenticada e menu, pesquisa textual sem acentos, filtro e capítulos expansíveis, links de contexto.
- Importar PDF final e imagens próprias/autorizadas. Conferir modelos T25P/T40/T50/T55P/T70/T100 e controle RC Plus/RC Plus 2 com manual oficial, revisão agronômica e regulatória.
- Incluir guia visual de SARPAS, componentes, calibração, checklist, operação, tecnologia de aplicação e pós-voo; incluir catálogo de ingredientes ativos sem prescrição automática.
- Adicionar favoritos, leitura offline, testes de conhecimento, versão/data/fonte por artigo, revisão editorial e links de ajuda nas etapas do campo.
- Não usar distâncias ou doses universais nem inventar imagens técnicas ou especificações.

## Critérios de aceite
Build, lint e TypeScript aprovados, testes unitários e E2E autenticados registrados, nenhum defeito P0 em aberto, nenhuma perda/duplicação de registros, relatório conferido com modelo oficial e aprovação de homologação. A branch não realiza merge, deploy de produção nem migração.
