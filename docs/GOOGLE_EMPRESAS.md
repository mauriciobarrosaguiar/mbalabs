# Google Empresas

Painel privado do MBA Labs para cadastrar e gerenciar Perfis da Empresa no Google.

## Acesso

- Painel administrativo: `/google-empresas`
- Acesso permitido somente para `admin_master` ou `super_admin`.
- O cliente não recebe usuário no MBA Labs.
- O cliente acessa somente um link temporário em `/google-empresas/autorizar/{token}` para autorizar a própria Conta Google.

## Fluxo

1. O Admin Master cadastra a empresa e os horários.
2. O painel gera um link temporário para o cliente.
3. O cliente autoriza a Conta Google responsável.
4. O painel lista as contas do Perfil da Empresa disponíveis.
5. O Admin Master sincroniza e pesquisa possíveis perfis existentes.
6. Quando já existe um perfil reivindicado, o painel apresenta o link oficial para solicitar acesso.
7. Quando não existe, o painel cria o perfil pela API oficial.
8. O painel consulta os métodos de verificação liberados pelo Google e inicia o método escolhido.
9. Quando houver PIN, o código pode ser concluído pelo painel.

## Google Cloud

Habilite:

- My Business Account Management API;
- My Business Business Information API;
- My Business Verifications API.

Configure a tela de consentimento OAuth e adicione a URL de retorno:

```text
https://www.mbalabs.com.br/api/google-empresas/oauth/callback
```

Escopo utilizado:

```text
https://www.googleapis.com/auth/business.manage
```

## Variáveis da Vercel

```env
NEXT_PUBLIC_APP_URL=https://www.mbalabs.com.br
GOOGLE_BUSINESS_CLIENT_ID=
GOOGLE_BUSINESS_CLIENT_SECRET=
GOOGLE_BUSINESS_TOKEN_SECRET=
```

`GOOGLE_BUSINESS_TOKEN_SECRET` deve ser uma chave longa e aleatória. Ela criptografa os tokens antes de salvá-los no Supabase.

## Banco de dados

Aplicar:

```text
supabase/migrations/20260729120000_google_empresas.sql
```

A migration cria `gmb_empresas`, `gmb_autorizacoes` e `gmb_operacoes`, com RLS restrita ao Admin Master.

## Segurança

- Nunca solicitar a senha Google do cliente.
- Nunca colocar client secret ou service role no navegador.
- Conferir duplicidades antes de criar novo perfil.
- Usar somente contas cujo proprietário autorizou o gerenciamento.
- A verificação continua sujeita aos métodos e à análise definidos pelo Google.
