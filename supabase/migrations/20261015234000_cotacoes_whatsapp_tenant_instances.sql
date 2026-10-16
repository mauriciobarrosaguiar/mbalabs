-- Cada empresa cliente gerencia uma instância WhatsApp exclusiva.
-- Nunca armazena API key/QR code em tabelas acessíveis ao navegador.
CREATE TABLE IF NOT EXISTS public.cot_whatsapp_tenant_sessions (
 tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
 instance_name text NOT NULL UNIQUE,
 provider text NOT NULL DEFAULT 'evolution_api',
 status text NOT NULL DEFAULT 'desconectado'
    CHECK (status IN ('desconectado','aguardando_qr','conectado','erro')),
 last_checked_at timestamptz,
 last_connected_at timestamptz,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT tenant_instance_name_safe CHECK (instance_name ~ '^[a-z0-9_-]{8,64}$')
);
CREATE INDEX IF NOT EXISTS cot_whatsapp_tenant_sessions_status_idx
 ON public.cot_whatsapp_tenant_sessions(status);
ALTER TABLE public.cot_whatsapp_tenant_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cot_whatsapp_tenant_sessions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cot_whatsapp_tenant_sessions TO service_role;
COMMENT ON TABLE public.cot_whatsapp_tenant_sessions IS
'Vínculo do WhatsApp próprio de cada tenant. A configuração global contém somente credenciais da infraestrutura.';
