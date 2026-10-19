import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const source = stripTypeScriptTypes(readFileSync(new URL('../src/modules/cotacoes/lib/whatsapp/mba-cotacoes.ts', import.meta.url), 'utf8'))
  .replace(/^import .*;\s*$/gm, '').replace(/^export /gm, '');
function fixture(env) {
  const state = { calls: 0, configCalls: 0, updates: [] };
  const db = { from(table) {
    const q = {
      select() { return q; }, eq() { return q; },
      maybeSingle: async () => ({ data: null }),
      insert() { return q; }, single: async () => ({ data: { id: 'qa-send' } }),
      update(data) { state.updates.push({ table, ...data }); return q; },
      then(resolve) { return Promise.resolve({ error: null }).then(resolve); }
    }; return q;
  }};
  const context = vm.createContext({ process: { env }, URL, console, setTimeout,
    createSupabaseAdminClient: () => db, hasSupabaseConfig: () => true, hasSupabaseAdminConfig: () => true,
    getTenantWhatsAppSendingConfig: async () => { state.configCalls++; throw new Error('provider fixture disabled'); },
    verifyGlobalEvolutionInfrastructure: async () => {},
    fetch: async () => { state.calls++; throw new Error('External calls must never occur'); }
  });
  vm.runInContext(source + '\nthis.sendQA = sendWhatsAppMbaCotacoes;', context);
  return { send: context.sendQA, state };
}
const input = { empresaId: 'TESTE_QA', cotacaoId: 'TESTE_QA', vendedorId: 'TESTE_QA', telefone: '', mensagem: 'TESTE_QA', tipoEnvio: 'link_cotacao', linkEnviado: 'https://example.invalid/TESTE_QA' };
const qa = { WHATSAPP_MOCK: 'true', NEXT_PUBLIC_SUPABASE_URL: 'https://ulabbmjxdvxxiybhtgnn.supabase.co', VERCEL_ENV: 'preview' };
test('QA registra solicitação pendente sem provider, sem telefone real e sem envio externo', async () => {
  const { send, state } = fixture(qa); const result = await send(input);
  assert.equal(result.status, 'pendente'); assert.equal(result.enviadoPor, 'qa_simulator');
  assert.match(result.erro, /nenhuma mensagem enviada ou entregue/);
  assert.equal(result.enviadoEm, undefined); assert.equal(state.calls, 0); assert.equal(state.configCalls, 0);
  assert.equal(state.updates.at(-1).status, 'pendente'); assert.equal(state.updates.at(-1).enviado_por, 'qa_simulator');
});
test('flag de teste falha fechada em produção e em Supabase diferente do QA', async () => {
  for (const env of [{ ...qa, VERCEL_ENV: 'production' }, { ...qa, NEXT_PUBLIC_SUPABASE_URL: 'https://example.invalid' }]) {
    const { send, state } = fixture(env); await assert.rejects(send(input), /somente no Supabase QA/);
    assert.equal(state.calls, 0); assert.equal(state.updates.length, 0);
  }
});
test('sem flag mantém validação normal de telefone e não simula sucesso', async () => {
  const { send, state } = fixture({ NEXT_PUBLIC_SUPABASE_URL: qa.NEXT_PUBLIC_SUPABASE_URL });
  const result = await send(input); assert.equal(result.status, 'falhou');
  assert.match(result.erro, /WhatsApp válido/); assert.equal(state.calls, 0);
});
