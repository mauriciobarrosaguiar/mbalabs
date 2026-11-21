import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLoads, calculateProduct, calculateFlow, calculateYield, calculateFinance } from '../src/lib/dronegestor-calculations.ts';
test('cargas completas, parcial e área menor que tanque', () => {
  assert.deepEqual(calculateLoads(10,10,25), { totalL:100,areaPerLoadHa:2.5,fullLoads:4,partialLoads:0,loads:4,lastL:25,partialL:0 });
  assert.equal(calculateLoads(10.1,10,25).lastL,1);
  assert.equal(calculateLoads(1,10,25).fullLoads,0);
  assert.equal(calculateLoads(1,10,25).lastL,10);
});
test('decimal exato não gera carga fantasma; parcial pequena é preservada', () => {
  assert.equal(calculateLoads(3,.1,.1).loads,3);
  assert.equal(calculateLoads(1.000001,1,1).loads,2);
  assert.equal(calculateLoads(1e-20,1,1).loads,1);
});
test('conversões preservam dimensão de massa e volume', () => {
  assert.equal(calculateProduct(250,'mL/ha',4).baseAmount,1);
  assert.equal(calculateProduct(250,'g/ha',4).baseUnit,'kg');
  assert.throws(()=>calculateProduct(1,'dose',1));
});
test('vazão e rendimento incluem paradas explicitamente', () => {
  assert.equal(calculateFlow(10,12,6),1.2);
  const result=calculateYield({areaHa:10,speedKmh:12,widthM:6,rateLHa:10,tankL:25,refillMin:5,batteryMin:2,travelMin:10,efficiencyPercent:80});
  assert.equal(result.theoreticalHaH,7.2);
  assert.equal(result.loads,4);
  assert.ok(result.estimatedHaH<result.theoreticalHaH);
});
test('financeiro diferencia ausência de retorno e retorno calculável', () => {
  const result=calculateFinance({areaHa:100,priceHa:100,variableHa:40,fixed:1000,investment:20000,monthlyHa:100});
  assert.equal(result.profit,5000); assert.equal(result.marginPercent,50); assert.equal(result.paybackMonths,4);
  assert.equal(calculateFinance({areaHa:1,priceHa:0,variableHa:1,fixed:0,investment:0,monthlyHa:0}).marginPercent,null);
});
test('rejeita zero, infinitos, negativos e eficiência inválida', () => {
  for (const invalid of [0,-1,NaN,Infinity,1e10]) assert.throws(()=>calculateLoads(invalid,10,25));
  assert.throws(()=>calculateFlow(10,0,6));
  assert.throws(()=>calculateYield({areaHa:1,speedKmh:1,widthM:1,rateLHa:1,tankL:1,refillMin:0,batteryMin:0,travelMin:0,efficiencyPercent:101}));
});
