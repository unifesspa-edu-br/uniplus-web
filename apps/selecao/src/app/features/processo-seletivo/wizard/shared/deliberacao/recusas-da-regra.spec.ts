import { describe, expect, it } from 'vitest';

import type { RecusaOrdenada } from '../recusas/ordem-das-recusas';
import { CAMPOS_DA_BANCA, errosDaBancaPorCampo, recusasDoModo } from './recusas-da-regra';
import { controlesAVista } from './regra-de-deliberacao';
import { COLEGIADA, comRegra } from './regra-de-deliberacao.testing';

describe('errosDaBancaPorCampo', () => {
  it('reúne só os campos que têm erro', () => {
    const erros = errosDaBancaPorCampo((campo) => (campo === 'quorum' ? 'fora' : null));

    expect(erros).toEqual({ quorum: 'fora' });
  });

  it('ignora o erro vazio ou indefinido', () => {
    expect(errosDaBancaPorCampo((campo) => (campo === 'modo' ? '' : undefined))).toEqual({});
  });

  it('consulta cada lugar sob o qual a recusa pode aparecer', () => {
    const consultados: string[] = [];
    errosDaBancaPorCampo((campo) => {
      consultados.push(campo);
      return null;
    });

    expect(consultados).toEqual([...CAMPOS_DA_BANCA]);
  });
});

function recusa(campo: string, ordem: number): RecusaOrdenada {
  return {
    campo,
    codigo: `uniplus.selecao.banca.recusa_${ordem}`,
    mensagem: `Mensagem ${ordem}.`,
    pagina: null,
    ordem,
    resposta: 1,
    origem: 'gravacao',
    aConferir: false,
  };
}

describe('recusasDoModo', () => {
  const recusas = {
    modo: [recusa('modo', 0)],
    regra: [recusa('regra', 1)],
    quorum: [recusa('quorum', 2)],
    desempate: [recusa('desempate', 3)],
  };
  const doModo = (regra: Parameters<typeof controlesAVista>[0]) =>
    recusasDoModo(recusas, controlesAVista(regra)).map((item) => item.campo);

  it('reúne a do modo e a da regra inteira, na ordem em que a API as deu', () => {
    expect(doModo(COLEGIADA)).toEqual(['modo', 'regra']);
  });

  it('acrescenta a do controle que a tela não mostra para a regra', () => {
    expect(doModo(comRegra({ integrantes: '1' }))).toEqual(['modo', 'regra', 'desempate']);
  });

  it('acrescenta a de todo controle enquanto não há regra declarada', () => {
    expect(doModo(null)).toEqual(['modo', 'regra', 'quorum', 'desempate']);
  });

  it('fica vazia quando nenhuma recusa cabe ao modo', () => {
    expect(recusasDoModo({ quorum: recusas.quorum }, controlesAVista(COLEGIADA))).toEqual([]);
  });
});
