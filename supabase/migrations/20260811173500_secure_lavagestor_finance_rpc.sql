-- Harden LavaGestor finance mutation at the database boundary.
create or replace function public.lava_registrar_acerto_comissoes(
  p_empresa_id uuid,
  p_funcionario_id uuid,
  p_modo text default 'nao'::text,
  p_valor_parcial numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_total_comissao numeric(12,2) := 0;
  v_desconto_solicitado numeric(12,2) := 0;
  v_desconto_restante numeric(12,2) := 0;
  v_desconto_aplicado numeric(12,2) := 0;
  v_saldo_antes numeric(12,2) := 0;
  v_abater numeric(12,2) := 0;
  v_vale record;
  v_usuario_id uuid;
  v_empresa_atual uuid;
  v_tipo text;
  v_permitido boolean := false;
  v_service_role boolean := coalesce(auth.role() = 'service_role', false);
begin
  if not v_service_role then
    if auth.uid() is null then
      raise exception 'Autenticacao obrigatoria.' using errcode = '42501';
    end if;

    select u.id, u.empresa_id, coalesce(u.tipo_global, u.tipo)
      into v_usuario_id, v_empresa_atual, v_tipo
      from public.core_usuarios u
     where u.auth_user_id = auth.uid()
       and u.status = 'ativo'
     limit 1;

    if v_usuario_id is null or v_empresa_atual is distinct from p_empresa_id then
      raise exception 'Empresa nao autorizada para este acerto.' using errcode = '42501';
    end if;

    if v_tipo in ('super_admin', 'admin_master', 'admin_empresa') then
      v_permitido := true;
    else
      select exists (
        select 1
          from public.core_usuario_app_permissoes p
          join public.core_apps a on a.id = p.app_id
         where p.usuario_id = v_usuario_id
           and p.empresa_id = p_empresa_id
           and p.status = 'ativo'
           and a.slug in ('lavagestor', 'lava-gestor')
           and (
             lower(coalesce(p.perfil_app, '')) in ('dono', 'gerente', 'caixa')
             or 'financeiro.ver_caixa' = any(coalesce(p.permissoes_extras, array[]::text[]))
           )
      ) into v_permitido;
    end if;

    if not coalesce(v_permitido, false) then
      raise exception 'Perfil sem permissao financeira para realizar acerto.' using errcode = '42501';
    end if;
  end if;

  if not exists (
    select 1 from public.lava_funcionarios f
     where f.id = p_funcionario_id and f.empresa_id = p_empresa_id
  ) then
    raise exception 'Funcionario nao pertence a empresa informada.' using errcode = '42501';
  end if;

  select coalesce(sum(valor), 0)
    into v_total_comissao
    from public.lava_comissoes
   where empresa_id = p_empresa_id
     and funcionario_id = p_funcionario_id
     and status = 'pendente';

  if v_total_comissao <= 0 then
    return jsonb_build_object('ok', false, 'message', 'Este funcionario nao possui comissao pendente.');
  end if;

  update public.lava_comissoes
     set status = 'pago', pago_em = now()
   where empresa_id = p_empresa_id
     and funcionario_id = p_funcionario_id
     and status = 'pendente';

  if coalesce(p_modo, 'nao') = 'parcial' then
    v_desconto_solicitado := least(greatest(coalesce(p_valor_parcial, 0), 0), v_total_comissao);
    v_desconto_restante := v_desconto_solicitado;

    for v_vale in
      select id, valor, valor_descontado, coalesce(valor, 0) - coalesce(valor_descontado, 0) as saldo
        from public.lava_vales
       where empresa_id = p_empresa_id
         and funcionario_id = p_funcionario_id
         and status in ('aberto', 'parcial')
         and coalesce(valor, 0) - coalesce(valor_descontado, 0) > 0
       order by data_vale asc, created_at asc
    loop
      exit when v_desconto_restante <= 0;
      v_saldo_antes := greatest(coalesce(v_vale.saldo, 0), 0);
      v_abater := least(v_saldo_antes, v_desconto_restante);

      update public.lava_vales
         set valor_descontado = coalesce(valor_descontado, 0) + v_abater,
             status = case when coalesce(valor, 0) - (coalesce(valor_descontado, 0) + v_abater) <= 0 then 'descontado' else 'parcial' end
       where id = v_vale.id and empresa_id = p_empresa_id;

      insert into public.lava_vale_movimentos (
        empresa_id, vale_id, funcionario_id, valor_descontado, saldo_antes, saldo_depois, tipo, observacao
      ) values (
        p_empresa_id, v_vale.id, p_funcionario_id, v_abater, v_saldo_antes, greatest(v_saldo_antes - v_abater, 0), 'desconto', 'Abatimento no acerto de comissao'
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
$function$;

revoke execute on function public.lava_registrar_acerto_comissoes(uuid,uuid,text,numeric) from public, anon;
grant execute on function public.lava_registrar_acerto_comissoes(uuid,uuid,text,numeric) to authenticated, service_role;

revoke execute on function public.can_employee_create_wash() from public, anon;
grant execute on function public.can_employee_create_wash() to authenticated, service_role;
