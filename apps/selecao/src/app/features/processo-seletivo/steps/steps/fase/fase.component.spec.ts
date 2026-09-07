import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { PUBLICACOES_BASE_PATH } from '@uniplus/shared-data/publicacoes';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';

import type { FaseDoCronograma } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { CatalogosDoCronogramaService } from '../cronograma/catalogos-do-cronograma.service';
import { FaseStepComponent } from './fase.component';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000007aa';
const ROTA_FASES = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/cronograma-fases`;

/** O interceptor só lê o corpo como ProblemDetails sob este media type. */
const PROBLEM_JSON = { 'content-type': 'application/problem+json' };

const ID_AVALIACAO = '01960000-0000-7000-0000-0000000000c2';
const ID_RECURSOS = '01960000-0000-7000-0000-0000000000c3';
const ID_BANCA_HETERO = '01960000-0000-7000-0000-0000000000b1';
const ID_CATEGORIA_RACA = '01960000-0000-7000-0000-0000000000d1';
const ID_CATEGORIA_RENDA = '01960000-0000-7000-0000-0000000000d2';

const FASES_CANONICAS = [
  {
    id: ID_AVALIACAO,
    codigo: 'AVALIACAO',
    nome: 'Avaliação',
    donoTipico: 'CEPS',
    agrupaEtapas: false,
    permiteComplementacao: false,
    coletaInscricao: false,
    origemData: 'PROPRIA',
  },
  {
    id: ID_RECURSOS,
    codigo: 'RECURSOS',
    nome: 'Recursos',
    donoTipico: 'CEPS',
    agrupaEtapas: false,
    permiteComplementacao: false,
    coletaInscricao: false,
    origemData: 'PROPRIA',
  },
];

/** Vigência aberta, para que o seletor de publicação ofereça os três. */
function ato(codigo: string, nome: string, ehResultado: boolean) {
  return {
    id: `ato-${codigo}`,
    codigo,
    nome,
    congelaConfiguracao: false,
    unicoPorObjeto: false,
    efeitoIrreversivel: false,
    ehResultado,
    vigenciaInicio: '2020-01-01',
    vigenciaFim: null,
    baseLegal: null,
    criadoEm: '2026-08-30T12:00:00Z',
  };
}

const ATOS = [
  ato('GABARITO_PRELIMINAR', 'Gabarito preliminar', true),
  ato('RESULTADO_PRELIMINAR', 'Resultado preliminar', true),
  ato('RESULTADO_FINAL', 'Resultado final', true),
  ato('COMUNICADO', 'Comunicado', false),
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
  {
    id: ID_CATEGORIA_RENDA,
    codigo: 'RENDA',
    nome: 'Renda',
    descricao: null,
    ordem: 2,
    criadoEm: '2026-08-30T12:00:00Z',
  },
];

const REGRAS = [
  {
    codigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
    versao: 'v1',
    tipo: 'regra_prazo_recurso',
    esquemaArgs: {},
    invariantes: {},
    baseLegal: 'Lei 9.784/1999',
    hash: 'abc',
    modalidadesAdmitidas: null,
  },
];

/** Uma fase do rascunho, com o que este passo não edita já preenchido. */
function fase(parcial: Partial<FaseDoCronograma>): FaseDoCronograma {
  return {
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
    ...parcial,
  };
}

describe('FaseStepComponent', () => {
  let componente: FaseStepComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let detectar: () => void;
  let nativo: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FaseStepComponent],
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

    const fixture = TestBed.createComponent(FaseStepComponent);
    componente = fixture.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);
    detectar = () => fixture.detectChanges();
    nativo = fixture.nativeElement as HTMLElement;

    detectar();

    for (const requisicao of controller.match(() => true)) {
      const { url } = requisicao.request;
      if (url.includes('fases-canonicas')) requisicao.flush(FASES_CANONICAS);
      else if (url.includes('tipos-banca')) requisicao.flush(BANCAS);
      else if (url.includes('categorias-documento')) requisicao.flush(CATEGORIAS);
      else if (url.includes('tipos-ato')) requisicao.flush(ATOS);
      else if (url.includes('regras')) requisicao.flush(REGRAS);
      else requisicao.flush([]);
    }
    detectar();
  });

  afterEach(() => controller.verify());

  /** Deixa a cadeia de `await` do comando avançar antes da próxima expectativa. */
  const proximoPasso = () => new Promise((resolve) => setTimeout(resolve, 0));

  function comCronograma(...fases: readonly FaseDoCronograma[]): void {
    store.patchObjectSection('cronograma', { fases: [...fases] });
    detectar();
  }

  /** As fases como o corpo do comando as declara. */
  const fasesEnviadas = (corpo: unknown) => corpo as Record<string, unknown>[];

  it('abre a primeira fase do cronograma sem que ninguém escolha', () => {
    comCronograma(fase({}), fase({ faseCanonicaId: ID_RECURSOS, codigo: 'RECURSOS', ordem: 2 }));

    expect(componente.faseAberta()).toBe(ID_AVALIACAO);
    expect(componente.nomeDaFaseAberta()).toBe('Avaliação');
  });

  it('espelha no formulário a fase que chega ao rascunho', () => {
    comCronograma(
      fase({
        produtos: [{ atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' }],
        emiteParecerIndividual: true,
      }),
    );

    expect(componente.produtos).toEqual([
      { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' },
    ]);
    expect(componente.formulario()?.controls.emiteParecerIndividual.value).toBe(true);
  });

  it('leva ao rascunho a publicação declarada na tela', () => {
    comCronograma(fase({}));

    componente.acrescentarProduto();
    componente.escolherAto(0, 'RESULTADO_FINAL');
    componente.escolherPapel(0, 'DEFINITIVO');
    detectar();

    expect(store.draft().cronograma.fases[0].produtos).toEqual([
      { atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' },
    ]);
  });

  /**
   * Só ato que o catálogo marca como resultado recebe papel: trocar para um que
   * não é deixaria declarada uma combinação que o servidor recusa.
   */
  it('descarta o papel ao trocar para publicação que não é resultado', () => {
    comCronograma(fase({ produtos: [{ atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' }] }));

    componente.escolherAto(0, 'COMUNICADO');
    detectar();

    expect(store.draft().cronograma.fases[0].produtos).toEqual([
      { atoCodigo: 'COMUNICADO', papel: null },
    ]);
  });

  /** O seletor, como o operador o vê — não como o modelo o guarda. */
  function selecionado(id: string): string {
    const campo = nativo.querySelector<HTMLSelectElement>(`#${id}`);
    if (campo === null) throw new Error(`Seletor ${id} não está na tela.`);
    return campo.value;
  }

  /**
   * O que a tela mostra é o que o operador acredita ter declarado. Um seletor em
   * branco sobre uma fase que publica faria ele gravar por cima do que existe
   * sem perceber — e a gravação substitui a coleção inteira.
   */
  describe('o que os seletores exibem', () => {
    beforeEach(() => {
      comCronograma(
        fase({
          produtos: [{ atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' }],
          bancasRequeridas: [
            { tipoBancaId: ID_BANCA_HETERO, categoriasDocumentoIds: [ID_CATEGORIA_RACA] },
          ],
          regraRecurso: null,
        }),
      );
    });

    it('mostra a publicação que a fase declara, não o rótulo de escolha', () => {
      expect(selecionado('fase-produto-ato-0')).toBe('RESULTADO_FINAL');
    });

    it('mostra o papel que a publicação declara', () => {
      expect(selecionado('fase-produto-papel-0')).toBe('DEFINITIVO');
    });

    it('mostra a banca que a fase requer', () => {
      expect(selecionado('fase-banca-0')).toBe(ID_BANCA_HETERO);
    });

    it('mostra a regra de recurso escolhida', async () => {
      comCronograma(
        fase({
          produtos: [
            { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' },
            { atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' },
          ],
          regraRecurso: {
            regraCodigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
            regraVersao: 'v1',
            prazoValor: '2',
            prazoUnidade: 'diasUteis',
            atoAncoraCodigo: 'RESULTADO_PRELIMINAR',
            suspensividadePrimeiraInstanciaValor: '',
            suspensividadePrimeiraInstanciaUnidade: '',
            suspensividadeSegundaInstanciaValor: '',
            suspensividadeSegundaInstanciaUnidade: '',
          },
        }),
      );

      // O bloco da regra de recurso só entra no DOM depois de `admiteRecurso`
      // ligar, e o valor do seletor é escrito no microtask seguinte.
      await proximoPasso();
      detectar();

      expect(selecionado('fase-regra')).toBe('RECURSO-PRAZO-ANCORADO-EM-ATO');
      expect(selecionado('fase-ancora')).toBe('RESULTADO_PRELIMINAR');
    });
  });

  describe('âncora do prazo de recurso', () => {
    /**
     * Com um só resultado preliminar não há escolha a fazer, e pré-selecionar
     * poupa um clique — sem eleger nada, porque não há alternativa.
     */
    it('pré-seleciona a âncora quando a fase publica um preliminar só', () => {
      comCronograma(
        fase({
          produtos: [
            { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' },
            { atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' },
          ],
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
        }),
      );

      expect(store.draft().cronograma.fases[0].regraRecurso?.atoAncoraCodigo).toBe(
        'RESULTADO_PRELIMINAR',
      );
    });

    /**
     * Gabarito e resultado preliminares são publicações legítimas da mesma
     * fase, e cabe recurso de qualquer uma. Eleger uma em silêncio contaria a
     * janela da publicação errada.
     */
    it('não elege a âncora quando a fase publica dois preliminares', () => {
      comCronograma(
        fase({
          produtos: [
            { atoCodigo: 'GABARITO_PRELIMINAR', papel: 'PRELIMINAR' },
            { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' },
            { atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' },
          ],
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
        }),
      );

      expect(store.draft().cronograma.fases[0].regraRecurso?.atoAncoraCodigo).toBe('');
      expect(componente.erroDoCampo('recurso.ancora')).toContain('Escolha a publicação preliminar');
    });

    /**
     * Ligar o interruptor não muda a lista de âncoras possíveis nem recria o
     * formulário, e o campo ficaria vazio esperando uma escolha que não existe.
     */
    it('pré-seleciona a âncora ao ligar o recurso numa fase com um preliminar só', () => {
      comCronograma(
        fase({
          produtos: [
            { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' },
            { atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' },
          ],
        }),
      );

      componente.formulario()?.controls.admiteRecurso.setValue(true);
      detectar();

      expect(store.draft().cronograma.fases[0].regraRecurso?.atoAncoraCodigo).toBe(
        'RESULTADO_PRELIMINAR',
      );
    });

    it('oferece à escolha só as publicações preliminares da própria fase', () => {
      comCronograma(
        fase({
          produtos: [
            { atoCodigo: 'GABARITO_PRELIMINAR', papel: 'PRELIMINAR' },
            { atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' },
            { atoCodigo: 'COMUNICADO', papel: null },
          ],
        }),
      );

      expect(componente.ancorasPossiveis()).toEqual([
        { codigo: 'GABARITO_PRELIMINAR', nome: 'Gabarito preliminar' },
      ]);
    });
  });

  /**
   * A conclusão do ciclo só existe em fase que publica preliminar, e o seletor
   * que a declara some junto com ele. Deixar o código declarado para trás
   * trancaria o passo numa recusa cujo campo a tela não mostra mais.
   */
  describe('conclusão declarada que perde o preliminar', () => {
    const comConcluinte = () =>
      comCronograma(
        fase({
          produtos: [{ atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' }],
          faseConcluinteCodigo: 'RECURSOS',
        }),
        fase({
          faseCanonicaId: ID_RECURSOS,
          codigo: 'RECURSOS',
          ordem: 2,
          produtos: [{ atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' }],
        }),
      );

    it('esquece a fase concluinte quando o papel preliminar é trocado', () => {
      comConcluinte();

      componente.escolherPapel(0, 'DEFINITIVO');
      detectar();

      expect(store.draft().cronograma.fases[0].faseConcluinteCodigo).toBeNull();
      expect(componente.validate().valid).toBe(true);
    });

    it('esquece a fase concluinte quando a publicação preliminar é removida', () => {
      comConcluinte();

      componente.removerProduto(0);
      detectar();

      expect(store.draft().cronograma.fases[0].faseConcluinteCodigo).toBeNull();
    });
  });

  /**
   * Fora de rascunho — e enquanto uma gravação corre — o servidor recusa
   * qualquer escrita. Um controle que continua aceitando clique faz a tela
   * passar a descrever uma configuração que o processo não tem.
   */
  it('não aceita trocar a regra de recurso enquanto a edição está suspensa', async () => {
    comCronograma(
      fase({
        produtos: [
          { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' },
          { atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' },
        ],
        regraRecurso: {
          regraCodigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
          regraVersao: 'v1',
          prazoValor: '2',
          prazoUnidade: 'diasUteis',
          atoAncoraCodigo: 'RESULTADO_PRELIMINAR',
          suspensividadePrimeiraInstanciaValor: '',
          suspensividadePrimeiraInstanciaUnidade: '',
          suspensividadeSegundaInstanciaValor: '',
          suspensividadeSegundaInstanciaUnidade: '',
        },
      }),
    );

    store.salvando.set(true);
    detectar();
    await proximoPasso();
    detectar();

    expect(nativo.querySelector<HTMLSelectElement>('#fase-regra')?.disabled).toBe(true);
  });

  describe('bancas requeridas', () => {
    it('declara a banca com o recorte de competência que ela julga', () => {
      comCronograma(fase({}));

      componente.acrescentarBanca();
      componente.escolherTipoDeBanca(0, ID_BANCA_HETERO);
      componente.alternarCategoria(0, ID_CATEGORIA_RACA, true);
      detectar();

      expect(store.draft().cronograma.fases[0].bancasRequeridas).toEqual([
        { tipoBancaId: ID_BANCA_HETERO, categoriasDocumentoIds: [ID_CATEGORIA_RACA] },
      ]);
    });

    it('exige recorte na segunda banca do mesmo tipo', () => {
      comCronograma(
        fase({
          bancasRequeridas: [
            { tipoBancaId: ID_BANCA_HETERO, categoriasDocumentoIds: [ID_CATEGORIA_RACA] },
            { tipoBancaId: ID_BANCA_HETERO, categoriasDocumentoIds: [] },
          ],
        }),
      );

      expect(componente.recorteObrigatorio(1)).toBe(true);
      expect(componente.erroDoCampo('bancasRequeridas')).toContain(
        'mais de uma banca de Heteroidentificação',
      );
    });
  });

  describe('gravação', () => {
    /**
     * A gravação substitui a coleção inteira. Mexer numa fase precisa reenviar
     * as demais como estão, e a janela e a ordem — que esta superfície não
     * edita — precisam chegar intactas na fase mexida também.
     */
    it('reenvia na gravação as outras fases e o que a superfície não edita', async () => {
      store.processoSeletivoId.set(PROCESSO_ID);
      comCronograma(
        fase({ produtos: [{ atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' }] }),
        fase({
          faseCanonicaId: ID_RECURSOS,
          codigo: 'RECURSOS',
          ordem: 2,
          inicio: '2026-04-01T08:00:00-03:00',
          fim: '2026-04-05T18:00:00-03:00',
          produtos: [{ atoCodigo: 'COMUNICADO', papel: null }],
          bancasRequeridas: [
            { tipoBancaId: ID_BANCA_HETERO, categoriasDocumentoIds: [ID_CATEGORIA_RENDA] },
          ],
        }),
      );

      componente.formulario()?.controls.emiteParecerIndividual.setValue(true);
      detectar();

      const gravacao = componente.persistir();
      const enviadas = controller.expectOne(ROTA_FASES);
      const corpo = fasesEnviadas(enviadas.request.body);

      expect(corpo[0]).toMatchObject({
        ordem: 1,
        faseCanonicaId: ID_AVALIACAO,
        inicio: '2026-03-01T08:00:00-03:00',
        fim: '2026-03-10T18:00:00-03:00',
        emiteParecerIndividual: true,
        produtos: [{ atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' }],
      });
      expect(corpo[1]).toMatchObject({
        ordem: 2,
        faseCanonicaId: ID_RECURSOS,
        inicio: '2026-04-01T08:00:00-03:00',
        fim: '2026-04-05T18:00:00-03:00',
        produtos: [{ atoCodigo: 'COMUNICADO', papel: null }],
        bancasRequeridas: [
          { tipoBancaId: ID_BANCA_HETERO, categoriasDocumentoIds: [ID_CATEGORIA_RENDA] },
        ],
        emiteParecerIndividual: false,
      });

      enviadas.flush(null, { status: 204, statusText: 'No Content' });
      await proximoPasso();
      expect((await gravacao).valid).toBe(true);
    });

    it('não envia nada quando a conferência da fase acusa', async () => {
      store.processoSeletivoId.set(PROCESSO_ID);
      comCronograma(
        fase({ produtos: [{ atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' }] }),
      );

      const resultado = await componente.persistir();

      expect(resultado.valid).toBe(false);
      controller.expectNone(ROTA_FASES);
    });

    /**
     * O CA-03 pede mensagem por campo, não erro genérico do formulário: a
     * recusa do domínio precisa aparecer sob o controle que a provocou.
     */
    it('leva a recusa do domínio para o campo que a provocou', async () => {
      store.processoSeletivoId.set(PROCESSO_ID);
      comCronograma(fase({ produtos: [{ atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' }] }));

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_FASES).flush(
        {
          type: 'about:blank',
          title: 'Cronograma recusado',
          status: 422,
          code: 'uniplus.selecao.regra_recurso_fase.prazo_em_dias_corridos',
          traceId: '00000000000000000000000000000001',
          errors: [
            {
              field: 'fases[0].regraRecurso',
              code: 'uniplus.selecao.regra_recurso_fase.prazo_em_dias_corridos',
              message: 'detalhe do servidor',
            },
          ],
        },
        { status: 422, statusText: 'Unprocessable Content', headers: PROBLEM_JSON },
      );
      await proximoPasso();

      const resultado = await gravacao;
      expect(resultado.valid).toBe(false);
      expect(componente.erroDoCampo('recurso.prazo')).toContain('dias corridos não é aceito');
    });
  });

  describe('exigências documentais da fase', () => {
    it('exige o documento na fase aberta, e só nela', () => {
      comCronograma(fase({}), fase({ faseCanonicaId: ID_RECURSOS, codigo: 'RECURSOS', ordem: 2 }));

      componente.alternarExigencia('cpf', true);
      detectar();

      expect(componente.exigidoNestaFase('cpf')).toBe(true);
      componente.abrirFase(ID_RECURSOS);
      detectar();
      expect(componente.exigidoNestaFase('cpf')).toBe(false);
    });

    /**
     * Congelar o conjunto de fases vivas preserva o que estava valendo; começar
     * do zero apagaria a exigência das outras fases por causa de uma decisão
     * tomada numa só.
     */
    /**
     * O rascunho nasce com `todasEtapas: true` e `included: false` em todo
     * documento — é o padrão de "acompanha o edital", não uma exigência. Travar
     * a caixa por `todasEtapas` sozinho deixava o processo novo com quinze
     * documentos desmarcados, desabilitados e anunciando "exigido em todas as
     * fases": o operador lia o oposto do estado real e não tinha como marcar
     * nenhum.
     */
    it('deixa marcar o documento que o processo novo ainda não exige', () => {
      comCronograma(fase({}));

      const caixa = nativo.querySelector<HTMLInputElement>('#fase-doc-cpf');

      expect(caixa?.disabled).toBe(false);
      expect(caixa?.checked).toBe(false);
      expect(nativo.textContent).not.toContain('Exigido em todas as fases do edital.');
    });

    it('recorta por fase partindo das fases que o edital tem hoje', () => {
      comCronograma(fase({}), fase({ faseCanonicaId: ID_RECURSOS, codigo: 'RECURSOS', ordem: 2 }));

      componente.valerEmTodasAsFases('cpf');
      detectar();
      componente.recortarPorFase('cpf');
      detectar();

      expect(store.draft().documentos['cpf'].etapas).toEqual(['AVALIACAO', 'RECURSOS']);
      expect(store.draft().documentos['cpf'].todasEtapas).toBe(false);
    });

    it('tira o documento do processo ao desmarcar a última fase que o exigia', () => {
      comCronograma(fase({}));

      componente.alternarExigencia('cpf', true);
      detectar();
      componente.alternarExigencia('cpf', false);
      detectar();

      expect(store.draft().documentos['cpf'].included).toBe(false);
    });
  });
});
