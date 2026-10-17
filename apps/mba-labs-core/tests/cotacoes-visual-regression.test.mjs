import assert from 'node:assert/strict';
import test from 'node:test';
import { formatDateBR, formatDeadlineDateBR, formatDateTime } from '../src/modules/cotacoes/lib/formatters.ts';
import { countConfirmedNotBilledItems } from '../src/modules/cotacoes/lib/purchase-order-display.ts';

test('prazo de calendário preserva o dia em UTC e nos fusos brasileiros', () => {
  const previous = process.env.TZ;
  try {
    for (const timezone of ['UTC', 'America/Sao_Paulo', 'America/Manaus']) {
      process.env.TZ = timezone;
      assert.equal(formatDateBR('2026-10-24'), '24/10/2026');
      assert.equal(formatDeadlineDateBR('2026-10-24T00:00:00Z'), '24/10/2026');
      assert.equal(formatDeadlineDateBR(null), '-');
    }
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

test('horários reais continuam convertidos ao fuso local', () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'America/Sao_Paulo';
    assert.equal(formatDateTime('2026-10-24T00:00:00Z'), '23/10/2026 21:00');
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

test('resumo de faturamento conta a recusa mesmo com todos os itens em pedidos', () => {
  const item = fulfillmentStatus => ({fulfillmentStatus});
  const orders = [{items:[item('faturado'),item('faturado'),item('faturado')]},
    {items:[item('parcial'),item('nao_faturado')]}];
  assert.equal(countConfirmedNotBilledItems(orders), 1);
  assert.equal(countConfirmedNotBilledItems([{items:[item('pendente')]}]), 0);
  assert.equal(countConfirmedNotBilledItems([]), 0);
});
