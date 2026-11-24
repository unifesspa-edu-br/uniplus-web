import { TipoUnidadeCodigo } from '@uniplus/shared-data/organizacao';
import { CHIPS_DE_TIPO, OPCOES_DE_TIPO, rotuloDoTipo } from './tipos-de-unidade';

describe('tipos-de-unidade', () => {
  it('apresenta rótulos para os códigos e mantém o filtro numérico', () => {
    expect(OPCOES_DE_TIPO).toHaveLength(11);
    expect(rotuloDoTipo(TipoUnidadeCodigo.PRO_REITORIA)).toBe('Pró-Reitoria');
    expect(CHIPS_DE_TIPO.find((tipo) => tipo.label === 'Pró-Reitoria')?.value).toBe('2');
  });
});
