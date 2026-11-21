/** D-064AE — E2E desktop/mobile de catálogo read-only. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const root=new URL('../../../../',import.meta.url);
const folder=new URL('artifacts/regions/',root);
await mkdir(folder,{recursive:true});
const port=43123;
const base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,[new URL('server.mjs',root).pathname],{
  cwd:root.pathname,env:{...process.env,PORT:String(port)},stdio:'pipe'
});
let stderr='';
server.stderr.on('data',data=>{stderr+=String(data);});
async function ready(){
  for(let i=0;i<80;i++){
    try{if((await fetch(base+'/health')).ok)return;}catch{}
    await new Promise(r=>setTimeout(r,250));
  }
  throw Error('Servidor /regions indisponível: '+stderr);
}
let browser;
try{
  await ready();
  browser=await chromium.launch({headless:true});
  for(const [device,viewport] of [
    ['desktop',{width:1440,height:900}],
    ['mobile',{width:390,height:844}]
  ]){
    const context=await browser.newContext({viewport});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      localStorage.setItem('kanto-idle-play-v02','DO-NOT-ALTER-REGIONAL-PREVIEW');
      localStorage.setItem('kanto-idle-lab-save-v01','DO-NOT-ALTER-LEGACY');
    });
    const response=await page.goto(base+'/regions',{waitUntil:'domcontentloaded'});
    assert.equal(response?.status(),200);
    await page.getByRole('heading',{name:'Explore as regiões de Kanto'}).waitFor();
    const before=await page.evaluate(()=>JSON.stringify(Object.entries(localStorage).sort()));
    const sections=page.getByRole('region',{name:'Catálogo de regiões'});
    assert.equal(await sections.getByRole('button').count(),10);
    await sections.getByRole('button',{name:/Área 09/}).click();
    await page.getByRole('heading',{name:'Pico Dracônico'}).waitFor();
    assert.equal(await sections.getByRole('button',{name:/Área 09/}).getAttribute('aria-pressed'),'true');
    await sections.getByRole('button',{name:/Área 10/}).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('heading',{name:'Santuário Lendário'}).waitFor();
    await page.getByText('Estes requisitos são preliminares').waitFor();
    assert.equal(await page.getByRole('button',{name:/Capturar agora|Iniciar batalha|Receber recompensa/}).count(),0);
    // D-064AF: executar motor real em sandbox, sem recompensas ou save.
    await page.getByRole('combobox',{name:'Seu Pokémon'}).selectOption('7');
    await page.getByRole('combobox',{name:'Nível de demonstração'}).selectOption('100');
    await page.getByRole('button',{name:'Simular encontro'}).click();
    const preview=page.getByTestId('regional-demo-result');
    await preview.waitFor();
    await preview.getByRole('button',{name:'Ver resultado completo'}).click();
    await preview.getByText(/Demonstração encerrada após/).waitFor();
    assert.equal(await preview.getByText(/Captura! |Recompensas de combate recebidas/).count(),0,
      'A prévia não pode reivindicar recompensas reais ou captura');
    const after=await page.evaluate(()=>JSON.stringify(Object.entries(localStorage).sort()));
    assert.equal(after,before,'Catálogo jamais deve escrever em localStorage');
    assert.deepEqual(errors,[],'Catálogo deve abrir sem erros JS');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,
      'Não pode haver scroll horizontal na prévia');
    await page.screenshot({path:new URL('preview-'+device+'.png',folder).pathname,fullPage:true});
    await context.close();
  }
}finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
}
