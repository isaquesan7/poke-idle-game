import { describe, expect, it } from 'vitest';
import fixture from '../../../../tests/fixtures/legacy-save-v01.json';
import {
  prepareRecoveryBundle, inspectOriginBackup, inspectRecoveryBundle,
  recoverLegacySource, sha256Hex, utf8ByteLength,
  OFFICIAL_V02_KEY, ORIGIN_BACKUP_V02_KEY, COMMIT_MARKER_V02_KEY
} from './officialSaveV02';

const original = '\n  ' + JSON.stringify({
  ...fixture,
  extras: { trainerNote: 'Pokémon ☀️', evolutionHistory: ['bulbasaur'] },
  roster: [
    { ...fixture.roster[0], moveName: 'vine-whip', upgrades: { 'vine-whip': 3 },
      someUnknownInstanceField: { shape: [1,2,3] } },
    { ...fixture.roster[0], uid: 2, pokemonId: 4, level: 17,
      affinity: 100, moveName: 'ember', xp: 87 }
  ],
  team: [1,2],
  nextUid: 3
}, null, 2).replace(/\n/g, '\r\n') + '  \n';

async function prepared() {
  const result = await prepareRecoveryBundle(original, 1794865000000);
  if (result.status !== 'ok') throw Error(result.reason);
  return result.value;
}

describe('contrato candidato de save v0.2 e backup de origem', () => {
  it('usa chaves novas e distintas da origem e do draft v0.2', () => {
    expect(OFFICIAL_V02_KEY).toBe('kanto-idle-lab-save-v02');
    expect(ORIGIN_BACKUP_V02_KEY).toBe('kanto-idle-lab-save-v02-origin-backup');
    expect(COMMIT_MARKER_V02_KEY).toBe('kanto-idle-lab-save-v02-commit');
    expect(new Set([
      OFFICIAL_V02_KEY, ORIGIN_BACKUP_V02_KEY, COMMIT_MARKER_V02_KEY,
      'kanto-idle-lab-save-v01','kanto-idle-lab-save-v02-draft'
    ]).size).toBe(5);
  });

  it('calcula SHA256 conhecido e tamanho real UTF-8, não caracteres UTF-16', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
    expect(utf8ByteLength('é💫')).toBe(6);
  });

  it('preserva bytes do save original e todos os campos desconhecidos e individuais', async () => {
    const bundle = await prepared();
    expect(bundle.kind).toBe('kanto-recovery-bundle');
    expect(bundle.bundleVersion).toBe(1);
    expect(bundle.backup.sourceRaw).toBe(original);
    expect(bundle.backup.byteLength).toBe(new TextEncoder().encode(original).byteLength);
    expect(bundle.candidate.schemaVersion).toBe(2);
    expect(bundle.candidate.revision).toBe(0);
    expect(bundle.candidate.payloadFormat).toBe('legacy-v01');
    expect(bundle.candidate.progress.version).toBe(1);
    expect(bundle.candidate.progress.roster).toHaveLength(2);
    expect(bundle.candidate.progress.roster[0]?.affinity).toBe(73);
    expect(bundle.candidate.progress.roster[1]?.affinity).toBe(100);
    expect(bundle.candidate.progress.team).toEqual([1,2]);
    expect(bundle.candidate.progress.extras).toEqual({
      trainerNote: 'Pokémon ☀️', evolutionHistory: ['bulbasaur']
    });
    expect(bundle.candidate.progress.roster[0]?.someUnknownInstanceField)
      .toEqual({ shape: [1,2,3] });
    expect(JSON.stringify(bundle.candidate.progress)).toBe(
      JSON.stringify(JSON.parse(original))
    );
    expect(bundle.candidate.origin.sha256).toBe(bundle.backup.sha256);
    const recovered = await recoverLegacySource(JSON.stringify(bundle));
    expect(recovered).toEqual({ status:'ok', originalRaw:original });
  });

  it('verifica offline backup e pacote após serialização, sem tocar storage', async () => {
    const bundle = await prepared();
    const backup = await inspectOriginBackup(JSON.stringify(bundle.backup));
    expect(backup.status).toBe('verified');
    const inspection = await inspectRecoveryBundle(JSON.stringify(bundle));
    expect(inspection.status).toBe('verified');
    if (inspection.status === 'verified') expect(inspection.sourceRaw).toBe(original);
  });

  it('recusa corrupção silenciosa do backup, inclusive whitespace alterado', async () => {
    const bundle = await prepared();
    const modified = { ...bundle.backup, sourceRaw: bundle.backup.sourceRaw + ' ' };
    const backup = await inspectOriginBackup(JSON.stringify({
      ...modified, byteLength: utf8ByteLength(modified.sourceRaw)
    }));
    expect(backup.status).toBe('invalid');
    const damaged = { ...bundle, backup: modified };
    expect((await inspectRecoveryBundle(JSON.stringify(damaged))).status).toBe('invalid');
    expect((await recoverLegacySource(JSON.stringify(damaged))).status).toBe('blocked');
  });

  it('detecta adulteração de moeda, afinidade, nível e qualquer campo desconhecido', async () => {
    const bundle = await prepared();
    const progress = structuredClone(bundle.candidate.progress);
    const altered = [
      { ...progress, coins: 98765 },
      { ...progress, roster: progress.roster.map((p,i) => i === 0
        ? { ...p, affinity: 100 } : p) },
      { ...progress, trainer: { ...progress.trainer, level: 25 } },
      { ...progress, extras: { trainerNote: 'alterado' } }
    ];
    for (const candidate of altered) {
      expect((await inspectRecoveryBundle(JSON.stringify({
        ...bundle, candidate:{ ...bundle.candidate, progress:candidate }
      }))).status).toBe('invalid');
    }
  });

  it('bloqueia origem inválida, orçamento excedido e versão futura', async () => {
    expect((await prepareRecoveryBundle('{oops',0)).status).toBe('invalid');
    expect((await prepareRecoveryBundle(original,-1)).status).toBe('invalid');
    expect((await prepareRecoveryBundle(JSON.stringify({
      ...fixture,version:3
    }),1)).status).toBe('unsupported');
    expect((await prepareRecoveryBundle(JSON.stringify({
      ...fixture,trainer:{ ...fixture.trainer,manual:{
        ...fixture.trainer.manual,attack:41
      }}
    }),1)).status).toBe('invalid');
  });

  it('rejeita versões desconhecidas, mesmo com outros campos aparentemente válidos', async () => {
    const bundle = await prepared();
    expect((await inspectOriginBackup(JSON.stringify({
      ...bundle.backup,backupVersion:2
    }))).status).toBe('unsupported');
    expect((await inspectRecoveryBundle(JSON.stringify({
      ...bundle,bundleVersion:99
    }))).status).toBe('unsupported');
    expect((await inspectRecoveryBundle(JSON.stringify({
      ...bundle,candidate:{...bundle.candidate,schemaVersion:3}
    }))).status).toBe('invalid');
    expect((await inspectOriginBackup('not-json')).status).toBe('invalid');
    expect((await inspectRecoveryBundle('not-json')).status).toBe('invalid');
  });
});
