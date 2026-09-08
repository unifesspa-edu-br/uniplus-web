import type { RegraCatalogoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { regrasEscolhiveis } from './regra-escolhivel';

function regra(patch: Partial<RegraCatalogoDto>): RegraCatalogoDto {
  return {
    codigo: '',
    versao: '',
    tipo: 'regra_calculo',
    esquemaArgs: {},
    invariantes: {},
    baseLegal: 'Base legal',
    hash: 'hash-1',
    modalidadesAdmitidas: null,
    ...patch,
  };
}

describe('regrasEscolhiveis', () => {
  it('exibe o catálogo tal como veio, projetando só codigo/versao/baseLegal', () => {
    const catalogo = [regra({ codigo: 'A', versao: '1.0', baseLegal: 'Lei X' })];

    expect(regrasEscolhiveis(catalogo, '', '')).toEqual([
      { codigo: 'A', versao: '1.0', baseLegal: 'Lei X' },
    ]);
  });

  it('não acrescenta nada quando nenhuma regra está selecionada', () => {
    const catalogo = [regra({ codigo: 'A', versao: '1.0' })];

    expect(regrasEscolhiveis(catalogo, '', '')).toHaveLength(1);
  });

  it('não duplica quando a selecionada já está no catálogo', () => {
    const catalogo = [regra({ codigo: 'A', versao: '1.0' })];

    expect(regrasEscolhiveis(catalogo, 'A', '1.0')).toHaveLength(1);
  });

  /**
   * CA-08: entrada de catálogo que não esteja mais disponível ainda aparece —
   * senão o `<select>` de um processo hidratado ficaria em branco, e o
   * operador gravaria por cima sem perceber que trocou de regra.
   */
  it('acrescenta a regra gravada quando ela saiu do catálogo atual', () => {
    const catalogo = [regra({ codigo: 'A', versao: '1.0' })];

    const opcoes = regrasEscolhiveis(catalogo, 'B', '2.0');

    expect(opcoes).toEqual([
      { codigo: 'A', versao: '1.0', baseLegal: 'Base legal' },
      { codigo: 'B', versao: '2.0', baseLegal: null },
    ]);
  });

  it('acrescenta mesmo quando o catálogo está vazio', () => {
    expect(regrasEscolhiveis([], 'B', '2.0')).toEqual([
      { codigo: 'B', versao: '2.0', baseLegal: null },
    ]);
  });
});
