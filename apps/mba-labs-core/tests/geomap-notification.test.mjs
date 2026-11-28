import test from "node:test";
import assert from "node:assert/strict";
import {availability,notificationText,RETENTION_MS} from "../src/app/apps/geomap/notification-policy.ts";
const completedAt="2026-11-28T10:00:00Z",t=Date.parse(completedAt);
test("exact seven days, reminder window, expiry",()=>{assert.equal(availability(completedAt,t).expiresAt,"2026-12-05T10:00:00.000Z");assert.equal(availability(completedAt,t+RETENTION_MS-86400000).reminderDue,true);assert.equal(availability(completedAt,t+RETENTION_MS).available,false);assert.equal(availability(completedAt,t+RETENTION_MS).deleteDue,true);});
test("authenticated project link, no stale notification",()=>{const i={projectName:"Teste",projectId:"00000000-0000-4000-8000-000000000001",completedAt,nowMs:t,origin:"https://www.mbalabs.com.br",event:"completed"};assert.match(notificationText(i).text,/https:\/\/www\.mbalabs\.com\.br\/apps\/geomap\/projetos\//);assert.equal(notificationText({...i,event:"reminder"}),null);assert.equal(notificationText({...i,nowMs:t+RETENTION_MS}),null);assert.throws(()=>notificationText({...i,origin:"http://example.com"}));});
