import test from 'node:test';
import assert from 'node:assert/strict';
import {formatDroneReportDate} from '../src/lib/dronegestor-report-date.ts';
test('PDF mantém Brasília/Palmas mesmo com servidor em UTC ou outro fuso',()=>{
 const previous=process.env.TZ;
 try{for(const tz of ['UTC','America/Los_Angeles']){process.env.TZ=tz;assert.equal(formatDroneReportDate('2026-11-22T11:00:00Z'),'22/11/2026, 08:00');assert.equal(formatDroneReportDate('2026-11-22T11:30:00Z'),'22/11/2026, 08:30');}}
 finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
test('PDF distingue data ausente e texto inválido',()=>{assert.equal(formatDroneReportDate(undefined),'Não informado');assert.equal(formatDroneReportDate('SIMULAÇÃO'),'SIMULAÇÃO');});
