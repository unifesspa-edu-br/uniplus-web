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

const EM_USO = 'uniplus.selecao.processo_seletivo.identificador_legivel_em_uso';

function problema(code: string, errors?: { field?: string; code: string; message: string }[]) {
  return { code, errors };
}

describe('ehRecusaDoIdentificadorLegivel', () => {
  it('reconhece a recusa de uma só causa pelo código, sem lista', () => {
    expect(ehRecusaDoIdentificadorLegivel(problema(EM_USO))).toBe(true);
    expect(
      ehRecusaDoIdentificadorLegivel(problema('uniplus.idempotency.processing_conflict')),
    ).toBe(false);
  });

  it('reconhece o identificador em segundo lugar da lista, pelo campo apontado', () => {
    const lista = [
      { field: 'nome', code: 'obrigatorio', message: 'O nome do processo seletivo é obrigatório.' },
      { field: 'identificadorLegivel', code: 'tamanho', message: 'Identificador curto demais.' },
    ];
    expect(ehRecusaDoIdentificadorLegivel(problema('obrigatorio', lista))).toBe(true);
  });

  it('reconhece o identificador em uso na lista pelo código da causa', () => {
    const lista = [
      { field: 'nome', code: 'obrigatorio', message: 'O nome é obrigatório.' },
      { code: EM_USO, message: 'O identificador legível já é usado por outro processo seletivo.' },
    ];
    expect(ehRecusaDoIdentificadorLegivel(problema('obrigatorio', lista))).toBe(true);
  });

  it('não reconhece lista sem causa do identificador, ainda que o código principal seja outro', () => {
    const lista = [{ field: 'nome', code: 'obrigatorio', message: 'O nome é obrigatório.' }];
    expect(ehRecusaDoIdentificadorLegivel(problema('obrigatorio', lista))).toBe(false);
  });
});
