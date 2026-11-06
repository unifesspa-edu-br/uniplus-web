import { describe, expect, it } from 'vitest';
import { cidadeDaUnidade, vigenciaDaUnidade } from './rotulos-da-unidade';
import { reitoria } from './unidades.testing';

describe('rotulos-da-unidade', () => {
  it('vigência aberta diz "Desde"; encerrada mostra o intervalo', () => {
    expect(vigenciaDaUnidade(reitoria)).toBe('Desde 01/01/2020');
    expect(vigenciaDaUnidade({ ...reitoria, vigenciaFim: '2030-12-31' })).toBe(
      '01/01/2020 a 31/12/2030',
    );
  });

  it('data fora do formato é devolvida como veio', () => {
    expect(vigenciaDaUnidade({ ...reitoria, vigenciaInicio: 'sem-data' })).toBe('Desde sem-data');
  });

  it('cidade ausente diz "Não informada"', () => {
    expect(cidadeDaUnidade(reitoria)).toBe('Marabá — PA');
    expect(cidadeDaUnidade({ ...reitoria, cidadeCodigoIbge: null })).toBe('Não informada');
  });
});
