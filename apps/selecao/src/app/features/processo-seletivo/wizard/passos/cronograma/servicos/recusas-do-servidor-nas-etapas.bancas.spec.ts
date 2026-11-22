import { TestBed } from '@angular/core/testing';
import type { FormGroup } from '@angular/forms';
import type { RecusaDoProblema } from '@uniplus/shared-core/http';
import { beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { umaBancaDeclarada } from '../../../shared/bancas/banca-declarada.testing';
import { NOTA_DA_BANCA_AUSENTE } from '../../../shared/bancas/recusas-das-bancas';
import { umaEtapaDoCronograma } from '../../../shared/etapa-do-cronograma.testing';
import { etapaDoFormulario, grupoDaEtapa, novoFormularioDoCronograma } from '../cronograma-form';
import type { EtapaForm } from '../cronograma-form';
import { FormularioDoCronograma } from './formulario-do-cronograma.service';
import { SEM_RECUSAS_DA_PUBLICACAO } from './recusas-da-publicacao-no-cronograma.testing';
import { RecusasDoServidorNasEtapas } from './recusas-do-servidor-nas-etapas.service';

const PRIMEIRA = umaBancaDeclarada({ id: 'id-1', identificadorLocal: 'banca-1' });
const SEGUNDA = umaBancaDeclarada({ id: 'id-2', identificadorLocal: 'banca-2' });

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

describe('RecusasDoServidorNasEtapas: bancas da etapa', () => {
  const formulario = novoFormularioDoCronograma();
  let recusasNasEtapas: RecusasDoServidorNasEtapas;
  let etapa: FormGroup<EtapaForm>;

  const registrar = (...recusas: RecusaDoProblema[]) => {
    const grupos = [...formulario.controls.etapas.controls];
    return recusasNasEtapas.registrar(
      1,
      { grupos, etapasNoFormulario: grupos.map(etapaDoFormulario) },
      recusas,
      () => true,
    );
  };
  const daEtapa = (bancas = [PRIMEIRA, SEGUNDA]) =>
    recusasNasEtapas.recusasDasBancas(etapa, bancas);

  beforeEach(() => {
    formulario.controls.etapas.clear();
    etapa = grupoDaEtapa(umaEtapaDoCronograma({ bancas: [PRIMEIRA, SEGUNDA] }));
    formulario.controls.etapas.push(etapa);
    TestBed.configureTestingModule({
      providers: [
        ProcessoSeletivoStore,
        RecusasDoServidorNasEtapas,
        SEM_RECUSAS_DA_PUBLICACAO,
        {
          provide: FormularioDoCronograma,
          useValue: { formulario, etapas: formulario.controls.etapas },
        },
      ],
    });
    recusasNasEtapas = TestBed.inject(RecusasDoServidorNasEtapas);
    TestBed.inject(ProcessoSeletivoStore);
    TestBed.tick();
  });

  it('põe cada recusa na banca que estava naquela posição do envio, mesmo sendo do mesmo tipo', () => {
    registrar(
      recusa('etapas[0].bancas[1].regraDeDeliberacao.quorum', 0),
      recusa('etapas[0].bancas[0]', 1),
    );

    const { daBanca, porControle, secao } = daEtapa();

    expect(porControle.get('banca-2')?.quorum?.map((r) => r.campo)).toEqual([
      'bancas.banca-2.quorum',
    ]);
    expect(daBanca.get('banca-1')?.map((r) => r.campo)).toEqual(['bancas.banca-1']);
    expect(secao).toEqual([]);
  });

  it('leva à seção, com a nota, a recusa de uma banca retirada depois do envio', () => {
    registrar(recusa('etapas[0].bancas[1].regraDeDeliberacao.modo'));

    const { daBanca, porControle, secao } = daEtapa([PRIMEIRA]);

    expect(secao.map((r) => r.nota)).toEqual([NOTA_DA_BANCA_AUSENTE]);
    expect(daBanca.size).toBe(0);
    expect(porControle.size).toBe(0);
  });

  it('leva à seção, com a nota, a recusa de uma posição que o envio não tinha', () => {
    registrar(recusa('etapas[0].bancas[9]'));

    expect(daEtapa().secao.map((r) => r.nota)).toEqual([NOTA_DA_BANCA_AUSENTE]);
  });

  it('deixa na seção, sem nota, a recusa que nunca apontou uma banca', () => {
    registrar(recusa('etapas[0].bancas'));

    expect(daEtapa().secao.map((r) => r.nota)).toEqual([undefined]);
  });

  it('mantém a nota quando a etapa muda e a recusa passa a conferir de novo', () => {
    registrar(recusa('etapas[0].bancas[9]'));

    etapa.controls.notaMaxima.setValue('7');

    const [achada] = daEtapa().secao;
    expect(achada.aConferir).toBe(true);
    expect(achada.nota).toBe(NOTA_DA_BANCA_AUSENTE);
  });
});
