import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {ExpeditionScreen} from '../src/play/ExpeditionScreen';
import {expeditionElapsedMs,formatExpeditionDuration,timeUntilAffinityLoss} from '../src/play/expeditionDisplay';

const started=1_800_000_000_000;
const base={
  expedition:null,
  regionName:'Bosque Inicial',
  options:[{id:1,name:'Bosque Inicial',trainerUnlockLevel:1,levelMin:2,unlocked:true},
           {id:4,name:'Lagos Serenos',trainerUnlockLevel:20,levelMin:31,unlocked:false}],
  selectedRegionId:1,
  onSelectRegion:(_id:number)=>{},
  leaderName:'Dragonair',leaderLevel:41,activePokemonLevel:41,leaderArt:<span>GIF Dragonair</span>,
  pending:null,nowMs:started,busy:false,
  onStart:()=>{},onClaim:()=>{},onStop:()=>{}
} as const;

describe('D064BH — cronômetro de expedição',()=>{
  it('formata duração cumulativa acima de 24h, sem 24h rollover',()=>{
    expect(formatExpeditionDuration(0)).toBe('00:00:00');
    expect(formatExpeditionDuration(999)).toBe('00:00:00');
    expect(formatExpeditionDuration(10_000)).toBe('00:00:10');
    expect(formatExpeditionDuration(3_661_000)).toBe('01:01:01');
    expect(formatExpeditionDuration(32*3_600_000+125_000)).toBe('32:02:05');
    expect(expeditionElapsedMs(started,started+32*3_600_000)).toBe(32*3_600_000);
    expect(expeditionElapsedMs(started,started-1000)).toBe(0);
    expect(expeditionElapsedMs(-1,started)).toBe(0);
  });
  it('antes do início exibe zero e seletor com regiões bloqueadas',()=>{
    const html=renderToStaticMarkup(<ExpeditionScreen {...base}/>);
    expect(html).toContain('Expedição de Kanto');
    expect(html).toContain('00:00:00');
    expect(html).toContain('Região para expedição');
    expect(html).toContain('Iniciar expedição');
    expect(html).toContain('Lagos Serenos');
    expect(html).toContain('disabled=""');
  });
  it('tempo total não zera com resgates, mas recursos usam apenas período desde lastClaimAt',()=>{
    const html=renderToStaticMarkup(<ExpeditionScreen {...base}
      expedition={{startedAt:started,lastClaimAt:started+10*3_600_000,regionId:1,teamUids:[1]}}
      nowMs={started+11*3_600_000+31_000}
      pending={{cycles:363,coins:2541,trainerXp:1452,pokemonXpPerMember:1815}}
      />);
    expect(html).toContain('Expedição em andamento');
    expect(html).toContain('11:00:31');
    expect(html).toContain('01:00:31');
    expect(html).toContain('Resgatar recompensas');
    expect(html).toContain('Encerrar expedição');
    expect(html).toContain('2541');
    expect(html).toContain('363');
    expect(html).toContain('08:00:00');
  });
  it('cap de recompensa não congela o tempo total',()=>{
    const html=renderToStaticMarkup(<ExpeditionScreen {...base}
      expedition={{startedAt:started,lastClaimAt:started,teamUids:[1]}}
      nowMs={started+27*3_600_000} pending={{cycles:2880,coins:20160,trainerXp:11520,pokemonXpPerMember:14400}} />);
    expect(html).toContain('27:00:00');
    expect(html).toContain('08:00:00 / 08:00:00');
  });
  it('D064BI: seletor possui dica, ações bloqueadas e nomes acessíveis',()=>{
    const html=renderToStaticMarkup(<ExpeditionScreen {...base} busy />);
    expect(html).toContain('aria-labelledby="expedition-title"');
    expect(html).toContain('aria-describedby="expedition-region-hint"');
    expect(html).toContain('A expedição não inicia ao mudar a seleção.');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('aria-live="off"');
  });
  it('D064BI: no teto 8h avisa resgate e não anuncia próximo ciclo inexistente',()=>{
    const html=renderToStaticMarkup(<ExpeditionScreen {...base}
      expedition={{startedAt:started,lastClaimAt:started,teamUids:[1]}}
      nowMs={started+8*3_600_000} pending={{cycles:2880,coins:20160,trainerXp:11520,pokemonXpPerMember:14400}} />);
    expect(html).toContain('Limite de 8 horas de recompensas atingido');
    expect(html).not.toContain('Próximo ciclo em');
    expect(html).not.toContain('aria-label="Progresso para o próximo ciclo"');
    expect(html).toContain('08:00:00');
  });
  it('D064BK: informa quando arredondamento zera as recompensas e pausa os contadores',()=>{
    const html=renderToStaticMarkup(<ExpeditionScreen {...base}
      selectedRegionId={3}
      options={[{id:3,name:'Caverna Rochosa',trainerUnlockLevel:12,levelMin:21,unlocked:true}]}
      activePokemonLevel={41}
      ballProgress={{'poke-ball':1439,'great-ball':0,'ultra-ball':0}}
      pending={{cycles:2880,coins:0,trainerXp:0,pokemonXpPerMember:0,
        ballProgress:{'poke-ball':1439,'great-ball':0,'ultra-ball':0}}}
    />);
    expect(html).toContain('Esta região não gera moedas nem XP por ciclo');
    expect(html).toContain('O progresso de Pokébolas também fica pausado');
    expect(html).toContain('Contadores pausados nesta região');
    expect(html).toContain('Poké Ball: <b>1 ciclo</b>');
  });
  it('D064BK: exibe o próximo marco real das três bolas em áreas superiores',()=>{
    const html=renderToStaticMarkup(<ExpeditionScreen {...base}
      selectedRegionId={9} activePokemonLevel={81}
      options={[{id:9,name:'Pico Dracônico',trainerUnlockLevel:82,levelMin:81,unlocked:true}]}
      ballProgress={{'poke-ball':1439,'great-ball':2879,'ultra-ball':8639}}
    />);
    expect(html).toContain('Ciclos elegíveis para as próximas Pokébolas');
    expect(html).toContain('Poké Ball: <b>1 ciclo</b>');
    expect(html).toContain('Great Ball: <b>1 ciclo</b>');
    expect(html).toContain('Ultra Ball: <b>1 ciclo</b>');
    expect(html).not.toContain('Contadores pausados nesta região');
  });
  it('próxima perda de afinidade usa última atividade e dias já cobrados',()=>{
    const D=86_400_000;
    expect(timeUntilAffinityLoss(started,started,0)).toBe(2*D);
    expect(timeUntilAffinityLoss(started,started+D,0)).toBe(D);
    expect(timeUntilAffinityLoss(started,started+2*D,1)).toBe(D);
    expect(timeUntilAffinityLoss(started,started+3*D,1)).toBe(0);
    expect(timeUntilAffinityLoss(-1,started,0)).toBe(0);
  });
});
