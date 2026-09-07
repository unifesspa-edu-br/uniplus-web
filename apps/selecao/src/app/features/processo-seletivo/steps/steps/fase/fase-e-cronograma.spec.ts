import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { PUBLICACOES_BASE_PATH } from '@uniplus/shared-data/publicacoes';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { CatalogosDoCronogramaService } from '../cronograma/catalogos-do-cronograma.service';
import { CronogramaStepComponent } from '../cronograma/cronograma.component';
import { FaseStepComponent } from './fase.component';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000007aa';
const ROTA_FASES = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/cronograma-fases`;
const ROTA_ETAPAS = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/etapas`;
const ROTA_PROCESSO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}`;

/** O interceptor só lê o corpo como ProblemDetails sob este media type. */
const PROBLEM_JSON = { 'content-type': 'application/problem+json' };

/** A recusa do servidor quando a nova ordem fecha ciclo entre fases existentes. */
const CICLO_DE_ORDEM = {
  type: 'about:blank',
  title: 'A redefinição do cronograma troca a Ordem entre fases já existentes',
  status: 422,
  code: 'uniplus.selecao.fase_cronograma.permutacao_de_ordem_nao_suportada',
  traceId: '00000000000000000000000000000002',
};

const ID_AVALIACAO = '01960000-0000-7000-0000-0000000000c2';
const ID_RESULTADO = '01960000-0000-7000-0000-0000000000c3';
const ID_TIPO_ETAPA = '01960000-0000-7000-0000-0000000000e1';
const ID_ETAPA_GRAVADA = '01960000-0000-7000-0000-0000000000ee';
const ID_BANCA_HETERO = '01960000-0000-7000-0000-0000000000b1';
const ID_CATEGORIA_RACA = '01960000-0000-7000-0000-0000000000d1';

const FASES_CANONICAS = [
  {
    id: ID_AVALIACAO,
    codigo: 'AVALIACAO',
    nome: 'Avaliação',
    donoTipico: 'CEPS',
    agrupaEtapas: true,
    permiteComplementacao: false,
    coletaInscricao: false,
    origemData: 'PROPRIA',
  },
  {
    id: ID_RESULTADO,
    codigo: 'RESULTADO_FINAL',
    nome: 'Resultado final',
    donoTipico: 'CEPS',
    agrupaEtapas: false,
    permiteComplementacao: false,
    coletaInscricao: false,
    origemData: 'PROPRIA',
  },
];

const TIPOS_ETAPA = [
  { id: ID_TIPO_ETAPA, codigo: 'PROVA_OBJETIVA', nome: 'Prova objetiva', ativo: true },
];

const ATOS = [
  {
    id: 'ato-resultado-final',
    codigo: 'RESULTADO_FINAL',
    nome: 'Resultado final',
    congelaConfiguracao: false,
    unicoPorObjeto: false,
    efeitoIrreversivel: false,
    ehResultado: true,
    vigenciaInicio: '2020-01-01',
    vigenciaFim: null,
    baseLegal: null,
    criadoEm: '2026-08-30T12:00:00Z',
  },
];

const BANCAS = [
  {
    id: ID_BANCA_HETERO,
    codigo: 'HETEROIDENTIFICACAO',
    nome: 'Heteroidentificação',
    faseTipica: null,
    descricao: null,
    criadoEm: '2026-08-30T12:00:00Z',
  },
];

const CATEGORIAS = [
  {
    id: ID_CATEGORIA_RACA,
    codigo: 'RACA_ETNIA',
    nome: 'Raça e etnia',
    descricao: null,
    ordem: 1,
    criadoEm: '2026-08-30T12:00:00Z',
  },
];

/** O detalhe que a releitura de etapas devolve depois da gravação. */
const PROCESSO_COM_ETAPA_GRAVADA = {
  id: PROCESSO_ID,
  nome: 'Vestibular 2026.1',
  tipoProcesso: {
    origemId: '01960000-0000-7000-0000-0000000000t1',
    codigo: 'VESTIBULAR',
    nome: 'Vestibular',
  },
  status: 'rascunho',
  origemCandidatos: 'inscricaoPropria',
  unidadeAdministradora: {
    origemId: '01960000-0000-7000-0000-0000000000u1',
    sigla: 'IGE',
    slug: 'ige',
    nome: 'Instituto de Geociências e Engenharias',
  },
  localidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  etapas: [
    {
      id: ID_ETAPA_GRAVADA,
      nome: 'Prova objetiva',
      carater: 'classificatoria',
      tipoEtapa: { origemId: ID_TIPO_ETAPA, codigo: 'PROVA_OBJETIVA', nome: 'Prova objetiva' },
      peso: 1,
      notaMinima: null,
      ordem: 1,
    },
  ],
  ofertaAtendimento: null,
  distribuicaoVagas: [],
  bonusRegional: null,
  cascata: null,
  criteriosDesempate: [],
  classificacao: null,
  cronogramaFases: [],
  documentosExigidos: [],
  raizesExigencia: [],
  referenciaTemporalFatos: null,
  configuracaoTaxaInscricao: { cobra: false, valor: null, fundamentos: [] },
};

/**
 * Os dois passos que escrevem a mesma coleção de fases, montados sobre o mesmo
 * rascunho — que é como eles existem na página do wizard.
 *
 * O que se prova aqui não é alcançável testando cada um sozinho: a linha do
 * tempo e a superfície da fase espelham e reescrevem `cronograma.fases`, e a
 * gravação substitui a coleção inteira. Uma reescrita que não respeitasse o que
 * o outro passo acabou de declarar apagaria trabalho sem erro nenhum, e só a
 * releitura do processo revelaria — depois.
 */
describe('a linha do tempo e a superfície da fase sobre o mesmo cronograma', () => {
  let cronograma: CronogramaStepComponent;
  let superficie: FaseStepComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let detectar: () => void;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CronogramaStepComponent, FaseStepComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicialService,
        CatalogosDoCronogramaService,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: PUBLICACOES_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    // Um provider de cada serviço no injetor do TestBed: as duas telas
    // compartilham o rascunho, os catálogos e a chave de gravação, como
    // compartilham na página que as hospeda.
    const fixtureCronograma = TestBed.createComponent(CronogramaStepComponent);
    const fixtureSuperficie = TestBed.createComponent(FaseStepComponent);
    cronograma = fixtureCronograma.componentInstance;
    superficie = fixtureSuperficie.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);
    detectar = () => {
      fixtureCronograma.detectChanges();
      fixtureSuperficie.detectChanges();
    };

    detectar();

    for (const requisicao of controller.match(() => true)) {
      const { url } = requisicao.request;
      if (url.includes('fases-canonicas')) requisicao.flush(FASES_CANONICAS);
      else if (url.includes('tipos-etapa')) requisicao.flush(TIPOS_ETAPA);
      else if (url.includes('tipos-banca')) requisicao.flush(BANCAS);
      else if (url.includes('categorias-documento')) requisicao.flush(CATEGORIAS);
      else if (url.includes('tipos-ato')) requisicao.flush(ATOS);
      else requisicao.flush([]);
    }
    detectar();
  });

  afterEach(() => controller.verify());

  /** Deixa a cadeia de `await` do comando avançar antes da próxima expectativa. */
  const proximoPasso = () => new Promise((resolve) => setTimeout(resolve, 0));

  /** As ordens que o corpo do comando de cronograma declara. */
  const ordensDe = (corpo: unknown): number[] =>
    (corpo as { ordem: number }[]).map((fase) => fase.ordem);

  /** As fases do corpo, na ordem em que ele as declara. */
  const fasesDe = (corpo: unknown): string[] =>
    (corpo as { faseCanonicaId: string }[]).map((fase) => fase.faseCanonicaId);

  function comCertame(): void {
    store.patchObjectSection('cronograma', {
      fases: [
        {
          faseCanonicaId: ID_AVALIACAO,
          codigo: 'AVALIACAO',
          ordem: 1,
          inicio: '2026-03-01T08:00:00-03:00',
          fim: '2026-03-10T18:00:00-03:00',
          produtos: [],
          faseConcluinteCodigo: null,
          emiteParecerIndividual: false,
          bancasRequeridas: [],
          regraRecurso: null,
          congelados: null,
        },
        {
          faseCanonicaId: ID_RESULTADO,
          codigo: 'RESULTADO_FINAL',
          ordem: 2,
          inicio: '2026-04-01T08:00:00-03:00',
          fim: '2026-04-05T18:00:00-03:00',
          produtos: [],
          faseConcluinteCodigo: null,
          emiteParecerIndividual: false,
          bancasRequeridas: [],
          regraRecurso: null,
          congelados: null,
        },
      ],
      etapas: [
        {
          id: ID_ETAPA_GRAVADA,
          nome: 'Prova objetiva',
          carater: 'classificatoria' as const,
          tipoEtapaOrigemId: ID_TIPO_ETAPA,
          peso: '1',
          notaMinima: '',
          ordem: 1,
        },
      ],
    });
    detectar();
  }

  /**
   * O caminho real do operador: ele desenha a linha do tempo, entra na fase
   * para declarar o que ela publica e quem a julga, volta para acertar uma data
   * e grava. Nada do que ele fez em qualquer um dos dois passos pode ficar para
   * trás no corpo que sai.
   */
  it('não perde o que foi declarado num passo quando o outro é editado', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comCertame();

    // 1. Linha do tempo: acerta o fim da primeira fase.
    cronograma.fases.at(0).controls.fim.setValue('2026-03-11T18:00');
    detectar();

    // 2. Superfície da fase: declara o que a segunda publica e quem a julga.
    superficie.abrirFase(ID_RESULTADO);
    detectar();
    superficie.acrescentarProduto();
    superficie.escolherAto(0, 'RESULTADO_FINAL');
    superficie.escolherPapel(0, 'DEFINITIVO');
    superficie.acrescentarBanca();
    superficie.escolherTipoDeBanca(0, ID_BANCA_HETERO);
    superficie.alternarCategoria(0, ID_CATEGORIA_RACA, true);
    detectar();

    // 3. Linha do tempo de novo: acerta o início da segunda fase. A superfície
    //    reescreveu a coleção entre as duas edições; se ela tivesse partido de
    //    uma cópia velha, a mudança do passo 1 sumiria aqui.
    expect(cronograma.fases.at(0).controls.fim.value).toBe('2026-03-11T18:00');
    cronograma.fases.at(1).controls.inicio.setValue('2026-04-02T08:00');
    detectar();

    // A superfície continua mostrando o que declarou, depois de duas reescritas
    // vindas da outra tela.
    expect(superficie.produtos).toEqual([{ atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' }]);
    expect(superficie.bancas).toEqual([
      { tipoBancaId: ID_BANCA_HETERO, categoriasDocumentoIds: [ID_CATEGORIA_RACA] },
    ]);

    // 4. Grava pela linha do tempo — é ela que leva as etapas junto.
    const gravacao = cronograma.persistir();

    controller.expectOne(ROTA_ETAPAS).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_ETAPA_GRAVADA);
    await proximoPasso();

    const enviadas = controller.expectOne(ROTA_FASES);
    const corpo = enviadas.request.body as Record<string, unknown>[];

    expect(corpo[0]).toMatchObject({
      faseCanonicaId: ID_AVALIACAO,
      ordem: 1,
      inicio: '2026-03-01T08:00:00-03:00',
      fim: '2026-03-11T18:00:00-03:00',
    });
    expect(corpo[1]).toMatchObject({
      faseCanonicaId: ID_RESULTADO,
      ordem: 2,
      inicio: '2026-04-02T08:00:00-03:00',
      fim: '2026-04-05T18:00:00-03:00',
      produtos: [{ atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' }],
      bancasRequeridas: [
        { tipoBancaId: ID_BANCA_HETERO, categoriasDocumentoIds: [ID_CATEGORIA_RACA] },
      ],
    });

    enviadas.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    expect((await gravacao).valid).toBe(true);
  });

  /**
   * A linha em branco nasce no rascunho no instante em que o operador clica em
   * "Acrescentar publicação", e a gravação do cronograma substitui a coleção
   * inteira. A conferência da linha do tempo precisa cobrar o que a superfície
   * deixou pela metade: sem isso, mexer numa data manda a publicação sem ato ao
   * servidor, e a recusa volta falando de um campo que aquele passo não mostra.
   */
  it('recusa gravar pela linha do tempo a publicação que a fase deixou sem ato', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comCertame();

    superficie.acrescentarProduto();
    detectar();

    cronograma.fases.at(0).controls.fim.setValue('2026-03-11T18:00');
    detectar();

    const resultado = await cronograma.persistir();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.join(' ')).toContain('Escolha o tipo de ato');
    expect(resultado.messages?.join(' ')).toContain('Configuração por fase');
    controller.expectNone(ROTA_FASES);
    controller.expectNone(ROTA_ETAPAS);
  });

  it('recusa gravar pela linha do tempo a banca que a fase deixou sem tipo', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comCertame();

    superficie.acrescentarBanca();
    detectar();

    const resultado = await cronograma.persistir();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.join(' ')).toContain('Escolha o tipo de cada banca requerida');
    controller.expectNone(ROTA_FASES);
  });

  /**
   * "Cabe recurso" marcado sem regra nem prazo: `comoComandoDeFase` converteria
   * o prazo vazio em zero e mandaria a unidade em branco, e o servidor recusaria
   * a gravação inteira por causa de um campo que a linha do tempo não edita.
   */
  it('recusa gravar pela linha do tempo o recurso declarado pela metade', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comCertame();

    superficie.formulario()?.controls.admiteRecurso.setValue(true);
    detectar();

    const resultado = await cronograma.persistir();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.join(' ')).toContain('prazo de interposição');
    controller.expectNone(ROTA_FASES);
  });

  /**
   * A reordenação fica no rascunho até alguém gravar, e quem grava pode ser a
   * superfície da fase. Toda permutação não-trivial fecha ciclo de ordem, que o
   * servidor não persiste numa chamada só — o contorno de duas gravações precisa
   * valer em qualquer caminho que substitua a coleção.
   */
  it('contorna o ciclo de ordem também quando quem grava é a superfície da fase', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comCertame();

    // Troca as duas fases de lugar pela linha do tempo, sem gravar ali.
    cronograma.mover(0, 1);
    detectar();

    const gravacao = superficie.persistir();

    // Renumerar produz 1..N de novo: a permutação está em qual fase ocupa cada
    // posição, não nos valores.
    const pretendida = controller.expectOne(ROTA_FASES);
    expect(fasesDe(pretendida.request.body)).toEqual([ID_RESULTADO, ID_AVALIACAO]);
    expect(ordensDe(pretendida.request.body)).toEqual([1, 2]);
    pretendida.flush(CICLO_DE_ORDEM, {
      status: 422,
      statusText: 'Unprocessable Content',
      headers: PROBLEM_JSON,
    });
    await proximoPasso();

    // A gravação intermediária tira as duas da faixa disputada.
    const intermediaria = controller.expectOne(ROTA_FASES);
    expect(ordensDe(intermediaria.request.body)).toEqual([3, 4]);
    intermediaria.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();

    const definitiva = controller.expectOne(ROTA_FASES);
    expect(fasesDe(definitiva.request.body)).toEqual([ID_RESULTADO, ID_AVALIACAO]);
    expect(ordensDe(definitiva.request.body)).toEqual([1, 2]);
    definitiva.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();

    expect((await gravacao).valid).toBe(true);
  });

  /**
   * Quando o contorno não resolve, o operador precisa da orientação — não do
   * título cru de uma recusa que fala de uma tela onde ele nem reordena.
   */
  it('explica a permutação de ordem que a superfície da fase não consegue contornar', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comCertame();

    cronograma.mover(0, 1);
    detectar();

    const gravacao = superficie.persistir();

    controller.expectOne(ROTA_FASES).flush(CICLO_DE_ORDEM, {
      status: 422,
      statusText: 'Unprocessable Content',
      headers: PROBLEM_JSON,
    });
    await proximoPasso();
    controller.expectOne(ROTA_FASES).flush(CICLO_DE_ORDEM, {
      status: 422,
      statusText: 'Unprocessable Content',
      headers: PROBLEM_JSON,
    });
    await proximoPasso();

    const resultado = await gravacao;
    expect(resultado.messages?.join(' ')).toContain('exige duas gravações');
    expect(superficie.recusasGerais().join(' ')).toContain('exige duas gravações');
  });

  /**
   * O mesmo trajeto visto do outro lado: gravar pela superfície da fase envia a
   * coleção inteira, e o que a linha do tempo declarou tem de ir junto.
   */
  it('leva a linha do tempo inteira quando quem grava é a superfície da fase', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comCertame();

    cronograma.fases.at(1).controls.fim.setValue('2026-04-06T18:00');
    detectar();

    superficie.abrirFase(ID_RESULTADO);
    detectar();
    superficie.acrescentarProduto();
    superficie.escolherAto(0, 'RESULTADO_FINAL');
    superficie.escolherPapel(0, 'DEFINITIVO');
    detectar();

    const gravacao = superficie.persistir();
    const enviadas = controller.expectOne(ROTA_FASES);
    const corpo = enviadas.request.body as Record<string, unknown>[];

    expect(corpo).toHaveLength(2);
    expect(corpo[0]).toMatchObject({ faseCanonicaId: ID_AVALIACAO, ordem: 1, produtos: [] });
    expect(corpo[1]).toMatchObject({
      faseCanonicaId: ID_RESULTADO,
      ordem: 2,
      fim: '2026-04-06T18:00:00-03:00',
      produtos: [{ atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' }],
    });

    // A gravação da superfície não toca as etapas, e o rascunho as mantém.
    expect(store.draft().cronograma.etapas).toHaveLength(1);

    enviadas.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    expect((await gravacao).valid).toBe(true);
  });
});
