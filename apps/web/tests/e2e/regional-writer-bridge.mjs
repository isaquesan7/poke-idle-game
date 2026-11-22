/** D-064AG: jornada regional escrita pelo mesmo writer da Arena. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const root=new URL('../../../../',import.meta.url);
const port=43125,base='http://127.0.0.1:'+port,key='kanto-idle-play-v02';
const server=spawn(process.execPath,[new URL('server.mjs',root).pathname],{
  cwd:root.pathname,env:{...process.env,PORT:String(port)},stdio:'pipe'
});
let stderr='';
server.stderr.on('data',value=>stderr+=String(value));
async function ready(){
  for(let i=0;i<80;i++){
    try{if((await fetch(base+'/health')).ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw Error('Servidor não iniciou: '+stderr);
}
let browser;
try{
  await ready();
  browser=await chromium.launch({headless:true});
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    const context=await browser.newContext({viewport});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/play',{waitUntil:'domcontentloaded'});
    await page.getByLabel('Nome do treinador').fill('Treinador Regional');
    await page.getByRole('radio',{name:/Bulbasaur/}).check();
    await page.getByRole('checkbox',{name:/modo demonstração/}).check();
    await page.getByRole('button',{name:'Começar aventura'}).click();
    await page.getByRole('heading',{name:'Bem-vindo de volta, Treinador Regional!'}).waitFor();
    await page.getByRole('button',{name:'Regiões',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Arena',exact:true}).count(),0);
    const region=page.getByRole('region',{name:'Escolha de região'});
    await region.waitFor();
    await region.getByRole('button',{name:/ÁREA 05/}).click();
    assert.equal(await page.getByRole('button',{name:/Batalhar em Planícies Elétricas/}).isDisabled(),true,
      'Região 5 deve estar bloqueada para treinador nível 21');
    await region.getByRole('button',{name:/ÁREA 04/}).click();
    const before=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
    await page.getByRole('button',{name:/Batalhar em Lagos Serenos/}).click();
    await page.getByRole('heading',{name:'Batalha nos Lagos Serenos'}).waitFor();
    await page.waitForFunction(()=>scrollY===0);
    await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k))?.revision===1,key);
    const staged=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
    const stagedGame=JSON.parse(staged.journal.raw);
    assert.equal(staged.journal.revision,0,'começar apresentação não paga antecipadamente');
    assert.equal(stagedGame.wins,JSON.parse(before.journal.raw).wins);
    assert.equal(stagedGame.trainer.level,JSON.parse(before.journal.raw).trainer.level);
    assert.ok(stagedGame.pendingBattle);
    await page.getByRole('button',{name:'Pular apresentação'}).click();
    await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k))?.revision===2,key);
    const after=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
    const game=JSON.parse(after.journal.raw);
    assert.equal(after.revision,2);
    assert.equal(after.journal.revision,1);
    assert.equal(after.journal.receipts.length,1);
    assert.equal(game.pendingBattle,undefined);
    assert.equal(game.lastBattle.regionId,4);
    assert.equal(game.lastBattle.regionName,'Lagos Serenos');
    assert.ok(game.lastBattle.wildSpeciesId>=1&&game.lastBattle.wildSpeciesId<=151);
    assert.ok(game.lastBattle.wildLevel>=31&&game.lastBattle.wildLevel<=40);
    assert.equal(game.lastBattle.log.length,game.lastBattle.frames.length);
    assert.ok(game.ballPocket&&game.ballPocket.version===1);
    assert.equal(game.regionWins.length,10);
    assert.ok(game.lastBattle.battleId.startsWith('regional-v02-'));
    await page.reload();
    const persisted=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
    assert.deepEqual(persisted,after,'Reabrir não duplica recompensa regional');
    assert.notEqual(before.journal.raw,after.journal.raw);
    // D064BE: em encontro de nível baixo, jogador decide APÓS revelar espécie.
    await page.getByRole('button',{name:'Regiões',exact:true}).click();
    if(game.lastBattle.captureStatus==='available'){
      await page.getByRole('region',{name:'Escolha de região'})
        .getByRole('button',{name:/ÁREA 04/}).click();
      await page.getByRole('button',{name:'Rever último combate nesta região'}).click();
      await page.getByRole('button',{name:'Seguir sem capturar'}).click();
      await page.getByRole('button',{name:'Regiões',exact:true}).click();
    }
    await page.getByRole('region',{name:'Escolha de região'})
      .getByRole('button',{name:/ÁREA 01/}).click();
    await page.evaluate(()=>{
      const original=window.crypto.getRandomValues.bind(window.crypto);
      Object.defineProperty(window.crypto,'getRandomValues',{
        configurable:true,value(array){
          if(array instanceof Uint32Array&&array.length===1){array[0]=3;return array;}
          return original(array);
        }
      });
    });
    await page.getByRole('button',{name:/Batalhar em Bosque Inicial/}).click();
    await page.getByRole('heading',{name:'Batalha no Bosque Inicial'}).waitFor();
    const pending=await page.evaluate(k=>JSON.parse(JSON.parse(localStorage.getItem(k)).journal.raw).pendingBattle,key);
    assert.ok(pending,'o segundo encontro ainda não pagou recompensas');
    assert.equal(pending.preview.wildSpeciesId,54,'seed fixa seleciona Psyduck');
    await page.getByRole('button',{name:'Pular apresentação'}).click();
    await page.getByRole('heading',{name:'Vitória!'}).waitFor();
    const confirmed=await page.evaluate(k=>JSON.parse(JSON.parse(localStorage.getItem(k)).journal.raw),key);
    assert.equal(confirmed.lastBattle.captureStatus,'available');
    const stockBefore=confirmed.ballPocket.quantities['poke-ball'];
    await page.getByRole('combobox',{name:'Pokébola para captura após batalha'}).selectOption('poke-ball');
    await page.getByRole('button',{name:/Tentar capturar \(1 tentativa\)/}).click();
    await page.waitForFunction(k=>{
      const saved=JSON.parse(JSON.parse(localStorage.getItem(k)).journal.raw);
      return ['caught','escaped'].includes(saved.lastBattle.captureStatus);
    },key);
    const attempt=await page.evaluate(k=>JSON.parse(JSON.parse(localStorage.getItem(k)).journal.raw),key);
    assert.equal(attempt.ballPocket.quantities['poke-ball'],stockBefore-1);
    assert.ok(['caught','escaped'].includes(attempt.lastBattle.captureStatus));
    assert.equal(await page.getByRole('button',{name:/Tentar capturar \(1 tentativa\)/}).count(),0);
    const singleAttemptSave=await page.evaluate(k=>localStorage.getItem(k),key);
    await page.reload();
    assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),singleAttemptSave,
      'reload não pode conceder segunda tentativa nem prêmio');
    assert.deepEqual(errors,[]);
    await context.close();
  }
}finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
}
