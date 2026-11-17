import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { catalogoPorCodigo } from '../catalogos-por-codigo';
import { documentoSemNada, exemploDoContrato, NOMES_DOS_EXEMPLOS } from '../exemplos.testing';
import { confirmarSemAtendimento } from '../edicoes/atendimento.edicao';
import {
  edicaoDoPasso,
  valoresDoFormulario,
  type CatalogosDoAtendimento,
  type ValoresDoAtendimento,
} from './atendimento.adaptador';

const CATALOGOS: CatalogosDoAtendimento = {
  condicoes: catalogoPorCodigo([
    { codigo: 'MOBILIDADE_REDUZIDA', rotulo: 'Mobilidade reduzida (catálogo)' },
    { codigo: 'PCD', rotulo: 'Pessoa com deficiência' },
  ]),
  recursos: catalogoPorCodigo([{ codigo: 'LEDOR', rotulo: 'Ledor' }]),
  tiposDeficiencia: catalogoPorCodigo([{ codigo: 'VISUAL', rotulo: 'Deficiência visual' }]),
};

const NAO_DECIDIDO: ValoresDoAtendimento = {
  decidido: false,
  condicoes: [],
  recursos: [],
  tiposDeficiencia: [],
};

function idaEVolta(documento: DocumentoDaConfiguracao): DocumentoDaConfiguracao {
  return edicaoDoPasso(valoresDoFormulario(documento, CATALOGOS))(documento);
}

describe('adaptador do passo Atendimento especializado', () => {
  it.each(NOMES_DOS_EXEMPLOS)('devolve o exemplo %s idêntico depois de ler e editar', (nome) => {
    const documento = exemploDoContrato(nome);

    expect(idaEVolta(documento)).toEqual(documento);
  });

  it('lê o nome que o processo gravou, e não o do catálogo vivo', () => {
    const valores = valoresDoFormulario(exemploDoContrato('inscricao-pelo-sistema'), CATALOGOS);

    expect(valores.decidido).toBe(true);
    expect(valores.condicoes).toEqual([
      { codigo: 'MOBILIDADE_REDUZIDA', nome: 'Mobilidade reduzida', origem: 0 },
    ]);
  });

  it('lê bloco ausente como "ainda não decidiu"', () => {
    expect(valoresDoFormulario(documentoSemNada(), CATALOGOS)).toEqual(NAO_DECIDIDO);
  });

  it('não cria o bloco enquanto a decisão não foi tomada', () => {
    const documento = documentoSemNada();

    expect(edicaoDoPasso(NAO_DECIDIDO)(documento)).toBe(documento);
  });

  it('bloco com as listas vazias é a decisão de não oferecer atendimento', () => {
    const documento = confirmarSemAtendimento(documentoSemNada());

    expect(documento.atendimento).toEqual({ condicoes: [], recursos: [], tiposDeficiencia: [] });
    expect(valoresDoFormulario(documento, CATALOGOS).decidido).toBe(true);
    expect(idaEVolta(documento)).toEqual(documento);
  });

  it('decidir sem marcar nenhum item cria o bloco com as três listas vazias', () => {
    const editado = edicaoDoPasso({ ...NAO_DECIDIDO, decidido: true })(documentoSemNada());

    expect(editado.atendimento).toEqual({ condicoes: [], recursos: [], tiposDeficiencia: [] });
  });

  it('confirmar que não oferece atendimento leva embora os itens que havia', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');

    expect(confirmarSemAtendimento(documento).atendimento).toEqual({
      condicoes: [],
      recursos: [],
      tiposDeficiencia: [],
    });
  });

  it('desfazer a decisão remove o bloco', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');

    expect(edicaoDoPasso(NAO_DECIDIDO)(documento)).not.toHaveProperty('atendimento');
  });

  it('item novo entra só com o código, sem nome gravado', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const valores = valoresDoFormulario(documento, CATALOGOS);
    const comPcd = { ...valores, condicoes: [...valores.condicoes, { codigo: 'PCD', nome: '' }] };

    const condicoes = edicaoDoPasso(comPcd)(documento).atendimento?.condicoes;

    expect(condicoes).toEqual([
      { condicaoCodigo: 'MOBILIDADE_REDUZIDA', condicaoNome: 'Mobilidade reduzida' },
      { condicaoCodigo: 'PCD' },
    ]);
  });

  it('o item novo mostra o nome do catálogo enquanto a API não o grava', () => {
    const documento = edicaoDoPasso({
      ...NAO_DECIDIDO,
      decidido: true,
      condicoes: [{ codigo: 'PCD', nome: '' }],
    })(documentoSemNada());

    expect(valoresDoFormulario(documento, CATALOGOS).condicoes).toEqual([
      { codigo: 'PCD', nome: 'Pessoa com deficiência', origem: 0 },
    ]);
  });

  it('desmarcar o último item deixa a lista vazia, que é uma decisão e não uma ausência', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const valores = { ...valoresDoFormulario(documento, CATALOGOS), recursos: [] };

    expect(edicaoDoPasso(valores)(documento).atendimento?.recursos).toEqual([]);
  });

  it('lista ausente dentro do bloco continua ausente quando nada foi marcado', () => {
    const documento = {
      ...documentoSemNada(),
      atendimento: { condicoes: [{ condicaoCodigo: 'PCD' }] },
    };

    expect(idaEVolta(documento)).toEqual(documento);
  });

  it('preserva itens novos com o mesmo código', () => {
    const repetido = { codigo: 'LEDOR', nome: '' };
    const valores = { ...NAO_DECIDIDO, decidido: true, recursos: [repetido, repetido] };

    expect(edicaoDoPasso(valores)(documentoSemNada()).atendimento?.recursos).toEqual([
      { recursoCodigo: 'LEDOR' },
      { recursoCodigo: 'LEDOR' },
    ]);
  });

  it('devolve intacto tudo fora do bloco e não altera o documento recebido', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const antes = structuredClone(documento);

    const editado = edicaoDoPasso({ ...NAO_DECIDIDO, decidido: true })(documento);

    expect({ ...editado, atendimento: undefined }).toEqual({ ...antes, atendimento: undefined });
    expect(documento).toEqual(antes);
  });
});

describe('itens de atendimento repetidos', () => {
  it('preserva o nome da segunda condição ao remover a primeira', () => {
    const documento = {
      ...documentoSemNada(),
      atendimento: {
        condicoes: [
          { condicaoCodigo: 'PCD', condicaoNome: 'primeira' },
          { condicaoCodigo: 'PCD', condicaoNome: 'segunda' },
        ],
      },
    };
    const valores = valoresDoFormulario(documento, CATALOGOS);
    const editado = edicaoDoPasso({ ...valores, condicoes: valores.condicoes.slice(1) })(documento);
    expect(editado.atendimento?.condicoes).toEqual([
      { condicaoCodigo: 'PCD', condicaoNome: 'segunda' },
    ]);
  });
});
