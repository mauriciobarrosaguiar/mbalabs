import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBilledPurchaseHistory} from '../src/modules/cotacoes/lib/services/purchase-history.ts';
const item=(id,qty,billed,status)=>({id,tenantId:'A',quantityToBuy:qty,billedQuantity:billed,unitPrice:10,productName:id,fulfillmentStatus:status});
const order=(id,status,items,extra={})=>({id,tenantId:'A',status,supplierName:'TESTE_QA',items,...extra});
test('histórico usa quantidade faturada e mantém faltas parciais e totais',()=>{
 const rows=buildBilledPurchaseHistory([order('full','finalizado_pelo_vendedor',[item('a',10,10,'faturado')]),order('partial','parcialmente_faturado',[item('b',10,6,'parcial')]),order('none','nao_faturado',[item('c',10,0,'nao_faturado')])],'A');
 assert.equal(rows.length,3);assert.equal(rows.reduce((s,r)=>s+r.billedAmount,0),160);
 assert.equal(rows.find(r=>r.id==='b').missing,4);assert.equal(rows.find(r=>r.id==='c').missing,10);
});
test('rascunhos, cancelados e pedidos de outra farmácia não compõem compras',()=>{
 const rows=buildBilledPurchaseHistory([order('draft','gerado',[item('a',10,0,'pendente')]),order('cancel','cancelado',[item('b',10,10,'faturado')],{completedAt:'2026-10-19'}),order('foreign','finalizado_pelo_vendedor',[item('c',10,10,'faturado')],{tenantId:'B'})],'A');assert.deepEqual(rows,[]);
});
test('item de outra farmácia é descartado e faturamento integral legado é preservado',()=>{
 const rows=buildBilledPurchaseHistory([order('full','confirmed',[item('legacy',5,undefined,'faturado'),{...item('foreign',5,5,'faturado'),tenantId:'B'}])],'A');assert.equal(rows.length,1);assert.equal(rows[0].billedAmount,50);
});
