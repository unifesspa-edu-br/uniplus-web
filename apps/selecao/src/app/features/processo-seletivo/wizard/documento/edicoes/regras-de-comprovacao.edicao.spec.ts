import { FormaDeComprovacaoDaConfiguracao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { valoresDoFormulario } from '../adaptadores/exigencias.adaptador';
import { catalogoPorCodigo } from '../catalogos-por-codigo';
import { umDocumentoComExigencias } from '../exigencias.testing';
import { definirRegrasDeComprovacao, type RegraDoFormulario } from './regras-de-comprovacao.edicao';

function regrasLidas(documento = umDocumentoComExigencias()) {
  return valoresDoFormulario(documento, { tiposDeDocumento: catalogoPorCodigo([]) })
    .regrasDeComprovacao;
}

function itensDaRegraPrincipal(documento: ReturnType<typeof umDocumentoComExigencias>) {
  return documento.documentosExigidos?.regrasDeComprovacao?.[0].itens ?? [];
}

function umaRegraNova(exigenciaChave: string): RegraDoFormulario {
  return {
    ...regrasLidas()[0].itens[0],
    origem: null,
    exigenciaChave,
    quantidadeMinima: '',
  };
}

describe('conjunto de regras de satisfação', () => {
  it('mover uma regra altera sua posição no grupo', () => {
    const documento = umDocumentoComExigencias();
    const [regraPrincipal, ou] = regrasLidas(documento);
    const [identificacao, renda] = regraPrincipal.itens;

    const editado = definirRegrasDeComprovacao(documento, [
      { ...regraPrincipal, itens: [renda, identificacao] },
      ou,
    ]);

    expect(itensDaRegraPrincipal(editado).map((regra) => regra.exigenciaChave)).toEqual([
      'comprovante-de-renda',
      'documento-de-identificacao',
    ]);
    expect(itensDaRegraPrincipal(editado)[0].quantidadeMinima).toBe(2);
  });

  it('preserva o documento quando a ordem não muda', () => {
    const documento = umDocumentoComExigencias();

    const editado = definirRegrasDeComprovacao(documento, regrasLidas(documento));

    expect(editado).toBe(documento);
  });

  it('acrescenta uma regra ao fim do grupo', () => {
    const documento = umDocumentoComExigencias();
    const [regraPrincipal, ou] = regrasLidas(documento);

    const editado = definirRegrasDeComprovacao(documento, [
      { ...regraPrincipal, itens: [...regraPrincipal.itens, umaRegraNova('historico')] },
      ou,
    ]);

    expect(itensDaRegraPrincipal(editado).map((regra) => regra.exigenciaChave)).toEqual([
      'documento-de-identificacao',
      'comprovante-de-renda',
      'historico',
    ]);
    expect(itensDaRegraPrincipal(editado)[2]).not.toHaveProperty('quantidadeMinima');
  });

  it('retira a regra escolhida do grupo', () => {
    const documento = umDocumentoComExigencias();
    const [regraPrincipal, ou] = regrasLidas(documento);

    const editado = definirRegrasDeComprovacao(documento, [
      { ...regraPrincipal, itens: [regraPrincipal.itens[1]] },
      ou,
    ]);

    expect(itensDaRegraPrincipal(editado).map((regra) => regra.exigenciaChave)).toEqual([
      'comprovante-de-renda',
    ]);
  });

  it('a mesma origem usada duas vezes cria uma regra na segunda', () => {
    const documento = umDocumentoComExigencias();
    const [regraPrincipal, ou] = regrasLidas(documento);

    const editado = definirRegrasDeComprovacao(documento, [
      { ...regraPrincipal, itens: [regraPrincipal.itens[0], regraPrincipal.itens[0]] },
      ou,
    ]);

    expect(itensDaRegraPrincipal(editado)[1]).not.toBe(itensDaRegraPrincipal(documento)[0]);
  });

  it('preserva a distinção entre lista vazia e lista ausente', () => {
    const documento = umDocumentoComExigencias();

    const editado = definirRegrasDeComprovacao(documento, regrasLidas(documento));

    expect(editado.documentosExigidos?.regrasDeComprovacao?.[1].itens).toEqual([]);
    expect(itensDaRegraPrincipal(editado)[0]).not.toHaveProperty('itens');
  });

  it('alterar a forma preserva os demais campos da regra', () => {
    const documento = umDocumentoComExigencias();
    const [regraPrincipal, ou] = regrasLidas(documento);

    const editado = definirRegrasDeComprovacao(documento, [
      { ...regraPrincipal, forma: FormaDeComprovacaoDaConfiguracao.QUANTIDADE_MINIMA_DE_ITENS },
      ou,
    ]);

    expect(editado.documentosExigidos?.regrasDeComprovacao?.[0]).toMatchObject({
      forma: 'QUANTIDADE_MINIMA_DE_ITENS',
    });
  });
});
