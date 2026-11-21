/** D-064AI — E2E da tela jogável Regiões (desktop/mobile + save real). */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const root=new URL('../../../../',import.meta.url);
const folder=new URL('artifacts/regions/',root);
await mkdir(folder,{recursive:true});
const port=43123,base='http://127.0.0.1:'+port,key='kanto-idle-play-v02';
const server=spawn(process.execPath,[new URL('server.mjs',root).pathname],{
  cwd:root.pathname,env:{...process.env,PORT:String(port)},stdio:'pipe'
});
let stderr='';
server.stderr.on('data',data=>stderr+=String(data));
async function ready(){
  for(let i=0;i<80;i++){
    try{if((await fetch(base+'/health')).ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
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
    const response=await page.goto(base+'/regions',{waitUntil:'domcontentloaded'});
    assert.equal(response?.status(),200);
    await page.getByLabel('Nome do treinador').fill('Explorador Regional');
    await page.getByRole('radio',{name:/Bulbasaur/}).check();
    await page.getByRole('checkbox',{name:/modo demonstração/}).check();
    await page.getByRole('button',{name:'Começar aventura'}).click();
    await page.getByRole('button',{name:'Regiões',exact:true}).click();
    await page.getByRole('heading',{name:'Suas regiões'}).waitFor();
    const grid=page.getByRole('region',{name:'Escolha de região'});
    assert.equal(await grid.getByRole('button').count(),10);
    await grid.getByRole('button',{name:/ÁREA 09/}).click();
    await page.getByRole('heading',{name:'Pico Dracônico'}).waitFor();
    assert.equal(await page.getByRole('button',{name:/Batalhar em Pico Dracônico/}).isDisabled(),true);
    await grid.getByRole('button',{name:/ÁREA 04/}).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('heading',{name:'Lagos Serenos'}).waitFor();
    assert.equal(await page.getByRole('button',{name:/Batalhar em Lagos Serenos/}).isDisabled(),false);
    const selected=grid.getByRole('button',{name:/ÁREA 04/});
    assert.equal(await selected.getAttribute('aria-pressed'),'true');
    const before=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
    // Navegação e consulta não podem alterar a revisão nem saldo.
    await grid.getByRole('button',{name:/ÁREA 03/}).click();
    await grid.getByRole('button',{name:/ÁREA 04/}).click();
    const consulted=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
    assert.deepEqual(consulted,before);
    await page.getByRole('combobox',{name:'Pokébola para captura regional'}).selectOption('poke-ball');
    await page.getByRole('button',{name:/Batalhar em Lagos Serenos/}).click();
    await page.getByRole('heading',{name:'Arena de batalha'}).waitFor();
    await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k))?.revision===1,key);
    const after=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
    const game=JSON.parse(after.journal.raw);
    assert.equal(after.revision,1);
    assert.equal(after.journal.revision,1);
    assert.equal(after.journal.receipts.length,1);
    assert.equal(game.lastBattle.regionId,4);
    assert.equal(game.lastBattle.regionName,'Lagos Serenos');
    assert.equal(game.lastBattle.log.length,game.lastBattle.frames.length);
    await page.getByRole('button',{name:'Regiões',exact:true}).click();
    await page.getByRole('heading',{name:'Suas regiões'}).waitFor();
    await page.getByText(/Vitórias regionais/).waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,
      'Tela regional não pode ter scroll horizontal');
    await page.screenshot({path:new URL('preview-'+device+'.png',folder).pathname,fullPage:true});
    await page.reload();
    await page.getByRole('heading',{name:'Suas regiões'}).waitFor();
    const persisted=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
    assert.deepEqual(persisted,after,'Voltar a Regiões não duplica recompensas ou gasto de bola');
    assert.deepEqual(errors,[],'Sem erros JavaScript na rota /regions');
    await context.close();
  }
}finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
}
