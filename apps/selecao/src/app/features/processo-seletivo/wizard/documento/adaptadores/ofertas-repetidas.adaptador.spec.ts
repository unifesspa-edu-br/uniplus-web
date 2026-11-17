import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { catalogoPorCodigo } from '../catalogos-por-codigo';
import { documentoSemNada } from '../exemplos.testing';
import { edicaoDoPasso, valoresDoFormulario } from './vagas.adaptador';

const catalogos = { ofertas: catalogoPorCodigo([]), modalidades: catalogoPorCodigo([]) };
const valoresDe = (documento: DocumentoDaConfiguracao) => valoresDoFormulario(documento, catalogos);
const idaEVolta = (documento: DocumentoDaConfiguracao) =>
  edicaoDoPasso(valoresDe(documento))(documento);

describe('ofertas com código repetido', () => {
  const documento: DocumentoDaConfiguracao = {
    ...documentoSemNada(),
    distribuicaoVagas: [
      {
        ofertaCursoCodigo: 'CURSO',
        vagasOfertadasBase: 10,
        modalidades: [{ codigo: 'AC', quantidadeDeclarada: 3 }],
      },
      {
        ofertaCursoCodigo: 'CURSO',
        vagasOfertadasBase: 20,
        modalidades: [{ codigo: 'PCD', quantidadeDeclarada: 7 }],
      },
    ],
  };
  it('devolve cada ocorrência idêntica na ida e volta', () => {
    expect(idaEVolta(documento)).toEqual(documento);
  });
  it('preserva a origem ao remover ou reordenar ocorrências', () => {
    const valores = valoresDe(documento);
    const [primeira, segunda] = valores.ofertas;
    const editar = (ofertas: typeof valores.ofertas) =>
      edicaoDoPasso({ ...valores, ofertas })(documento).distribuicaoVagas;

    expect(editar([segunda])).toEqual([documento.distribuicaoVagas?.[1]]);
    expect(editar([segunda, primeira])).toEqual([...(documento.distribuicaoVagas ?? [])].reverse());
  });
  it('edita só a segunda ocorrência', () => {
    const valores = valoresDe(documento);
    const ofertas = valores.ofertas.map((oferta, indice) =>
      indice === 1
        ? {
            ...oferta,
            vagasOfertadasBase: '25',
            modalidades: [{ ...oferta.modalidades[0], quantidade: '8' }],
          }
        : oferta,
    );
    const editado = edicaoDoPasso({ ...valores, ofertas })(documento);
    expect(editado.distribuicaoVagas).toEqual([
      documento.distribuicaoVagas?.[0],
      {
        ...documento.distribuicaoVagas?.[1],
        vagasOfertadasBase: 25,
        modalidades: [{ codigo: 'PCD', quantidadeDeclarada: 8 }],
      },
    ]);
  });
});
