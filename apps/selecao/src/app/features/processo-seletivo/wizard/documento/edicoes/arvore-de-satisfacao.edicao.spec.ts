import { TipoDeNoDaArvore } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { valoresDoFormulario } from '../adaptadores/exigencias.adaptador';
import { catalogoPorCodigo } from '../catalogos-por-codigo';
import { umDocumentoComExigencias } from '../exigencias.testing';
import { definirArvoreDeSatisfacao, type NoDoFormulario } from './arvore-de-satisfacao.edicao';

function nosLidos(documento = umDocumentoComExigencias()) {
  return valoresDoFormulario(documento, { tiposDeDocumento: catalogoPorCodigo([]) })
    .arvoreDeSatisfacao;
}

function filhosDaRaiz(documento: ReturnType<typeof umDocumentoComExigencias>) {
  return documento.documentosExigidos?.arvoreDeSatisfacao?.[0].filhos ?? [];
}

function umNoNovo(exigenciaChave: string): NoDoFormulario {
  return {
    ...nosLidos()[0].filhos[0],
    origem: null,
    exigenciaChave,
    quantidadeMinima: '',
  };
}

describe('árvore de satisfação', () => {
  it('mover um nó entre os irmãos o move no documento e renumera a `ordem` dos irmãos', () => {
    const documento = umDocumentoComExigencias();
    const [raiz, ou] = nosLidos(documento);
    const [identificacao, renda] = raiz.filhos;

    const editado = definirArvoreDeSatisfacao(documento, [
      { ...raiz, filhos: [renda, identificacao] },
      ou,
    ]);

    expect(filhosDaRaiz(editado).map((no) => [no.exigenciaChave, no.ordem])).toEqual([
      ['comprovante-de-renda', 1],
      ['documento-de-identificacao', 2],
    ]);
    expect(filhosDaRaiz(editado)[0].quantidadeMinima).toBe(2);
  });

  it('sem mexer na ordem, a `ordem` fora de sequência que o documento trazia fica como estava', () => {
    const documento = umDocumentoComExigencias();

    const editado = definirArvoreDeSatisfacao(documento, nosLidos(documento));

    expect(editado).toBe(documento);
    expect(filhosDaRaiz(editado)[1].ordem).toBe(9);
  });

  it('acrescentar um nó o põe ao fim e renumera os irmãos', () => {
    const documento = umDocumentoComExigencias();
    const [raiz, ou] = nosLidos(documento);

    const editado = definirArvoreDeSatisfacao(documento, [
      { ...raiz, filhos: [...raiz.filhos, umNoNovo('historico')] },
      ou,
    ]);

    expect(filhosDaRaiz(editado).map((no) => [no.exigenciaChave, no.ordem])).toEqual([
      ['documento-de-identificacao', 1],
      ['comprovante-de-renda', 2],
      ['historico', 3],
    ]);
    expect(filhosDaRaiz(editado)[2]).not.toHaveProperty('quantidadeMinima');
  });

  it('retirar um nó não renumera os irmãos que ficam', () => {
    const documento = umDocumentoComExigencias();
    const [raiz, ou] = nosLidos(documento);

    const editado = definirArvoreDeSatisfacao(documento, [
      { ...raiz, filhos: [raiz.filhos[1]] },
      ou,
    ]);

    expect(filhosDaRaiz(editado).map((no) => no.ordem)).toEqual([9]);
  });

  it('o nó com a mesma origem usada duas vezes é um nó novo na segunda', () => {
    const documento = umDocumentoComExigencias();
    const [raiz, ou] = nosLidos(documento);

    const editado = definirArvoreDeSatisfacao(documento, [
      { ...raiz, filhos: [raiz.filhos[0], raiz.filhos[0]] },
      ou,
    ]);

    expect(filhosDaRaiz(editado)[1]).not.toBe(filhosDaRaiz(documento)[0]);
    expect(filhosDaRaiz(editado)[1].ordem).toBe(2);
  });

  it('o nó vazio de filhos segue com `filhos: []`, e o nó que não os tinha segue sem eles', () => {
    const documento = umDocumentoComExigencias();

    const editado = definirArvoreDeSatisfacao(documento, nosLidos(documento));

    expect(editado.documentosExigidos?.arvoreDeSatisfacao?.[1].filhos).toEqual([]);
    expect(filhosDaRaiz(editado)[0]).not.toHaveProperty('filhos');
  });

  it('trocar o tipo do nó pelo formulário muda o tipo e deixa o resto do nó', () => {
    const documento = umDocumentoComExigencias();
    const [raiz, ou] = nosLidos(documento);

    const editado = definirArvoreDeSatisfacao(documento, [
      { ...raiz, tipo: TipoDeNoDaArvore.OU },
      ou,
    ]);

    expect(editado.documentosExigidos?.arvoreDeSatisfacao?.[0]).toMatchObject({
      tipo: 'OU',
      ordem: 4,
    });
  });
});
