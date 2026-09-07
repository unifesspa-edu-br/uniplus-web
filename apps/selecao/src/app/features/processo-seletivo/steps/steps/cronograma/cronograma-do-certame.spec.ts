import { describe, expect, it } from 'vitest';
import type { FaseCanonicaDto, PrecedenciaFaseDto } from '@uniplus/shared-data/configuracao';

import type {
  EtapaPontuada,
  FaseDoCronograma,
  ProdutoDaFase,
} from '../../processo-seletivo.models';
import {
  comoNumero,
  componeNota,
  descreverFase,
  exigenciasDe,
  problemaDaAncora,
  problemasDoCronograma,
  produtosPreliminares,
  publicaResultadoDefinitivo,
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
    produtos: [],
    faseConcluinteCodigo: null,
    emiteParecerIndividual: false,
    bancasRequeridas: [],
    regraRecurso: null,
    congelados: null,
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

const PRELIMINAR: ProdutoDaFase = { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' };
const DEFINITIVO: ProdutoDaFase = { atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' };
const SEM_PAPEL: ProdutoDaFase = { atoCodigo: 'COMUNICADO', papel: null };
const AVISO: ProdutoDaFase = { atoCodigo: 'COMUNICADO', papel: null };

describe('exigências da fase', () => {
  it('data própria obriga janela; delegada não', () => {
    expect(exigenciasDe(faseCanonica({ origemData: 'PROPRIA' }), []).janelaObrigatoria).toBe(true);
    expect(exigenciasDe(faseCanonica({ origemData: 'DELEGADA' }), []).janelaObrigatoria).toBe(
      false,
    );
  });

  /**
   * O que a fase publica é declaração dela, não atributo do catálogo: a mesma
   * fase canônica entra em dois editais publicando coisas diferentes.
   */
  it('publica produto quando a fase declara ao menos um', () => {
    const canonica = faseCanonica({});

    expect(exigenciasDe(canonica, [AVISO]).publicaProduto).toBe(true);
    expect(exigenciasDe(canonica, []).publicaProduto).toBe(false);
  });

  /**
   * Recurso não é sinalizador próprio: cabe contra o resultado preliminar, que
   * é a âncora de que o prazo conta. Fase que só publica o definitivo encerra a
   * matéria, e oferecer ali a configuração levaria o operador a preencher algo
   * que o domínio recusa.
   */
  it('recurso cabe só onde há produto preliminar', () => {
    const canonica = faseCanonica({});

    expect(exigenciasDe(canonica, [PRELIMINAR]).admiteRecurso).toBe(true);
    expect(exigenciasDe(canonica, [DEFINITIVO]).admiteRecurso).toBe(false);
    expect(exigenciasDe(canonica, [AVISO]).admiteRecurso).toBe(false);
    expect(exigenciasDe(canonica, []).admiteRecurso).toBe(false);
  });

  /**
   * Ato que não é resultado não torna a fase produtora de resultado — publicar
   * um comunicado não abre nem encerra matéria nenhuma.
   */
  it('produto sem papel não publica resultado definitivo', () => {
    expect(publicaResultadoDefinitivo([DEFINITIVO])).toBe(true);
    expect(publicaResultadoDefinitivo([PRELIMINAR, AVISO])).toBe(false);
    expect(publicaResultadoDefinitivo([])).toBe(false);
  });

  /**
   * A fase que saiu do catálogo continua descrita pelo que congelou — mas o que
   * ela publica sai dos produtos dela, que o congelado não guarda.
   */
  it('descreve a fase congelada pelos produtos que ela declara', () => {
    const congelada = fase({
      produtos: [PRELIMINAR],
      congelados: {
        donoTipico: 'CEPS',
        origemData: 'PROPRIA',
        agrupaEtapas: false,
        coletaInscricao: false,
        bancas: [],
      },
    });

    const descricao = descreverFase(congelada, new Map());

    expect(descricao.exigencias?.admiteRecurso).toBe(true);
    expect(descricao.exigencias?.publicaProduto).toBe(true);
    expect(descricao.publicaResultadoDefinitivo).toBe(false);
    expect(descricao.foraDoCatalogo).toBe(true);
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

describe('âncora do prazo de recurso', () => {
  const recurso = (atoAncoraCodigo: string): FaseDoCronograma['regraRecurso'] => ({
    regraCodigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
    regraVersao: 'v1',
    prazoValor: '2',
    prazoUnidade: 'diasUteis',
    atoAncoraCodigo,
    suspensividadePrimeiraInstanciaValor: '',
    suspensividadePrimeiraInstanciaUnidade: '',
    suspensividadeSegundaInstanciaValor: '',
    suspensividadeSegundaInstanciaUnidade: '',
  });

  it('fase sem regra de recurso não tem âncora a conferir', () => {
    expect(problemaDaAncora(fase({ produtos: [PRELIMINAR] }))).toBeNull();
  });

  it('âncora que é produto preliminar da própria fase é coerente', () => {
    const declarada = fase({
      produtos: [PRELIMINAR, DEFINITIVO],
      regraRecurso: recurso('RESULTADO_PRELIMINAR'),
    });

    expect(problemaDaAncora(declarada)).toBeNull();
  });

  /**
   * É o que a hidratação produz quando o cruzamento não acha a publicação
   * ancorada: sem acusar, a gravação seguinte sairia com a âncora em branco.
   */
  it('acusa a âncora vazia numa fase que declara recurso', () => {
    const declarada = fase({ produtos: [PRELIMINAR], regraRecurso: recurso('') });

    expect(problemaDaAncora(declarada)).toBe('ausente');
  });

  it('acusa a âncora que a fase publica sem papel preliminar', () => {
    const declarada = fase({
      produtos: [DEFINITIVO],
      regraRecurso: recurso('RESULTADO_FINAL'),
    });

    expect(problemaDaAncora(declarada)).toBe('naoPreliminar');
  });

  it('acusa a âncora que a fase sequer publica', () => {
    const declarada = fase({
      produtos: [PRELIMINAR],
      regraRecurso: recurso('RESULTADO_DE_OUTRA_FASE'),
    });

    expect(problemaDaAncora(declarada)).toBe('naoPreliminar');
  });

  it('oferece à escolha só os produtos com papel preliminar', () => {
    expect(produtosPreliminares([PRELIMINAR, DEFINITIVO, SEM_PAPEL])).toEqual([PRELIMINAR]);
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
      produtos: [PRELIMINAR],
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
      produtos: [PRELIMINAR],
    });

    const problemas = problemasDoCronograma([faseDeAvaliacao, outra], [etapaValida], catalogo, []);

    expect(problemas).toContainEqual(expect.stringContaining('mesma posição na linha do tempo'));
  });

  /**
   * Texto que não converte vira `null` no comando, e `null` é o valor legítimo
   * de "não declarado": sem conferir, o campo malformado grava com sucesso e
   * apaga o que estava lá, sem nada dizer.
   */
  it('número malformado é recusado em vez de limpar o campo em silêncio', () => {
    const notaTorta = etapa({
      nome: 'Prova',
      carater: 'classificatoria',
      tipoEtapaOrigemId: 'tipo-1',
      peso: '1',
      notaMinima: '7,5,',
    });

    const problemas = problemasDoCronograma([faseDeAvaliacao], [notaTorta], catalogo, []);

    expect(problemas).toContainEqual(expect.stringContaining('nota mínima'));
  });

  it('campo numérico vazio continua sendo não declarado, e não erro', () => {
    const semNota = etapa({
      nome: 'Prova',
      carater: 'classificatoria',
      tipoEtapaOrigemId: 'tipo-1',
      peso: '1',
      notaMinima: '',
    });

    expect(problemasDoCronograma([faseDeAvaliacao], [semNota], catalogo, [])).toEqual([]);
  });

  /**
   * Zero converte, então nem a conferência de forma nem a agregada o pegam: com
   * outra etapa compondo a nota, a gravação sairia para o domínio recusar por
   * causa da que ficou zerada.
   */
  it('peso zero declarado é recusado mesmo com outra etapa compondo a nota', () => {
    const compoe = etapa({
      nome: 'Prova',
      carater: 'classificatoria',
      tipoEtapaOrigemId: 'tipo-1',
      peso: '1',
      ordem: 1,
    });
    const zerada = etapa({
      nome: 'Redação',
      carater: 'classificatoria',
      tipoEtapaOrigemId: 'tipo-1',
      peso: '0',
      ordem: 2,
    });

    const problemas = problemasDoCronograma([faseDeAvaliacao], [compoe, zerada], catalogo, []);

    expect(problemas).toContainEqual(expect.stringContaining('maior que zero'));
  });

  it('etapa sem peso declarado continua válida ao lado de outra que compõe', () => {
    const compoe = etapa({
      nome: 'Prova',
      carater: 'classificatoria',
      tipoEtapaOrigemId: 'tipo-1',
      peso: '1',
      ordem: 1,
    });
    const soEliminatoria = etapa({
      nome: 'Títulos',
      carater: 'eliminatoria',
      tipoEtapaOrigemId: 'tipo-1',
      peso: '',
      ordem: 2,
    });

    expect(
      problemasDoCronograma([faseDeAvaliacao], [compoe, soEliminatoria], catalogo, []),
    ).toEqual([]);
  });

  it('cronograma coerente não relata problema', () => {
    expect(problemasDoCronograma([faseDeAvaliacao], [etapaValida], catalogo, [])).toEqual([]);
  });

  /**
   * A âncora não é editada neste passo, mas atravessa o formulário até a
   * gravação. Sem cobrá-la aqui, mexer numa data enviaria o cronograma inteiro
   * para ser recusado por um campo que a tela nem mostra.
   */
  it('cobra a publicação que ancora o prazo antes de deixar gravar', () => {
    const semAncora = fase({
      faseCanonicaId: RESULTADO.id,
      codigo: 'RESULTADO_PRELIMINAR',
      produtos: [PRELIMINAR],
      regraRecurso: {
        regraCodigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
        regraVersao: 'v1',
        prazoValor: '2',
        prazoUnidade: 'diasUteis',
        atoAncoraCodigo: '',
        suspensividadePrimeiraInstanciaValor: '',
        suspensividadePrimeiraInstanciaUnidade: '',
        suspensividadeSegundaInstanciaValor: '',
        suspensividadeSegundaInstanciaUnidade: '',
      },
    });

    const problemas = problemasDoCronograma(
      [faseDeAvaliacao, semAncora],
      [etapaValida],
      catalogo,
      [],
    );

    expect(problemas).toContain(
      'A fase Resultado preliminar admite recurso e está sem a publicação que ancora o prazo. Escolha-a em Configuração por fase.',
    );
  });
});
