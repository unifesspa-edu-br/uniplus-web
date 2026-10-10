import { derivadosDoSistema } from './derivados-do-sistema';

/** Os derivados que o servidor calcula na submissão, calculados aqui só para mostrar. */
describe('derivadosDoSistema', () => {
  const MARABA = { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' };

  it('a idade é a de anos completos na data de referência, não na de hoje', () => {
    const naVespera = derivadosDoSistema({ DATA_NASCIMENTO: '1984-03-17' }, '2026-03-16');
    const noAniversario = derivadosDoSistema({ DATA_NASCIMENTO: '1984-03-17' }, '2026-03-17');

    expect(naVespera).toEqual([{ fatoCodigo: 'FAIXA_ETARIA', valor: 41, exibicao: '41 anos' }]);
    expect(noAniversario[0]?.valor).toBe(42);
  });

  it('sem data de referência, a idade não é calculada', () => {
    expect(derivadosDoSistema({ DATA_NASCIMENTO: '1984-03-17' }, null)).toEqual([]);
  });

  it('a UF e o município vêm da cidade do endereço residencial; sem cidade, nada', () => {
    expect(
      derivadosDoSistema({ ENDERECO_RESIDENCIAL: { cep: '68507590', cidade: MARABA } }, null),
    ).toEqual([
      { fatoCodigo: 'UF_RESIDENCIA', valor: 'PA', exibicao: 'PA' },
      { fatoCodigo: 'MUNICIPIO_RESIDENCIA', valor: '1504208', exibicao: 'Marabá (PA)' },
    ]);
    expect(
      derivadosDoSistema({ ENDERECO_RESIDENCIAL: { cep: '68507590', cidade: null } }, null),
    ).toEqual([]);
  });
});
