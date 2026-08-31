import { describe, expect, it } from 'vitest';
import type { FaseCanonicaDto, PrecedenciaFaseDto } from '@uniplus/shared-data/configuracao';

import type { EtapaPontuada, FaseDoCronograma } from '../../processo-seletivo.models';
import {
  comoNumero,
  componeNota,
  exigenciasDe,
  renumerar,
  trocaFechaCiclo,
  violacoesDePrecedencia,
} from './cronograma-do-certame';

function faseCanonica(parcial: Partial<FaseCanonicaDto>): FaseCanonicaDto {
  return {
    id: 'fase-1',
    codigo: 'INSCRICAO',
    nome: 'Inscrição',
    descricao: null,
    donoTipico: 'CEPS',
    agrupaEtapas: false,
    permiteComplementacao: false,
    baseLegal: null,
    produzResultado: false,
    resultadoDefinitivo: false,
    coletaInscricao: false,
    origemData: 'PROPRIA',
    criadoEm: '2026-08-30T12:00:00Z',
    ...parcial,
  } as FaseCanonicaDto;
}

function fase(parcial: Partial<FaseDoCronograma>): FaseDoCronograma {
  return {
    faseCanonicaId: 'id-1',
    codigo: 'INSCRICAO',
    ordem: 1,
    inicio: null,
    fim: null,
    atoProduzidoCodigo: null,
    tiposBancaIds: [],
    regraRecurso: null,
    ...parcial,
  };
}

function aresta(parcial: Partial<PrecedenciaFaseDto>): PrecedenciaFaseDto {
  return {
    id: 'aresta-1',
    antecessoraCodigo: 'INSCRICAO',
    sucessoraCodigo: 'HOMOLOGACAO',
    permiteSobreposicao: false,
    criadoEm: '2026-08-30T12:00:00Z',
    ...parcial,
  } as PrecedenciaFaseDto;
}

function etapa(parcial: Partial<EtapaPontuada>): EtapaPontuada {
  return {
    id: null,
    nome: 'Prova Objetiva',
    carater: 'classificatoria',
    tipoEtapaOrigemId: 'tipo-1',
    peso: '2',
    notaMinima: '',
    ordem: 1,
    ...parcial,
  };
}

describe('exigências lidas da fase canônica', () => {
  it('data própria obriga janela; delegada não', () => {
    expect(exigenciasDe(faseCanonica({ origemData: 'PROPRIA' })).janelaObrigatoria).toBe(true);
    expect(exigenciasDe(faseCanonica({ origemData: 'DELEGADA' })).janelaObrigatoria).toBe(false);
  });

  it('fase que produz resultado exige declarar o ato produzido', () => {
    expect(exigenciasDe(faseCanonica({ produzResultado: true })).exigeAtoProduzido).toBe(true);
    expect(exigenciasDe(faseCanonica({ produzResultado: false })).exigeAtoProduzido).toBe(false);
  });

  /**
   * Recurso não é sinalizador próprio: cabe onde há resultado, e nunca contra
   * resultado definitivo. Oferecer a configuração numa fase definitiva levaria o
   * operador a preencher algo que o domínio recusa.
   */
  it('recurso cabe só em resultado não definitivo', () => {
    const admite = faseCanonica({ produzResultado: true, resultadoDefinitivo: false });
    const definitiva = faseCanonica({ produzResultado: true, resultadoDefinitivo: true });
    const semResultado = faseCanonica({ produzResultado: false });

    expect(exigenciasDe(admite).admiteRecurso).toBe(true);
    expect(exigenciasDe(definitiva).admiteRecurso).toBe(false);
    expect(exigenciasDe(semResultado).admiteRecurso).toBe(false);
  });
});

describe('precedência entre fases', () => {
  it('acusa a ordem invertida quando as duas fases estão no cronograma', () => {
    const violacoes = violacoesDePrecedencia(
      [
        fase({ codigo: 'HOMOLOGACAO', ordem: 1 }),
        fase({ codigo: 'INSCRICAO', ordem: 2, faseCanonicaId: 'id-2' }),
      ],
      [aresta({})],
    );

    expect(violacoes).toHaveLength(1);
    expect(violacoes[0].motivo).toBe('ordem');
  });

  /**
   * A ausência de uma das duas fases NÃO é violação — é o que permite um
   * cronograma curto, e o agregado é explícito quanto a isso.
   */
  it('ignora a aresta cuja outra ponta não está no cronograma', () => {
    const violacoes = violacoesDePrecedencia([fase({ codigo: 'INSCRICAO', ordem: 1 })], [aresta({})]);

    expect(violacoes).toEqual([]);
  });

  it('acusa janelas sobrepostas quando a aresta não permite sobreposição', () => {
    const violacoes = violacoesDePrecedencia(
      [
        fase({ codigo: 'INSCRICAO', ordem: 1, fim: '2026-03-20T23:59:59-03:00' }),
        fase({
          codigo: 'HOMOLOGACAO',
          ordem: 2,
          faseCanonicaId: 'id-2',
          inicio: '2026-03-15T08:00:00-03:00',
        }),
      ],
      [aresta({ permiteSobreposicao: false })],
    );

    expect(violacoes).toHaveLength(1);
    expect(violacoes[0].motivo).toBe('sobreposicao');
  });

  it('aceita as mesmas janelas quando a aresta permite sobreposição', () => {
    const violacoes = violacoesDePrecedencia(
      [
        fase({ codigo: 'INSCRICAO', ordem: 1, fim: '2026-03-20T23:59:59-03:00' }),
        fase({
          codigo: 'HOMOLOGACAO',
          ordem: 2,
          faseCanonicaId: 'id-2',
          inicio: '2026-03-15T08:00:00-03:00',
        }),
      ],
      [aresta({ permiteSobreposicao: true })],
    );

    expect(violacoes).toEqual([]);
  });

  /**
   * O mesmo instante escrito em deslocamentos diferentes precisa comparar igual.
   * Comparar o texto separaria os dois, e a tela acusaria sobreposição onde não
   * há.
   */
  it('compara janelas pelo instante, não pelo texto', () => {
    const violacoes = violacoesDePrecedencia(
      [
        fase({ codigo: 'INSCRICAO', ordem: 1, fim: '2026-03-20T23:59:59-03:00' }),
        fase({
          codigo: 'HOMOLOGACAO',
          ordem: 2,
          faseCanonicaId: 'id-2',
          inicio: '2026-03-21T02:59:59Z',
        }),
      ],
      [aresta({ permiteSobreposicao: false })],
    );

    expect(violacoes).toEqual([]);
  });
});

describe('permutação de ordem', () => {
  const a = fase({ faseCanonicaId: 'a', codigo: 'INSCRICAO', ordem: 1 });
  const b = fase({ faseCanonicaId: 'b', codigo: 'HOMOLOGACAO', ordem: 2 });

  it('acusa a troca direta entre duas fases retidas', () => {
    const depois = [
      { ...a, ordem: 2 },
      { ...b, ordem: 1 },
    ];

    expect(trocaFechaCiclo([a, b], depois)).toBe(true);
  });

  /** Cadeia que termina em ordem livre não fecha ciclo. */
  it('aceita o deslocamento para uma ordem que ninguém ocupa', () => {
    const depois = [
      { ...a, ordem: 3 },
      { ...b, ordem: 2 },
    ];

    expect(trocaFechaCiclo([a, b], depois)).toBe(false);
  });

  /** A remoção libera o valor, então a cadeia que termina nela não é ciclo. */
  it('aceita assumir a ordem de uma fase removida', () => {
    const depois = [{ ...a, ordem: 2 }];

    expect(trocaFechaCiclo([a, b], depois)).toBe(false);
  });

  it('renumerar sequencialmente nunca fecha ciclo', () => {
    const depois = renumerar([b, a]);

    expect(depois.map((f) => f.ordem)).toEqual([1, 2]);
    expect(trocaFechaCiclo([a, b], depois)).toBe(true);
  });
});

describe('etapa que compõe a nota', () => {
  /**
   * Havendo etapas, ao menos uma precisa pontuar COM peso — senão o divisor da
   * média seria zero. Uma prova de títulos sozinha, eliminatória e sem peso, é
   * recusada, e a mensagem do domínio fala de nota final, não de etapa.
   */
  it('exige caráter que pontua e peso declarado', () => {
    expect(componeNota(etapa({ carater: 'classificatoria', peso: '2' }))).toBe(true);
    expect(componeNota(etapa({ carater: 'ambas', peso: '1' }))).toBe(true);
    expect(componeNota(etapa({ carater: 'eliminatoria', peso: '2' }))).toBe(false);
    expect(componeNota(etapa({ carater: 'classificatoria', peso: '' }))).toBe(false);
    expect(componeNota(etapa({ carater: 'classificatoria', peso: '   ' }))).toBe(false);
  });
});

describe('conversão do campo para número', () => {
  /** `Number` sozinho leria `1.000` como 1 — a armadilha do valor da taxa. */
  it('lê vírgula como decimal e ponto como agrupador', () => {
    expect(comoNumero('2,5')).toBe(2.5);
    expect(comoNumero('1.000')).toBe(1000);
    expect(comoNumero('1.234,5')).toBe(1234.5);
  });

  it('devolve nulo para campo vazio, e não zero', () => {
    expect(comoNumero('')).toBeNull();
    expect(comoNumero('   ')).toBeNull();
  });

  it('devolve nulo para texto que não é número', () => {
    expect(comoNumero('dois')).toBeNull();
  });

  it('preserva o zero declarado', () => {
    expect(comoNumero('0')).toBe(0);
  });
});
