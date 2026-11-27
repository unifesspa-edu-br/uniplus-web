import { TestBed } from '@angular/core/testing';
import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { faseDoServidor } from '../../../shared/cronograma-do-servidor.testing';
import { umaFaseDoCronograma } from '../../../shared/fase-do-cronograma.testing';
import { dtoComCronograma } from '../../../shared/hidratacao.testing';
import { FasesNoServidor } from './fases-no-servidor.service';

const FASE_LIDA = 'fase-canonica-lida';
const FASE_GRAVADA = 'fase-canonica-gravada';
const OUTRA_FASE_LIDA = 'fase-canonica-outra';

function retratoCom(...origens: readonly string[]): ProcessoSeletivoDto {
  const fases = origens.map((origemId) => faseDoServidor({ faseCanonica: { origemId } }));
  return dtoComCronograma({ cronogramaFases: fases, etapas: [] }) as unknown as ProcessoSeletivoDto;
}

describe('FasesNoServidor', () => {
  let store: ProcessoSeletivoStore;
  let fasesNoServidor: FasesNoServidor;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ProcessoSeletivoStore, FasesNoServidor] });
    store = TestBed.inject(ProcessoSeletivoStore);
    fasesNoServidor = TestBed.inject(FasesNoServidor);
  });

  it('não tem fase nenhuma enquanto o processo não foi lido', () => {
    expect(fasesNoServidor.origens().size).toBe(0);
  });

  it('parte das fases do retrato lido do servidor', () => {
    store.remoteSnapshot.set(retratoCom(FASE_LIDA));

    expect([...fasesNoServidor.origens()]).toEqual([FASE_LIDA]);
  });

  it('depois de gravar, passa a ser o conjunto de fases que a gravação enviou', () => {
    store.remoteSnapshot.set(retratoCom(FASE_LIDA));

    fasesNoServidor.registrarGravadas([
      umaFaseDoCronograma({ faseCanonicaId: FASE_LIDA }),
      umaFaseDoCronograma({ faseCanonicaId: FASE_GRAVADA }),
    ]);

    expect([...fasesNoServidor.origens()]).toEqual([FASE_LIDA, FASE_GRAVADA]);
  });

  it('deixa de ter a fase que a gravação não enviou mais', () => {
    store.remoteSnapshot.set(retratoCom(FASE_LIDA));

    fasesNoServidor.registrarGravadas([umaFaseDoCronograma({ faseCanonicaId: FASE_GRAVADA })]);

    expect(fasesNoServidor.origens().has(FASE_LIDA)).toBe(false);
  });

  it('um retrato novo substitui o que a gravação registrou', () => {
    store.remoteSnapshot.set(retratoCom(FASE_LIDA));
    fasesNoServidor.registrarGravadas([umaFaseDoCronograma({ faseCanonicaId: FASE_GRAVADA })]);

    store.remoteSnapshot.set(retratoCom(OUTRA_FASE_LIDA));

    expect([...fasesNoServidor.origens()]).toEqual([OUTRA_FASE_LIDA]);
  });
});
