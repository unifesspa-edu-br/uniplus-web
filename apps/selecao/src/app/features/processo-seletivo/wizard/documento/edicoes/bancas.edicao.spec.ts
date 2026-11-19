import { CriterioDaDeliberacao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { valoresDaEtapa, valoresDaFase } from '../adaptadores/fase.adaptador';
import { umaFaseCompleta } from '../fase.testing';
import { acrescentarBanca, definirBancas, type BancaDoFormulario } from './bancas.edicao';

const NA_FASE = { faseChave: 'inscricao' };
const NA_ETAPA = { etapaChave: 'prova' };

function bancasDaFase(): readonly BancaDoFormulario[] {
  return valoresDaFase(umaFaseCompleta(), 'inscricao')?.bancas ?? [];
}

describe('bancas', () => {
  it('acrescentar atribui a chave, única entre as bancas da fase e das etapas', () => {
    const documento = umaFaseCompleta();

    const naFase = acrescentarBanca(
      documento,
      NA_FASE,
      { tipoBancaCodigo: 'BANCA_ANALISE', nome: 'Banca nova' },
      { original: documento, criadas: [] },
    );
    const naEtapa = acrescentarBanca(
      naFase,
      NA_ETAPA,
      { tipoBancaCodigo: 'BANCA_ANALISE', nome: 'Banca nova' },
      { original: documento, criadas: ['banca-nova'] },
    );

    expect(naFase.cronograma?.fases?.[0].bancasRequeridas?.at(-1)).toEqual({
      chave: 'banca-nova',
      tipoBancaCodigo: 'BANCA_ANALISE',
    });
    expect(naEtapa.etapas?.[0].bancas?.at(-1)?.chave).toBe('banca-nova-2');
  });

  it('reserva a chave da banca removida e as criadas na edição', () => {
    const original = {
      ...umaFaseCompleta(),
      cronograma: {
        fases: [
          {
            chave: 'inscricao',
            faseCanonicaCodigo: 'INSCRICOES',
            bancasRequeridas: [{ chave: 'banca-de-analise', tipoBancaCodigo: 'BANCA_ANALISE' }],
          },
        ],
      },
      etapas: [],
    };
    const removido = definirBancas(original, NA_FASE, []);
    const editado = acrescentarBanca(
      removido,
      NA_FASE,
      { tipoBancaCodigo: 'BANCA_ANALISE', nome: 'Banca de análise' },
      { original, criadas: ['banca-de-analise-2'] },
    );
    expect(editado.cronograma?.fases?.[0].bancasRequeridas?.[0].chave).toBe('banca-de-analise-3');
  });

  it('a banca da fase e a da etapa ficam cada uma no seu lugar', () => {
    const documento = umaFaseCompleta();

    const editado = definirBancas(documento, NA_ETAPA, []);

    expect(editado.etapas?.[0].bancas).toEqual([]);
    expect(editado.cronograma).toBe(documento.cronograma);
    expect(valoresDaEtapa(documento, 'prova')?.bancas).toHaveLength(1);
  });

  it('esvaziar a deliberação de uma banca tira o bloco; categorias vazias seguem `[]`', () => {
    const documento = umaFaseCompleta();
    const [banca] = bancasDaFase();

    const editado = definirBancas(documento, NA_FASE, [{ ...banca, regraDeDeliberacao: null }]);

    const editada = editado.cronograma?.fases?.[0].bancasRequeridas?.[0];
    expect(editada).not.toHaveProperty('regraDeDeliberacao');
    expect(editada?.categoriasDocumentoCodigos).toEqual([]);
  });

  it('trocar o critério de votação muda só ele, e o campo esvaziado sai da deliberação', () => {
    const documento = umaFaseCompleta();
    const [banca] = bancasDaFase();
    const regra = banca.regraDeDeliberacao;
    if (regra === null) throw new Error('A banca tem deliberação.');

    const editado = definirBancas(documento, NA_FASE, [
      {
        ...banca,
        regraDeDeliberacao: {
          ...regra,
          criterio: CriterioDaDeliberacao.maioriaAbsoluta,
          integrantes: '',
        },
      },
    ]);

    expect(editado.cronograma?.fases?.[0].bancasRequeridas?.[0].regraDeDeliberacao).toEqual({
      modo: 'colegiadaComVotacao',
      criterio: 'maioriaAbsoluta',
    });
  });

  it('a banca que o formulário deixa de trazer sai, e a ordem do formulário vale', () => {
    const documento = umaFaseCompleta();
    const [banca] = bancasDaFase();

    const editado = definirBancas(documento, NA_FASE, [
      { ...banca, chave: 'banca-que-nao-existe' },
      banca,
    ]);

    expect(editado.cronograma?.fases?.[0].bancasRequeridas?.map((b) => b.chave)).toEqual([
      'banca-de-analise',
    ]);
  });
});
