// Deterministic database boundary for offline authorization tests. No real database.
export const state = { row: null, error: null, config: true, reads: 0 };
export const hasSupabaseConfig = () => state.config;
export const hasSupabaseAdminConfig = () => state.config;
export const canAccessModule = (type, module) => !type || type === 'both' ||
  (module === 'pharmacy' ? type === 'pharmacy' : type === 'distributor_bidding');
export const isTenantSuspended = status =>
  ['suspended','suspenso','canceled','cancelado','inactive','inativo','bloqueada'].includes(String(status ?? '').toLowerCase());
export function createSupabaseAdminClient() {
  return { from(table) {
    if (table !== 'quotations') throw Error('Unexpected table');
    return { select() { return this; }, eq() { return this; }, async maybeSingle() {
      state.reads++; return { data:state.row,error:state.error };
    }};
  }};
}
