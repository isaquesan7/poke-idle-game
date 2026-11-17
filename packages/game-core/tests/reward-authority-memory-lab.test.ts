import { describe, expect, it } from 'vitest';
import fixture from '../../../tests/fixtures/legacy-save-v01.json';
import {
  RewardAuthorityMemoryLab
} from '../src/index.js';
import type { RewardCommand, RewardAuthorityLabClient } from '../src/index.js';

const raw = JSON.stringify({ ...fixture, extra: { keep: 'intocado' } });
type Battle = Extract<RewardCommand, { type: 'battle-result' }>;
type Start = Extract<RewardCommand, { type: 'start-expedition' }>;
type Claim = Extract<RewardCommand, { type: 'claim-expedition' }>;
type Stop = Extract<RewardCommand, { type: 'stop-expedition' }>;

function battle(id = 'battle-1', expectedRevision = 0): Battle {
  return {
    id, expectedRevision, type: 'battle-result',
    outcome: 'win', activeUid: 1, wildLevel: 10, affinityGain: 3,
    capture: { pokemonId: 25, moveName: 'thunder-shock' }
  };
}
function start(id = 'start', expectedRevision = 0, nowMs = 100000): Start {
  return { type: 'start-expedition', id, expectedRevision, nowMs };
}
function claim(id = 'claim', expectedRevision = 1, nowMs = 130000): Claim {
  return { type: 'claim-expedition', id, expectedRevision, nowMs };
}
function stop(id = 'stop', expectedRevision = 2, nowMs = 140000): Stop {
  return { type: 'stop-expedition', id, expectedRevision, nowMs };
}
function state(client: RewardAuthorityLabClient): typeof fixture & { extra: { keep: string } } {
  const journal = client.read();
  if (!journal) throw Error('journal de laboratório inválido');
  return JSON.parse(journal.raw) as typeof fixture & { extra: { keep: string } };
}

describe('autoridade serial em RAM: recibos e revisão únicos no mesmo Map', () => {
  it('não aceita save legado ausente, inválido ou versão desconhecida', () => {
    expect(() => new RewardAuthorityMemoryLab('{')).toThrow();
    expect(() => new RewardAuthorityMemoryLab(JSON.stringify({ ...fixture, version: 2 }))).toThrow();
    const lab = new RewardAuthorityMemoryLab(raw);
    expect(lab.snapshot()).toEqual({ raw, revision: 0, receipts: [] });
  });

  it('duas abas no mesmo laboratório disputam revision 0; somente UMA vence', async () => {
    const lab = new RewardAuthorityMemoryLab(raw);
    const a = lab.openClient();
    const b = lab.openClient();
    expect(a.read()?.revision).toBe(0);
    expect(b.read()?.revision).toBe(0);
    const results = await Promise.all([a.submit(battle('a')), b.submit(battle('b'))]);
    expect(results.map(r => r.status).sort()).toEqual(['applied', 'rejected']);
    expect(a.read()?.revision).toBe(1);
    expect(b.read()?.revision).toBe(1);
    expect(state(b).coins).toBe(376);
    expect(state(b).roster).toHaveLength(2);
    expect(state(b).nextUid).toBe(3);
    expect(a.read()?.receipts).toHaveLength(1);
    // O perdedor não pode promover seu snapshot anterior ao registro canônico.
    expect((await b.submit(battle('stale'))).status).toBe('rejected');
  });

  it('reenvio com mesmo ID/payload depois do commit NÃO concede novamente', async () => {
    const lab = new RewardAuthorityMemoryLab(raw);
    const a = lab.openClient();
    expect((await a.submit(battle())).status).toBe('applied');
    const after = a.read();
    expect((await a.submit(battle())).status).toBe('duplicate');
    expect(a.read()).toEqual(after);
    expect(state(a).coins).toBe(376);
    expect(state(a).roster).toHaveLength(2);
    expect(state(a).nextUid).toBe(3);
    expect((await a.submit({ ...battle(), wildLevel: 30 })).status).toBe('rejected');
    expect((await a.submit({ ...battle(), id: 'new-battle' })).status).toBe('rejected');
  });

  it('falha antes do commit não concede nada e permite retentativa do mesmo ID', async () => {
    const lab = new RewardAuthorityMemoryLab(raw);
    const client = lab.openClient();
    expect((await client.submit(battle(), 'before-commit')).status).toBe('interrupted');
    expect(client.read()?.revision).toBe(0);
    expect(state(client).coins).toBe(321);
    expect((await client.submit(battle())).status).toBe('applied');
    expect(state(client).coins).toBe(376);
  });

  it('perda de ACK após commit: segundo cliente recupera recibo por replay', async () => {
    const lab = new RewardAuthorityMemoryLab(raw);
    const a = lab.openClient();
    const b = lab.openClient();
    expect((await a.submit(battle(), 'after-commit')).status).toBe('interrupted');
    expect(b.read()?.revision).toBe(1); // commit ocorreu mesmo sem ACK
    expect((await b.submit(battle())).status).toBe('duplicate');
    expect(state(a).coins).toBe(376);
    expect(state(a).roster).toHaveLength(2);
    expect(a.read()?.receipts).toHaveLength(1);
    // Novo cliente simula refresh de aba, NÃO persistência entre processos.
    const afterRefresh = lab.openClient();
    expect((await afterRefresh.submit(battle())).status).toBe('duplicate');
  });

  it('snapshot entregue ao cliente é cópia; não permite injetar moedas ou recibos', async () => {
    const lab = new RewardAuthorityMemoryLab(raw);
    const client = lab.openClient();
    const copied = client.read() as { raw: string; revision: number; receipts: unknown[] };
    copied.raw = JSON.stringify({ ...fixture, coins: 999999 });
    copied.revision = 100;
    copied.receipts.push({ id: 'forged', fingerprint: 'forged' });
    expect(client.read()).toEqual({ raw, revision: 0, receipts: [] });
    expect((await client.submit(battle())).status).toBe('applied');
    expect(state(client).coins).toBe(376);
  });

  it('expedição serial: start, claim, stop e replays nunca pagam o mesmo ciclo', async () => {
    const lab = new RewardAuthorityMemoryLab(raw);
    const a = lab.openClient();
    const b = lab.openClient();
    expect((await a.submit(start())).status).toBe('applied');
    expect((await b.submit(start())).status).toBe('duplicate');
    expect((await a.submit(claim(), 'after-commit')).status).toBe('interrupted');
    expect((await b.submit(claim())).status).toBe('duplicate');
    expect(state(a).coins).toBe(342);
    expect(await b.submit(claim('other-claim', 2, 130000))).toMatchObject({ status: 'rejected' });
    expect((await a.submit(stop())).status).toBe('applied');
    expect(state(b).coins).toBe(349);
    expect(state(b).expedition).toBeNull();
    expect((await b.submit(stop())).status).toBe('duplicate');
    expect(await a.submit(claim('stale', 3, 150000))).toMatchObject({ status: 'rejected' });
    expect(a.read()?.revision).toBe(3);
  });

  it('corrupção detectada causa bloqueio; nunca recomeça com registro vazio', async () => {
    const lab = new RewardAuthorityMemoryLab(raw);
    const client = lab.openClient();
    expect((await client.submit(battle())).status).toBe('applied');
    lab.simulateCorruptionForTest();
    expect(client.read()).toBeNull();
    expect((await client.submit(battle('other', 1))).status).toBe('damaged');
    expect(client.read()).toBeNull();
  });

  it('instâncias independentes ainda divergem: NÃO há banco/autoridade remota', async () => {
    const left = new RewardAuthorityMemoryLab(raw).openClient();
    const right = new RewardAuthorityMemoryLab(raw).openClient();
    expect((await left.submit(battle('left'))).status).toBe('applied');
    expect((await right.submit(battle('right'))).status).toBe('applied');
    expect(left.read()?.receipts[0]?.id).toBe('left');
    expect(right.read()?.receipts[0]?.id).toBe('right');
    expect(left.read()?.revision).toBe(1);
    expect(right.read()?.revision).toBe(1);
  });

  it('resultado de batalha forjado ainda é aceito no laboratório: NÃO antifraude', async () => {
    const lab = new RewardAuthorityMemoryLab(raw);
    const client = lab.openClient();
    expect((await client.submit(battle('unverified-win'))).status).toBe('applied');
    // Futuro servidor DEVE validar batalha, captura e relógio antes de chamar reducer.
    expect(state(client).wins).toBe(2);
  });
});
