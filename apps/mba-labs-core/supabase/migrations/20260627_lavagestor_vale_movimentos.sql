-- LavaGestor: histórico de abatimentos de vale
-- Objetivo: quando um vale for descontado parcial ou integralmente no acerto de comissão,
-- registrar o valor abatido e o saldo restante para aparecer no relatório.

alter table if exists lava_vales
  add column if not exists valor_descontado numeric(12,2) not null default 0;

alter table if exists lava_vales
  drop constraint if exists lava_vales_status_check;

alter table if exists lava_vales
  add constraint lava_vales_status_check
  check (status in ('aberto', 'parcial', 'descontado', 'cancelado'));

create table if not exists lava_vale_movimentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references core_empresas(id) on delete cascade,
  vale_id uuid references lava_vales(id) on delete cascade,
  funcionario_id uuid references lava_funcionarios(id) on delete cascade,
  valor_descontado numeric(12,2) not null default 0,
  saldo_antes numeric(12,2) not null default 0,
  saldo_depois numeric(12,2) not null default 0,
  tipo text not null default 'desconto',
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists lava_vale_movimentos_empresa_idx on lava_vale_movimentos(empresa_id);
create index if not exists lava_vale_movimentos_vale_idx on lava_vale_movimentos(vale_id);
create index if not exists lava_vale_movimentos_funcionario_idx on lava_vale_movimentos(funcionario_id);

create or replace function lava_registrar_acerto_comissoes(
  p_empresa_id uuid,
  p_funcionario_id uuid,
  p_modo text default 'nao',
  p_valor_parcial numeric default 0
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_total_comissao numeric(12,2) := 0;
  v_desconto_solicitado numeric(12,2) := 0;
  v_desconto_restante numeric(12,2) := 0;
  v_desconto_aplicado numeric(12,2) := 0;
  v_saldo_antes numeric(12,2) := 0;
  v_abater numeric(12,2) := 0;
  v_vale record;
begin
  select coalesce(sum(valor), 0)
    into v_total_comissao
    from lava_comissoes
   where empresa_id = p_empresa_id
     and funcionario_id = p_funcionario_id
     and status = 'pendente';

  if v_total_comissao <= 0 then
    return jsonb_build_object('ok', false, 'message', 'Este funcionário não possui comissão pendente.');
  end if;

  update lava_comissoes
     set status = 'pago', pago_em = now()
   where empresa_id = p_empresa_id
     and funcionario_id = p_funcionario_id
     and status = 'pendente';

  if coalesce(p_modo, 'nao') = 'parcial' then
    v_desconto_solicitado := least(greatest(coalesce(p_valor_parcial, 0), 0), v_total_comissao);
    v_desconto_restante := v_desconto_solicitado;

    for v_vale in
      select id, valor, valor_descontado, coalesce(valor, 0) - coalesce(valor_descontado, 0) as saldo
        from lava_vales
       where empresa_id = p_empresa_id
         and funcionario_id = p_funcionario_id
         and status in ('aberto', 'parcial')
         and coalesce(valor, 0) - coalesce(valor_descontado, 0) > 0
       order by data_vale asc, created_at asc
    loop
      exit when v_desconto_restante <= 0;
      v_saldo_antes := greatest(coalesce(v_vale.saldo, 0), 0);
      v_abater := least(v_saldo_antes, v_desconto_restante);

      update lava_vales
         set valor_descontado = coalesce(valor_descontado, 0) + v_abater,
             status = case when coalesce(valor, 0) - (coalesce(valor_descontado, 0) + v_abater) <= 0 then 'descontado' else 'parcial' end
       where id = v_vale.id;

      insert into lava_vale_movimentos (
        empresa_id, vale_id, funcionario_id, valor_descontado, saldo_antes, saldo_depois, tipo, observacao
      ) values (
        p_empresa_id, v_vale.id, p_funcionario_id, v_abater, v_saldo_antes, greatest(v_saldo_antes - v_abater, 0), 'desconto', 'Abatimento no acerto de comissão'
      );

      v_desconto_aplicado := v_desconto_aplicado + v_abater;
      v_desconto_restante := v_desconto_restante - v_abater;
    end loop;
  end if;

  return jsonb_build_object(
    'ok', true,
    'comissao', v_total_comissao,
    'desconto', v_desconto_aplicado,
    'liquido', greatest(v_total_comissao - v_desconto_aplicado, 0)
  );
end;
$$;
