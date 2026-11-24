import { expect, it } from 'vitest';
import { TipoDoDadoCodigo } from '@uniplus/shared-data/configuracao';
import { tipoDoDadoEscolhido } from './codigos-do-fato';

it('aceita apenas tipos de dado do contrato', () => {
  const codigo = Object.values(TipoDoDadoCodigo)[0];
  expect(tipoDoDadoEscolhido(codigo)).toBe(codigo);
  expect(() => tipoDoDadoEscolhido('desconhecido')).toThrow('Código de fato desconhecido.');
});
