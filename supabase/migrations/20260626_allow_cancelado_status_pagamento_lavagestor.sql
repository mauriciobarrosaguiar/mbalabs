alter table public.lava_lavagens
  drop constraint if exists lava_lavagens_status_pagamento_check;

alter table public.lava_lavagens
  add constraint lava_lavagens_status_pagamento_check
  check (
    status_pagamento is null
    or status_pagamento in ('aberto', 'parcial', 'pago', 'fiado', 'cancelado')
  );
