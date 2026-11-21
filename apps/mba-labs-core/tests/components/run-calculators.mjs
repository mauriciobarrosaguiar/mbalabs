/** Isolated component browser test; does not bypass or test app authentication. */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
const cssDir = new URL('../../.next/static/chunks/',import.meta.url);
const css = readdirSync(cssDir).filter(x=>x.endsWith('.css')).map(x=>readFileSync(new URL(x,cssDir),'utf8')).join('\n');
const server=createServer((req,res)=>{if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(readFileSync('/tmp/dronegestor-component.js'));}else{res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`);}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
console.log('Component URL: http://127.0.0.1:'+server.address().port);
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const errors=[],results=[];
const evidence=new URL('../../../../docs/evidence/dronegestor/',import.meta.url);mkdirSync(evidence,{recursive:true});
try{
 for(const width of [360,390,768,1024,1440,1920]){
  const page=await browser.newPage({viewport:{width,height:960}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByLabel('Área (ha)',{exact:true}).fill('10.1');
  await page.getByLabel('Taxa (L/ha)',{exact:true}).fill('10');
  await page.getByLabel('Tanque útil do drone (L)').fill('25');
  await page.getByLabel('Misturador útil (L)').fill('100');
  await page.getByLabel('Dose prescrita por hectare').fill('250');
  await page.getByRole('button',{name:'Calcular',exact:true}).click();
  await page.getByText('QUANTO COLOCAR NO MISTURADOR',{exact:true}).waitFor();
  if(!await page.getByText('2.500 mL do produto para 100 L de calda final',{exact:true}).isVisible())throw new Error('Quantidade no misturador incorreta');
  if(!await page.getByText('1 L — 25 mL do produto',{exact:true}).isVisible())throw new Error('Última mistura incorreta');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  if(overflow)throw new Error(`Overflow em ${width}`);
  await page.screenshot({path:new URL(`calculadoras-${width}.png`,evidence).pathname,fullPage:true});
  await page.getByRole('button',{name:'Vazão',exact:true}).click();
  await page.getByLabel('Velocidade (km/h)').fill('12');await page.getByLabel('Faixa efetiva total (m)').fill('6');
  await page.getByRole('button',{name:'Calcular',exact:true}).click();await page.getByText('1,2 L/min',{exact:true}).waitFor();
  await page.getByLabel('Velocidade (km/h)').fill('0');await page.getByRole('button',{name:'Calcular',exact:true}).click();await page.getByRole('alert').waitFor();
  results.push({width,mixer:true,partial:true,flow:true,invalidInput:true,overflow:false});await page.close();
 }
 if(errors.length)throw new Error(errors.join('\n'));
 writeFileSync(new URL('component-tests.json',evidence),JSON.stringify({scope:'Componentes isolados; não é E2E autenticado',results,errors},null,2));console.log(JSON.stringify({passed:results.length,results}));
}finally{await browser.close();server.close();}
