import { describe, expect, it } from 'vitest';
import type { FaseCanonicaDto, PrecedenciaFaseDto } from '@uniplus/shared-data/configuracao';

import type { EtapaPontuada, FaseDoCronograma } from '../../processo-seletivo.models';
import {
  comoNumero,
  componeNota,
  exigenciasDe,
  problemasDoCronograma,
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
    const violacoes = violacoesDePrecedencia(
      [fase({ codigo: 'INSCRICAO', ordem: 1 })],
      [aresta({})],
    );

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

  /**
   * Renumerar sequencialmente **não** evita o ciclo — trocar duas fases de
   * lugar e renumerar produz exatamente a permutação que o servidor recusa. É a
   * reordenação mais comum que existe, e quem implementar o arrastar-e-soltar
   * precisa guardá-la com `trocaFechaCiclo`, não confiar na renumeração.
   *
   * A saída é mover uma das fases para uma ordem livre numa gravação e fechar o
   * ciclo na seguinte, que é o que a recusa do domínio orienta.
   */
  it('renumerar após trocar duas fases produz o ciclo que o servidor recusa', () => {
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

  /**
   * Peso zero não soma ao divisor, e o domínio o recusa à parte por exigir peso
   * maior que zero. Aceitá-lo aqui deixaria um conjunto todo zerado passar na
   * conferência da tela e ser recusado no servidor por outro motivo.
   */
  it('não considera peso zero como composição de nota', () => {
    expect(componeNota(etapa({ carater: 'classificatoria', peso: '0' }))).toBe(false);
    expect(componeNota(etapa({ carater: 'ambas', peso: '0,0' }))).toBe(false);
  });
});

describe('conversão do campo para número', () => {
  /**
   * O defeito que esta gramática existe para impedir: ler o ponto como
   * agrupador devolveria 5 para `0.5`, e o servidor aceitaria — 5 é peso
   * válido, e a classificação rodaria com o dobro em ordem de grandeza.
   */
  it('lê o ponto como separador decimal, não como agrupador', () => {
    expect(comoNumero('0.5')).toBe(0.5);
    expect(comoNumero('2.75')).toBe(2.75);
  });

  it('aceita vírgula como separador decimal', () => {
    expect(comoNumero('0,5')).toBe(0.5);
    expect(comoNumero('2,5')).toBe(2.5);
  });

  it('devolve nulo para campo vazio, e não zero', () => {
    expect(comoNumero('')).toBeNull();
    expect(comoNumero('   ')).toBeNull();
  });

  it('devolve nulo para texto que não é número', () => {
    expect(comoNumero('dois')).toBeNull();
  });

  /** `Number` leria `1e2` como 100 e `0x10` como 16; nenhum é peso. */
  it('recusa notação científica e hexadecimal', () => {
    expect(comoNumero('1e2')).toBeNull();
    expect(comoNumero('0x10')).toBeNull();
  });

  it('recusa sinal negativo, que nenhum destes campos admite', () => {
    expect(comoNumero('-1')).toBeNull();
  });

  it('preserva o zero declarado', () => {
    expect(comoNumero('0')).toBe(0);
  });
});

describe('o que impede gravar o cronograma', () => {
  const AVALIACAO = faseCanonica({
    id: 'id-avaliacao',
    codigo: 'AVALIACAO',
    nome: 'Avaliação',
    agrupaEtapas: true,
    origemData: 'PROPRIA',
  });
  const RESULTADO = faseCanonica({
    id: 'id-resultado',
    codigo: 'RESULTADO_PRELIMINAR',
    nome: 'Resultado preliminar',
    produzResultado: true,
    origemData: 'DERIVADA',
  });
  const catalogo = new Map([
    [AVALIACAO.id, AVALIACAO],
    [RESULTADO.id, RESULTADO],
  ]);

  const etapaValida = etapa({
    nome: 'Prova',
    carater: 'classificatoria',
    tipoEtapaOrigemId: 'tipo-1',
    peso: '1',
  });
  const faseDeAvaliacao = fase({
    faseCanonicaId: AVALIACAO.id,
    codigo: 'AVALIACAO',
    inicio: '2026-03-01T08:00:00-03:00',
    fim: '2026-03-02T18:00:00-03:00',
  });

  it('cronograma sem nenhuma fase é o único problema relatado', () => {
    expect(problemasDoCronograma([], [], catalogo, [])).toEqual([
      'O cronograma precisa de ao menos uma fase.',
    ]);
  });

  /**
   * A fase que agrupa etapas é recusada na hora se o processo não tiver etapa
   * alguma. Deixar o operador escolhê-la e descobrir isso na gravação é o
   * estado que este passo existe para evitar.
   */
  it('fase que agrupa etapas sem nenhuma etapa é recusada antes de gravar', () => {
    const problemas = problemasDoCronograma([faseDeAvaliacao], [], catalogo, []);

    expect(problemas).toContainEqual(expect.stringContaining('precisa de ao menos uma'));
  });

  /**
   * O caminho oposto só seria recusado na publicação — tarde demais para quem
   * já saiu deste passo.
   */
  it('etapas sem a fase que as agrupa também são recusadas', () => {
    const semAvaliacao = fase({
      faseCanonicaId: RESULTADO.id,
      codigo: 'RESULTADO_PRELIMINAR',
      atoProduzidoCodigo: 'EDITAL_RESULTADO',
    });

    const problemas = problemasDoCronograma([semAvaliacao], [etapaValida], catalogo, []);

    expect(problemas).toContainEqual(expect.stringContaining('fase de avaliação que as agrupa'));
  });

  it('fase com janela própria exige data e hora de início e de fim', () => {
    const semJanela = fase({ faseCanonicaId: AVALIACAO.id, codigo: 'AVALIACAO' });

    const problemas = problemasDoCronograma([semJanela], [etapaValida], catalogo, []);

    expect(problemas).toContainEqual('A fase Avaliação precisa de data e hora de início e de fim.');
  });

  it('fim antes do início é recusado', () => {
    const invertida = fase({
      faseCanonicaId: AVALIACAO.id,
      codigo: 'AVALIACAO',
      inicio: '2026-03-10T08:00:00-03:00',
      fim: '2026-03-01T08:00:00-03:00',
    });

    const problemas = problemasDoCronograma([invertida], [etapaValida], catalogo, []);

    expect(problemas).toContainEqual('Na fase Avaliação, o fim não pode vir antes do início.');
  });

  it('fase que produz resultado exige o ato que o publica', () => {
    const semAto = fase({ faseCanonicaId: RESULTADO.id, codigo: 'RESULTADO_PRELIMINAR' });

    const problemas = problemasDoCronograma([semAto], [], catalogo, []);

    expect(problemas).toContainEqual(expect.stringContaining('precisa declarar o ato'));
  });

  /**
   * Sem nenhuma etapa compondo a nota, o divisor da média seria zero — e a
   * recusa do servidor fala de nota final, não da etapa que ficou sem peso.
   */
  it('etapas que não compõem a nota final são recusadas com a explicação da média', () => {
    const soEliminatoria = etapa({
      nome: 'Títulos',
      carater: 'eliminatoria',
      tipoEtapaOrigemId: 'tipo-1',
      peso: '',
    });

    const problemas = problemasDoCronograma([faseDeAvaliacao], [soEliminatoria], catalogo, []);

    expect(problemas).toContainEqual(expect.stringContaining('compor a nota final'));
  });

  it('mesma posição em duas fases é recusada', () => {
    const outra = fase({
      faseCanonicaId: RESULTADO.id,
      codigo: 'RESULTADO_PRELIMINAR',
      ordem: 1,
      atoProduzidoCodigo: 'EDITAL',
    });

    const problemas = problemasDoCronograma([faseDeAvaliacao, outra], [etapaValida], catalogo, []);

    expect(problemas).toContainEqual(expect.stringContaining('mesma posição na linha do tempo'));
  });

  it('cronograma coerente não relata problema', () => {
    expect(problemasDoCronograma([faseDeAvaliacao], [etapaValida], catalogo, [])).toEqual([]);
  });
});
