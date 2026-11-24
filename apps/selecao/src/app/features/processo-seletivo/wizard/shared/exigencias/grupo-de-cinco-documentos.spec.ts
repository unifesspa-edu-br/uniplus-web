import { describe, expect, it } from 'vitest';
import { FormaDeComprovacaoCodigo } from '@uniplus/shared-data/selecao';
import type { RegraDeComprovacaoDto } from '@uniplus/shared-data/selecao';

import { criarGrupo, editarGrupo } from './composicao-dos-grupos';
import {
  comando,
  detalheDaApi,
  exigencia,
  exigenciaDaApi,
  grupoDaApi,
  rascunho,
} from './exigencias.testing';
import { exigenciasDe } from './leitura-das-exigencias';

const DOCUMENTOS = ['RG', 'CIN', 'CNH', 'CARTEIRA_DE_TRABALHO', 'PASSAPORTE'];

function grupoDeCinco() {
  const inicial = rascunho(...DOCUMENTOS.map((tipoDocumentoId) => exigencia({ tipoDocumentoId })));
  const identificadores = inicial.regrasDeComprovacao.map((regra) => regra.identificadorNoRascunho);
  return editarGrupo(criarGrupo(inicial, identificadores, 'grupo'), 'grupo', {
    consequencia: 'ELIMINA',
    basesLegais: [
      {
        referencia: 'Edital 1/2027',
        abrangencia: 'INTERNA_EDITAL',
        situacao: 'RESOLVIDO',
        observacao: null,
      },
    ],
  });
}

function respostaDaApi(): RegraDeComprovacaoDto {
  const itens = DOCUMENTOS.map((nome) => {
    const regra = exigenciaDaApi();
    if (regra.documento == null) throw new Error('Documento esperado na regra de teste');
    return {
      ...regra,
      documento: {
        ...regra.documento,
        tipoDocumento: { ...regra.documento.tipoDocumento, id: nome, nome },
      },
    };
  });
  return {
    ...grupoDaApi(itens),
    forma: {
      codigo: FormaDeComprovacaoCodigo.QUANTIDADE_MINIMA_DE_ITENS,
      rotulo: 'Quantidade mínima',
    },
    cardinalidade: { quantidadeMinima: 1, distincao: null },
    indeferimento: {
      consequencia: { codigo: 'ELIMINA' as NonNullable<NonNullable<RegraDeComprovacaoDto['indeferimento']>['consequencia']>['codigo'], rotulo: 'Elimina' },
      basesLegais: [
        {
          id: 'norma',
          referencia: 'Edital 1/2027',
          abrangencia: { codigo: 'INTERNA_EDITAL' as NonNullable<RegraDeComprovacaoDto['indeferimento']>['basesLegais'][number]['abrangencia']['codigo'], rotulo: 'Edital' },
          situacao: { codigo: 'RESOLVIDO' as NonNullable<RegraDeComprovacaoDto['indeferimento']>['basesLegais'][number]['situacao']['codigo'], rotulo: 'Resolvido' },
          observacao: null,
        },
      ],
    },
  };
}

describe('Gravação e leitura de grupo de documentos', () => {
  it('conserva um destes cinco documentos e a consequência ao gravar e ler', () => {
    const enviado = comando(grupoDeCinco())[0];
    const relido = exigenciasDe(detalheDaApi([respostaDaApi()]));
    const reenviado = comando(relido)[0];
    expect(enviado.forma).toBe(FormaDeComprovacaoCodigo.QUANTIDADE_MINIMA_DE_ITENS);
    expect(enviado.cardinalidade?.quantidadeMinima).toBe(1);
    expect(enviado.itens?.map((item) => item.documento?.tipoDocumento?.id)).toEqual(DOCUMENTOS);
    expect(reenviado.cardinalidade).toEqual(enviado.cardinalidade);
    expect(reenviado.indeferimento).toEqual(enviado.indeferimento);
    expect(reenviado.itens?.map((item) => item.documento?.tipoDocumento?.id)).toEqual(DOCUMENTOS);
  });
});
