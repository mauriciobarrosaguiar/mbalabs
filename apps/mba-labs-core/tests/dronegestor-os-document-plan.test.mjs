import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { NextRequest } from 'next/server.js';
import { state } from './helpers/dronegestor-planning-fixture.mjs';

const fixture = new URL('./helpers/dronegestor-planning-fixture.mjs', import.meta.url).href;
const hook = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (['@/lib/core-data', '@mba-labs/shared/supabase/server'].includes(specifier))
      return { url: fixture, shortCircuit: true };
    if (specifier.startsWith('@/lib/'))
      return { url: new URL('../src/lib/' + specifier.slice(6) + '.ts', import.meta.url).href, shortCircuit: true };
    if (specifier === 'next/server') return nextResolve('next/server.js', context);
    return nextResolve(specifier, context);
  },
});
const { GET } = await import('../src/app/api/dronegestor/operacao-os/route.ts');
hook.deregister();

const planned = {
  tipoAtividade: 'pulverizacao', equipamentoId: 'equipment-qa',
  drone: 'HOMOLOGAÇÃO DRONE DE TESTE', registroAnac: 'SEM-REGISTRO-REAL',
  pontaModelo: 'FICTÍCIO', volume: 10, tanque: 20, faixa: 5,
  velocidadeKmh: 18, alturaM: 3, produtos: [{nome:'ÁGUA FICTÍCIA',dose:100,unidade:'mL/ha'}],
};
const osData = {
  numero: 'OS-HOMOLOGACAO', status: 'em_preparacao', areaHa: 0.1,
  cultura: 'Milho — TESTE FICTÍCIO', alvo: 'NÃO APLICAR',
  pilotoResponsavelId: 'pedro', pilotoResponsavelNome: 'Pedro',
  missaoPlanejada: planned, planejamentoAtualizadoEm: '2026-11-23T10:00:00Z',
};
function row(action, id, details, usuario_id='owner') {
  return {
    id: id + '-row', acao: action, usuario_id, empresa_id: 'company-A',
    app_slug: 'dronegestor', created_at: '2026-11-23T10:00:00Z',
    detalhes: { entityId: id, ativo: true, data: details },
  };
}
const req = (id='os-qa') => new NextRequest('https://example.invalid/api/dronegestor/operacao-os?osId=' + id);
beforeEach(() => Object.assign(state, {
  session: {
    user: { id: 'auth' },
    profile: { id: 'pedro', nome: 'Pedro', tipo: 'usuario', status: 'ativo', empresa_id: 'company-A' },
    permissoes: [{appSlug:'dronegestor',perfil:'piloto',podeAcessar:true}],
    appsLiberados: [{slug:'dronegestor',canAccess:true}],
  },
  factories: 0, writes: 0, queries: [], audit: [], race: false, auditError: false,
  rows: [row('ordem_servico', 'os-qa', osData)],
}));

test('pilot document GET receives persisted technical plan of a prepared OS', async () => {
  const response = await GET(req());
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.source, 'os');
  assert.equal(payload.state.mission.ordemServicoId, 'os-qa');
  assert.equal(payload.state.mission.tipoAtividade, 'pulverizacao');
  assert.equal(payload.state.mission.drone, planned.drone);
  assert.equal(payload.state.mission.registroAnac, planned.registroAnac);
  assert.equal(payload.state.mission.area, 0.1);
  assert.equal(payload.state.mission.produtos[0].nome, 'ÁGUA FICTÍCIA');
  assert.equal(payload.state.mission.planejamentoAtualizadoEm, '2026-11-23T10:00:00Z');
  assert.equal(state.writes, 0);
});

test('document GET never invents drone/ANAC identity when plan is missing', async () => {
  delete state.rows[0].detalhes.data.missaoPlanejada;
  const response = await GET(req());
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.state.mission.registroAnac, undefined);
  assert.equal(payload.state.mission.tipoAtividade, undefined);
  assert.equal(state.writes, 0);
});

test('live mission snapshot remains authoritative even when gestor plan differs', async () => {
  state.rows[0].detalhes.data.status = 'em_execucao';
  const mission = {
    ordemServicoId: 'os-qa', tipoAtividade:'dispersao', drone:'DRONE DO CHECKPOINT',
    registroAnac:'CHECKPOINT', area:0.1,
  };
  state.rows.push({
    ...row('estado_campo_v2','live','', 'pedro'),
    detalhes: { state:{mission}, updatedAt:'2026-11-23T10:05:00Z' },
  });
  const response = await GET(req());
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.source, 'live');
  assert.equal(payload.state.mission.drone, mission.drone);
  assert.equal(payload.state.mission.registroAnac, mission.registroAnac);
  assert.equal(payload.state.mission.tipoAtividade, 'dispersao');
  assert.equal(state.writes, 0);
});

test('other pilot cannot read a planned OS of Pedro', async () => {
  state.session.profile.id = 'outro-piloto';
  const response = await GET(req());
  assert.equal(response.status, 403);
  assert.equal(state.writes, 0);
});
