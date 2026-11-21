# DroneGestor — edição de funcionários

## Problema e correção

Os funcionários eram cartões estáticos. Agora cada cartão é um botão acessível “Editar funcionário [nome]”. O clique carrega os dados no formulário, destaca o cartão selecionado e leva ao formulário. Nome, telefone e perfil operacional podem ser corrigidos; Salvar alterações persiste via PATCH e atualiza a lista. Cancelar edição / Novo funcionário sai da edição.

E-mail e senha são preservados, sem campos de redefinição nesta edição. No administrador empresarial, o perfil administrativo fica bloqueado, mas o contato pode ser corrigido. O cadastro de novos funcionários continua disponível.

## Autorização e integridade

PATCH exige administrador ativo, liberação vigente e empresa ativa. Funcionário e vínculo são consultados dentro da empresa e app derivados da sessão. Somente id/nome/telefone/perfil são aceitos; tenant, e-mail, senha, status global e privilégios injetados são recusados. Não altera contratos ou permissões de outros aplicativos. Nome/telefone pertencem ao cadastro central compartilhado; a alteração pode refletir nos demais aplicativos.

Mudanças de perfil não concedem papel administrativo. O cadastro operacional de piloto é sincronizado com nome/telefone; retirada de papel de piloto o inativa sem apagar histórico. Novo piloto recebe permissões conservadoras; conta/vínculo/piloto bloqueados não são reativados implicitamente. Um administrador que também pilota preserva seu cadastro operacional ao corrigir contato.

Se a gravação de perfil ou auditoria falha, o endpoint tenta restaurar contato/perfil anterior. Não é transação distribuída: falha na compensação retorna erro explícito para conferência antes de repetir. Não há migration nem alteração de RLS.

## Validação

80 testes DroneGestor aprovados, incluindo nove cenários de edição: autorização, injeção, vínculo inexistente, escopo de escrita, proteção administrativa, mudança de piloto, bloqueios e compensações. TypeScript, lint dos arquivos alterados e build aprovados. Saídas em docs/evidence/dronegestor/edicao-funcionarios-20261121/.

Reteste produtivo deve usar somente contatos fictícios e preservar papel/acesso real. Criação dos perfis Aplicador CAAR e Visualizador e testes de login específicos continuam pendentes da definição segura das respectivas credenciais. Nenhuma senha foi incluída nos arquivos.

## Reteste produtivo concluído

PR #201 incorporada; deploy dpl_GkRoLqJNPjzYQaR5z9Z5prw1a45N READY, commit main 8b2d99031618ef669d6b5a8085b1746ecace5402, domínio www.mbalabs.com.br.

Com a sessão empresarial Pulveriza 63, os cinco cartões abriram os dados corretos: gestor operacional, RT, João, Pedro e administrador. Somente o gestor fictício id f3adf1f7-5ed1-4d06-9d8d-35aa159b6fa7 foi alterado de “E2E Gestor DroneGestor” para “HOMOLOGAÇÃO P63 - Gestor operacional”. Salvar retornou confirmação e a lista atualizou sem recarregar. Nenhum papel, senha, e-mail ou status de acesso foi alterado. O formulário do administrador manteve o seletor de papel desabilitado. Os demais cartões foram apenas abertos, sem salvar.

Captura edicao-funcionario.jpg comprova formulário interno com dados persistidos. rls-perfis.md registra teste complementar somente leitura sob papel authenticated e claims locais de piloto/RT/gestor. Leitura de outra empresa retornou zero, mas leitura de logs de outros autores da mesma empresa permaneceu permitida. A RLS continua pendente; este teste não equivale a login real dos perfis.

Aplicador CAAR e Visualizador continuam sem cadastro nesta rodada: o usuário precisa concluir definição/submissão das credenciais no navegador. Não houve criação ou redefinição automática de senhas.
