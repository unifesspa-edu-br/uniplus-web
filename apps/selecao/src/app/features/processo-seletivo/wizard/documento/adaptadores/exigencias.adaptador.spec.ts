import {
  AplicabilidadeDaExigencia,
  FormaDeComprovacaoDaConfiguracao,
  type DocumentoDaConfiguracao,
} from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { catalogoPorCodigo } from '../catalogos-por-codigo';
import { documentoSemNada, exemploDoContrato, NOMES_DOS_EXEMPLOS } from '../exemplos.testing';
import { umDocumentoComExigencias } from '../exigencias.testing';
import {
  edicaoDoPasso,
  valoresDoFormulario,
  type CatalogosDasExigencias,
  type ValoresDasExigencias,
} from './exigencias.adaptador';

const CATALOGOS: CatalogosDasExigencias = {
  tiposDeDocumento: catalogoPorCodigo([
    { codigo: 'COMPROVANTE_RENDA', rotulo: 'Comprovante de renda' },
  ]),
};

function ler(documento: DocumentoDaConfiguracao): ValoresDasExigencias {
  return valoresDoFormulario(documento, CATALOGOS);
}

function idaEVolta(documento: DocumentoDaConfiguracao): DocumentoDaConfiguracao {
  return edicaoDoPasso(ler(documento))(documento);
}

describe('adaptador do passo Exigências', () => {
  it.each(NOMES_DOS_EXEMPLOS)('devolve o exemplo %s idêntico depois de ler e editar', (nome) => {
    const documento = exemploDoContrato(nome);

    expect(JSON.stringify(idaEVolta(documento))).toBe(JSON.stringify(documento));
    expect(idaEVolta(documento)).toBe(documento);
  });

  it('o documento com todos os campos que o catálogo preenche volta como a mesma instância', () => {
    const documento = umDocumentoComExigencias();

    expect(idaEVolta(documento)).toBe(documento);
  });

  it('lê a exigência com o gatilho, a idade máxima e o nome do tipo de documento', () => {
    const [identificacao, renda] = ler(umDocumentoComExigencias()).exigencias;

    expect(identificacao).toMatchObject({
      tipoDocumentoRotulo: 'Documento de identificação',
      obrigatorio: true,
      formatosPermitidos: { qualquer: true, lista: [] },
      idadeMaximaEmissao: null,
    });
    expect(renda).toMatchObject({
      tipoDocumentoRotulo: 'Comprovante de renda',
      aplicabilidade: AplicabilidadeDaExigencia.Condicional,
      obrigatorio: null,
      tamanhoMaximoBytes: '5242880',
      idadeMaximaEmissao: { valor: '90', unidade: 'DIAS', referenciaTipo: 'FIM_INSCRICAO' },
    });
    expect(renda.condicaoGatilho).toHaveLength(1);
  });

  it('lê as regras pela posição que ocupam em cada grupo', () => {
    const [regraPrincipal, ou] = ler(umDocumentoComExigencias()).regrasDeComprovacao;

    expect(regraPrincipal.itens.map((regra) => regra.origem)).toEqual([0, 1]);
    expect(regraPrincipal.itens[1]).toMatchObject({
      exigenciaChave: 'comprovante-de-renda',
      quantidadeMinima: '2',
    });
    expect(ou).toMatchObject({
      origem: 1,
      forma: FormaDeComprovacaoDaConfiguracao.QUANTIDADE_MINIMA_DE_ITENS,
      itens: [],
    });
  });

  it('sem documentos exigidos nada é declarado e a seção não é criada', () => {
    const documento = documentoSemNada();

    expect(ler(documento)).toEqual({ exigencias: [], regrasDeComprovacao: [] });
    expect(idaEVolta(documento)).toBe(documento);
  });

  it('trocar o tipo do documento descarta o que o catálogo dizia do tipo anterior', () => {
    const documento = umDocumentoComExigencias();
    const valores = ler(documento);

    const editado = edicaoDoPasso({
      ...valores,
      exigencias: [{ ...valores.exigencias[0], tipoDocumentoCodigo: 'RG' }, valores.exigencias[1]],
    })(documento);

    expect(editado.documentosExigidos?.exigencias?.[0]).toEqual({
      chave: 'documento-de-identificacao',
      tipoDocumentoCodigo: 'RG',
      faseChave: 'inscricao',
      aplicabilidade: 'Geral',
      obrigatorio: true,
      formatosPermitidos: { qualquer: true },
    });
    expect(editado.documentosExigidos?.exigencias?.[1]).toBe(
      documento.documentosExigidos?.exigencias?.[1],
    );
  });

  it('repetir o mesmo tipo de documento não descarta os descritivos', () => {
    const documento = umDocumentoComExigencias();
    const valores = ler(documento);

    const editado = edicaoDoPasso({
      ...valores,
      exigencias: [{ ...valores.exigencias[0], obrigatorio: true }, valores.exigencias[1]],
    })(documento);

    expect(editado.documentosExigidos?.exigencias?.[0].tipoDocumentoNome).toBe(
      'Documento de identificação',
    );
  });

  it('esvaziar a idade máxima e os formatos tira os blocos; a base legal retirada sai da lista', () => {
    const documento = umDocumentoComExigencias();
    const valores = ler(documento);
    const [primeira, renda] = valores.exigencias;

    const editado = edicaoDoPasso({
      ...valores,
      exigencias: [
        { ...primeira, formatosPermitidos: null },
        { ...renda, idadeMaximaEmissao: null, basesLegais: [] },
      ],
    })(documento);

    const [semFormatos, semIdade] = editado.documentosExigidos?.exigencias ?? [];
    expect(semFormatos).not.toHaveProperty('formatosPermitidos');
    expect(semIdade).not.toHaveProperty('idadeMaximaEmissao');
    expect(semIdade.basesLegais).toEqual([]);
  });
});
