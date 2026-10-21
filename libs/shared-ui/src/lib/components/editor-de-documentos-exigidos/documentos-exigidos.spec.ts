import { describe, expect, it } from 'vitest';

import {
  baseLegalNova,
  distribuirRecusasDosDocumentos,
  documentoExigidoNovo,
  ehRecusaDeDocumento,
  temNormaResolvida,
} from './documentos-exigidos';

describe('recusas dos documentos exigidos', () => {
  const a = documentoExigidoNovo('INSCRICAO', 'LAUDO_MEDICO');
  const b = documentoExigidoNovo('INSCRICAO', 'ATESTADO');

  it('separa a recusa da condição das demais do mesmo documento, pela posição enviada', () => {
    const { porDocumento, gerais } = distribuirRecusasDosDocumentos(
      [
        { field: 'conteudo.documentosExigidos[1].quando[0][0].valor', message: 'valor' },
        { field: 'conteudo.documentosExigidos[1].tipoDocumentoCodigo', message: 'tipo' },
        { field: 'conteudo.documentosExigidos', message: 'lista' },
      ],
      [a, b],
    );

    expect(porDocumento.get(a)).toBeUndefined();
    expect(porDocumento.get(b)).toEqual({ quando: ['valor'], demais: ['tipo'] });
    expect(gerais).toEqual(['lista']);
  });

  it('reconhece só o caminho dos documentos', () => {
    expect(ehRecusaDeDocumento('conteudo.documentosExigidos[0].faseCodigo')).toBe(true);
    expect(ehRecusaDeDocumento('conteudo.itens[0].rotulo')).toBe(false);
  });
});

describe('norma da folha', () => {
  it('nasce em branco, no alcance e no status do caso comum, sem observação', () => {
    expect(baseLegalNova()).toEqual({
      referencia: '',
      abrangencia: 'INTERNA_EDITAL',
      status: 'RESOLVIDO',
      observacao: null,
    });
  });

  it('só sustenta a exigência com referência e situação resolvida', () => {
    expect(temNormaResolvida([baseLegalNova()])).toBe(false);
    expect(temNormaResolvida([{ ...baseLegalNova(), referencia: 'Lei 12.711/2012' }])).toBe(true);
    expect(
      temNormaResolvida([{ ...baseLegalNova(), referencia: 'Lei', status: 'PENDENTE' }]),
    ).toBe(false);
  });
});
