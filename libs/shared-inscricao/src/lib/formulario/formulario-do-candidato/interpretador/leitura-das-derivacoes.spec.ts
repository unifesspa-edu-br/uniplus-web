import { expect, it } from 'vitest';
import { lerAgregado, lerDerivacao } from './leitura-das-derivacoes';

it('recusa derivação sem regras', () => {
  expect(() => lerDerivacao({ fatoCodigo: 'A', booleano: false, regras: [] }, 'derivacao')).toThrow(
    'precisa de ao menos uma regra',
  );
});

it('recusa regra sem condição explícita', () => {
  expect(() =>
    lerDerivacao({ fatoCodigo: 'A', booleano: false, regras: [{}] }, 'derivacao'),
  ).toThrow('não diz quando ativa');
});

it('recusa contribuição vazia para derivação não booleana', () => {
  const regra = { quando: [], contribui: ' ' };
  expect(() =>
    lerDerivacao({ fatoCodigo: 'A', booleano: false, regras: [regra] }, 'derivacao'),
  ).toThrow('precisa contribuir');
});

it('lê derivação booleana sempre ativa sem contribuição', () => {
  const resultado = lerDerivacao(
    { fatoCodigo: ' A ', booleano: true, regras: [{ quando: [] }] },
    'derivacao',
  );
  expect(resultado).toEqual({
    fatoCodigo: 'A',
    booleano: true,
    regras: [{ quando: { clausulas: [] }, contribui: null }],
    dependencias: [],
  });
});

it('recusa derivação que depende do próprio fato', () => {
  const regra = { quando: [[{ fato: 'A', operador: 'IGUAL', valor: true }]] };
  expect(() =>
    lerDerivacao({ fatoCodigo: 'A', booleano: true, regras: [regra] }, 'derivacao'),
  ).toThrow('cita o próprio fato');
});

it('lê agregado com operação admitida e recusa operação desconhecida', () => {
  const agregado = { codigo: 'A', grupoCodigo: 'G', fatoDeMembro: 'F', operacao: 'EXISTE' };
  expect(lerAgregado(agregado, 'agregado')).toEqual(agregado);
  expect(() => lerAgregado({ ...agregado, operacao: 'OUTRA' }, 'agregado')).toThrow(
    'EXISTE ou VALORES_PRESENTES',
  );
});
