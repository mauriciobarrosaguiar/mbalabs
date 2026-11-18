# MBA AgroDoc — Armazenamento externo (PR #196)

## Estado

Esta PR e um rascunho empilhado sobre #194 e #193. Nao publicar, fazer merge ou executar migracao no banco principal.
Google Drive possui codigo preparado para OAuth, upload retomavel, download e sincronizacao, mas **NAO passou por homologacao real**. Dropbox nao esta conectado.

## Funcionalidades em codigo

- Conexao OAuth Google exclusiva do AgroDoc com drive.file e acesso limitado.
- Identificacao por ID interno da empresa ou usuario solo.
- Tokens criptografados AES-256-GCM no servidor.
- Pastas: MBA AgroDoc / ANO / propriedade-id / OS-id / categoria.
- Metadados e tentativas persistidos no banco da empresa, separados do arquivo no Google Drive.
- Upload de arquivo direto do navegador ao Drive em blocos (evita limite de body da Vercel).
- Permissao de OS verificada no servidor, com RLS fechada e sem policy de acesso direto as tabelas.
- Documentos legados permanecem no Supabase (ate 10 MB). Drive limita 2 GB por envio no codigo.
- Central de armazenamento em Configuracoes, testando conexao e exibindo status real.
- Dropbox: interface de provedor preparada, integracao marcada indisponivel.

## Dependencias a configurar na homologacao

1. Preparar Supabase QA realmente isolado, sem afetar o projeto principal MBA Labs.
2. Executar SOMENTE no QA a migracao supabase/migrations/20261117190000_agrodoc_cloud_storage.sql.
3. Habilitar a Google Drive API no Google Cloud e configurar cliente OAuth Web Application ESPECIFICO do AgroDoc, tela de consentimento, publico/testadores autorizados.
4. Usar endereco QA estavel. Cadastrar no Google o URI de retorno HTTPS exato:
   https://<HOST_QA_REAL>/api/dronegestor/cloud/google/callback
   Reservar para producao, sem ativar:
   https://www.mbalabs.com.br/api/dronegestor/cloud/google/callback
5. Registrar exclusivamente na Vercel Preview QA:
   AGRODOC_GOOGLE_CLIENT_ID
   AGRODOC_GOOGLE_CLIENT_SECRET
   AGRODOC_GOOGLE_REDIRECT_URI
   AGRODOC_CLOUD_ENCRYPTION_KEY (segredo aleatorio persistente de >= 32 caracteres)
   Nunca usar prefixo NEXT_PUBLIC_ para segredos. Nao usar credenciais OAuth de outro aplicativo automaticamente.
6. Confirmar que a previa efetivamente aponta para Supabase QA antes de gravar qualquer teste.
7. Realizar OAuth real, primeiro upload e download, e testar CORS browser, inclusive header Range em resposta 308. Se CORS falhar, desenhar staging TUS/S3 em QA e trabalhador de transferencia sem passar videos grandes pelo corpo da Vercel.
8. Confirmar permissao drive.file e retencao do refresh token, alem de renovacao e revogacao.
9. Conferir tamanho e conteudo final no Google; hash original nao e garantia de verificacao fim a fim ate um teste autorizado.

## Testes para aceite

- Empresa A (Drive A) e empresa B (Drive B); gestor e piloto por empresa.
- Piloto com OS atribuida pode anexar; piloto sem permissao recebe 403/404.
- Gestor cadastra propriedade, equipamento, piloto, cria e atribui OS.
- Piloto inicia, pausa, retoma, finaliza e registra fotos/mapas.
- RT pede correcao, piloto corrige, RT aprova, gestor exporta.
- Invasao cruzada entre tenant A/B nao deve listar, visualizar, editar ou baixar arquivos.
- Mesmo arquivo duas vezes; perda e retorno de internet; upload de video > 10 MB; troca de conta Google e arquivo existente; arquivo pendente e 308.
- Testar visualmente em 360, 390, 412, 768, 1024 px e desktop com sessao autenticada.
- XLSX oficial MAPA 2026 deve ser cadastrado em ambiente autorizado, comparar formulas, abas, validacoes e dados reais. Nao confundir XLSX demonstrativo com documento oficial.
- Testar mes sem atividade e multiproduto sem duplicar horas/hectares. Exportacao oficial bloqueada se invalidada.
- CI TypeScript, build e testes Playwright autenticados.

## Limitacoes conhecidas

- Nao foi encontrado projeto Supabase QA dedicado. A migracao permanece NAO APLICADA.
- Nao existem variaveis AGRODOC_* configuradas na Vercel acessada.
- Nao foi realizada integracao OAuth real, teste de upload Drive com conta autorizada nem dois tenants de QA.
- Retomada exige selecionar novamente o mesmo arquivo, nao promete transferencia em background/offline.
- Se o usuario trocar conta Drive, documentos anteriores podem ficar indisponiveis ate reconectar a conta de origem; nunca apagar arquivos automaticamente.
- A exclusao autorizada, retencao legal e sincronizacao de relatorios MAPA ao Drive precisam de testes adicionais e aceite antes da producao.
- Nao enviar dados ficticios para MAPA, ANAC ou outros orgaos.
