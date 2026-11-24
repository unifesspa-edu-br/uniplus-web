import { MODOS } from '../deliberacao/regra-de-deliberacao.testing';
import { describe, expect, it } from 'vitest';
import type { RegraDeDeliberacaoDaBanca } from '../../modelos/deliberacao.models';
import type { BancaDeclarada } from '../../modelos/banca.models';
import { comOsIdentificadoresLidos } from './identificadores-das-bancas-lidas';

function banca(tipoBancaId: string, identificadorLocal: string, id: string | null): BancaDeclarada {
  return { id, identificadorLocal, tipoBancaId, regraDeDeliberacao: null, copiaDoTipo: null };
}

describe('comOsIdentificadoresLidos', () => {
  it('associa bancas do mesmo tipo pelo conteúdo mesmo com a leitura em outra ordem', () => {
    const regra: RegraDeDeliberacaoDaBanca = {
      modo: MODOS.colegiadaComVotacao,
      integrantes: '3',
      suplentes: '0',
      quorum: '2',
      criterio: null,
      desempate: null,
      encerramento: null,
      semUnanimidade: null,
    };
    const primeira = { ...banca('a', 'primeira', null), regraDeDeliberacao: regra };
    const segunda = {
      ...banca('a', 'segunda', null),
      regraDeDeliberacao: { ...regra, quorum: '3' },
    };
    const lidas = [
      { ...segunda, id: 'id-2' },
      { ...primeira, id: 'id-1' },
    ];
    const resultado = comOsIdentificadoresLidos([primeira, segunda], lidas);
    expect(resultado.confere && resultado.lista.map((item) => item.id)).toEqual(['id-1', 'id-2']);
  });

  it('recusa bancas novas indistinguíveis', () => {
    const enviadas = [banca('a', '1', null), banca('a', '2', null)];
    const lidas = [banca('a', '3', 'id-1'), banca('a', '4', 'id-2')];
    expect(comOsIdentificadoresLidos(enviadas, lidas)).toEqual({ confere: false });
  });

  it('associa bancas novas idênticas pela posição informada na leitura', () => {
    const enviadas = [banca('a', '1', null), banca('a', '2', null)];
    const lidas = [
      { ...banca('a', '4', 'id-2'), posicaoNoTipo: 2 },
      { ...banca('a', '3', 'id-1'), posicaoNoTipo: 1 },
    ];
    const resultado = comOsIdentificadoresLidos(enviadas, lidas);
    expect(resultado.confere && resultado.lista.map((item) => item.id)).toEqual(['id-1', 'id-2']);
  });

  it('recusa a posição declarada divergente', () => {
    const enviada = banca('a', 'local', null);
    expect(
      comOsIdentificadoresLidos([enviada], [{ ...enviada, id: 'id', posicaoNoTipo: 2 }]),
    ).toEqual({ confere: false });
  });

  it('distingue categorias atendidas independentemente da ordem delas', () => {
    const primeira = { ...banca('a', '1', null), categoriasDocumentoIds: ['a', 'b'] };
    const segunda = { ...banca('a', '2', null), categoriasDocumentoIds: ['c'] };
    const lidas = [
      { ...segunda, id: '2' },
      { ...primeira, id: '1', categoriasDocumentoIds: ['b', 'a'] },
    ];
    const resultado = comOsIdentificadoresLidos([primeira, segunda], lidas);
    expect(resultado.confere && resultado.lista.map((item) => item.id)).toEqual(['1', '2']);
  });

  it('recusa leitura sem uma banca enviada', () => {
    expect(comOsIdentificadoresLidos([banca('a', 'local', null)], [])).toEqual({ confere: false });
  });
  it('aceita retirada e acréscimo do mesmo tipo, inclusive com a nova antes', () => {
    const enviadas = [banca('a', 'nova', null), banca('a', 'mantida', 'id-antigo')];
    const lidas = [banca('a', 'lida', 'id-novo'), banca('a', 'lida', 'id-antigo')];
    expect(comOsIdentificadoresLidos(enviadas, lidas)).toEqual({
      confere: true,
      lista: [banca('a', 'nova', 'id-novo'), banca('a', 'mantida', 'id-antigo')],
    });
  });

  it('recusa quantidade excedente e id diferente', () => {
    expect(comOsIdentificadoresLidos([], [banca('a', 'lida', 'id')])).toEqual({ confere: false });
    expect(
      comOsIdentificadoresLidos([banca('a', 'local', 'id-1')], [banca('a', 'lida', 'id-2')]),
    ).toEqual({ confere: false });
  });
});
