import { describe, expect, it } from 'vitest';

import {
  ehRecusaDoIdentificadorLegivel,
  normalizarIdentificadorLegivel,
  problemaDoIdentificadorLegivel,
} from './identificador-legivel';

describe('problemaDoIdentificadorLegivel', () => {
  it.each(['medicina-2027', 'ps2', 'abc', 'a'.repeat(64), 'pos-educacao-2025'])(
    'aceita %s',
    (valor) => {
      expect(problemaDoIdentificadorLegivel(valor)).toBeNull();
    },
  );

  it('confere o valor sem os espaços das pontas, como o servidor grava', () => {
    expect(problemaDoIdentificadorLegivel('  medicina-2027  ')).toBeNull();
    expect(normalizarIdentificadorLegivel('  medicina-2027  ')).toBe('medicina-2027');
  });

  it('pede o identificador quando está vazio', () => {
    expect(problemaDoIdentificadorLegivel('   ')).toBe(
      'Informe o identificador legível do processo seletivo.',
    );
  });

  it.each(['ps', 'a'.repeat(65)])('recusa o tamanho de %s', (valor) => {
    expect(problemaDoIdentificadorLegivel(valor)).toBe(
      'O identificador legível deve ter entre 3 e 64 caracteres.',
    );
  });

  it.each(['PSIQ-2026', 'psiq 2026', 'seleção-26', '-psiq', 'psiq-', 'psiq--2026', '2026-psiq'])(
    'recusa o formato de %s',
    (valor) => {
      expect(problemaDoIdentificadorLegivel(valor)).toMatch(
        /^O identificador legível deve começar/,
      );
    },
  );

  it.each(['a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'abcdef0123456789abcdef0123456789'])(
    'recusa %s por ter a forma de um Guid',
    (valor) => {
      expect(problemaDoIdentificadorLegivel(valor)).toBe(
        'O identificador legível não pode ter a forma de um identificador técnico (Guid).',
      );
    },
  );
});

describe('ehRecusaDoIdentificadorLegivel', () => {
  it('reconhece as recusas do campo pelo prefixo do código', () => {
    expect(
      ehRecusaDoIdentificadorLegivel(
        'uniplus.selecao.processo_seletivo.identificador_legivel_em_uso',
      ),
    ).toBe(true);
    expect(ehRecusaDoIdentificadorLegivel('uniplus.idempotency.processing_conflict')).toBe(false);
    expect(ehRecusaDoIdentificadorLegivel(undefined)).toBe(false);
  });
});
