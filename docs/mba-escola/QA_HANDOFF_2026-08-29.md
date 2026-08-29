# MBA Escola — handoff da auditoria E2E

Data de referência: 2026-08-29.

## Regra funcional fixa

- Não existe login/perfil autenticado de ALUNO.
- O aluno é um registro escolar.
- O acesso familiar é feito pelo RESPONSÁVEL.
- Perfis autenticados a validar: ADMIN MBA, ADMIN ESCOLA, DIREÇÃO, COORDENAÇÃO, PROFESSOR e RESPONSÁVEL.
- Não reintroduzir MFA/AAL2. O acesso usa e-mail + senha e recuperação por link seguro.

## Ambiente QA já existente

Não recriar escolas, usuários, turmas ou seeds antes de verificar o estado atual.

- ESCOLA TESTE ALFA
- ESCOLA TESTE BETA
- ESCOLA TESTE INATIVA
- usuários fake de Admin Escola, Direção, Coordenação, Professor e Responsável
- professor sem turma
- professor multi-escola
- usuário inativo
- Admin de escola inativa
- turmas, alunos, responsáveis, vínculos, disciplinas, grade, frequência, ocorrências, acompanhamentos, reuniões, comunicados, agenda, autorizações, retiradas, planos e pagamentos fake
- convites pendente, aceito, expirado e revogado

## O que já foi comprovado/corrigido

- Isolamento multi-escola e seleção de escola possuem validação server-side.
- Admin Escola Alfa não consegue selecionar Escola Beta.
- RPC de criar convite e revogar convite funciona com Admin Escola e foi testada em transação com ROLLBACK.
- Professor só registra falta para aluno dentro do próprio escopo.
- Agenda do professor foi restringida ao escopo real.
- Auditoria cobre acompanhamentos e interações do responsável.
- Documentos PDF/JPG/PNG/WEBP foram usados no QA.
- Storage e metadata estavam consistentes: 4 arquivos / 4 metadados no fechamento desta etapa.
- Upload de documentos agora tem validação em duas camadas:
  - frontend: MIME/extensão/tamanho
  - banco/storage: extensão do path, MIME, tamanho, correspondência MIME-extensão, formato exato do path
- TXT e caminho com segmento extra são negados pelo helper de upload.
- Testes transacionais do trigger:
  - PDF válido: aceito
  - nome .txt com MIME PDF: bloqueado
  - MIME/extensão incompatível: bloqueado
  - tamanho zero: bloqueado
- Rota de usuário autenticado sem perfil não usa mais /setup-admin; usa /perfil-pendente.
- Retorno pós-login agora reconhece /mba-escola e subrotas, inclusive /mba-escola/admin/seguranca.
- Mensagem residual de MFA no status de privacidade foi removida.
- Edge Function de privacidade exige JWT + ADMIN MBA ativo, sem MFA.

## Commits recentes que NÃO devem ser refeitos

- 829cc8bf8022ada6a6a0438a4b6950bda26ae404 — grade/timeline/LGPD
- 57439a83154364f29e8c176073917a0ccd0047e9 — navegação Segurança e LGPD
- b545860e080aeac9df376e70710b4ca37fe8ef34 / c07409ebd8ba90ef336f646a34aea1a350ea97aa — avisos prioritários/importação
- a905731cc8e602182d67f5b91a5a1257f356111b — auditoria de acompanhamentos
- d6ed7101839287e612eaeb933adc81721baf0a32 / 1b86a6313553d70ce3f82007f65a95d7dbee1aee / 3e097896df08961aee1f9fa5c0be69a68873408d — faltas do professor
- b1c5d1b164eeb83fdf140f853390ebfdb230d877 — agenda do professor
- e12b0cc691ad3a31f3a3423a7e39676d43b1545f — auditoria do responsável
- 8cb597e50f48f247cc4d7ec36c4b46a363632ff0 — bloqueio de documento inválido no frontend
- d615ac3553f60133126a2b9f2db968cc366fd4d9 — validação server-side de documentos + roteamento de autenticação
- cc3e28a2838a008e2a4ee226b828207db91980ae — índices dos hot paths do MBA Escola

## Migrations recentes

- 20260827210256_fix_mba_escola_timeline_and_remove_mfa_residue
- 20260828145123_audit_mba_escola_acompanhamentos
- 20260828152016_allow_teacher_absence_registration
- 20260828211018_scope_teacher_agenda_events
- 20260828213251_audit_responsible_interactions
- 20260829225732_harden_mba_escola_document_validation
- 20260829230223_optimize_mba_escola_hot_paths

## O que ainda precisa de EVIDÊNCIA VISUAL/E2E

O foco ao retomar não é recriar nem reprogramar tudo. É executar, registrar screenshots e fechar a matriz.

1. Documento TXT:
   - entrar como Responsável Alfa
   - usar a justificativa em correção
   - selecionar .txt
   - confirmar mensagem de formato inválido
   - provar que não criou arquivo nem metadata

2. Documento >10 MB:
   - comprovar bloqueio visual

3. Documento permitido:
   - abrir PDF/JPG/PNG/WEBP via URL assinada
   - comprovar acesso do responsável correto
   - comprovar bloqueio do responsável errado e de outra escola

4. Exclusão segura/LGPD:
   - ADMIN MBA excluir um documento QA com motivo
   - comprovar soft delete + remoção do Storage + auditoria
   - testar dry-run de retenção
   - testar/registrar diagnóstico de órfãos
   - só criar órfão controlado se necessário e limpar depois

5. Recuperação de senha E2E com conta fake:
   - Esqueceu sua senha
   - e-mail recebido
   - link aberto
   - nova senha
   - login com a nova senha
   - link inválido/expirado
   - nunca usar a conta real do ADMIN MBA

6. Convites pela interface:
   - criar convite
   - revogar
   - validar pendente/aceito/expirado/revogado
   - não recriar os seeds sem necessidade

7. Responsividade:
   - 1920x1080
   - 1366x768
   - 768x1024
   - 390x844
   - 360x800

8. Screenshots obrigatórios:
   - todas as telas relevantes por perfil
   - antes/ação/depois para mutações
   - bloqueios Alfa x Beta
   - professor sem turma
   - professor multi-escola
   - usuário inativo
   - escola inativa
   - responsável não vinculado
   - documentos
   - LGPD
   - recuperação de senha

9. Fechamento:
   - inventário completo de telas
   - matriz de testes
   - reteste final de regressão
   - PPT MBA_Escola_Teste_Completo_Ponta_a_Ponta.pptx

## Observações de segurança

- Não remover EXECUTE de RPCs SECURITY DEFINER em massa: muitas são APIs intencionais e fazem autorização interna.
- Não usar npm audit fix --force sem revisar impacto.
- O build ainda vinha reportando 3 vulnerabilidades npm (2 moderadas, 1 alta); identificar os pacotes e documentar/corrigir de forma segura antes de declarar produção 100%.
- O warning de install script de unrs-resolver@1.12.2 deve ser revisado, não aprovado automaticamente.

## Critério de encerramento

Só marcar o E2E como concluído quando houver:
AÇÃO REAL + RESULTADO REAL + EVIDÊNCIA VISUAL
para todos os cenários relevantes, seguido de matriz final e PPT.
