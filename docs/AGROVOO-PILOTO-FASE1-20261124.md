# AgroVoo — área exclusiva do piloto (prévia)

## Entrega
- /apps/dronegestor/agrovoo/piloto: dashboard da conta piloto/aplicador CAAR, com autenticação e verificação do papel no servidor.
- A entrada original /apps/dronegestor redireciona somente perfis de piloto para o novo dashboard. Gestores e outros perfis mantêm os fluxos anteriores.
- Lista de OS obtida do endpoint existente /api/dronegestor/cadastros?type=os, filtrado pelo servidor e novamente por pilotoResponsavelId no cliente. Contagens se referem aos registros retornados, não a toda a base.
- Ações de consulta apontam para /gestao?osId=..., sem iniciar aplicação ou modificar localStorage.
- Menu de piloto e navegação inferior: início, Minhas OS, campo, calda, documentos, histórico, Piloto Pro, perfil e ajuda. Sem atalho financeiro.
- A execução em /campo continua com o shell anterior e todos os componentes de segurança, SARPAS, equipamentos, sincronização e recuperação; não foi reescrita. Link Início leva ao novo dashboard via redirecionamento.
- Abertura de OS, retomada, complementação, foto/KML/KMZ, relatório e permissões permanecem nos fluxos existentes.

## Homologação obrigatória
1. Entrar como piloto fictício Pedro; confirmar redirecionamento e identidade.
2. Conferir que somente suas OS aparecem e testar OS aberta, em preparação, em execução, suspensa e encerrada. Não iniciar voo real.
3. Abrir uma OS a partir do dashboard e verificar a seleção existente; manter os mecanismos de recuperação.
4. Conferir retorno do campo, documentos, calda, histórico, perfil, logout e navegação móvel (360,390,768,1024,1366,1920).
5. Confirmar que gestor não entra na página exclusiva do piloto; piloto não tem acesso a cadastros/financeiro de administração.
6. Conferir desenho com as referências originais do usuário quando disponíveis; esta entrega não declara fidelidade visual 1:1.
7. Financeiro: manter gravação real desabilitada até homologação de persistência em ambiente isolado e autorização de migração. Não usar produção para testes.

Nenhum dado real, migration, merge ou publicação em produção autorizado por esta entrega.
