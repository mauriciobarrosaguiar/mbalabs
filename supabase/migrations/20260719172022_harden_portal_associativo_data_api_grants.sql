-- O Portal Associativo exige sessão autenticada. O acesso anônimo não é
-- necessário e fica explicitamente revogado, independentemente dos defaults
-- do projeto Supabase. RLS continua sendo a segunda camada de proteção.
revoke all on table
  public.assoc_pessoas,
  public.assoc_unidades,
  public.assoc_vinculos_unidade_pessoa,
  public.assoc_cobrancas,
  public.assoc_transferencias,
  public.assoc_reunioes,
  public.assoc_avisos,
  public.assoc_projetos,
  public.assoc_documentos,
  public.assoc_configuracoes,
  public.assoc_configuracoes_pagamento,
  public.assoc_perfis_usuarios,
  public.assoc_auditoria_logs,
  public.assoc_storage_integracoes,
  public.assoc_arquivos,
  public.assoc_importacoes,
  public.assoc_importacao_erros,
  public.assoc_comprovantes_pagamento,
  public.assoc_arquivos_vinculos,
  public.assoc_loteamentos,
  public.assoc_segredos_pagamento
from anon;

grant select, insert, update, delete on table
  public.assoc_pessoas,
  public.assoc_unidades,
  public.assoc_vinculos_unidade_pessoa,
  public.assoc_cobrancas,
  public.assoc_transferencias,
  public.assoc_reunioes,
  public.assoc_avisos,
  public.assoc_projetos,
  public.assoc_documentos,
  public.assoc_configuracoes,
  public.assoc_configuracoes_pagamento,
  public.assoc_perfis_usuarios,
  public.assoc_auditoria_logs,
  public.assoc_storage_integracoes,
  public.assoc_arquivos,
  public.assoc_importacoes,
  public.assoc_importacao_erros,
  public.assoc_comprovantes_pagamento,
  public.assoc_arquivos_vinculos,
  public.assoc_loteamentos,
  public.assoc_segredos_pagamento
to authenticated, service_role;

alter table public.assoc_pessoas enable row level security;
alter table public.assoc_unidades enable row level security;
alter table public.assoc_vinculos_unidade_pessoa enable row level security;
alter table public.assoc_cobrancas enable row level security;
alter table public.assoc_transferencias enable row level security;
alter table public.assoc_reunioes enable row level security;
alter table public.assoc_avisos enable row level security;
alter table public.assoc_projetos enable row level security;
alter table public.assoc_documentos enable row level security;
alter table public.assoc_configuracoes enable row level security;
alter table public.assoc_configuracoes_pagamento enable row level security;
alter table public.assoc_perfis_usuarios enable row level security;
alter table public.assoc_auditoria_logs enable row level security;
alter table public.assoc_storage_integracoes enable row level security;
alter table public.assoc_arquivos enable row level security;
alter table public.assoc_importacoes enable row level security;
alter table public.assoc_importacao_erros enable row level security;
alter table public.assoc_comprovantes_pagamento enable row level security;
alter table public.assoc_arquivos_vinculos enable row level security;
alter table public.assoc_loteamentos enable row level security;
alter table public.assoc_segredos_pagamento enable row level security;
