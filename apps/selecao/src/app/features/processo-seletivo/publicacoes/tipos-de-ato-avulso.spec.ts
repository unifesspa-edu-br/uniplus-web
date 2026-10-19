import type { TipoAtoPublicadoDto } from '@uniplus/shared-data/publicacoes';
import { describe, expect, it } from 'vitest';

import { codigosQueCongelam, tiposDeDocumentoAvulso } from './tipos-de-ato-avulso';

function tipo(codigo: string, sobrescritas: Partial<TipoAtoPublicadoDto> = {}): TipoAtoPublicadoDto {
  return {
    id: `id-${codigo}`,
    codigo,
    nome: codigo,
    congelaConfiguracao: false,
    unicoPorObjeto: false,
    efeitoIrreversivel: false,
    ehResultado: false,
    publicavelComoAvulso: true,
    exigeAtoCorrigido: false,
    vigenciaInicio: '2026-01-01',
    vigenciaFim: null,
    baseLegal: null,
    criadoEm: '2026-01-01T00:00:00Z',
    ...sobrescritas,
  };
}

describe('tiposDeDocumentoAvulso', () => {
  it('oferece só o que o catálogo declara publicável como documento avulso', () => {
    const tipos = [
      tipo('AVISO'),
      tipo('RESULTADO_PRELIMINAR', { publicavelComoAvulso: false, ehResultado: true }),
      tipo('EDITAL_ABERTURA', { publicavelComoAvulso: false, congelaConfiguracao: true }),
    ];

    expect(tiposDeDocumentoAvulso(tipos, '2026-10-19').map((t) => t.codigo)).toEqual(['AVISO']);
  });

  it('não oferece o tipo cuja vigência terminou nem o que ainda não começou', () => {
    const tipos = [
      tipo('ENCERRADO', { vigenciaFim: '2026-10-19' }),
      tipo('FUTURO', { vigenciaInicio: '2026-10-20' }),
      tipo('EM_VIGOR', { vigenciaFim: '2026-10-20' }),
    ];

    expect(tiposDeDocumentoAvulso(tipos, '2026-10-19').map((t) => t.codigo)).toEqual(['EM_VIGOR']);
  });

  it('mostra um tipo por código quando duas versões vigoram', () => {
    const tipos = [tipo('AVISO', { id: 'v1' }), tipo('AVISO', { id: 'v2' })];

    expect(tiposDeDocumentoAvulso(tipos, '2026-10-19')).toHaveLength(1);
  });

  it('marca o tipo que corrige outro, para a tela pedir o ato corrigido', () => {
    const [errata] = tiposDeDocumentoAvulso([tipo('ERRATA', { exigeAtoCorrigido: true })], '2026-10-19');

    expect(errata.exigeAtoCorrigido).toBe(true);
  });
});

describe('codigosQueCongelam', () => {
  it('inclui o código de qualquer versão que congela a configuração', () => {
    const tipos = [
      tipo('EDITAL_ABERTURA', { congelaConfiguracao: true, vigenciaFim: '2026-01-01' }),
      tipo('AVISO'),
    ];

    expect([...codigosQueCongelam(tipos)]).toEqual(['EDITAL_ABERTURA']);
  });
});
