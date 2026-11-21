import { describe, expect, it } from 'vitest';
import { PapelDaBancaCodigo } from '@uniplus/shared-data/selecao';
import type { BancaDeclarada } from '../../modelos/banca.models';
import {
  acrescentarBanca,
  gruposPorTipo,
  identificacaoDaBanca,
  moverNoTipo,
  posicaoNoTipo,
  retirarBanca,
} from './lista-de-bancas';

function banca(chave: string, tipoBancaId: string): BancaDeclarada {
  return {
    id: null,
    identificadorLocal: chave,
    tipoBancaId,
    copiaDoTipo: null,
    regraDeDeliberacao: null,
  };
}

describe('lista de bancas', () => {
  const primeira = banca('a', 'entrevista');
  const outra = banca('b', 'prova');
  const segunda = banca('c', 'entrevista');
  const lista = [primeira, outra, segunda];

  it('acrescenta e retira pela identidade, inclusive a única banca', () => {
    expect(acrescentarBanca([primeira], segunda)).toEqual([primeira, segunda]);
    expect(retirarBanca(lista, 'a')).toEqual([outra, segunda]);
    expect(retirarBanca([primeira], 'a')).toEqual([]);
  });

  it('troca somente com a vizinha do mesmo tipo e respeita os limites', () => {
    expect(moverNoTipo(lista, 'c', -1)).toEqual([segunda, outra, primeira]);
    expect(moverNoTipo(lista, 'a', -1)).toEqual(lista);
    expect(moverNoTipo(lista, 'c', 1)).toEqual(lista);
    expect(moverNoTipo(lista, 'b', 1)).toEqual(lista);
    expect(moverNoTipo(lista, 'ausente', 1)).toEqual(lista);
  });

  it('agrupa na ordem da primeira aparição e identifica pela posição no tipo', () => {
    expect(gruposPorTipo(lista)).toEqual([[primeira, segunda], [outra]]);
    expect(posicaoNoTipo(lista, segunda)).toBe(2);
    expect(identificacaoDaBanca(lista, segunda, 'Banca de entrevista')).toBe(
      'Banca de entrevista 2',
    );
    const gravada = {
      ...primeira,
      copiaDoTipo: {
        rotulo: 'Cópia',
        papel: { codigo: PapelDaBancaCodigo.AVALIA_O_MERITO, rotulo: 'Avalia candidato' },
        exigeDuasOuMaisBancas: false,
        encerraRecursoNaPrimeiraInstancia: false,
      },
    };
    expect(identificacaoDaBanca([gravada], gravada, 'Cadastro')).toBe('Cópia 1');
  });
});
