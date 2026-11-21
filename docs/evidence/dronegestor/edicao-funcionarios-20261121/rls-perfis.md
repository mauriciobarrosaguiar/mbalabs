# Verificação complementar de RLS — 21/11/2026

Banco produtivo, transações somente leitura com ROLLBACK. Papel PostgreSQL authenticated, claims locais com auth.uid das contas fictícias existentes. Nenhuma mudança de política, conta ou sessão persistida. Este método exercita as políticas reais com identidades não administrativas, mas não substitui login e navegação de cada perfil.

| Perfil | Admin master | Logs da empresa visíveis | Logs de outros autores da empresa | Logs de outras empresas |
|---|---|---:|---:|---:|
| Piloto | false | 14 | 14 | 0 |
| Responsável técnico | false | 14 | 14 | 0 |
| Gestor operacional | false | 14 | 12 | 0 |

Isolamento entre empresas passou neste conjunto de leitura. Restrição entre perfis/autores não é imposta por core_logs_select: a política permite is_admin_master() OR empresa_id=current_empresa_id(). A política INSERT possui condição equivalente de empresa e não foi testada por escrita nesta rodada. Permanece necessário definir uma matriz de ações e migrar com proteção dos demais aplicativos após autorização específica.
