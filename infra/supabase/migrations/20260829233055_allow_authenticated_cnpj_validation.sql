-- O validador é usado por CHECK constraint e pode ser executado por sessões autenticadas.
grant execute on function public.escola_cnpj_valido(text) to authenticated, service_role;
revoke execute on function public.escola_cnpj_valido(text) from anon;
