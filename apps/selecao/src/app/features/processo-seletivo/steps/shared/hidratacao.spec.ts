import { describe, expect, it } from 'vitest';
import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import { WizardDraft } from '../processo-seletivo.models';
import { hidratarDraft } from './hidratacao';

/** Só o que `hidratarDraft` lê; o resto do rascunho não participa. */
const DRAFT = { identificacao: {} } as unknown as WizardDraft;

/**
 * Grafia do wire que o detalhe de Seleção emite — PascalCase, e não o token
 * canônico do catálogo de Configuração (uniplus-api#1294). Escrever a fixture
 * com o vocabulário do catálogo esconderia o defeito que este arquivo cobre.
 */
const DISTRIBUICAO = {
  id: 'snapshot-1',
  ofertaCursoOrigemId: 'oferta-1',
  voBase: 40,
  pr: 0.5,
  regraDistribuicao: { codigo: 'DISTRIB-VAGAS-LEI-12711', versao: 'v1' },
  regraAjuste: { codigo: 'RECONCILIACAO-VAGAS-ART11-PU', versao: 'v1' },
  referenciaDemografica: { id: 'snapshot-ref', origemId: 'ref-1' },
  modalidades: [
    {
      id: 'snapshot-m',
      modalidadeOrigemId: 'modalidade-1',
      codigo: 'AC',
      composicaoVagas: 'ResidualDoVo',
    },
    {
      id: 'snapshot-p',
      modalidadeOrigemId: 'modalidade-2',
      codigo: 'AC_PCD',
      composicaoVagas: 'RetiraDe',
    },
  ],
  quadro: [
    { modalidadeOrigemId: 'modalidade-1', modalidadeCodigo: 'AC', quantidade: 19 },
    { modalidadeOrigemId: 'modalidade-2', modalidadeCodigo: 'AC_PCD', quantidade: 2 },
  ],
};

function dtoCom(distribuicao: unknown): ProcessoSeletivoDto {
  return {
    nome: 'PS 2026',
    tipoProcesso: { origemId: 'tipo-1', nome: 'SiSU' },
    unidadeAdministradora: { origemId: 'unidade-1' },
    origemCandidatos: 'Interno',
    localidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
    distribuicaoVagas: distribuicao,
  } as unknown as ProcessoSeletivoDto;
}

describe('hidratarDraft — distribuição de vagas', () => {
  it('projeta a distribuição gravada sobre o rascunho', () => {
    const { ofertas } = hidratarDraft(DRAFT, dtoCom([DISTRIBUICAO])).vagas;

    expect(ofertas).toEqual([
      {
        ofertaCursoId: 'oferta-1',
        voBase: '40',
        pr: '0,5',
        regraDistribuicaoCodigo: 'DISTRIB-VAGAS-LEI-12711',
        regraDistribuicaoVersao: 'v1',
        regraAjusteCodigo: 'RECONCILIACAO-VAGAS-ART11-PU',
        regraAjusteVersao: 'v1',
        referenciaReservaDemograficaId: 'ref-1',
        modalidades: [
          { id: 'modalidade-1', codigo: 'AC' },
          { id: 'modalidade-2', codigo: 'AC_PCD' },
        ],
        quadro: [{ modalidadeId: 'modalidade-2', quantidade: '2' }],
      },
    ]);
  });

  /**
   * O campo edita com vírgula, e é assim que o operador informou o percentual:
   * reabrir mostrando `0.5` exibiria grafia diferente da que a tela pediu.
   */
  it.each([
    [0.5, '0,5'],
    [1, '1'],
    ['0.75', '0,75'],
  ])('devolve o percentual %j como %j', (pr, esperado) => {
    const { ofertas } = hidratarDraft(DRAFT, dtoCom([{ ...DISTRIBUICAO, pr }])).vagas;
    expect(ofertas[0].pr).toBe(esperado);
  });

  /** O id do snapshot não é aceito de volta pelo comando de gravação. */
  it('guarda os identificadores de origem, não os do snapshot', () => {
    const { ofertas } = hidratarDraft(DRAFT, dtoCom([DISTRIBUICAO])).vagas;

    expect(ofertas[0].modalidades[0].id).toBe('modalidade-1');
    expect(ofertas[0].referenciaReservaDemograficaId).toBe('ref-1');
  });

  /**
   * O quadro devolvido é o cálculo do servidor. Trazer AC de volta ao rascunho
   * faria a gravação seguinte reenviá-la como quantidade do edital, e a API
   * recusaria (`quantidade_calculada_nao_informavel`) a configuração que ela
   * mesma acabou de devolver — falha que só aparece na segunda edição.
   */
  it('descarta do quadro o que a Lei 12.711 calcula', () => {
    const { ofertas } = hidratarDraft(DRAFT, dtoCom([DISTRIBUICAO])).vagas;

    expect(ofertas[0].quadro.map((item) => item.modalidadeId)).toEqual(['modalidade-2']);
  });

  /** Fora do ramo federal o edital fixa todas — nada é descartado. */
  it('mantém o quadro inteiro quando a regra não é a Lei 12.711', () => {
    const institucional = {
      ...DISTRIBUICAO,
      regraDistribuicao: { codigo: 'DISTRIB-VAGAS-INSTITUCIONAL', versao: 'v1' },
    };
    const { ofertas } = hidratarDraft(DRAFT, dtoCom([institucional])).vagas;

    expect(ofertas[0].quadro).toHaveLength(2);
  });

  it('trata processo sem distribuição gravada', () => {
    expect(hidratarDraft(DRAFT, dtoCom(undefined)).vagas.ofertas).toEqual([]);
  });

  it('deixa a regra de ajuste nula quando o processo não a tem', () => {
    const semAjuste = { ...DISTRIBUICAO, regraAjuste: null, referenciaDemografica: null };
    const { ofertas } = hidratarDraft(DRAFT, dtoCom([semAjuste])).vagas;

    expect(ofertas[0].regraAjusteCodigo).toBeNull();
    expect(ofertas[0].regraAjusteVersao).toBeNull();
    expect(ofertas[0].referenciaReservaDemograficaId).toBeNull();
  });
});

/**
 * Fase que produz resultado e admite recurso — o caso completo. A janela vem com
 * deslocamento, e é assim que precisa voltar: truncar para data perderia a hora
 * que separa o fim de um dia do começo do seguinte.
 */
const FASE_COM_RECURSO = {
  id: 'snapshot-fase-1',
  ordem: 2,
  faseCanonicaOrigemId: 'fase-canonica-homologacao',
  codigo: 'HOMOLOGACAO',
  donoInstitucional: 'CEPS',
  origemData: 'PROPRIA',
  agrupaEtapas: false,
  permiteComplementacao: true,
  produzResultado: true,
  resultadoDefinitivo: false,
  coletaInscricao: false,
  inicio: '2026-03-25T08:00:00-03:00',
  fim: '2026-03-25T23:59:59-03:00',
  atoProduzidoCodigo: 'RESULTADO_HOMOLOGACAO',
  bancasRequeridas: [
    { id: 'snapshot-banca', tipoBancaOrigemId: 'tipo-banca-1', codigo: 'BANCA_ANALISE_RECURSOS' },
  ],
  regraRecurso: {
    id: 'snapshot-recurso',
    regra: { codigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO', versao: 'v1', hash: 'abc123' },
    args: {
      prazoValor: 2,
      prazoUnidade: 'diasUteis',
      atoAncoraCodigo: 'RESULTADO_HOMOLOGACAO',
      suspensividadePrimeiraInstanciaValor: null,
      suspensividadePrimeiraInstanciaUnidade: null,
      suspensividadeSegundaInstanciaValor: null,
      suspensividadeSegundaInstanciaUnidade: null,
    },
  },
};

const ETAPA = {
  id: 'etapa-persistida-1',
  nome: 'Prova Objetiva',
  carater: 'classificatoria',
  tipoEtapa: { origemId: 'tipo-etapa-1', codigo: 'PROVA_OBJETIVA', nome: 'Prova Objetiva' },
  peso: 2,
  notaMinima: null,
  ordem: 1,
};

/** Reaproveita a base de `dtoCom`, que traz o que `hidratarDraft` lê fora do cronograma. */
function dtoComCronograma(extra: Record<string, unknown>): ProcessoSeletivoDto {
  return { ...dtoCom([]), ...extra } as unknown as ProcessoSeletivoDto;
}

const COM_CRONOGRAMA = dtoComCronograma({
  cronogramaFases: [FASE_COM_RECURSO],
  etapas: [ETAPA],
  algoritmoContagemPrazo: {
    codigo: 'CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL',
    versao: 'v1',
    hash: 'def456',
  },
});

describe('hidratarDraft — cronograma e etapas', () => {
  it('projeta a fase pelo id de origem, não pelo id do snapshot', () => {
    const [fase] = hidratarDraft(DRAFT, COM_CRONOGRAMA).cronograma.fases;

    expect(fase.faseCanonicaId).toBe('fase-canonica-homologacao');
    expect(fase.tiposBancaIds).toEqual(['tipo-banca-1']);
  });

  /**
   * O código acompanha o id porque as pendências derivadas e as precedências
   * falam em `INSCRICAO`, não em uuid.
   */
  it('guarda o código canônico ao lado do identificador da fase', () => {
    const [fase] = hidratarDraft(DRAFT, COM_CRONOGRAMA).cronograma.fases;

    expect(fase.codigo).toBe('HOMOLOGACAO');
  });

  it('preserva a janela como instante, com o deslocamento intacto', () => {
    const [fase] = hidratarDraft(DRAFT, COM_CRONOGRAMA).cronograma.fases;

    expect(fase.inicio).toBe('2026-03-25T08:00:00-03:00');
    expect(fase.fim).toBe('2026-03-25T23:59:59-03:00');
  });

  /**
   * O hash da referência não volta ao rascunho: o servidor o recompõe do
   * catálogo, e uma cópia aqui envelheceria sozinha.
   */
  it('projeta a regra de recurso sem carregar o hash da referência', () => {
    const [fase] = hidratarDraft(DRAFT, COM_CRONOGRAMA).cronograma.fases;

    expect(fase.regraRecurso?.regraCodigo).toBe('RECURSO-PRAZO-ANCORADO-EM-ATO');
    expect(fase.regraRecurso?.prazoValor).toBe('2');
    expect(fase.regraRecurso).not.toHaveProperty('hash');
  });

  /** Ausência dos dois campos é desativação da instância, e vira campo vazio. */
  it('projeta a suspensividade desativada como par vazio', () => {
    const [fase] = hidratarDraft(DRAFT, COM_CRONOGRAMA).cronograma.fases;

    expect(fase.regraRecurso?.suspensividadePrimeiraInstanciaValor).toBe('');
    expect(fase.regraRecurso?.suspensividadePrimeiraInstanciaUnidade).toBe('');
  });

  /**
   * O `id` da etapa é o único que volta ao rascunho, porque critério de
   * desempate e regra de eliminação o referenciam — perdê-lo ao reordenar
   * deixaria os dois apontando para uma etapa que deixou de existir.
   */
  it('preserva o id da etapa e o id de origem do tipo', () => {
    const [etapa] = hidratarDraft(DRAFT, COM_CRONOGRAMA).cronograma.etapas;

    expect(etapa.id).toBe('etapa-persistida-1');
    expect(etapa.tipoEtapaOrigemId).toBe('tipo-etapa-1');
  });

  it('devolve nota mínima ausente como campo vazio, não como zero', () => {
    const [etapa] = hidratarDraft(DRAFT, COM_CRONOGRAMA).cronograma.etapas;

    expect(etapa.notaMinima).toBe('');
    expect(etapa.peso).toBe('2');
  });

  /**
   * A etapa gravada sem ordem volta como zero. Com uma etapa só não há duplicata
   * que a conferência acuse nem botão de mover que a conserte: a gravação sairia
   * com ordem zero para voltar recusada, sem nada na tela explicando. Renumerar
   * na chegada preserva a sequência que o servidor devolveu.
   */
  it('renumera as etapas na chegada, corrigindo ordem ausente', () => {
    const semOrdem = dtoComCronograma({
      etapas: [
        { ...ETAPA, id: 'etapa-sem-ordem', ordem: null },
        { ...ETAPA, id: 'etapa-com-ordem', ordem: 7 },
      ],
    });

    const { etapas } = hidratarDraft(DRAFT, semOrdem).cronograma;

    expect(etapas.map((etapa) => etapa.ordem)).toEqual([1, 2]);
    expect(etapas.map((etapa) => etapa.id)).toEqual(['etapa-sem-ordem', 'etapa-com-ordem']);
  });

  it('projeta a convenção de contagem declarada', () => {
    const { cronograma } = hidratarDraft(DRAFT, COM_CRONOGRAMA);

    expect(cronograma.algoritmoContagemCodigo).toBe('CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL');
    expect(cronograma.algoritmoContagemVersao).toBe('v1');
  });

  it('trata processo sem cronograma, sem etapa e sem convenção', () => {
    const vazio = dtoComCronograma({ cronogramaFases: [], etapas: [] });
    const { cronograma } = hidratarDraft(DRAFT, vazio);

    expect(cronograma.fases).toEqual([]);
    expect(cronograma.etapas).toEqual([]);
    expect(cronograma.algoritmoContagemCodigo).toBe('');
  });
});
