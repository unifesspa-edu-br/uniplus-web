import { SituacaoDoRegistroDoAto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { atosQueAdmitemCorrecao, idsJaCorrigidos, type AtoDaCadeia } from './cadeia-de-correcao';

function ato(id: string, sobrescritas: Partial<AtoDaCadeia> = {}): AtoDaCadeia {
  return {
    id,
    atoCorrigidoId: null,
    situacao: SituacaoDoRegistroDoAto.registrado,
    tipoCodigo: 'AVISO',
    ...sobrescritas,
  };
}

describe('atosQueAdmitemCorrecao', () => {
  const nenhumCongela: ReadonlySet<string> = new Set();

  it('deixa de oferecer o ato original quando a correção dele já existe', () => {
    const aviso = ato('aviso');
    const errata = ato('errata', { tipoCodigo: 'ERRATA', atoCorrigidoId: 'aviso' });

    const oferecidos = atosQueAdmitemCorrecao([errata, aviso], nenhumCongela);

    expect(oferecidos.map((a) => a.id)).toEqual(['errata']);
  });

  it('oferece só o mais recente da cadeia, que é o que a correção seguinte aponta', () => {
    const aviso = ato('aviso');
    const errata1 = ato('errata-1', { tipoCodigo: 'ERRATA', atoCorrigidoId: 'aviso' });
    const errata2 = ato('errata-2', { tipoCodigo: 'ERRATA', atoCorrigidoId: 'errata-1' });

    const oferecidos = atosQueAdmitemCorrecao([errata2, errata1, aviso], nenhumCongela);

    expect(oferecidos.map((a) => a.id)).toEqual(['errata-2']);
  });

  it('conta a correção ainda em processamento: o ato já tem quem o corrija', () => {
    const aviso = ato('aviso');
    const errataPendente = ato('errata', {
      tipoCodigo: 'ERRATA',
      atoCorrigidoId: 'aviso',
      situacao: SituacaoDoRegistroDoAto.pendente,
    });

    expect(atosQueAdmitemCorrecao([errataPendente, aviso], nenhumCongela)).toEqual([]);
  });

  it('não oferece o ato que ainda não foi registrado', () => {
    const pendente = ato('aviso', { situacao: SituacaoDoRegistroDoAto.pendente });

    expect(atosQueAdmitemCorrecao([pendente], nenhumCongela)).toEqual([]);
  });

  it('não oferece o ato de um tipo que congela a configuração, que só se corrige por retificação do edital', () => {
    const edital = ato('edital', { tipoCodigo: 'EDITAL_ABERTURA' });
    const aviso = ato('aviso');

    const oferecidos = atosQueAdmitemCorrecao([aviso, edital], new Set(['EDITAL_ABERTURA']));

    expect(oferecidos.map((a) => a.id)).toEqual(['aviso']);
  });
});

describe('idsJaCorrigidos', () => {
  it('reúne os atos citados como corrigidos, sem repetir', () => {
    const atos = [ato('a'), ato('b', { atoCorrigidoId: 'a' }), ato('c', { atoCorrigidoId: 'a' })];

    expect([...idsJaCorrigidos(atos)]).toEqual(['a']);
  });
});
