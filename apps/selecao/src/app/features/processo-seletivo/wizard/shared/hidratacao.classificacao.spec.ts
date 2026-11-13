import { describe, expect, it } from 'vitest';
import { ProcessoSeletivoStore } from '../processo-seletivo.store';
import { hidratarDraft } from './hidratacao';
import { DRAFT, dtoComCronograma } from './hidratacao.testing';

const CLASSIFICACAO = {
  regraCalculo: { codigo: 'FORMULA-MEDIA-PONDERADA', versao: '1.0' },
  regraArredondamento: { codigo: 'ARRED-TRUNCAR', versao: '1.0' },
  casasArredondamento: 2,
  regraOrdemAlocacao: { codigo: 'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA', versao: '1.0' },
  baseadoEmEnem: false,
  concorrenciaDuplaAplicavel: false,
  escalaNotaFinal: 1000,
  resolucaoPesoAreaEnem: null,
  quadroPesoAreaEnem: [],
  regrasEliminacao: [
    {
      id: 'snapshot-elim-1',
      regra: { codigo: 'ELIM-NOTA-MINIMA-ETAPA', versao: '1.0' },
      etapaRef: 'etapa-persistida-1',
      notaMinima: 5,
      minimo: null,
      areaCodigo: null,
    },
    {
      id: 'snapshot-elim-2',
      regra: { codigo: 'ELIM-CORTE-EM-AREA', versao: 'v1' },
      etapaRef: null,
      notaMinima: null,
      minimo: 450,
      areaCodigo: 'REDACAO',
    },
  ],
};

const BASE_LEGAL_ID_SNAPSHOT = 'ba5e0000-0000-7000-8000-000000000001';

const BONUS = {
  id: 'snapshot-bonus-1',
  regra: { codigo: 'BONUS-MULTIPLICATIVO', versao: '1.0' },
  fator: 1.2,
  teto: null,
  baseLegalBonusRegionalId: BASE_LEGAL_ID_SNAPSHOT,
  fatoElegibilidadeCodigo: 'SOLICITA_ACRESCIMO',
  tipoInstrumento: 'PORTARIA',
  identificacao: 'Portaria Unifesspa nº 2514/2023',
  descricao: 'Institui inclusão regional.',
  municipios: [{ codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' }],
};

const CRITERIOS_DESEMPATE = [
  {
    id: 'snapshot-desemp-2',
    ordem: 2,
    regra: { codigo: 'DESEMPATE-IDOSO', versao: '1.0' },
    etapaRef: null,
    idadeMinima: 60,
    fato: null,
    operador: null,
    valor: null,
    areas: null,
  },
  {
    id: 'snapshot-desemp-1',
    ordem: 1,
    regra: { codigo: 'DESEMPATE-MAIOR-NOTA-ETAPA', versao: '1.0' },
    etapaRef: 'etapa-persistida-1',
    idadeMinima: null,
    fato: null,
    operador: null,
    valor: null,
    areas: null,
  },
  {
    id: 'snapshot-desemp-3',
    ordem: 3,
    regra: { codigo: 'DESEMPATE-MAIOR-NOTA-AREA-ENEM', versao: '1' },
    etapaRef: null,
    idadeMinima: null,
    fato: null,
    operador: null,
    valor: null,
    areas: ['MATEMATICA', 'REDACAO'],
  },
];

describe('hidratarDraft — classificação, bônus e desempate (UNI-REQ-0482)', () => {
  it('projeta o número de opções de curso, e o deixa vazio quando o processo não o declarou', () => {
    const declarado = dtoComCronograma({ opcoesDeCurso: { numero: 2 } });
    const semDeclarar = dtoComCronograma({ opcoesDeCurso: null });

    expect(hidratarDraft(DRAFT, declarado).opcoesDeCurso).toEqual({ numero: '2' });
    expect(hidratarDraft(DRAFT, semDeclarar).opcoesDeCurso).toEqual({ numero: '' });
  });

  it('projeta a classificação inteira, inclusive as regras de eliminação', () => {
    const dto = dtoComCronograma({ classificacao: CLASSIFICACAO });

    expect(hidratarDraft(DRAFT, dto).classificacao).toEqual({
      regraCalculoCodigo: 'FORMULA-MEDIA-PONDERADA',
      regraCalculoVersao: '1.0',
      regraArredondamentoCodigo: 'ARRED-TRUNCAR',
      regraArredondamentoVersao: '1.0',
      casasArredondamento: '2',
      regraOrdemAlocacaoCodigo: 'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA',
      regraOrdemAlocacaoVersao: '1.0',
      baseadoEmEnem: false,
      escalaNotaFinal: '1000',
      resolucaoPesoAreaEnem: '',
      regrasEliminacao: [
        {
          regraCodigo: 'ELIM-NOTA-MINIMA-ETAPA',
          regraVersao: '1.0',
          etapaRef: 'etapa-persistida-1',
          notaMinima: '5',
          minimo: '',
          areaCodigo: '',
        },
        {
          regraCodigo: 'ELIM-CORTE-EM-AREA',
          regraVersao: 'v1',
          etapaRef: '',
          notaMinima: '',
          minimo: '450',
          areaCodigo: 'REDACAO',
        },
      ],
      edicoesEnem: [],
    });
  });

  it('projeta a resolução de Peso por Área que o processo congelou', () => {
    const enem = {
      ...CLASSIFICACAO,
      baseadoEmEnem: true,
      resolucaoPesoAreaEnem: 'Resolução nº 805/2024/Consepe',
      quadroPesoAreaEnem: [
        {
          grupoAreaEnem: { codigo: 'SAUDE_E_BIOLOGICAS', rotulo: 'Saúde e Biológicas' },
          baseLegal: 'Resolução nº 805/2024/Consepe – Anexo I',
          areas: [{ codigo: 'REDACAO', rotulo: 'Redação', peso: 2, corte: 400 }],
        },
      ],
    };
    const { classificacao } = hidratarDraft(DRAFT, dtoComCronograma({ classificacao: enem }));

    expect(classificacao.resolucaoPesoAreaEnem).toBe('Resolução nº 805/2024/Consepe');
  });

  it('projeta a escala da nota final como o campo a lê, e vazia quando o processo não a declarou', () => {
    const fracionada = { ...CLASSIFICACAO, escalaNotaFinal: 7.5 };
    const semEscala = { ...CLASSIFICACAO, escalaNotaFinal: null };

    expect(
      hidratarDraft(DRAFT, dtoComCronograma({ classificacao: fracionada })).classificacao
        .escalaNotaFinal,
    ).toBe('7,5');
    expect(
      hidratarDraft(DRAFT, dtoComCronograma({ classificacao: semEscala })).classificacao
        .escalaNotaFinal,
    ).toBe('');
  });

  /** Sob classificação importada, o arredondamento é ausente — `null`, não zero. */
  it('projeta classificação importada sem arredondamento como campo vazio', () => {
    const importada = {
      ...CLASSIFICACAO,
      regraCalculo: { codigo: 'CLASSIFICACAO-IMPORTADA', versao: '1.0' },
      regraArredondamento: null,
      casasArredondamento: null,
      regrasEliminacao: [],
    };
    const { classificacao } = hidratarDraft(DRAFT, dtoComCronograma({ classificacao: importada }));

    expect(classificacao.regraArredondamentoCodigo).toBe('');
    expect(classificacao.casasArredondamento).toBe('');
    expect(classificacao.regrasEliminacao).toEqual([]);
  });

  it('trata processo sem classificação gravada como rascunho vazio', () => {
    const { classificacao } = hidratarDraft(DRAFT, dtoComCronograma({ classificacao: null }));

    expect(classificacao.regraCalculoCodigo).toBe('');
    expect(classificacao.resolucaoPesoAreaEnem).toBe('');
    expect(classificacao.regrasEliminacao).toEqual([]);
  });

  it('projeta o bônus regional gravado, com a declaração de que aplica', () => {
    const { bonus } = hidratarDraft(
      DRAFT,
      dtoComCronograma({ bonusRegional: BONUS, aplicaBonusRegional: true }),
    );

    expect(bonus).toEqual({
      aplica: true,
      regraCodigo: 'BONUS-MULTIPLICATIVO',
      regraVersao: '1.0',
      fator: '1.2',
      teto: '',
      baseLegalBonusRegionalId: BASE_LEGAL_ID_SNAPSHOT,
      fatoElegibilidadeCodigo: 'SOLICITA_ACRESCIMO',
    });
  });

  /** A declaração vem do servidor; sem configuração, os campos voltam vazios. */
  it('projeta a declaração de que não aplica o bônus, sem resíduo de configuração', () => {
    const { bonus } = hidratarDraft(
      DRAFT,
      dtoComCronograma({ bonusRegional: null, aplicaBonusRegional: false }),
    );

    expect(bonus).toEqual({
      aplica: false,
      regraCodigo: '',
      regraVersao: '',
      fator: '',
      teto: '',
      baseLegalBonusRegionalId: '',
      fatoElegibilidadeCodigo: '',
    });
  });

  /** Ausência da configuração não é mais "sem bônus": sem declaração, o passo pergunta. */
  it('mantém o bônus por declarar quando o servidor ainda não tem a declaração', () => {
    const { bonus } = hidratarDraft(
      DRAFT,
      dtoComCronograma({ bonusRegional: null, aplicaBonusRegional: null }),
    );

    expect(bonus.aplica).toBeNull();
  });

  it('projeta os critérios de desempate na ordem em que o servidor os avalia', () => {
    const { desempate } = hidratarDraft(
      DRAFT,
      dtoComCronograma({ criteriosDesempate: CRITERIOS_DESEMPATE }),
    );

    expect(desempate.map((criterio) => criterio.regraCodigo)).toEqual([
      'DESEMPATE-MAIOR-NOTA-ETAPA',
      'DESEMPATE-IDOSO',
      'DESEMPATE-MAIOR-NOTA-AREA-ENEM',
    ]);
    expect(desempate[1]).toEqual({
      regraCodigo: 'DESEMPATE-IDOSO',
      regraVersao: '1.0',
      etapaRef: '',
      idadeMinima: '60',
      fato: '',
      operador: '',
      valor: '',
      areas: [],
    });
  });

  it('projeta as áreas do critério por área do ENEM na ordem gravada', () => {
    const { desempate } = hidratarDraft(
      DRAFT,
      dtoComCronograma({ criteriosDesempate: CRITERIOS_DESEMPATE }),
    );

    expect(desempate[2].areas).toEqual(['MATEMATICA', 'REDACAO']);
  });

  it('guarda no store os critérios lidos como os gravados, contra os quais a classificação é conferida', () => {
    const store = new ProcessoSeletivoStore();

    store.hidratar(dtoComCronograma({ criteriosDesempate: CRITERIOS_DESEMPATE }));

    expect(store.classificacao.criteriosDesempateGravados()).toEqual(store.draft().desempate);
    expect(store.classificacao.criteriosDesempateGravados()?.[2].areas).toEqual([
      'MATEMATICA',
      'REDACAO',
    ]);
  });

  it('a hidratação de outro processo muda a versão da classificação lida, mesmo com a mesma classificação', () => {
    const store = new ProcessoSeletivoStore();
    store.hidratar(dtoComCronograma({ id: 'processo-1' }));
    const antes = store.classificacao.versaoLida();

    store.hidratar(dtoComCronograma({ id: 'processo-2' }));

    expect(store.classificacao.versaoLida()).toBe(antes + 1);
  });

  it('a releitura do processo repõe os critérios gravados que uma gravação inconclusiva deixou desconhecidos', () => {
    const store = new ProcessoSeletivoStore();
    store.classificacao.criteriosDesempateGravados.set(null);

    store.registrarGravadoLido(dtoComCronograma({ criteriosDesempate: CRITERIOS_DESEMPATE }));

    // Na ordem em que o servidor os avalia, como a hidratação os projeta.
    expect(
      store.classificacao.criteriosDesempateGravados()?.map((criterio) => criterio.regraCodigo),
    ).toEqual(
      [...CRITERIOS_DESEMPATE]
        .sort((a, b) => a.ordem - b.ordem)
        .map((criterio) => criterio.regra.codigo),
    );
  });

  it('trata processo sem critério de desempate declarado', () => {
    const { desempate } = hidratarDraft(DRAFT, dtoComCronograma({ criteriosDesempate: [] }));

    expect(desempate).toEqual([]);
  });
});
