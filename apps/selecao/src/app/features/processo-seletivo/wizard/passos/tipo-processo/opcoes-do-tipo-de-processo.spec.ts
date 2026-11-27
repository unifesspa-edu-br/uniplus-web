import { TipoProcessoOption } from '../../processo-seletivo.models';
import { incluirTipoRetomado } from './opcoes-do-tipo-de-processo';

const CATALOGO: readonly TipoProcessoOption[] = [
  { value: 'tipo-1', codigo: 'SISU', name: 'SiSU', description: 'Código: SISU', tags: ['SISU'] },
];

const RETOMADO = { origemId: 'tipo-2', codigo: 'ANTIGO', nome: 'Tipo antigo' };

describe('opções do tipo de processo', () => {
  it('mantém o catálogo quando o processo não declara tipo', () => {
    expect(incluirTipoRetomado(CATALOGO, undefined)).toBe(CATALOGO);
  });

  it('mantém o catálogo quando o tipo do processo já está nele', () => {
    const tipo = { ...RETOMADO, origemId: 'tipo-1' };

    expect(incluirTipoRetomado(CATALOGO, tipo as never)).toBe(CATALOGO);
  });

  it('acrescenta o tipo que o catálogo atual já não lista, antes dos demais', () => {
    const opcoes = incluirTipoRetomado(CATALOGO, RETOMADO as never);

    expect(opcoes).toHaveLength(2);
    expect(opcoes[0]).toMatchObject({ value: 'tipo-2', codigo: 'ANTIGO', name: 'Tipo antigo' });
    expect(opcoes[1]).toBe(CATALOGO[0]);
  });
});
