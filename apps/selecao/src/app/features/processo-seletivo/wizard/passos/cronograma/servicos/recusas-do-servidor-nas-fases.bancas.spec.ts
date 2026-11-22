import { TestBed } from '@angular/core/testing';
import type { RecusaDoProblema } from '@uniplus/shared-core/http';
import { beforeEach, describe, expect, it } from 'vitest';

import type { FaseDoCronograma } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { umaBancaRequeridaDaFase } from '../../../shared/bancas/banca-declarada.testing';
import { NOTA_DA_BANCA_AUSENTE, recusasDasBancas } from '../../../shared/bancas/recusas-das-bancas';
import { umaFaseDoCronograma } from '../../../shared/fase-do-cronograma.testing';
import { RecusasDoServidorNasFases } from './recusas-do-servidor-nas-fases.service';
import { SEM_RECUSAS_DA_PUBLICACAO } from './recusas-da-publicacao-no-cronograma.testing';

const PRIMEIRA = umaBancaRequeridaDaFase({ id: 'id-1', identificadorLocal: 'banca-1' });
const SEGUNDA = umaBancaRequeridaDaFase({ id: 'id-2', identificadorLocal: 'banca-2' });
const FASE = umaFaseDoCronograma({
  faseCanonicaId: 'fase-a',
  codigo: 'A',
  bancasRequeridas: [PRIMEIRA, SEGUNDA],
});

function recusa(campo: string, ordem = 0): RecusaDoProblema {
  return {
    campo,
    codigo: `uniplus.selecao.banca.recusa_${ordem}`,
    mensagem: `Mensagem ${ordem}.`,
    pagina: null,
    ordem,
    identificadores: [],
  };
}

describe('RecusasDoServidorNasFases: bancas da fase', () => {
  let recusasNasFases: RecusasDoServidorNasFases;
  let store: ProcessoSeletivoStore;

  const noRascunho = (fase: FaseDoCronograma) =>
    store.patchObjectSection('cronograma', { fases: [fase] });
  const registrar = (...recusas: RecusaDoProblema[]) =>
    recusasNasFases.registrar(1, [FASE], recusas, () => true);
  const campos = () => recusasNasFases.recusasDaFase('fase-a').map((r) => r.campo);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProcessoSeletivoStore, RecusasDoServidorNasFases, SEM_RECUSAS_DA_PUBLICACAO],
    });
    recusasNasFases = TestBed.inject(RecusasDoServidorNasFases);
    store = TestBed.inject(ProcessoSeletivoStore);
    noRascunho(FASE);
  });

  it('põe cada recusa na banca que estava naquela posição do envio, mesmo sendo do mesmo tipo', () => {
    registrar(
      recusa('fases[0].bancasRequeridas[1].regraDeDeliberacao.quorum', 0),
      recusa('fases[0].bancasRequeridas[0]', 1),
    );

    expect(campos()).toEqual(['bancasRequeridas.banca-2.quorum', 'bancasRequeridas.banca-1']);
  });

  it('segue a banca pelo identificador quando a ordem das bancas muda depois do envio', () => {
    registrar(recusa('fases[0].bancasRequeridas[0].regraDeDeliberacao.criterio'));

    noRascunho({ ...FASE, bancasRequeridas: [SEGUNDA, PRIMEIRA] });
    const { porControle } = recusasDasBancas(
      recusasNasFases.recusasDaFase('fase-a'),
      'bancasRequeridas',
      [SEGUNDA, PRIMEIRA],
    );

    expect(porControle.get('banca-1')?.criterio?.map((r) => r.campo)).toEqual([
      'bancasRequeridas.banca-1.criterio',
    ]);
    expect(porControle.has('banca-2')).toBe(false);
  });

  it('leva à seção, com a nota, a recusa de uma banca retirada depois do envio', () => {
    registrar(recusa('fases[0].bancasRequeridas[1].regraDeDeliberacao.quorum'));

    const { secao, daBanca, porControle } = recusasDasBancas(
      recusasNasFases.recusasDaFase('fase-a'),
      'bancasRequeridas',
      [PRIMEIRA],
    );

    expect(secao.map((r) => r.nota)).toEqual([NOTA_DA_BANCA_AUSENTE]);
    expect(daBanca.size).toBe(0);
    expect(porControle.size).toBe(0);
  });

  it('leva à seção, com a nota, a recusa de uma posição que o envio não tinha', () => {
    registrar(recusa('fases[0].bancasRequeridas[7]'));

    const [achada] = recusasNasFases.recusasDoCampo('fase-a', 'bancasRequeridas');

    expect(achada.nota).toBe(NOTA_DA_BANCA_AUSENTE);
  });

  it('deixa na seção, sem nota, a recusa que nunca apontou uma banca', () => {
    registrar(recusa('fases[0].bancasRequeridas'));

    const [achada] = recusasNasFases.recusasDoCampo('fase-a', 'bancasRequeridas');

    expect(achada.nota).toBeUndefined();
  });

  it('mantém a nota quando a fase muda e a recusa passa a conferir de novo', () => {
    registrar(recusa('fases[0].bancasRequeridas[7]'));

    noRascunho({ ...FASE, emiteParecerIndividual: true });
    const [achada] = recusasNasFases.recusasDoCampo('fase-a', 'bancasRequeridas');

    expect(achada.aConferir).toBe(true);
    expect(achada.nota).toBe(NOTA_DA_BANCA_AUSENTE);
  });
});
