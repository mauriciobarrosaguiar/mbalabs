-- Atualiza conexoes existentes do LexGestor para pasta raiz separada por escritorio.
-- Mantem os arquivos no armazenamento do proprio escritorio; Supabase guarda apenas metadados/caminhos.

update public.lex_storage_connections sc
set
  root_folder_path = '/LexGestor/Escritorio - ' || regexp_replace(
    trim(coalesce(nullif(e.nome, ''), 'Escritorio')),
    '[^[:alnum:] _.-]+',
    '-',
    'g'
  ),
  updated_at = now()
from public.lex_escritorios e
where sc.escritorio_id = e.id
  and (sc.root_folder_path is null or sc.root_folder_path = '/LexGestor');
