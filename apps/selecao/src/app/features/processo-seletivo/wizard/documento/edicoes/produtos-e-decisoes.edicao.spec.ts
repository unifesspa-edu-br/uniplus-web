import {
  PapelDoProduto,
  type DocumentoDaConfiguracaoCronogramaFase,
} from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { umaFaseCompleta } from '../fase.testing';
import { comParecerIndividual, comProdutos, comTiposDeDecisao } from './produtos-e-decisoes.edicao';

const SEM_NADA: DocumentoDaConfiguracaoCronogramaFase = { chave: 'x' };

function inscricao() {
  const fase = umaFaseCompleta().cronograma?.fases?.[0];
  if (fase === undefined) throw new Error('A fase existe.');
  return fase;
}

describe('produtos e decisões', () => {
  it('o produto repetido com papéis diferentes é identificado pela posição', () => {
    const fase = inscricao();

    const editada = comProdutos(fase, [
      { atoCodigo: 'EDITAL', papel: '' },
      { atoCodigo: 'EDITAL', papel: PapelDoProduto.PRELIMINAR },
    ]);

    expect(editada.produtos).toEqual([
      { atoCodigo: 'EDITAL' },
      { atoCodigo: 'EDITAL', papel: 'PRELIMINAR' },
    ]);
  });

  it('declarar sem produtos escreve a lista vazia onde havia lista; onde não havia, nada', () => {
    const fase = inscricao();

    expect(comProdutos(fase, []).produtos).toEqual([]);
    expect(comProdutos(SEM_NADA, [])).not.toHaveProperty('produtos');
  });

  it('o parecer individual nulo é "não decidido" e tira o campo; falso é uma decisão', () => {
    const fase = inscricao();

    expect(comParecerIndividual(fase, null)).not.toHaveProperty('emiteParecerIndividual');
    expect(comParecerIndividual(SEM_NADA, false).emiteParecerIndividual).toBe(false);
  });

  it('os tipos de decisão seguem a ordem do formulário; a lista igual devolve a mesma instância', () => {
    const fase = inscricao();

    expect(comTiposDeDecisao(fase, ['CLASSIFICACAO', 'HOMOLOGACAO_DAS_INSCRICOES'])).toBe(fase);
    expect(
      comTiposDeDecisao(fase, ['HOMOLOGACAO_DAS_INSCRICOES', 'CLASSIFICACAO']).tiposDeDecisao,
    ).toEqual(['HOMOLOGACAO_DAS_INSCRICOES', 'CLASSIFICACAO']);
  });

  it('o código desconhecido que o documento já tinha continua, para poder ser retirado', () => {
    const fase: DocumentoDaConfiguracaoCronogramaFase = JSON.parse(
      '{"chave":"x","tiposDeDecisao":["CODIGO_DO_FUTURO"]}',
    );

    expect(comTiposDeDecisao(fase, ['CODIGO_DO_FUTURO']).tiposDeDecisao).toEqual([
      'CODIGO_DO_FUTURO',
    ]);
    expect(comTiposDeDecisao(fase, []).tiposDeDecisao).toEqual([]);
  });
});
