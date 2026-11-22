import { describe, expect, it } from 'vitest';

import type { BancaDeclarada } from '../../modelos/banca.models';
import type { RecusaOrdenada } from '../recusas/ordem-das-recusas';
import { NOTA_DA_BANCA_AUSENTE, notaDaBanca, recusasDasBancas } from './recusas-das-bancas';

function banca(identificadorLocal: string): BancaDeclarada {
  return {
    id: null,
    identificadorLocal,
    tipoBancaId: 'entrevista',
    regraDeDeliberacao: null,
    copiaDoTipo: null,
  };
}

function recusa(campo: string, ordem: number, parcial: Partial<RecusaOrdenada> = {}) {
  return {
    campo,
    codigo: `uniplus.selecao.banca.recusa_${ordem}`,
    mensagem: `Mensagem ${ordem}.`,
    pagina: null,
    ordem,
    resposta: 1,
    origem: 'gravacao',
    aConferir: false,
    ...parcial,
  } satisfies RecusaOrdenada;
}

const NA_TELA = [banca('banca-1'), banca('banca-2')];

describe('recusasDasBancas', () => {
  it('deixa com a banca da tela, e não no controle, a recusa que aponta só o identificador dela', () => {
    const { daBanca, porControle, secao } = recusasDasBancas(
      [recusa('bancas.banca-1', 1)],
      'bancas',
      NA_TELA,
    );

    expect(daBanca.get('banca-1')?.map((r) => r.ordem)).toEqual([1]);
    expect(porControle.size).toBe(0);
    expect(secao).toEqual([]);
  });

  it('deixa no controle da banca, e não na banca inteira, a recusa que o aponta', () => {
    const { daBanca, porControle, secao } = recusasDasBancas(
      [recusa('bancas.banca-2.quorum', 0), recusa('bancas.banca-2.criterio', 2)],
      'bancas',
      NA_TELA,
    );

    expect(porControle.get('banca-2')?.quorum?.map((r) => r.ordem)).toEqual([0]);
    expect(porControle.get('banca-2')?.criterio?.map((r) => r.ordem)).toEqual([2]);
    expect(daBanca.size).toBe(0);
    expect(secao).toEqual([]);
  });

  it('trata a regra inteira e as categorias como controles da banca', () => {
    const { daBanca, porControle } = recusasDasBancas(
      [recusa('bancas.banca-1.regra', 0), recusa('bancas.banca-1.categoriasDocumentoIds', 1)],
      'bancas',
      NA_TELA,
    );

    expect(porControle.get('banca-1')?.regra?.map((r) => r.ordem)).toEqual([0]);
    expect(porControle.get('banca-1')?.categoriasDocumentoIds?.map((r) => r.ordem)).toEqual([1]);
    expect(daBanca.size).toBe(0);
  });

  it('guarda a recusa a conferir junto da ativa do mesmo controle, a ativa primeiro', () => {
    const { porControle } = recusasDasBancas(
      [
        recusa('bancas.banca-1.quorum', 0, { aConferir: true, codigo: 'uniplus.antiga' }),
        recusa('bancas.banca-1.quorum', 1),
      ],
      'bancas',
      NA_TELA,
    );

    expect(porControle.get('banca-1')?.quorum?.map((r) => r.aConferir)).toEqual([false, true]);
  });

  it('põe na banca inteira a recusa a um controle que a tela não conhece', () => {
    const { daBanca, porControle } = recusasDasBancas(
      [recusa('bancas.banca-1.outroControle', 0)],
      'bancas',
      NA_TELA,
    );

    expect(daBanca.get('banca-1')).toHaveLength(1);
    expect(porControle.size).toBe(0);
  });

  it('põe na seção, sem nota, a recusa da seção inteira', () => {
    const { secao } = recusasDasBancas([recusa('bancas', 0)], 'bancas', NA_TELA);

    expect(secao).toHaveLength(1);
    expect(secao[0].nota).toBeUndefined();
  });

  it('põe na seção, com a nota, a recusa de banca que saiu da tela depois do envio', () => {
    const { secao, daBanca, porControle } = recusasDasBancas(
      [recusa('bancas.banca-9.quorum', 0)],
      'bancas',
      NA_TELA,
    );

    expect(secao.map((r) => r.nota)).toEqual([NOTA_DA_BANCA_AUSENTE]);
    expect(NOTA_DA_BANCA_AUSENTE).toBe('Sobre uma banca que não está mais nesta tela.');
    expect(daBanca.size).toBe(0);
    expect(porControle.size).toBe(0);
  });

  it('mostra as recusas de duas bancas ausentes do mesmo tipo e código, cada uma com a nota', () => {
    const mesma = 'uniplus.selecao.banca.regra_de_deliberacao_obrigatoria';
    const { secao } = recusasDasBancas(
      [
        recusa('bancas.banca-8', 0, { codigo: mesma }),
        recusa('bancas.banca-9', 1, { codigo: mesma }),
      ],
      'bancas',
      NA_TELA,
    );

    expect(secao).toHaveLength(2);
  });

  it('ignora a recusa de outra lista de bancas', () => {
    const { secao, daBanca, porControle } = recusasDasBancas(
      [recusa('bancasRequeridas.banca-1', 0)],
      'bancas',
      NA_TELA,
    );

    expect(secao).toEqual([]);
    expect(daBanca.size).toBe(0);
    expect(porControle.size).toBe(0);
  });
});

describe('notaDaBanca', () => {
  it('dá a nota só à recusa de banca ausente', () => {
    expect(notaDaBanca(true)).toBe(NOTA_DA_BANCA_AUSENTE);
    expect(notaDaBanca(false)).toBeUndefined();
    expect(notaDaBanca(undefined)).toBeUndefined();
  });
});
