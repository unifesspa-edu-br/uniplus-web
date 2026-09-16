import { describe, expect, it } from 'vitest';
import type { FaseCanonicaDto, PrecedenciaFaseDto } from '@uniplus/shared-data/configuracao';

import type {
  EtapaPontuada,
  FaseDoCronograma,
  ProdutoDaFase,
} from '../../processo-seletivo.models';
import { publicaResultadoDefinitivo, type AtoDoCatalogo } from '../fase/configuracao-da-fase';
import {
  comoNumero,
  componeNota,
  descreverFase,
  exigenciasDe,
  avisosDosGrupos,
  problemasDoCronograma,
  renumerar,
  trocaFechaCiclo,
  violacoesDePrecedencia,
  type ExigenciaDeclarada,
  type TipoDeEtapaDoCatalogo,
} from './cronograma-do-certame';

/** O catálogo de atos não descreve nenhum destes códigos: o servidor arbitra. */
const SEM_CATALOGO: ReadonlyMap<string, AtoDoCatalogo> = new Map();
const nomeDaBanca = (id: string): string => id;

/**
 * Tipo de etapa que admite qualquer caráter — o caso comum dos cenários de outro assunto. Quem
 * testa o recorte do cadastro passa o seu por `problemasDoCronograma` diretamente.
 */
const tipoQueAdmiteTudo = (): TipoDeEtapaDoCatalogo => ({
  nome: 'Prova objetiva',
  admitePontuacao: true,
  admiteEliminacao: true,
});

/** A conferência do cronograma, com os catálogos que ela consulta. */
function problemasDe(
  fases: Parameters<typeof problemasDoCronograma>[0],
  etapas: Parameters<typeof problemasDoCronograma>[1],
  fasePorId: Parameters<typeof problemasDoCronograma>[2],
  precedencias: Parameters<typeof problemasDoCronograma>[3],
): readonly string[] {
  return problemasDoCronograma(
    fases,
    etapas,
    fasePorId,
    precedencias,
    SEM_CATALOGO,
    nomeDaBanca,
    tipoQueAdmiteTudo,
    [],
  );
}

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

/**
 * Espalhar um `Partial` faz o TypeScript aceitar o objeto mesmo sem as propriedades
 * obrigatórias, então o fixture as declara todas à mão: antes disto ele devolvia uma etapa
 * sem `recursos`, e qualquer conferência que percorresse a coleção estourava no teste em vez
 * de reprovar de verdade.
 */
function etapa(parcial: Partial<EtapaPontuada>): EtapaPontuada {
  return {
    id: null,
    nome: 'Prova Objetiva',
    carater: 'classificatoria',
    tipoEtapaOrigemId: 'tipo-1',
    peso: '2',
    notaMinima: '',
    ordem: 1,
    faseCodigo: '',
    produtos: [],
    inicio: '',
    fim: '',
    emiteParecerIndividual: false,
    bancas: [],
    recursos: [],
    ...parcial,
  };
}

/**
 * Uma exigência declarada, ancorada e conforme — os testes de norma partem daqui e mexem só
 * no que estão medindo. Montar o objeto à mão deixava `faseViva` indefinido, e a conferência
 * de ancoragem acusava "fase que saiu do cronograma" em teste que falava de outra coisa.
 */
function exigenciaDeclarada(parcial: Partial<ExigenciaDeclarada>): ExigenciaDeclarada {
  return {
    nome: 'Documento',
    decideResultado: false,
    normaResolvida: false,
    faseCodigo: 'AVALIACAO',
    faseViva: true,
    alcancaModalidade: true,
    reenvioSemComplementacao: false,
    problemasDeGatilho: [],
    ...parcial,
  };
}

const PRELIMINAR: ProdutoDaFase = { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' };
const DEFINITIVO: ProdutoDaFase = { atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' };
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
        permiteComplementacao: false,
        coletaSolicitacaoIsencao: false,
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
    expect(problemasDe([], [], catalogo, [])).toEqual([
      'O cronograma precisa de ao menos uma fase.',
    ]);
  });

  /**
   * A fase que agrupa etapas é recusada na hora se o processo não tiver etapa
   * alguma. Deixar o operador escolhê-la e descobrir isso na gravação é o
   * estado que este passo existe para evitar.
   */
  it('fase que agrupa etapas sem nenhuma etapa é recusada antes de gravar', () => {
    const problemas = problemasDe([faseDeAvaliacao], [], catalogo, []);

    expect(problemas).toContainEqual(expect.stringContaining('precisa de ao menos uma'));
  });

  /**
   * O caminho oposto só seria recusado na publicação — tarde demais para quem
   * já saiu deste passo.
   */
  it('etapa que não diz a que fase pertence é recusada', () => {
    const semAvaliacao = fase({
      faseCanonicaId: RESULTADO.id,
      codigo: 'RESULTADO_PRELIMINAR',
      produtos: [PRELIMINAR],
    });

    const problemas = problemasDe([semAvaliacao], [etapaValida], catalogo, []);

    expect(problemas).toContainEqual(
      expect.stringContaining('não dizem a que fase pertencem'),
    );
  });

  it('fase com janela própria exige data e hora de início e de fim', () => {
    const semJanela = fase({ faseCanonicaId: AVALIACAO.id, codigo: 'AVALIACAO' });

    const problemas = problemasDe([semJanela], [etapaValida], catalogo, []);

    expect(problemas).toContainEqual('A fase Avaliação precisa de data e hora de início e de fim.');
  });

  it('fim antes do início é recusado', () => {
    const invertida = fase({
      faseCanonicaId: AVALIACAO.id,
      codigo: 'AVALIACAO',
      inicio: '2026-03-10T08:00:00-03:00',
      fim: '2026-03-01T08:00:00-03:00',
    });

    const problemas = problemasDe([invertida], [etapaValida], catalogo, []);

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

    const problemas = problemasDe([faseDeAvaliacao], [soEliminatoria], catalogo, []);

    expect(problemas).toContainEqual(expect.stringContaining('compor a nota final'));
  });

  /**
   * O servidor confere o caráter declarado contra o que o tipo admite no cadastro. Sem espelhar
   * isso, a tela deixaria gravar para receber uma recusa que a pessoa não pediu — e o caso
   * acontece sem ninguém errar nada: basta o cadastro estreitar o tipo depois.
   */
  it('caráter que o tipo de etapa não admite é recusado antes de gravar', () => {
    const classificatoria = etapa({
      nome: 'Análise documental',
      carater: 'classificatoria',
      tipoEtapaOrigemId: 'tipo-1',
      peso: '1',
    });

    const problemas = problemasDoCronograma(
      [faseDeAvaliacao],
      [classificatoria],
      catalogo,
      [],
      SEM_CATALOGO,
      nomeDaBanca,
      () => ({ nome: 'Análise Documental', admitePontuacao: false, admiteEliminacao: true }),
      [],
    );

    expect(problemas).toContainEqual(
      expect.stringContaining('não compõe a nota final'),
    );
    expect(problemas).toContainEqual(expect.stringContaining('Análise documental'));
  });

  /** Tipo fora do catálogo carregado não autoriza inventar restrição nenhuma. */
  it('tipo que a tela não conhece não gera recusa de caráter', () => {
    const classificatoria = etapa({
      nome: 'Prova',
      carater: 'classificatoria',
      tipoEtapaOrigemId: 'tipo-1',
      peso: '1',
    });

    const problemas = problemasDoCronograma(
      [faseDeAvaliacao],
      [classificatoria],
      catalogo,
      [],
      SEM_CATALOGO,
      nomeDaBanca,
      () => undefined,
      [],
    );

    expect(problemas).not.toContainEqual(expect.stringContaining('não compõe a nota final'));
  });

  /**
   * A publicação recusa exigência que decide o resultado sem norma resolvida. Descobrir isso
   * só no último passo custa o certame inteiro montado.
   */
  it('exigência que decide o resultado sem norma resolvida é acusada antes de gravar', () => {
    const problemas = problemasDoCronograma(
      [faseDeAvaliacao],
      [],
      catalogo,
      [],
      SEM_CATALOGO,
      nomeDaBanca,
      tipoQueAdmiteTudo,
      [exigenciaDeclarada({ nome: 'Histórico do ensino médio', decideResultado: true })],
    );

    expect(problemas).toContainEqual(expect.stringContaining('Histórico do ensino médio'));
    expect(problemas).toContainEqual(expect.stringContaining('norma'));
  });

  /**
   * A conferência de ancoragem: fase que saiu do cronograma, exigência que não alcança
   * modalidade nenhuma, e reenvio onde a fase não admite complementação. Ela mora aqui porque
   * é o `validate()` do Cronograma que o wizard chama — escrita na superfície da fase, que é
   * embutida com `faseFixada`, a conferência existia e nunca rodava.
   */
  it('acusa a exigência cuja fase saiu do cronograma, nomeando o documento', () => {
    const problemas = problemasDoCronograma(
      [faseDeAvaliacao],
      [],
      catalogo,
      [],
      SEM_CATALOGO,
      nomeDaBanca,
      tipoQueAdmiteTudo,
      [exigenciaDeclarada({ nome: 'Comprovante de renda', faseViva: false })],
    );

    expect(problemas).toContainEqual(expect.stringContaining('saiu do cronograma'));
    expect(problemas).toContainEqual(expect.stringContaining('Comprovante de renda'));
  });

  it('acusa a exigência que não alcança modalidade nenhuma', () => {
    const problemas = problemasDoCronograma(
      [faseDeAvaliacao],
      [],
      catalogo,
      [],
      SEM_CATALOGO,
      nomeDaBanca,
      tipoQueAdmiteTudo,
      [exigenciaDeclarada({ alcancaModalidade: false })],
    );

    expect(problemas).toContainEqual(expect.stringContaining('modalidade'));
  });

  /** Exigência já acusada de órfã não é acusada de novo por não alcançar modalidade. */
  it('não repete a queixa de modalidade sobre exigência de fase morta', () => {
    const problemas = problemasDoCronograma(
      [faseDeAvaliacao],
      [],
      catalogo,
      [],
      SEM_CATALOGO,
      nomeDaBanca,
      tipoQueAdmiteTudo,
      [exigenciaDeclarada({ faseViva: false, alcancaModalidade: false })],
    );

    expect(problemas).not.toContainEqual(expect.stringContaining('modalidade'));
  });

  it('acusa o reenvio declarado em fase que não admite complementação', () => {
    const problemas = problemasDoCronograma(
      [faseDeAvaliacao],
      [],
      catalogo,
      [],
      SEM_CATALOGO,
      nomeDaBanca,
      tipoQueAdmiteTudo,
      [exigenciaDeclarada({ nome: 'Contracheque', reenvioSemComplementacao: true })],
    );

    expect(problemas).toContainEqual(expect.stringContaining('complementação'));
    expect(problemas).toContainEqual(expect.stringContaining('Contracheque'));
  });

  /** Controle negativo: exigência conforme não produz nenhuma das três queixas. */
  it('exigência ancorada, com modalidade e sem reenvio indevido não é acusada', () => {
    const problemas = problemasDoCronograma(
      [faseDeAvaliacao],
      [],
      catalogo,
      [],
      SEM_CATALOGO,
      nomeDaBanca,
      tipoQueAdmiteTudo,
      [exigenciaDeclarada({ normaResolvida: true })],
    );

    expect(problemas).not.toContainEqual(expect.stringContaining('saiu do cronograma'));
    expect(problemas).not.toContainEqual(expect.stringContaining('modalidade'));
    expect(problemas).not.toContainEqual(expect.stringContaining('complementação'));
  });

  it('exigência que não decide o resultado segue sem norma', () => {
    const problemas = problemasDoCronograma(
      [faseDeAvaliacao],
      [],
      catalogo,
      [],
      SEM_CATALOGO,
      nomeDaBanca,
      tipoQueAdmiteTudo,
      [exigenciaDeclarada({ nome: 'Foto 3x4', decideResultado: false })],
    );

    expect(problemas).not.toContainEqual(expect.stringContaining('norma'));
  });

  it('mesma posição em duas fases é recusada', () => {
    const outra = fase({
      faseCanonicaId: RESULTADO.id,
      codigo: 'RESULTADO_PRELIMINAR',
      ordem: 1,
      produtos: [PRELIMINAR],
    });

    const problemas = problemasDe([faseDeAvaliacao, outra], [etapaValida], catalogo, []);

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

    const problemas = problemasDe([faseDeAvaliacao], [notaTorta], catalogo, []);

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

    expect(problemasDe([faseDeAvaliacao], [semNota], catalogo, [])).toEqual([]);
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

    const problemas = problemasDe([faseDeAvaliacao], [compoe, zerada], catalogo, []);

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

    expect(problemasDe([faseDeAvaliacao], [compoe, soEliminatoria], catalogo, [])).toEqual([]);
  });

  it('cronograma coerente não relata problema', () => {
    expect(problemasDe([faseDeAvaliacao], [etapaValida], catalogo, [])).toEqual([]);
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

    const problemas = problemasDe([faseDeAvaliacao, semAncora], [etapaValida], catalogo, []);

    expect(problemas).toContain(
      'Na fase Resultado preliminar: Escolha a publicação preliminar de cuja divulgação corre o prazo de recurso. Corrija em Configuração por fase.',
    );
  });


  /**
   * A janela recursal da etapa. O prazo é obrigatório no comando e o mapeador converte o que
   * não casa para 0 — janela de prazo zero fecha no instante em que abre, e o servidor aceita.
   */
  describe('janela de recurso da etapa', () => {
    function comRecurso(patch: Record<string, string>): readonly string[] {
      return problemasDoCronograma(
        [faseDeAvaliacao],
        [
          etapa({
            nome: 'Prova Objetiva',
            faseCodigo: 'AVALIACAO',
            recursos: [
              {
                ancora: 'atoPublicado',
                regraCodigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
                regraVersao: '1.0.0',
                prazoValor: '2',
                prazoUnidade: 'diasUteis',
                atoAncoraCodigo: 'RESULTADO_PRELIMINAR',
                suspensividadePrimeiraInstanciaValor: '',
                suspensividadePrimeiraInstanciaUnidade: '',
                suspensividadeSegundaInstanciaValor: '',
                suspensividadeSegundaInstanciaUnidade: '',
                ...patch,
              },
            ],
          }),
        ],
        catalogo,
        [],
        SEM_CATALOGO,
        nomeDaBanca,
        tipoQueAdmiteTudo,
        [],
      );
    }

    it('acusa prazo em branco', () => {
      expect(comRecurso({ prazoValor: '' })).toContainEqual(
        expect.stringContaining('prazo maior que zero'),
      );
    });

    it('acusa prazo que a gramática numérica não aceita', () => {
      expect(comRecurso({ prazoValor: '2,5 dias' })).toContainEqual(
        expect.stringContaining('prazo maior que zero'),
      );
    });

    it('acusa prazo zero declarado', () => {
      expect(comRecurso({ prazoValor: '0' })).toContainEqual(
        expect.stringContaining('prazo maior que zero'),
      );
    });

    it('não acusa prazo válido', () => {
      expect(comRecurso({})).not.toContainEqual(expect.stringContaining('prazo maior que zero'));
    });

    /**
     * As duas conferências que só a fase tinha. O prazo e a suspensividade vivem no MESMO value
     * object nos dois donos, e o servidor passou a prová-las nos dois — a tela que aprovasse
     * aqui mandaria o operador colher um 422 que a fase nunca deixaria acontecer.
     */
    it('acusa fração de dia útil no prazo', () => {
      expect(comRecurso({ prazoValor: '2.5', prazoUnidade: 'diasUteis' })).toContainEqual(
        expect.stringContaining('fração de dia útil'),
      );
    });

    it('não acusa dia útil inteiro', () => {
      expect(comRecurso({ prazoValor: '2', prazoUnidade: 'diasUteis' })).not.toContainEqual(
        expect.stringContaining('fração de dia útil'),
      );
    });

    it('acusa suspensividade com valor e sem unidade', () => {
      expect(comRecurso({ suspensividadePrimeiraInstanciaValor: '3' })).toContainEqual(
        expect.stringContaining('suspensividade'),
      );
    });

    it('acusa suspensividade com unidade e sem valor', () => {
      expect(comRecurso({ suspensividadeSegundaInstanciaUnidade: 'horas' })).toContainEqual(
        expect.stringContaining('suspensividade'),
      );
    });

    it('acusa suspensividade não positiva', () => {
      expect(
        comRecurso({
          suspensividadePrimeiraInstanciaValor: '0',
          suspensividadePrimeiraInstanciaUnidade: 'diasUteis',
        }),
      ).toContainEqual(expect.stringContaining('suspensividade'));
    });

    it('aceita o par completo, e aceita a instância desativada', () => {
      const comPar = comRecurso({
        suspensividadePrimeiraInstanciaValor: '3',
        suspensividadePrimeiraInstanciaUnidade: 'diasUteis',
      });
      expect(comPar).not.toContainEqual(expect.stringContaining('suspensividade'));
      expect(comRecurso({})).not.toContainEqual(expect.stringContaining('suspensividade'));
    });

    /** Janela sem regra resolvida é descartada na gravação — e isso precisa ser dito. */
    it('acusa a janela cuja regra o catálogo ainda não resolveu', () => {
      expect(comRecurso({ regraCodigo: '', regraVersao: '' })).toContainEqual(
        expect.stringContaining('sem a regra de prazo'),
      );
    });
  });
});

describe('o que a publicação vai cobrar dos grupos', () => {
  /**
   * Aviso, não impedimento. A norma de um grupo não se edita no wizard — bloquear a gravação
   * por causa dela prenderia o passo sem saída, e a única fuga seria remover os documentos do
   * grupo um a um até ele desaparecer, destruindo a configuração. Quem recusa é a publicação.
   */
  it('avisa sobre o grupo que decide o resultado sem norma, nomeando o que ele reúne', () => {
    const avisos = avisosDosGrupos([
      { decideResultado: true, normaResolvida: false, documentos: ['Contracheque', 'Extrato'] },
    ]);

    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain('Contracheque, Extrato');
    expect(avisos[0]).toContain('A publicação vai cobrá-la.');
  });

  it('não avisa sobre grupo com norma resolvida nem sobre grupo transparente', () => {
    expect(
      avisosDosGrupos([
        { decideResultado: true, normaResolvida: true, documentos: ['Contracheque'] },
        { decideResultado: false, normaResolvida: false, documentos: ['Extrato'] },
      ]),
    ).toEqual([]);
  });

  /** Sem documentos nomeáveis a frase não pode terminar em "reúne ." */
  it('avisa mesmo quando não há documento a nomear', () => {
    const avisos = avisosDosGrupos([
      { decideResultado: true, normaResolvida: false, documentos: [] },
    ]);

    expect(avisos[0]).not.toContain('reúne');
    expect(avisos[0]).toContain('A publicação vai cobrá-la.');
  });
});

describe('a janela própria da etapa', () => {
  const CATALOGO = new Map([['id-aval', faseCanonica({ id: 'id-aval', codigo: 'AVALIACAO', nome: 'Avaliação', agrupaEtapas: true })]]);

  /** Fase de 10 a 20 de março, a janela contra a qual a etapa é conferida. */
  const avaliacao = fase({
    faseCanonicaId: 'id-aval',
    codigo: 'AVALIACAO',
    inicio: '2027-03-10T08:00',
    fim: '2027-03-20T18:00',
  });

  const naAvaliacao = (inicio: string, fim: string, nome = 'Prova') =>
    etapa({ nome, faseCodigo: 'AVALIACAO', inicio, fim });

  const conferir = (e: EtapaPontuada, f: FaseDoCronograma = avaliacao) =>
    problemasDe([f], [e], CATALOGO, []);

  it('aceita a etapa inteiramente dentro da fase', () => {
    const problemas = conferir(naAvaliacao('2027-03-12T09:00', '2027-03-14T17:00'));

    expect(problemas.filter((p) => p.includes('Prova'))).toEqual([]);
  });

  /** Refinar não obriga a encolher: a etapa pode ocupar a fase inteira. */
  it('aceita a etapa que coincide com as bordas da fase', () => {
    const problemas = conferir(naAvaliacao('2027-03-10T08:00', '2027-03-20T18:00'));

    expect(problemas.filter((p) => p.includes('Prova'))).toEqual([]);
  });

  it('acusa a etapa cujo fim vem antes do próprio início', () => {
    const problemas = conferir(naAvaliacao('2027-03-14T17:00', '2027-03-12T09:00'));

    expect(problemas).toContain('Na etapa "Prova", o fim não pode vir antes do início.');
  });

  /** Com a janela invertida, comparar com a fase só somaria ruído ao mesmo defeito. */
  it('não soma a queixa de contenção quando a própria janela está invertida', () => {
    const problemas = conferir(naAvaliacao('2027-03-30T17:00', '2027-03-01T09:00'));

    expect(problemas.filter((p) => p.includes('Prova'))).toHaveLength(1);
  });

  it('acusa a etapa que começa antes da fase', () => {
    const problemas = conferir(naAvaliacao('2027-03-09T08:00', '2027-03-14T17:00'));

    expect(problemas).toContain(
      'A etapa "Prova" começa antes da fase Avaliação. A janela da etapa precisa caber na da fase.',
    );
  });

  it('acusa a etapa que termina depois da fase', () => {
    const problemas = conferir(naAvaliacao('2027-03-12T09:00', '2027-03-21T09:00'));

    expect(problemas).toContain(
      'A etapa "Prova" termina depois da fase Avaliação. A janela da etapa precisa caber na da fase.',
    );
  });

  it('acusa as duas pontas quando a etapa transborda dos dois lados', () => {
    const problemas = conferir(naAvaliacao('2027-03-09T08:00', '2027-03-21T09:00'));

    expect(problemas.filter((p) => p.includes('Prova'))).toHaveLength(2);
  });

  /** Em branco, a etapa acontece na janela da fase — é o que a dica do campo promete. */
  it('não confere nada quando a etapa não declara janela', () => {
    const problemas = conferir(naAvaliacao('', ''));

    expect(problemas.filter((p) => p.includes('Prova'))).toEqual([]);
  });

  it('confere a ponta declarada quando só uma das duas datas existe', () => {
    expect(conferir(naAvaliacao('2027-03-09T08:00', ''))).toContain(
      'A etapa "Prova" começa antes da fase Avaliação. A janela da etapa precisa caber na da fase.',
    );
    expect(conferir(naAvaliacao('', '2027-03-21T09:00'))).toContain(
      'A etapa "Prova" termina depois da fase Avaliação. A janela da etapa precisa caber na da fase.',
    );
  });

  /**
   * Fase sem janela não tem o que conter, e exigir data dela por causa da etapa inventaria uma
   * obrigação que o cadastro não faz. A coerência interna da etapa continua valendo.
   */
  it('tolera a etapa com janela própria quando a fase não declara a dela', () => {
    const semJanela = fase({ faseCanonicaId: 'id-aval', codigo: 'AVALIACAO', inicio: null, fim: null });

    const problemas = conferir(naAvaliacao('2027-03-12T09:00', '2027-03-14T17:00'), semJanela);

    expect(problemas.filter((p) => p.includes('Prova'))).toEqual([]);
  });

  it('nomeia a etapa sem nome em vez de deixar a mensagem sem sujeito', () => {
    const problemas = conferir(naAvaliacao('2027-03-09T08:00', '2027-03-14T17:00', ''));

    expect(problemas).toContain(
      'A etapa sem nome começa antes da fase Avaliação. A janela da etapa precisa caber na da fase.',
    );
  });
});

