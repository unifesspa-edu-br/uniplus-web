import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { ClassificacaoNoServidor } from './classificacao-no-servidor';

const RESOLUCAO = 'Resolução nº 805/2024/Consepe';

const QUADRO = [
  {
    grupoAreaEnem: { codigo: 'SAUDE_E_BIOLOGICAS', rotulo: 'Saúde e Biológicas' },
    baseLegal: 'Resolução nº 805/2024/Consepe – Anexo I',
    areas: [{ codigo: 'REDACAO', rotulo: 'Redação', peso: 2, corte: 400 }],
  },
];

function classificacaoCom(peso: number): ProcessoSeletivoDto['classificacao'] {
  return {
    resolucaoPesoAreaEnem: RESOLUCAO,
    quadroPesoAreaEnem: [
      {
        grupoAreaEnem: { codigo: 'G', rotulo: 'Grupo' },
        baseLegal: 'Anexo I',
        areas: [{ codigo: 'REDACAO', rotulo: 'Redação', peso, corte: null }],
      },
    ],
  } as unknown as ProcessoSeletivoDto['classificacao'];
}

describe('ClassificacaoNoServidor — versão da classificação lida', () => {
  it('muda quando a leitura traz outro quadro', () => {
    const classificacao = new ClassificacaoNoServidor();
    classificacao.registrarLida(classificacaoCom(1));
    const antes = classificacao.versaoLida();

    classificacao.registrarLida(classificacaoCom(2));

    expect(classificacao.versaoLida()).toBe(antes + 1);
  });

  it('não muda quando a leitura só confirma a cópia presumida', () => {
    const classificacao = new ClassificacaoNoServidor();
    classificacao.registrarLida(classificacaoCom(1));
    const confirmada = classificacao.gravada();
    if (confirmada.estado !== 'com-quadro') throw new Error('cópia esperada');
    classificacao.registrarGravadaComQuadro(confirmada.resolucao, confirmada.grupos);
    const antes = classificacao.versaoLida();

    classificacao.registrarLida(classificacaoCom(1));

    expect(classificacao.versaoLida()).toBe(antes);
    expect(classificacao.motivoDaReleitura()).not.toBe('por-confirmar');
  });
});

describe('ClassificacaoNoServidor — quadro de Peso por Área congelado', () => {
  it('uma classificação lida sem o quadro fica sem grupo, sem quebrar quem o lê', () => {
    const classificacao = new ClassificacaoNoServidor();

    classificacao.registrarLida({
      resolucaoPesoAreaEnem: RESOLUCAO,
    } as unknown as ProcessoSeletivoDto['classificacao']);

    // O servidor só conta como quadro o que tem ao menos um grupo.
    expect(classificacao.gravada()).toEqual({ estado: 'sem-quadro' });
  });

  it('guarda a resolução e o quadro que o processo congelou, como referência atual', () => {
    const classificacao = new ClassificacaoNoServidor();
    classificacao.marcarDesconhecida();

    classificacao.registrarLida({
      resolucaoPesoAreaEnem: RESOLUCAO,
      quadroPesoAreaEnem: QUADRO,
    } as unknown as ProcessoSeletivoDto['classificacao']);

    expect(classificacao.copiaCongeladaEmVigor()?.resolucao).toBe(RESOLUCAO);
    expect(classificacao.copiaCongeladaEmVigor()?.grupos.map((grupo) => grupo.codigo)).toEqual(
      QUADRO.map((grupo) => grupo.grupoAreaEnem.codigo).sort(),
    );
  });
});
