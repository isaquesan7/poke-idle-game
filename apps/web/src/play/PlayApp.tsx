import { useEffect, useState } from 'react';
import {
  EXPEDITION_CYCLE_MS, expeditionRewards, LEGACY_EQUIPMENT_SLOTS,
  LEGACY_ITEMS, LEGACY_STARTERS, STATS, legacyPokemonManualBudget
} from '@kanto/game-core';
import type { Stat, EquipmentSlot } from '@kanto/game-core';
import { projectLegacyTrainer, STAT_LABELS } from '../features/trainer/legacyProjection';
import { parseLegacySave } from '../storage/legacySave';
import {
  PLAY_LOCK_NAME, PLAY_SAVE_KEY, createPlaySave, readPlaySave,
  resetPlaySave, updatePlaySave
} from './playSave';
import type { PlayAction, PlayRead, PlayWrite } from './playSave';
import styles from './PlayApp.module.css';

type Tab = 'overview' | 'trainer' | 'pokemon' | 'expedition';
const STARTERS = [
  { id: 1, type: 'Grama / Veneno', hint: 'Resistente e equilibrado' },
  { id: 4, type: 'Fogo', hint: 'Ataque e velocidade' },
  { id: 7, type: 'Água', hint: 'Defesa e resistência' }
] as const;

function readSafe(): PlayRead {
  try { return readPlaySave(window.localStorage); }
  catch { return { status: 'unavailable' }; }
}

/** GIFs locais na rota pública; arte estática só se um GIF não carregar. */
function PokemonArt({ id, name, large = false }: {
  id: number; name: string; large?: boolean
}) {
  return (
    <img
      className={large ? styles.pokemonLarge : styles.pokemonArt}
      src={`/assets/pokemon-gifs/poke_${id}.gif`}
      onError={event => {
        const image = event.currentTarget;
        image.onerror = null;
        image.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
      }}
      alt={name}
      loading="lazy"
    />
  );
}

function sectionName(tab: Tab): string {
  return { overview: 'Visão geral', trainer: 'Treinador', pokemon: 'Pokémon', expedition: 'Expedição' }[tab];
}

/**
 * Primeira experiência v0.2 jogável: cria progresso, edita atributos e
 * recebe recursos idle na mesma chave local, sem simular vitória falsa.
 * A v0.1 existente não é importada nem modificada.
 */
export function PlayApp() {
  const [save, setSave] = useState<PlayRead>(readSafe);
  const [tab, setTab] = useState<Tab>('overview');
  const [name, setName] = useState('');
  const [starter, setStarter] = useState(1);
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const refresh = (event: StorageEvent) => {
      if (event.key === PLAY_SAVE_KEY || event.key === null) setSave(readSafe());
    };
    window.addEventListener('storage', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  /** Preferir Web Lock; sem suporte o modo alfa oferece revisão otimista local. */
  async function transact(callback: () => PlayWrite): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      const execute = () => callback();
      const outcome = navigator.locks?.request
        ? await navigator.locks.request(PLAY_LOCK_NAME, { mode: 'exclusive' }, execute)
        : execute();
      setSave(readSafe());
      setFeedback(outcome.status === 'ok' ? 'Progresso salvo neste navegador.' : outcome.reason);
    } catch {
      setSave(readSafe());
      setFeedback('O armazenamento não pôde ser atualizado. Verifique as permissões do navegador.');
    } finally { setBusy(false); }
  }

  function newGame() {
    void transact(() => createPlaySave(window.localStorage, name, starter, Date.now(), demo));
  }

  function dispatch(action: PlayAction): void {
    if (save.status !== 'ready') return;
    const expected = save.snapshot.revision;
    void transact(() => updatePlaySave(window.localStorage, expected, action));
  }

  function restart() {
    if (!window.confirm('Reiniciar apenas este teste v0.2? O progresso de teste atual será apagado.')) return;
    if (!resetPlaySave(window.localStorage)) {
      setFeedback('Não foi possível apagar o progresso de teste.');
      return;
    }
    setSave(readSafe());
    setTab('overview');
    setFeedback('Teste v0.2 reiniciado. O protótipo v0.1 não foi alterado.');
  }

  const parsed = save.status === 'ready' ? parseLegacySave(save.snapshot.journal.raw) : null;
  const data = parsed?.status === 'valid' ? parsed.save : null;
  const projected = data ? projectLegacyTrainer(data, null, now) : null;
  const view = projected?.status === 'ready' ? projected.value : null;
  const active = data?.roster.find(p => p.uid === data.team[0]) ?? data?.roster[0];
  const pokemonManual = active?.manual as Record<Stat, number> | undefined;
  const pokemonSpent = pokemonManual
    ? STATS.reduce((total, stat) => total + (pokemonManual[stat] || 0), 0) : 0;
  const pokemonBudget = active ? legacyPokemonManualBudget(active.level) : 0;
  const expedition = data?.expedition as { lastClaimAt: number; startedAt: number } | null | undefined;
  const pending = expedition
    ? expeditionRewards(Math.max(0, now - expedition.lastClaimAt)) : null;
  const nextCycle = expedition
    ? Math.max(0, Math.ceil((EXPEDITION_CYCLE_MS - Math.max(0, now - expedition.lastClaimAt) % EXPEDITION_CYCLE_MS) / 1000))
    : 0;

  if (save.status !== 'ready') {
    return (
      <main className={styles.setupShell} data-testid="play-root">
        <header className={styles.brand}><span className={styles.brandBall}>◉</span>KANTO <strong>IDLE</strong><span className={styles.alpha}>v0.2 ALPHA</span></header>
        <section className={styles.welcome}>
          <div className={styles.kicker}>UMA NOVA JORNADA EM KANTO</div>
          <h1>O começo da sua aventura.</h1>
          <p>Escolha seu parceiro, treine seus atributos e envie Pokémon em expedições para evoluir mesmo enquanto explora outras telas.</p>
          {save.status === 'absent' ? (
            <div className={styles.form}>
              <label className={styles.label} htmlFor="trainer-name">Nome do treinador</label>
              <input
                id="trainer-name" className={styles.input} maxLength={24}
                value={name} onChange={event => setName(event.target.value)}
                placeholder="Como devemos chamar você?" autoComplete="nickname"
              />
              <h2>Escolha seu Pokémon inicial</h2>
              <div className={styles.starters}>
                {STARTERS.map(option => {
                  const pokemon = LEGACY_STARTERS[option.id]!;
                  return (
                    <label key={option.id} className={starter === option.id ? styles.starterSelected : styles.starter}>
                      <input type="radio" name="starter" value={option.id}
                        checked={starter === option.id} onChange={() => setStarter(option.id)} />
                      <PokemonArt id={option.id} name={pokemon.name} />
                      <strong>{pokemon.name}</strong>
                      <span>{option.type}</span>
                      <small>{option.hint}</small>
                    </label>
                  );
                })}
              </div>
              <label className={styles.demoToggle}>
                <input type="checkbox" checked={demo} onChange={event => setDemo(event.target.checked)} />
                Começar no modo demonstração (níveis e pontos para testar)
              </label>
              <button className={styles.primary} type="button" disabled={busy || name.trim().length < 2}
                onClick={newGame}>Começar aventura</button>
            </div>
          ) : (
            <div className={styles.form} role="alert">
              <h2>O progresso local precisa de atenção</h2>
              <p>O armazenamento está {save.status === 'invalid' ? 'incompatível' : 'indisponível'}. Nenhum dado foi apagado automaticamente.</p>
              <button type="button" className={styles.secondary} onClick={() => setSave(readSafe())}>Tentar novamente</button>
              {save.status === 'invalid' && <button type="button" className={styles.secondary} onClick={restart}>Reiniciar teste v0.2</button>}
            </div>
          )}
          {feedback && <p role="status" className={styles.message}>{feedback}</p>}
          <p className={styles.disclaimer}>Versão alfa de testes: progresso salvo apenas neste navegador, sem contas ou sincronização. Regras e dados de teste poderão ser reiniciados antes do lançamento.</p>
        </section>
      </main>
    );
  }

  return (
    <div className={styles.appShell} data-testid="play-root">
      <aside className={styles.sidebar}>
        <div className={styles.brand}><span className={styles.brandBall}>◉</span>KANTO <strong>IDLE</strong><span className={styles.alpha}>ALPHA</span></div>
        <div className={styles.sidebarCaption}>SUA JORNADA</div>
        <nav className={styles.menu} aria-label="Navegação do jogo">
          {(['overview','trainer','pokemon','expedition'] as Tab[]).map(item => (
            <button type="button" key={item} aria-current={tab === item ? 'page' : undefined}
              className={tab === item ? styles.menuActive : styles.menuItem}
              onClick={() => { setTab(item); setFeedback(''); }}>{sectionName(item)}</button>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <p>Pré-lançamento v0.2</p>
          <p>Progresso local · {save.snapshot.revision} alterações</p>
          <button type="button" className={styles.resetButton} onClick={restart}>Reiniciar teste</button>
        </div>
      </aside>
      <div className={styles.content}>
        <header className={styles.topbar}>
          <div>
            <div className={styles.kicker}>REGIÃO DE KANTO · SEASON 1</div>
            <h1>{sectionName(tab)}</h1>
          </div>
          <div className={styles.trainerChip}><span className={styles.avatar}>★</span>
            <span><strong>{view?.name ?? data?.name}</strong><small>Nível {view?.level ?? '?'}</small></span>
            <span className={styles.coins}>◈ {data?.coins ?? 0}</span>
          </div>
        </header>
        {feedback && <div role="status" aria-live="polite" className={styles.message}>{feedback}</div>}
        {!view || !data || !active ? (
          <section className={styles.panel}>O perfil de teste não pôde ser projetado. Nenhum dado foi modificado.</section>
        ) : (
          <>
            {tab === 'overview' && (
              <>
                <section className={styles.hero}>
                  <div>
                    <div className={styles.kicker}>TREINADOR EM JORNADA</div>
                    <h2>Bem-vindo de volta, {view.name}!</h2>
                    <p>Seu parceiro está pronto. Continue sua jornada, distribua pontos e receba recompensas idle.</p>
                    <div className={styles.heroActions}>
                      <button type="button" className={styles.primary} onClick={() => setTab('expedition')}>
                        {expedition ? 'Ver expedição ativa' : 'Iniciar expedição'}</button>
                      <button type="button" className={styles.secondary} onClick={() => setTab('trainer')}>Meu treinador</button>
                    </div>
                  </div>
                  <PokemonArt id={active.pokemonId} name={view.active.name} large />
                </section>
                <div className={styles.metrics}>
                  <article className={styles.metric}><small>Treinador</small><strong>Lv. {view.level}</strong><span>{view.xpNext === null ? 'Nível máximo' : view.xp + ' / ' + view.xpNext + ' XP'}</span></article>
                  <article className={styles.metric}><small>Parceiro</small><strong>Lv. {active.level}</strong><span>{view.active.name}</span></article>
                  <article className={styles.metric}><small>Moedas</small><strong>{data.coins}</strong><span>Saldo da jornada</span></article>
                  <article className={styles.metric}><small>Pokédex</small><strong>{view.capturedSpecies}/151</strong><span>Espécies capturadas</span></article>
                </div>
                <div className={styles.twoColumn}>
                  <section className={styles.panel}>
                    <h2>Seu parceiro</h2>
                    <div className={styles.partner}>
                      <PokemonArt id={active.pokemonId} name={view.active.name} />
                      <div><strong>{view.active.name}</strong><p>UID #{active.uid} · Afinidade {active.affinity}%</p>
                      <p>{pokemonBudget - pokemonSpent} pontos de treinamento disponíveis</p>
                      <button type="button" className={styles.textButton} onClick={() => setTab('pokemon')}>Treinar Pokémon</button></div>
                    </div>
                  </section>
                  <section className={styles.panel}>
                    <h2>Expedição idle</h2>
                    <p>{expedition
                      ? 'Explorando Kanto · ' + (pending?.cycles ?? 0) + ' ciclos disponíveis para resgate'
                      : 'Envie seu parceiro em expedição para receber moedas e XP.'}</p>
                    <button type="button" className={styles.secondary} onClick={() => setTab('expedition')}>Abrir expedição</button>
                  </section>
                </div>
              </>
            )}
            {tab === 'trainer' && (
              <div className={styles.twoColumn}>
                <section className={styles.panel}>
                  <div className={styles.panelHeading}><h2>{view.name}</h2><span className={styles.levelTag}>Nível {view.level}</span></div>
                  <p>{view.title.name} · {view.unspent} ponto(s) para distribuir</p>
                  <div className={styles.progress} role="progressbar" aria-label="Experiência do treinador"
                    aria-valuemin={0} aria-valuemax={view.xpNext ?? 1}
                    aria-valuenow={view.xpNext === null ? 1 : view.xp}>
                    <span style={{width: (view.xpNext === null ? 100 : Math.min(100, view.xp / view.xpNext * 100)) + '%'}} />
                  </div>
                  <div className={styles.statList}>
                    {STATS.map(stat => (
                      <div className={styles.stat} key={stat}>
                        <span>{STAT_LABELS[stat]}</span><strong>{view.totals[stat]}</strong>
                        <small>{view.manual[stat]} manual</small>
                        <button type="button" disabled={busy || view.unspent < 1 || view.manual[stat] >= 40}
                          onClick={() => dispatch({type:'trainer',value:{type:'invest',stat}})}
                          aria-label={`Adicionar ponto em ${STAT_LABELS[stat]} do treinador`}>+1</button>
                      </div>
                    ))}
                  </div>
                </section>
                <section className={styles.panel}>
                  <h2>Equipamentos provisórios</h2>
                  <p>Itens de teste disponíveis para explorar os bônus. A economia definitiva será implementada depois.</p>
                  <div className={styles.equipmentList}>
                    {LEGACY_EQUIPMENT_SLOTS.map((slot: EquipmentSlot) => {
                      const trainer = data.trainer as Record<string, unknown>;
                      const equipped = (trainer.equipped ?? {}) as Record<string, string>;
                      return (
                        <label key={slot}><span>{slot}</span>
                          <select aria-label={`Equipamento: ${slot}`} disabled={busy}
                            value={equipped[slot] || ''}
                            onChange={event => dispatch({type:'trainer',value:{type:'equip',slot,itemId:event.target.value}})}>
                            <option value="">Sem equipamento</option>
                            {LEGACY_ITEMS.filter(item => item.slot === slot).map(item => (
                              <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  </div>
                  <p>Insígnias: {view.badges.length}/8 · Título: {view.title.name}</p>
                </section>
              </div>
            )}
            {tab === 'pokemon' && (
              <div className={styles.twoColumn}>
                <section className={styles.panel}>
                  <div className={styles.pokemonShowcase}>
                    <PokemonArt id={active.pokemonId} name={view.active.name} large />
                    <h2>{view.active.name} <span className={styles.levelTag}>Lv. {active.level}</span></h2>
                    <p>Instância #{active.uid} · Afinidade {active.affinity}%</p>
                    <p>Transferência de atributos do treinador: {view.active.ratePercent.toFixed(1)}%</p>
                  </div>
                </section>
                <section className={styles.panel}>
                  <h2>Treinamento Pokémon</h2>
                  <p>Pontos disponíveis: <strong>{pokemonBudget - pokemonSpent}</strong> de {pokemonBudget}</p>
                  <div className={styles.statList}>
                    {STATS.map((stat: Stat) => (
                      <div className={styles.stat} key={stat}>
                        <span>{STAT_LABELS[stat]}</span>
                        <strong>{view.active.stats?.[stat] ?? '—'}</strong>
                        <small>{pokemonManual?.[stat] ?? 0} manual</small>
                        <button type="button" disabled={busy || pokemonSpent >= pokemonBudget}
                          onClick={() => dispatch({type:'pokemon',value:{type:'invest-pokemon',uid:active.uid,stat}})}
                          aria-label={`Adicionar ponto em ${STAT_LABELS[stat]} do Pokémon`}>+1</button>
                      </div>
                    ))}
                  </div>
                  <button type="button" className={styles.secondary} disabled={busy || pokemonSpent === 0}
                    onClick={() => dispatch({type:'pokemon',value:{type:'reset-pokemon',uid:active.uid}})}>
                    Redistribuir pontos</button>
                </section>
              </div>
            )}
            {tab === 'expedition' && (
              <div className={styles.twoColumn}>
                <section className={styles.panel}>
                  <h2>{expedition ? 'Expedição em andamento' : 'Expedição de Kanto'}</h2>
                  <p>Seu Pokémon explora a região em ciclos de 10 segundos. Cada ciclo concede 7 moedas, 4 XP ao treinador e 5 XP ao Pokémon. O resgate acumula no máximo 8 horas por vez.</p>
                  <div className={styles.partner}><PokemonArt id={active.pokemonId} name={view.active.name} />
                    <div><strong>{view.active.name}</strong><p>Parceiro da equipe · Nível {active.level}</p></div>
                  </div>
                  {!expedition
                    ? <button type="button" className={styles.primary} disabled={busy}
                        onClick={() => dispatch({type:'start-expedition',nowMs:Date.now()})}>Iniciar expedição</button>
                    : <div className={styles.heroActions}>
                        <button type="button" className={styles.primary} disabled={busy || !pending?.cycles}
                          onClick={() => dispatch({type:'claim-expedition',nowMs:Date.now()})}>Resgatar recompensas</button>
                        <button type="button" className={styles.secondary} disabled={busy}
                          onClick={() => dispatch({type:'stop-expedition',nowMs:Date.now()})}>Encerrar expedição</button>
                      </div>}
                </section>
                <section className={styles.panel}>
                  <h2>Recompensas acumuladas</h2>
                  <div className={styles.metricsCompact}>
                    <div><small>Ciclos completos</small><strong>{pending?.cycles ?? 0}</strong></div>
                    <div><small>Moedas</small><strong>+{pending?.coins ?? 0}</strong></div>
                    <div><small>XP treinador</small><strong>+{pending?.trainerXp ?? 0}</strong></div>
                    <div><small>XP Pokémon</small><strong>+{pending?.pokemonXpPerMember ?? 0}</strong></div>
                  </div>
                  <p>{expedition ? 'Próximo ciclo em cerca de ' + nextCycle + 's' : 'Comece uma expedição para acumular recompensas.'}</p>
                  <p className={styles.disclaimer}>A versão alfa usa o relógio deste dispositivo e não possui proteção contra alterações locais.</p>
                </section>
              </div>
            )}
          </>
        )}
        <footer className={styles.footer}>Poke Idle Game · Alfa pré-lançamento · Pokémon e marcas pertencem aos seus titulares. Sem conta ou progresso em nuvem.</footer>
      </div>
    </div>
  );
}
