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
