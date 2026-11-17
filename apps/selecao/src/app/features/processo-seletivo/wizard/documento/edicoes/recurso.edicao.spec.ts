import { UnidadeDoPrazoDoRecurso } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { valoresDaEtapa, valoresDaFase } from '../adaptadores/fase.adaptador';
import { umaFaseCompleta } from '../fase.testing';
import { definirRecursoDaFase, definirRecursosDaEtapa } from './recurso.edicao';

function recursoDaFase() {
  const recurso = valoresDaFase(umaFaseCompleta(), 'inscricao')?.recurso;
  if (recurso === null || recurso === undefined) throw new Error('A fase tem recurso.');
  return recurso;
}

describe('recurso da fase', () => {
  it('o valor fora do alcance sai do documento: não vira zero nem nulo', () => {
    const documento = umaFaseCompleta();

    const editado = definirRecursoDaFase(documento, 'inscricao', {
      ...recursoDaFase(),
      prazoValor: '1e999',
    });

    expect(editado.cronograma?.fases?.[0].regraRecurso).not.toHaveProperty('prazoValor');
  });

  it('trocar a unidade do prazo e a admissão de instância superior muda só esses campos', () => {
    const documento = umaFaseCompleta();

    const editado = definirRecursoDaFase(documento, 'inscricao', {
      ...recursoDaFase(),
      prazoUnidade: UnidadeDoPrazoDoRecurso.horas,
      admiteInstanciaSuperior: null,
    });

    expect(editado.cronograma?.fases?.[0].regraRecurso).toEqual({
      regraCodigo: 'RECURSO-PADRAO',
      regraVersao: 'v1',
      prazoValor: 2,
      prazoUnidade: 'horas',
      procedimentosDeRecurso: documento.cronograma?.fases?.[0].regraRecurso?.procedimentosDeRecurso,
    });
  });

  it('fase que o documento não tem não muda nada', () => {
    const documento = umaFaseCompleta();

    expect(definirRecursoDaFase(documento, 'inexistente', recursoDaFase())).toBe(documento);
  });
});

describe('recursos da etapa', () => {
  it('trocar a ordem dos recursos leva a âncora e os procedimentos de cada um', () => {
    const documento = umaFaseCompleta();
    const [primeiro, segundo] = valoresDaEtapa(documento, 'prova')?.recursos ?? [];

    const editado = definirRecursosDaEtapa(documento, 'prova', [segundo, primeiro]);

    expect(editado.etapas?.[0].recursos).toEqual([
      documento.etapas?.[0].recursos?.[1],
      documento.etapas?.[0].recursos?.[0],
    ]);
  });

  it('o recurso com a mesma posição citada duas vezes vira um recurso novo na segunda', () => {
    const documento = umaFaseCompleta();
    const [primeiro] = valoresDaEtapa(documento, 'prova')?.recursos ?? [];

    const editado = definirRecursosDaEtapa(documento, 'prova', [primeiro, primeiro]);

    expect(editado.etapas?.[0].recursos?.[1]).not.toBe(documento.etapas?.[0].recursos?.[0]);
    expect(editado.etapas?.[0].recursos?.[1]).not.toHaveProperty('procedimentosDeRecurso');
  });
});
