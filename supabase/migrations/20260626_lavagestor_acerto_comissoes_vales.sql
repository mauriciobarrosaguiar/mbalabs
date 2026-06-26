alter table public.lava_vales add column if not exists valor_descontado numeric default 0;

update public.lava_vales
set valor_descontado = coalesce(valor_descontado, 0);

create or replace function public.lava_registrar_acerto_comissoes(
  p_empresa_id uuid,
  p_funcionario_id uuid,
  p_modo text,
  p_valor_parcial numeric default 0
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_total_comissoes numeric := 0;
  v_saldo_vales numeric := 0;
  v_desconto numeric := 0;
  v_liquido numeric := 0;
  v_restante numeric := 0;
  v_aplicar numeric := 0;
  v_vale record;
begin
  select coalesce(sum(valor), 0) into v_total_comissoes
  from public.lava_comissoes
  where empresa_id = p_empresa_id and funcionario_id = p_funcionario_id and status = 'pendente';

  if v_total_comissoes <= 0 then
    return jsonb_build_object('ok', false, 'message', 'Sem comissões pendentes.');
  end if;

  select coalesce(sum(greatest(valor - coalesce(valor_descontado, 0), 0)), 0) into v_saldo_vales
  from public.lava_vales
  where empresa_id = p_empresa_id and funcionario_id = p_funcionario_id and status in ('aberto', 'parcial');

  if p_modo in ('integral', 'sim') then
    v_desconto := least(v_total_comissoes, v_saldo_vales);
  elsif p_modo = 'parcial' then
    v_desconto := least(greatest(coalesce(p_valor_parcial, 0), 0), v_total_comissoes, v_saldo_vales);
  else
    v_desconto := 0;
  end if;

  v_restante := v_desconto;

  if v_restante > 0 then
    for v_vale in
      select id, valor, coalesce(valor_descontado, 0) as valor_descontado
      from public.lava_vales
      where empresa_id = p_empresa_id and funcionario_id = p_funcionario_id and status in ('aberto', 'parcial')
      order by data_vale asc, created_at asc
    loop
      exit when v_restante <= 0;
      v_aplicar := least(greatest(v_vale.valor - v_vale.valor_descontado, 0), v_restante);
      if v_aplicar > 0 then
        update public.lava_vales
        set valor_descontado = round((v_vale.valor_descontado + v_aplicar)::numeric, 2),
            status = case when round((v_vale.valor_descontado + v_aplicar)::numeric, 2) >= v_vale.valor then 'descontado' else 'parcial' end
        where id = v_vale.id;
        v_restante := round((v_restante - v_aplicar)::numeric, 2);
      end if;
    end loop;
  end if;

  update public.lava_comissoes
  set status = 'pago', pago_em = now()
  where empresa_id = p_empresa_id and funcionario_id = p_funcionario_id and status = 'pendente';

  v_liquido := greatest(v_total_comissoes - v_desconto, 0);

  return jsonb_build_object('ok', true, 'total_comissoes', v_total_comissoes, 'saldo_vales', v_saldo_vales, 'desconto', v_desconto, 'liquido', v_liquido);
end;
$$;
