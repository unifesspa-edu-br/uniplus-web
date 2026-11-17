import { TipoDeDecisaoDoDocumento } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { catalogoPorCodigo } from '../catalogos-por-codigo';
import { umDocumentoComExigencias } from '../exigencias.testing';
import { valoresDoFormulario } from '../adaptadores/exigencias.adaptador';
import { acrescentarExigencia, definirExigencias } from './exigencias.edicao';

const SEM_CATALOGO = { tiposDeDocumento: catalogoPorCodigo([]) };

function exigenciasLidas(documento = umDocumentoComExigencias()) {
  return valoresDoFormulario(documento, SEM_CATALOGO).exigencias;
}

describe('exigências', () => {
  it('acrescentar atribui a chave a partir do nome e põe a exigência ao fim', () => {
    const documento = umDocumentoComExigencias();

    const editado = acrescentarExigencia(documento, 'HISTORICO', 'Histórico escolar', {
      original: documento,
      criadas: [],
    });

    expect(editado.documentosExigidos?.exigencias?.at(-1)).toEqual({
      chave: 'historico-escolar',
      tipoDocumentoCodigo: 'HISTORICO',
    });
  });

  it('a chave nova não coincide com a de outra exigência nem com a que outra parte cita', () => {
    const documento = {
      ...umDocumentoComExigencias(),
      motivos: [
        { faseChave: 'historico', tipoCodigo: TipoDeDecisaoDoDocumento.CLASSIFICACAO, codigo: 'M' },
      ],
    };

    const editado = acrescentarExigencia(documento, 'HISTORICO', 'Histórico', {
      original: documento,
      criadas: [],
    });

    expect(editado.documentosExigidos?.exigencias?.at(-1)?.chave).not.toBe('historico');
    const repetida = acrescentarExigencia(editado, 'HISTORICO', 'Histórico', {
      original: documento,
      criadas: [],
    });
    const chaves = repetida.documentosExigidos?.exigencias?.map((exigencia) => exigencia.chave);
    expect(new Set(chaves).size).toBe(chaves?.length);
  });

  it('reserva a chave da exigência removida e as criadas na edição', () => {
    const original = {
      ...umDocumentoComExigencias(),
      documentosExigidos: { exigencias: [{ chave: 'documento-de-identificacao' }] },
    };
    const removido = definirExigencias(original, []);
    const editado = acrescentarExigencia(removido, 'DOCUMENTO', 'Documento de identificação', {
      original,
      criadas: ['documento-de-identificacao-2'],
    });
    expect(editado.documentosExigidos?.exigencias?.[0].chave).toBe('documento-de-identificacao-3');
  });

  it('a exigência que o formulário deixa de trazer sai, e a árvore segue citando a chave dela', () => {
    const documento = umDocumentoComExigencias();
    const [, renda] = exigenciasLidas(documento);

    const editado = definirExigencias(documento, [renda]);

    expect(editado.documentosExigidos?.exigencias?.map((exigencia) => exigencia.chave)).toEqual([
      'comprovante-de-renda',
    ]);
    expect(editado.documentosExigidos?.arvoreDeSatisfacao).toBe(
      documento.documentosExigidos?.arvoreDeSatisfacao,
    );
  });

  it('mover a exigência no formulário é movê-la no documento', () => {
    const documento = umDocumentoComExigencias();
    const [identificacao, renda] = exigenciasLidas(documento);

    const editado = definirExigencias(documento, [renda, identificacao]);

    expect(editado.documentosExigidos?.exigencias?.map((exigencia) => exigencia.chave)).toEqual([
      'comprovante-de-renda',
      'documento-de-identificacao',
    ]);
  });

  it('o gatilho e a obrigatoriedade só mudam quando o formulário os muda', () => {
    const documento = umDocumentoComExigencias();
    const [identificacao, renda] = exigenciasLidas(documento);

    const editado = definirExigencias(documento, [
      { ...identificacao, obrigatorio: false },
      { ...renda, condicaoGatilho: null },
    ]);

    const [primeira, segunda] = editado.documentosExigidos?.exigencias ?? [];
    expect(primeira.obrigatorio).toBe(false);
    expect(segunda).not.toHaveProperty('condicaoGatilho');
  });

  it('o tamanho fora do alcance não vira zero nem nulo: o campo sai do documento', () => {
    const documento = umDocumentoComExigencias();
    const [identificacao, renda] = exigenciasLidas(documento);

    const editado = definirExigencias(documento, [
      identificacao,
      { ...renda, tamanhoMaximoBytes: '1e999' },
    ]);

    expect(editado.documentosExigidos?.exigencias?.[1].tamanhoMaximoBytes).toBeUndefined();
  });
});
