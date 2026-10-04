import { describe, expect, it } from 'vitest';
import type { TermoConsentimentoDto } from '@uniplus/shared-data/configuracao';
import { termoDisponivelDe } from './termos-disponiveis';

const versao = (id: string, promovidaEm: string) => ({ id, texto: 't', baseLegal: 'b', formaAceite: 'CHECKBOX', hash: 'h', promovidaEm });

describe('termoDisponivelDe', () => {
  it('oferece a versão promovida mais nova primeiro, que é a do termo recém-exigido', () => {
    const termo = {
      id: 'T1',
      nome: 'Consentimento LGPD',
      versoes: [versao('V1', '2026-08-01T12:00:00Z'), versao('V2', '2026-09-15T12:00:00Z')],
    } as unknown as TermoConsentimentoDto;

    expect(termoDisponivelDe(termo).versoes.map((v) => v.versaoId)).toEqual(['V2', 'V1']);
  });
});
