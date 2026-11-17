import { describe, expect, it } from 'vitest';

import {
  escolher,
  motivosDaFaseOuEtapa,
  retirar,
  semMotivosDeFaseOuEtapaRemovida,
} from './escolha-dos-motivos';
import {
  ETAPA_DA_PROVA,
  FASE_DA_INSCRICAO,
  FASE_DA_MATRICULA,
  umMotivoNoDocumento,
} from './motivos.testing';

const naInscricao = umMotivoNoDocumento(FASE_DA_INSCRICAO);
const naMatricula = umMotivoNoDocumento(FASE_DA_MATRICULA);
const naProva = umMotivoNoDocumento(ETAPA_DA_PROVA);

describe('motivos de uma fase ou etapa', () => {
  it('separa os motivos de cada fase e de cada etapa', () => {
    const todos = [naInscricao, naMatricula, naProva];

    expect(motivosDaFaseOuEtapa(todos, FASE_DA_INSCRICAO)).toEqual([naInscricao]);
    expect(motivosDaFaseOuEtapa(todos, ETAPA_DA_PROVA)).toEqual([naProva]);
  });

  it('devolve lista vazia para a fase que não escolheu motivo', () => {
    expect(motivosDaFaseOuEtapa([naMatricula], FASE_DA_INSCRICAO)).toEqual([]);
  });

  it('não confunde a fase e a etapa que têm a mesma chave', () => {
    const faseX = umMotivoNoDocumento({ faseChave: 'prova' });

    expect(motivosDaFaseOuEtapa([faseX], { etapaChave: 'prova' })).toEqual([]);
  });
});

describe('escolher', () => {
  it('acrescenta o motivo ao fim, mantendo os demais', () => {
    const resultado = escolher([naInscricao], naProva);

    expect(resultado).toEqual({ escolhido: true, motivos: [naInscricao, naProva] });
  });

  it('permite o mesmo motivo em duas fases', () => {
    const resultado = escolher([naInscricao], naMatricula);

    expect(resultado).toEqual({ escolhido: true, motivos: [naInscricao, naMatricula] });
  });

  it('recusa o mesmo motivo repetido na mesma fase, sem mudar a lista', () => {
    const lista = [naInscricao];

    const resultado = escolher(lista, umMotivoNoDocumento(FASE_DA_INSCRICAO));

    expect(resultado).toEqual({ escolhido: false, recusa: { motivoRepetido: naInscricao } });
    expect(lista).toEqual([naInscricao]);
  });

  it('recusa o mesmo motivo repetido na mesma etapa', () => {
    expect(escolher([naProva], naProva).escolhido).toBe(false);
  });

  it('permite o mesmo código em outro tipo de decisão na mesma fase', () => {
    const outroTipo = umMotivoNoDocumento(FASE_DA_INSCRICAO, { tipoCodigo: 'CLASSIFICACAO' });

    expect(escolher([naInscricao], outroTipo).escolhido).toBe(true);
  });

  it('não recusa pelo tipo de decisão, declarado ou não', () => {
    const qualquerTipo = umMotivoNoDocumento(FASE_DA_INSCRICAO, { tipoCodigo: 'TIPO_NOVO' });

    expect(escolher([], qualquerTipo).escolhido).toBe(true);
  });
});

describe('retirar', () => {
  it('tira só o motivo da fase indicada', () => {
    expect(retirar([naInscricao, naMatricula], naInscricao)).toEqual([naMatricula]);
  });

  it('deixa a lista vazia ao retirar o último motivo', () => {
    expect(retirar([naInscricao], naInscricao)).toEqual([]);
  });

  it('não muda nada ao retirar o motivo que a fase não escolheu', () => {
    expect(retirar([naMatricula], naInscricao)).toEqual([naMatricula]);
  });
});

describe('remoção de fase ou etapa do documento', () => {
  it('tira os motivos da fase removida e mantém os das demais', () => {
    const todos = [naInscricao, naMatricula, naProva];

    expect(semMotivosDeFaseOuEtapaRemovida(todos, FASE_DA_INSCRICAO)).toEqual([
      naMatricula,
      naProva,
    ]);
  });

  it('tira os motivos da etapa removida e mantém os da fase de mesma chave', () => {
    const faseDeMesmaChave = umMotivoNoDocumento({ faseChave: 'prova-escrita' });

    expect(semMotivosDeFaseOuEtapaRemovida([faseDeMesmaChave, naProva], ETAPA_DA_PROVA)).toEqual([
      faseDeMesmaChave,
    ]);
  });
});
