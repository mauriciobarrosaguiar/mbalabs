import {test,expect} from '@playwright/test';

// Real sessions supplied through secure, ephemeral test infrastructure; never bypass authentication.
const role=process.env.AGRODOC_QA_ROLE||'piloto';
const manager=['admin_empresa','gestor_operacional','responsavel_tecnico','rt'].includes(role);
const routes=[
 ['', 'Início','Início'],
 ['gestao','Operações','Ordens de serviço'],
 ['campo','Operações','Modo campo'],
 ['historico','Operações','Histórico'],
 ['fichas','Operações','Fichas de aplicação'],
 ...(manager?[
  ['conferencia','Operações','Conferência de operações'],
  ['cadastros','Cadastros','Visão dos cadastros'],
  ['pilotos','Cadastros','Pilotos'],
  ['equipe','Cadastros','Minha equipe'],
  ['configuracoes','Configurações','Configurações'],
 ]:[]),
 ['equipamentos','Cadastros','Drones e equipamentos'],
 ...(role==='admin_empresa'?[['funcionarios','Cadastros','Funcionários e acessos']]:[]),
 ['documentos','Documentação','Documentos'],
 ['diagnostico','Documentação','Diagnóstico e regularização'],
 ['regulacao','Documentação','Legislação e fontes'],
 ['relatorio-mensal','Documentação','Relatórios MAPA'],
 ['ferramentas','Ferramentas','MBA Calda e calculadoras'],
 ['produtos','Ferramentas','Defensivos e AGROFIT'],
 ['piloto-pro','Piloto Pro','Piloto Pro'],
 ['perfil-operacional','Configurações','Perfil operacional'],
 ['ajuda','Ajuda','Ajuda e como usar'],
];
const viewports=[{width:360,height:800},{width:390,height:844},{width:768,height:1024},{width:1024,height:768},{width:1440,height:900},{width:1920,height:1080}];

test.skip(!process.env.AGRODOC_BASE_URL||!process.env.AGRODOC_STORAGE_STATE,'Bloqueado: prévia e sessão específica do perfil não fornecidas.');

for(const viewport of viewports){
 test(`navegação ${role} ${viewport.width}x${viewport.height}`,async({page},info)=>{
  await page.setViewportSize(viewport);
  await page.goto('/apps/dronegestor');
  await expect(page).toHaveURL(/\/apps\/dronegestor$/);
  await expect(page.locator('.agro-page-content h1').first()).toBeVisible();
  for(const [path,group,title] of routes){
   const more=page.getByRole('button',{name:'Mais',exact:true});
   if(await more.isVisible())await more.click();
   const nav=page.getByRole('navigation',{name:'MBA DroneGestor',exact:true});
   const section=nav.locator('details').filter({has:page.getByText(group,{exact:true})}).first();
   if(await section.getAttribute('open')===null)await section.locator('summary').click();
   await nav.getByRole('link',{name:title,exact:true}).click();
   await expect(page).toHaveURL(new RegExp(`/apps/dronegestor${path?'/'+path:''}$`));
   await expect(page.locator('.agro-page-content h1').first()).toBeVisible();
   await expect(nav.locator('a[aria-current=page]')).toHaveCount(1);
   await expect(page.getByText('Application error: a server-side exception has occurred',{exact:false})).toHaveCount(0);
   const size=await page.evaluate(()=>({content:document.documentElement.scrollWidth,viewport:innerWidth}));
   expect(size.content,`${path}: horizontal overflow`).toBeLessThanOrEqual(size.viewport+2);
   // Actual browser rendering only. Includes viewport and module in filename.
   await page.screenshot({path:info.outputPath(`${role}-${path||'inicio'}-${viewport.width}x${viewport.height}.png`),fullPage:false});
  }
  await page.getByRole('link',{name:'Voltar ao início',exact:true}).click();
  await expect(page).toHaveURL(/\/apps\/dronegestor$/);
  if(await page.getByRole('button',{name:'Mais',exact:true}).isVisible()){
   await page.getByRole('button',{name:'Mais',exact:true}).click();
   await expect(page.locator('.agro-sidebar')).toHaveClass(/agro-sidebar-open/);
   await page.locator('.agro-sidebar').getByRole('button',{name:'Fechar menu',exact:true}).click();
   await expect(page.locator('.agro-sidebar')).not.toHaveClass(/agro-sidebar-open/);
  }
 });
}
// These read-only tests intentionally do not create, start, suspend, close or upload data remotely.
// API write permissions, offline recovery, physical keyboard and regulatory transitions need separate controlled runs.
