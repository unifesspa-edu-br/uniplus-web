import { describe, expect, it } from 'vitest';

import {
  distribuirRecusasDosDocumentos,
  documentoExigidoNovo,
  ehRecusaDeDocumento,
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
    expect(porDocumento.get(b)).toEqual({
      quando: ['valor'],
      obrigatorio: [],
      prazoParaReenvio: [],
      demais: ['tipo'],
    });
    expect(gerais).toEqual(['lista']);
  });

  it('leva a recusa de obrigatoriedade e de prazo para reenvio ao campo de cada uma', () => {
    const { porDocumento } = distribuirRecusasDosDocumentos(
      [
        { field: 'conteudo.documentosExigidos[0].indeferimento.obrigatorio', message: 'obrig' },
        {
          field: 'conteudo.documentosExigidos[0].indeferimento.abrePrazoParaReenvio',
          message: 'prazo',
        },
        { field: 'conteudo.documentosExigidos[0].indeferimento', message: 'bloco' },
      ],
      [a, b],
    );

    expect(porDocumento.get(a)).toEqual({
      quando: [],
      obrigatorio: ['obrig'],
      prazoParaReenvio: ['prazo'],
      demais: ['bloco'],
    });
  });

  it('reconhece só o caminho dos documentos', () => {
    expect(ehRecusaDeDocumento('conteudo.documentosExigidos[0].faseCodigo')).toBe(true);
    expect(ehRecusaDeDocumento('conteudo.itens[0].rotulo')).toBe(false);
  });
});
