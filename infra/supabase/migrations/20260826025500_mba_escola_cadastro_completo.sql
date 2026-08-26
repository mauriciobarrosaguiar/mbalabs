alter table public.escola_escolas
  add column if not exists razao_social text,
  add column if not exists cnpj text,
  add column if not exists email text,
  add column if not exists telefone text,
  add column if not exists whatsapp text,
  add column if not exists cep text,
  add column if not exists logradouro text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists uf text,
  add column if not exists contato_nome text,
  add column if not exists contato_cargo text,
  add column if not exists observacoes text;

create unique index if not exists escola_escolas_cnpj_unique
  on public.escola_escolas ((regexp_replace(cnpj, '\D', '', 'g')))
  where cnpj is not null and btrim(cnpj) <> '';

alter table public.escola_escolas
  drop constraint if exists escola_escolas_uf_check;

alter table public.escola_escolas
  add constraint escola_escolas_uf_check
  check (
    uf is null
    or uf = ''
    or upper(uf) in (
      'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
      'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
    )
  );
