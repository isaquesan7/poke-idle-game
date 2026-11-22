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
/** D064BO: o foco da viewport é o campo de combate, nunca o topo da página. */
async function expectStageFocused(page){
  await page.waitForFunction(()=>{
    const stage=document.querySelector('[data-testid="battle-stage"]');
    if(!stage||document.activeElement!==stage)return false;
    const rect=stage.getBoundingClientRect();
    return rect.bottom>0&&rect.top<innerHeight;
  });
}
async function expectCaptureFocused(page){
  await page.waitForFunction(()=>{
    const capture=document.querySelector('[data-testid="battle-capture-area"]');
    if(!capture||document.activeElement!==capture)return false;
    const rect=capture.getBoundingClientRect();
    return rect.bottom>0&&rect.top<innerHeight;
  });
}
async function expectAgainFocused(page){
  await page.waitForFunction(()=>{
    const button=document.querySelector('[data-testid="battle-again-button"]');
    if(!button||button.disabled||document.activeElement!==button)return false;
    const rect=button.getBoundingClientRect();
    return rect.bottom>0&&rect.top<innerHeight;
  });
}
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
    // A rota /regions inicia na seção de regiões, não em Visão geral.
    await page.getByRole('region',{name:'Escolha de região'}).waitFor();
    await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k))?.revision===0,key);
    // D064BQ: loja com preços beta; saldo demo 200 não autoriza comprar Poké Ball 600.
    const shopBefore=await page.evaluate(k=>localStorage.getItem(k),key);
    await page.getByRole('button',{name:'Loja',exact:true}).click();
    const shop=page.getByTestId('shop-preview');
    await shop.waitFor();
    assert.equal(await shop.getByTestId('shop-item-poke-ball').count(),1);
    assert.equal(await shop.getByTestId('shop-item-great-ball').count(),1);
    assert.equal(await shop.getByTestId('shop-item-ultra-ball').count(),1);
    assert.equal(await shop.getByText('600 moedas').count(),1);
    assert.equal(await shop.getByText('2.400 moedas').count(),1);
    assert.equal(await shop.getByText('16.000 moedas').count(),1);
    assert.equal(await shop.getByRole('button',{name:/Comprar/}).count(),3);
    assert.equal(await shop.getByTestId('shop-buy-poke-ball').isDisabled(),true,
      'saldo de 200 moedas deve impedir compra de Poké Ball 600');
    assert.equal(await shop.getByTestId('shop-buy-great-ball').isDisabled(),true);
    assert.equal(await shop.getByTestId('shop-buy-ultra-ball').isDisabled(),true);
    // A chance exibida vem da mesma função de drop que o writer usa.
    const odds=shop.getByTestId('shop-drop-chances');
    await odds.waitFor();
    assert.deepEqual(await odds.locator('tbody tr').allTextContents(),[
      '1–330%0%0%','4–625%14%0%','7–818%14%5%','9–1018%14%7%'
    ]);
    assert.equal(await shop.getByText(/Não existe vitória/).count(),1);
    assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),shopBefore);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    await page.screenshot({path:new URL('shop-'+device+'.png',folder).pathname,fullPage:true});
    await page.getByRole('button',{name:'Regiões',exact:true}).click();
    await page.getByRole('heading',{name:'Suas regiões'}).waitFor();
    const grid=page.getByRole('region',{name:'Escolha de região'});
    assert.equal(await grid.getByRole('button',{name:/ÁREA \d+/}).count(),10);
    await grid.getByRole('button',{name:/ÁREA 09/}).click();
    await page.getByRole('heading',{name:'Pico Dracônico'}).waitFor();
    assert.equal(await page.getByRole('button',{name:/Entrar na região/}).isDisabled(),true);
    await grid.getByRole('button',{name:/ÁREA 04/}).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('heading',{name:'Lagos Serenos'}).waitFor();
    assert.equal(await page.getByRole('button',{name:/Entrar na região/}).isDisabled(),false);
    const selected=grid.getByRole('button',{name:/ÁREA 04/});
    assert.equal(await selected.getAttribute('aria-pressed'),'true');
    const before=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
    // Navegação e consulta não podem alterar a revisão nem saldo.
    await grid.getByRole('button',{name:/ÁREA 03/}).click();
    await grid.getByRole('button',{name:/ÁREA 04/}).click();
    const consulted=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
    assert.deepEqual(consulted,before);
    await page.getByRole('button',{name:/Entrar na região/}).click();
    await page.getByRole('heading',{name:'Batalha nos Lagos Serenos'}).waitFor();
    assert.equal(await page.getByTestId('battle-stage').getByText('Encontro surpresa').count(),1);
    assert.equal(await page.getByRole('heading',{name:'Batalha em andamento…'}).count(),0);
    assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key),consulted,
      'entrar na região não pode sortear adversário nem alterar save');
    await page.getByRole('button',{name:'Batalhar na região'}).click();
    await expectStageFocused(page);
    assert.equal(await page.getByRole('button',{name:'Arena',exact:true}).count(),0);
    await page.getByRole('heading',{name:'Pokémon encontrados nesta área'}).waitFor();
    assert.equal(await page.locator('[class*="encounterGrid"] [class*="encounterCard"]').count(),18);
    await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k))?.revision===1,key);
    const staged=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
    const pending=JSON.parse(staged.journal.raw);
    assert.equal(staged.journal.revision,0,'o diário não concede resultados antes de terminar');
    assert.ok(pending.pendingBattle);
    assert.equal(pending.pendingBattle.preview.regionId,4);
    await page.getByRole('button',{name:'Pular apresentação'}).click();
    await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k))?.revision===2,key);
    let after=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
    let game=JSON.parse(after.journal.raw);
    assert.equal(after.journal.revision,1);
    assert.equal(after.journal.receipts.length,1);
    assert.equal(game.lastBattle.regionId,4);
    assert.equal(game.lastBattle.regionName,'Lagos Serenos');
    assert.equal(game.lastBattle.log.length,game.lastBattle.frames.length);
    if(game.lastBattle.captureStatus!=='available')await expectAgainFocused(page);
    if(game.lastBattle.captureStatus==='available'){
      await expectCaptureFocused(page);
      await page.getByRole('button',{name:'Seguir sem capturar'}).click();
      await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k))?.revision===3,key);
      await expectAgainFocused(page);
      after=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
      game=JSON.parse(after.journal.raw);
    }
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
    // O teste avança o nível SOMENTE no save de teste para validar Costa Oceânica;
    // o jogo real continuará desbloqueando pela curva do treinador.
    await page.evaluate(k=>{
      const snapshot=JSON.parse(localStorage.getItem(k));
      const game=JSON.parse(snapshot.journal.raw);
      game.trainer.level=55;
      snapshot.journal.raw=JSON.stringify(game);
      localStorage.setItem(k,JSON.stringify(snapshot));
    },key);
    await page.reload();
    await page.getByRole('heading',{name:'Suas regiões'}).waitFor();
    const coastal=page.getByRole('region',{name:'Escolha de região'});
    await coastal.getByRole('button',{name:/ÁREA 07/}).click();
    await page.getByRole('button',{name:/Entrar na região/}).click();
    await page.getByRole('heading',{name:'Batalha na Costa Oceânica'}).waitFor();
    await page.getByRole('button',{name:'Batalhar na região'}).click();
    await expectStageFocused(page);
    await page.waitForFunction(({key,revision})=>JSON.parse(localStorage.getItem(key))?.revision===revision,
      {key,revision:after.revision+1});
    const coastalStage=JSON.parse((await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key)).journal.raw);
    assert.equal(coastalStage.pendingBattle.preview.regionId,7);
    await page.getByRole('button',{name:'Pular apresentação'}).click();
    await page.waitForFunction(({key,revision})=>JSON.parse(localStorage.getItem(key))?.revision===revision,
      {key,revision:after.revision+2});
    const coast=JSON.parse((await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key)).journal.raw);
    assert.equal(coast.lastBattle.regionId,7);
    assert.ok([77,78,83,84,85,134,135,136,138,3,6,9].includes(coast.lastBattle.wildSpeciesId));
    assert.equal(await page.locator('[class*="encounterGrid"] [class*="encounterCard"]').count(),12);
    assert.equal(await page.getByText('Pokémon encontrados nesta área').count(),1);
    await page.getByRole('button',{name:'Voltar às regiões'}).click();
    await page.getByRole('heading',{name:'Suas regiões'}).waitFor();
    assert.deepEqual(errors,[],'Sem erros JavaScript na rota /regions');
    await context.close();
  }
}finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
}
