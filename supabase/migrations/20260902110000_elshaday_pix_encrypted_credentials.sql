-- Elshaday: credenciais de API PIX criptografadas no banco.
-- A chave de descriptografia permanece apenas no ambiente server-side da aplicação.

alter table public.igreja_pix_configuracoes
  add column if not exists credenciais_criptografadas text;

comment on column public.igreja_pix_configuracoes.credenciais_criptografadas is
  'Credenciais secretas do provedor criptografadas pela aplicação. Nunca expor ao cliente.';
