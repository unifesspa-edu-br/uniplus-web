import { TestBed } from '@angular/core/testing';
import type { ProblemDetails } from '@uniplus/shared-core/http';
import { beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { NumeracaoDasRespostasRecusadas } from '../../shared/recusas/numeracao-das-respostas-recusadas';
import { RecusasDaPublicacao } from '../../shared/recusas/recusas-da-publicacao.service';
import { RecusasDaPublicacaoNaProvaPresencial } from './recusas-da-publicacao-na-prova-presencial.service';

const municipios = [
  { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  { codigoIbge: '1501402', nome: 'Belém', uf: 'PA' },
];

function problema(code: string, field?: string): ProblemDetails {
  return {
    type: 'https://exemplo.org/erros/validacao',
    title: 'Validação',
    status: 422,
    code: 'validacao',
    traceId: 't',
    errors: [{ code, field, message: 'Confira.' }],
  };
}

describe('RecusasDaPublicacaoNaProvaPresencial', () => {
  let store: ProcessoSeletivoStore;
  let publicacao: RecusasDaPublicacao;
  let servico: RecusasDaPublicacaoNaProvaPresencial;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProcessoSeletivoStore,
        NumeracaoDasRespostasRecusadas,
        RecusasDaPublicacao,
        RecusasDaPublicacaoNaProvaPresencial,
      ],
    });
    store = TestBed.inject(ProcessoSeletivoStore);
    publicacao = TestBed.inject(RecusasDaPublicacao);
    servico = TestBed.inject(RecusasDaPublicacaoNaProvaPresencial);
  });

  it('coloca PorDeclarar sem campo na escolha', () => {
    publicacao.registrar(problema('ProvaPresencial.PorDeclarar'), 'Recusada');
    expect(servico.recusas().escolha).toHaveLength(1);
  });

  it('coloca SemMunicipio na lista', () => {
    publicacao.registrar(
      problema('ProvaPresencial.SemMunicipio', 'provaPresencial.municipios'),
      'Recusada',
    );
    expect(servico.recusas().lista).toHaveLength(1);
  });

  it('resolve o segundo município na declaração conferida', () => {
    store.patchObjectSection('provaPresencial', { temProvaPresencial: true, municipios });
    publicacao.registrar(
      problema(
        'ProvaPresencial.MunicipioNaoConferidoNoGeo',
        '/provaPresencial/municipios/1/codigoIbge',
      ),
      'Recusada',
    );
    store.patchObjectSection('provaPresencial', { municipios: [municipios[1], municipios[0]] });
    expect(servico.recusas().porMunicipio.get(municipios[1].codigoIbge)).toHaveLength(1);
  });

  it('mantém na lista a recusa de município removido', () => {
    store.patchObjectSection('provaPresencial', { temProvaPresencial: true, municipios });
    publicacao.registrar(
      problema(
        'ProvaPresencial.MunicipioNaoConferidoNoGeo',
        '/provaPresencial/municipios/1/codigoIbge',
      ),
      'Recusada',
    );
    store.patchObjectSection('provaPresencial', { municipios: [municipios[0]] });
    expect(servico.recusas().lista[0].aConferir).toBe(true);
  });

  it('marca a recusa a conferir quando a declaração muda', () => {
    publicacao.registrar(problema('ProvaPresencial.PorDeclarar'), 'Recusada');
    store.patchObjectSection('provaPresencial', { temProvaPresencial: true });
    expect(servico.recusas().escolha[0].aConferir).toBe(true);
  });
});
