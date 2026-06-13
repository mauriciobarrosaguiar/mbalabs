export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UsuarioTipo =
  | "super_admin"
  | "admin_master"
  | "admin_empresa"
  | "operador"
  | "usuario"
  | "vendedor"
  | "funcionario";

export type AppSlug = "mba-cotacoes" | "lavagestor";

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
};

export type Database = {
  public: {
    Tables: {
      core_empresa_categorias: Table<{
        id: string;
        nome: string;
        slug: string;
        descricao: string | null;
        status: string;
        created_at: string;
        updated_at: string;
      }>;
      core_empresas: Table<{
        id: string;
        categoria_id: string;
        nome: string;
        nome_fantasia: string | null;
        razao_social: string | null;
        cnpj: string | null;
        telefone: string | null;
        whatsapp: string | null;
        email: string | null;
        cidade: string | null;
        estado: string | null;
        responsavel: string | null;
        status: string;
        observacoes: string | null;
        created_at: string;
        updated_at: string;
      }>;
      core_usuarios: Table<{
        id: string;
        auth_user_id: string | null;
        empresa_id: string | null;
        nome: string;
        email: string;
        telefone: string | null;
        tipo: UsuarioTipo;
        tipo_global: UsuarioTipo;
        status: string;
        senha_hash: string | null;
        created_at: string;
        updated_at: string;
      }>;
      core_apps: Table<{
        id: string;
        slug: string;
        nome: string;
        descricao: string | null;
        url_path: string | null;
        url_interna: string | null;
        url_externa: string | null;
        logo_icone: string | null;
        status: string;
        ativo: boolean;
        ordem: number;
        created_at: string;
        updated_at: string;
      }>;
      core_planos: Table<{
        id: string;
        app_id: string | null;
        nome: string;
        descricao: string | null;
        valor_mensal: number;
        limite_usuarios: number | null;
        limite_registros: number | null;
        ativo: boolean;
        created_at: string;
      }>;
      core_assinaturas: Table<{
        id: string;
        empresa_id: string;
        app_id: string;
        plano_id: string | null;
        status: string;
        inicio: string;
        vencimento: string | null;
        created_at: string;
        updated_at: string;
      }>;
      core_empresa_apps: Table<{
        id: string;
        empresa_id: string;
        app_id: string;
        plano_id: string | null;
        status: string;
        data_inicio: string;
        data_vencimento: string | null;
        observacoes: string | null;
        created_at: string;
        updated_at: string;
      }>;
      core_pagamentos: Table<{
        id: string;
        empresa_id: string;
        assinatura_id: string;
        valor: number;
        vencimento: string | null;
        pagamento_em: string | null;
        status: string;
        metodo: string | null;
        referencia_externa: string | null;
        created_at: string;
      }>;
      core_permissoes: Table<{
        id: string;
        usuario_id: string;
        app_id: string;
        pode_acessar: boolean;
        perfil: string;
        created_at: string;
      }>;
      core_usuario_app_permissoes: Table<{
        id: string;
        usuario_id: string;
        empresa_id: string | null;
        app_id: string;
        perfil_app: string;
        status: string;
        created_at: string;
        updated_at: string;
      }>;
      core_logs: Table<{
        id: string;
        empresa_id: string | null;
        usuario_id: string | null;
        app_slug: string | null;
        acao: string;
        detalhes: Json | null;
        created_at: string;
      }>;
      cot_produtos: Table<Record<string, unknown>>;
      cot_vendedores: Table<Record<string, unknown>>;
      cot_cotacoes: Table<Record<string, unknown>>;
      cot_cotacao_itens: Table<Record<string, unknown>>;
      cot_respostas: Table<Record<string, unknown>>;
      cot_pedidos: Table<Record<string, unknown>>;
      cot_pedido_itens: Table<Record<string, unknown>>;
      lava_clientes: Table<Record<string, unknown>>;
      lava_veiculos: Table<Record<string, unknown>>;
      lava_funcionarios: Table<Record<string, unknown>>;
      lava_servicos: Table<Record<string, unknown>>;
      lava_lavagens: Table<Record<string, unknown>>;
      lava_comissoes: Table<Record<string, unknown>>;
      lava_vales: Table<Record<string, unknown>>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
