import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPharmacyAnalysis } from '../src/modules/cotacoes/lib/services/pharmacy-analysis.ts';

test('análise resolve nomes de duas distribuidoras pelo identificador sem alterar mínimos', () => {
  const analysis = buildPharmacyAnalysis([], [], [], [
    { id: 'dist-mtf', nome: 'MTF', uf: 'TO', pedidoMinimo: 300 },
    { id: 'dist-pan', nome: 'PANPHARMA', uf: 'GO', pedidoMinimo: 0 },
  ]);
  const source = readFileSync(new URL('../src/modules/cotacoes/components/dashboard/pages.tsx', import.meta.url), 'utf8');
  const expression = source.match(/<TableCell>\{(analysis\.distributorMinimums\.find[^\n]+)\}<\/TableCell>/)?.[1];
  assert.ok(expression);
  const display = new Function('analysis', 'item', `return ${expression}`);
  assert.equal(display(analysis, { distributorId: 'dist-pan' }), 'PANPHARMA GO');
  assert.equal(display(analysis, { distributorId: 'dist-mtf' }), 'MTF TO');
  assert.equal(display(analysis, { distributorId: 'desconhecido' }), '-');
  assert.equal(display(analysis, {}), '-');
  assert.deepEqual(analysis.distributorMinimums.map(d => d.minimumOrder), [300, 0]);
  assert.deepEqual(analysis.awards, []);
  assert.equal(analysis.totals.estimatedTotal, 0);
});
