import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { NEVER, Subject, of } from 'rxjs';
import { apiFailure, apiOk } from '@uniplus/shared-core/http';
import {
  ModalidadeDto,
  BaseLegalBonusRegionalApi,
  TiposInstrumentoNormativoApi,
  PesosEnemApi,
  CondicoesAtendimentoApi,
  CursosApi,
  ModalidadesApi,
  OfertasCursoApi,
  RecursoAcessibilidadeApi,
  ReservaDemograficaApi,
  FatosCandidatoApi,
  TipoDeficienciaApi,
  TipoProcessoDto,
  TiposProcessoApi,
  FasesCanonicasApi,
  PrecedenciasFaseApi,
  TiposBancaApi,
  TiposDocumentoApi,
  TiposEtapaApi,
  CategoriasDocumentoApi,
} from '@uniplus/shared-data/configuracao';
import { UnidadeDto, UnidadesApi } from '@uniplus/shared-data/organizacao';
import { GeoApi } from '@uniplus/shared-data/geo';
import { AtosApi, TiposAtoApi } from '@uniplus/shared-data/publicacoes';
import {
  FundamentoIsencaoDto,
  OrigemCandidatos,
  ProcessosSeletivosApi,
  RegrasCatalogoApi,
  StatusProcesso,
  type ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';
import { ProcessoSeletivoPage } from './processo-seletivo.page';
import { CadastroInicialService } from './steps/shared/cadastro-inicial.service';
import { quadroCongelado } from './steps/shared/quadro-de-pesos';
import { ReleituraDoSnapshot } from './steps/shared/releitura-do-snapshot.service';
import type { PassoDoWizard } from './steps/passo-do-wizard';
import { CatalogosDeClassificacaoService } from './steps/steps/classificacao/catalogos-de-classificacao.service';
import { DesempateStepComponent } from './steps/steps/desempate/desempate.component';
import type { CriterioDesempateConfigurado } from './steps/processo-seletivo.models';

const CRITERIO_POR_AREA: CriterioDesempateConfigurado = {
  regraCodigo: 'DESEMPATE-MAIOR-NOTA-AREA-ENEM',
  regraVersao: '1',
  etapaRef: '',
  idadeMinima: '',
  fato: '',
  operador: '',
  valor: '',
  areas: ['REDACAO'],
};
import { STEP_LABELS } from './steps/processo-seletivo.data';
import { ProcessoSeletivoStore } from './steps/processo-seletivo.store';

const tiposProcessoApiStub = {
  listar: () => of(apiOk<readonly TipoProcessoDto[]>([], 200, new HttpHeaders())),
};

const unidadesApiStub = {
  listar: () => of(apiOk<readonly UnidadeDto[]>([], 200, new HttpHeaders())),
};

/** O passo 2 injeta a Geo para o seletor de município; esta suíte não busca nada. */
const geoApiStub = {
  listarCidades: () => of(apiOk<readonly never[]>([], 200, new HttpHeaders())),
};

/** O passo de pagamento lê o catálogo de fundamentos ao montar. */
const listarFundamentos = () =>
  of(apiOk<readonly FundamentoIsencaoDto[]>([], 200, new HttpHeaders()));

const modalidadesApiStub = {
  listar: () => of(apiOk<readonly ModalidadeDto[]>([], 200, new HttpHeaders())),
};

/** Catálogos do passo de vagas: vazios, porque esta suíte cobre a página. */
const catalogoVazioStub = {
  listar: () => of(apiOk<readonly never[]>([], 200, new HttpHeaders())),
};

/**
 * A page provê `CadastroInicialService`, que injeta o client de Processo
 * Seletivo. Nenhum teste desta suíte chega a gravar — o stub existe para o
 * grafo de injeção fechar sem `HttpClient` real.
 */
const processosSeletivosApiStub = { listarFundamentosIsencao: listarFundamentos };

const PAGE_PROVIDERS = [
  provideRouter([]),
  { provide: TiposProcessoApi, useValue: tiposProcessoApiStub },
  { provide: UnidadesApi, useValue: unidadesApiStub },
  { provide: GeoApi, useValue: geoApiStub },
  { provide: ModalidadesApi, useValue: modalidadesApiStub },
  { provide: CursosApi, useValue: catalogoVazioStub },
  { provide: OfertasCursoApi, useValue: catalogoVazioStub },
  { provide: ReservaDemograficaApi, useValue: catalogoVazioStub },
  { provide: RegrasCatalogoApi, useValue: catalogoVazioStub },
  // O passo de bônus carrega o catálogo de base legal ao montar, e o vocabulário que traduz o
  // tipo de instrumento da norma.
  { provide: BaseLegalBonusRegionalApi, useValue: catalogoVazioStub },
  { provide: TiposInstrumentoNormativoApi, useValue: catalogoVazioStub },
  // O passo da fórmula carrega o cadastro de Peso por Área, de onde sai a resolução do ENEM.
  { provide: PesosEnemApi, useValue: { ...catalogoVazioStub, listarAreas: catalogoVazioStub.listar } },
  // O passo do cronograma carrega os sete catálogos ao montar; esta suíte não
  // exercita a linha do tempo, e o grafo de injeção precisa fechar sem HTTP.
  { provide: FasesCanonicasApi, useValue: catalogoVazioStub },
  { provide: PrecedenciasFaseApi, useValue: catalogoVazioStub },
  { provide: TiposBancaApi, useValue: catalogoVazioStub },
  { provide: CategoriasDocumentoApi, useValue: catalogoVazioStub },
  { provide: TiposEtapaApi, useValue: catalogoVazioStub },
  { provide: TiposDocumentoApi, useValue: catalogoVazioStub },
  { provide: TiposAtoApi, useValue: catalogoVazioStub },
  { provide: AtosApi, useValue: { obter: () => NEVER } },
  // O passo de atendimento carrega os três cadastros de Configuração ao
  // montar; esta suíte não exercita as escolhas, só a estrutura da página.
  { provide: CondicoesAtendimentoApi, useValue: catalogoVazioStub },
  { provide: RecursoAcessibilidadeApi, useValue: catalogoVazioStub },
  { provide: TipoDeficienciaApi, useValue: catalogoVazioStub },
  // O passo do formulário carrega o catálogo de fatos do candidato ao montar — é dele que
  // saem os dados que o certame pode coletar.
  { provide: FatosCandidatoApi, useValue: catalogoVazioStub },
  { provide: ProcessosSeletivosApi, useValue: processosSeletivosApiStub },
];

describe('ProcessoSeletivoPage — estrutura', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProcessoSeletivoPage],
      providers: PAGE_PROVIDERS,
    }).compileComponents();
  });

  /**
   * O painel de cada passo é escolhido pela POSIÇÃO — `[hidden]` compara com
   * `currentStep()` —, e o validador que decide o avanço também é resolvido por
   * índice. Um painel a mais ou a menos desalinha rótulo, conteúdo e validação
   * de todos os passos seguintes: o passo mostraria um formulário e cobraria os
   * campos de outro, e o último passo ficaria inalcançável.
   *
   * Nenhum gate pegava isso — o template compila com painel vazio, e os testes
   * de passo montam cada componente isoladamente.
   */
  it('tem um painel por passo declarado, sem sobra nem lacuna', () => {
    const fixture = TestBed.createComponent(ProcessoSeletivoPage);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const paineis = [...host.querySelectorAll('.step-pane')];

    expect(paineis).toHaveLength(STEP_LABELS.length);
    for (const painel of paineis) {
      expect(
        painel.children.length,
        `painel de passo vazio em "${painel.outerHTML.slice(0, 80)}"`,
      ).toBeGreaterThan(0);
    }
  });

  /**
   * O painel e o validador de cada passo são resolvidos por ÍNDICE, mas o índice de cada um vem
   * de duas fontes diferentes: o rótulo sai de `PASSOS`, e o painel e o validador saem da ordem
   * em que o template declara as seções — doze literais `currentStep() !== N` escritos à mão e
   * um `viewChildren` que lê a ordem de declaração.
   *
   * Reordenar um passo mexendo só em `PASSOS` dessincroniza os dois lados **sem erro de
   * compilação**: o stepper anuncia um passo e a tela mostra outro, e `validate()`/`persistir()`
   * operam no componente errado. Este teste amarra os dois.
   */
  it('o painel visível em cada índice é o do passo que o stepper anuncia', () => {
    const componentePorRotulo: Readonly<Record<string, string>> = {
      'Tipo do processo': 'sel-step-tipo-processo',
      Identificação: 'sel-step-identificacao',
      Pagamento: 'sel-step-pagamento',
      Vagas: 'sel-step-vagas',
      Cronograma: 'sel-step-cronograma',
      'Fórmula e precisão': 'sel-step-formula',
      Bônus: 'sel-step-bonus',
      Desempate: 'sel-step-desempate',
      Eliminação: 'sel-step-eliminacao',
      'Atend. especial': 'sel-step-atendimento',
      Formulário: 'sel-step-formulario',
      'Revisão e publicação': 'sel-step-revisao',
    };

    const fixture = TestBed.createComponent(ProcessoSeletivoPage);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const store = fixture.componentInstance.store;

    expect(Object.keys(componentePorRotulo)).toEqual([...STEP_LABELS]);

    STEP_LABELS.forEach((rotulo, indice) => {
      store.goTo(indice);
      fixture.detectChanges();

      const visiveis = [...host.querySelectorAll('.step-pane')].filter(
        (painel) => !painel.hasAttribute('hidden'),
      );

      expect(visiveis, `nenhum painel visível no passo ${indice} ("${rotulo}")`).toHaveLength(1);
      expect(
        visiveis[0].firstElementChild?.tagName.toLowerCase(),
        `no passo ${indice} o stepper anuncia "${rotulo}", mas o painel visível é outro`,
      ).toBe(componentePorRotulo[rotulo]);
    });
  });

  it('não declara landmark main próprio', () => {
    const fixture = TestBed.createComponent(ProcessoSeletivoPage);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('main').length).toBe(0);
  });

  it('não recria o shell da aplicação', () => {
    const fixture = TestBed.createComponent(ProcessoSeletivoPage);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.admin-shell')).toBeNull();
    expect(host.querySelector('.admin-main')).toBeNull();
    expect(host.querySelector('.sidebar-backdrop')).toBeNull();
  });

  it('mantém a área útil do wizard', () => {
    const fixture = TestBed.createComponent(ProcessoSeletivoPage);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.wiz-shell')).not.toBeNull();
    expect(host.querySelector('.wiz-content')).not.toBeNull();
  });

  it.each([
    ['em edição', null],
    ['em consulta', StatusProcesso.publicado],
  ])(
    '%s, .wiz-content não é contêiner de rolagem próprio: rola o .page do shell',
    (_modo, status) => {
      const fixture = TestBed.createComponent(ProcessoSeletivoPage);
      if (status !== null) {
        fixture.debugElement.injector.get(ProcessoSeletivoStore).remoteSnapshot.set({
          id: 'processo-publicado',
          status,
        } as unknown as ProcessoSeletivoDto);
      }
      fixture.detectChanges();

      const wizContent = (fixture.nativeElement as HTMLElement).querySelector('.wiz-content');
      expect(wizContent?.hasAttribute('uiBackToTopContainer')).toBe(false);
      expect(wizContent?.hasAttribute('tabindex')).toBe(false);
      expect(wizContent?.getAttribute('role')).toBeNull();
    },
  );
});

describe('ProcessoSeletivoPage — lista de etapas', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProcessoSeletivoPage],
      providers: PAGE_PROVIDERS,
    }).compileComponents();
  });

  function montar() {
    const fixture = TestBed.createComponent(ProcessoSeletivoPage);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const dialog = host.querySelector<HTMLDialogElement>('dialog.steps-overlay');
    if (dialog === null) {
      throw new Error('A lista de etapas precisa ser um <dialog> para conter o foco.');
    }
    return { fixture, page: fixture.componentInstance, dialog };
  }

  function instrumentar(dialog: HTMLDialogElement) {
    const showModal = vi.fn();
    dialog.showModal = showModal;
    dialog.close = vi.fn(() => dialog.dispatchEvent(new Event('close')));
    return showModal;
  }

  it('abre a lista de etapas como diálogo modal', () => {
    const { page, dialog } = montar();
    const showModal = instrumentar(dialog);
    page.openStepsOverlay();

    expect(showModal).toHaveBeenCalledTimes(1);
    expect(page.stepsOverlayOpen()).toBe(true);
  });

  it('sincroniza o estado quando o diálogo fecha', () => {
    const { page, dialog } = montar();
    instrumentar(dialog);

    page.openStepsOverlay();
    page.closeStepsOverlay();

    expect(page.stepsOverlayOpen()).toBe(false);
  });
});

describe('ProcessoSeletivoPage — bloqueio de scroll', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProcessoSeletivoPage],
      providers: PAGE_PROVIDERS,
    }).compileComponents();
  });

  it('libera o bloqueio de scroll ao destruir a página com overlay aberto', () => {
    const fixture = TestBed.createComponent(ProcessoSeletivoPage);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const dialog = host.querySelector<HTMLDialogElement>('dialog.steps-overlay');
    if (dialog === null) throw new Error('Diálogo de etapas ausente.');
    dialog.showModal = vi.fn();

    fixture.componentInstance.openStepsOverlay();
    expect(document.body.classList.contains('sel-overlay-open')).toBe(true);

    fixture.destroy();
    expect(document.body.classList.contains('sel-overlay-open')).toBe(false);
  });
});

describe('ProcessoSeletivoPage — publicação', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProcessoSeletivoPage],
      providers: PAGE_PROVIDERS,
    }).compileComponents();
  });

  function montar() {
    const fixture = TestBed.createComponent(ProcessoSeletivoPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    return { fixture, page, store: page.store };
  }

  /**
   * `page.nextOrPublish()` aguardado em todo teste deste describe: `publicar()`
   * agora grava de novo os passos anteriores e recarrega o checklist da
   * Revisão ANTES de validar (achado do Codex na #486, P1 — ver o
   * comentário de `publicar()`), o que introduz pontos `await` reais que
   * não existiam quando `validarRascunho()` era a primeira coisa a rodar.
   */
  it('recusa publicar rascunho vazio alcançado por salto de passo', async () => {
    const { fixture, page, store } = montar();

    store.goTo(store.totalSteps - 1);
    fixture.detectChanges();
    await page.nextOrPublish();
    fixture.detectChanges();

    const erros = store.stepError();
    expect(erros).not.toBeNull();
    expect(erros?.length).toBeGreaterThan(0);
    expect(erros?.[0]).toContain('Passo 1');
  });

  it('traz o aviso de pendências para a vista e para o foco', async () => {
    const { fixture, page, store } = montar();

    store.goTo(store.totalSteps - 1);
    fixture.detectChanges();
    await page.nextOrPublish();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));

    const alerta = (fixture.nativeElement as HTMLElement).querySelector('.step-error');
    expect(alerta).not.toBeNull();
    expect(alerta?.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(alerta);
  });

  it('identifica cada pendência pelo passo de origem', async () => {
    const { fixture, page, store } = montar();

    store.goTo(store.totalSteps - 1);
    fixture.detectChanges();
    await page.nextOrPublish();

    const erros = store.stepError() ?? [];
    expect(erros.some((erro) => erro.startsWith('Passo 2 — Identificação'))).toBe(true);
  });

  it('reconcilia o progresso ao validar o rascunho inteiro', async () => {
    const { fixture, page, store } = montar();

    store.syncCompleted([0, 1, 2]);
    store.goTo(store.totalSteps - 1);
    fixture.detectChanges();
    await page.nextOrPublish();

    expect(store.completedSteps().has(0)).toBe(false);
    expect(store.completedSteps().has(1)).toBe(false);
  });

  it('sem pendência local, segue para gravarEAvancar em vez de travar no aviso genérico', () => {
    const { fixture, page, store } = montar();
    const stub = { validate: () => ({ valid: true }) };

    vi.spyOn(
      page as unknown as { stepValidatorAt: (index: number) => unknown },
      'stepValidatorAt',
    ).mockReturnValue(stub);

    store.goTo(store.totalSteps - 1);
    fixture.detectChanges();
    page.nextOrPublish();

    // O stub não declara persistir() nem confirmacaoDeGravacao(): o fluxo
    // completa como navegação simples, sem erro nem confirmação pendente.
    expect(store.stepError()).toBeNull();
    expect(store.salvando()).toBe(false);
    expect(page.confirmacaoPendente()).toBeNull();
  });

  /**
   * A navegação entre passos é livre: o operador pode voltar a um passo já
   * gravado pelo stepper, editá-lo, e pular direto para a Revisão sem passar
   * pelo "avançar" que dispara `persistir()` de novo. Sem `gravarPassosAn-
   * teriores()`, `validarRascunho()` aprovaria o rascunho local (está
   * bem-formado) e a publicação confirmaria sobre uma edição que nunca
   * chegou ao servidor (achado do Codex na #486, P1).
   */
  it('grava de novo um passo anterior antes de publicar, mesmo sem editar via avançar', async () => {
    const { fixture, page, store } = montar();
    const persistirDoPassoAnterior = vi.fn().mockResolvedValue({ valid: true });
    const stubSemPersistir = { validate: () => ({ valid: true }) };
    const stubComPersistir = {
      validate: () => ({ valid: true }),
      persistir: persistirDoPassoAnterior,
    };

    vi.spyOn(
      page as unknown as { stepValidatorAt: (index: number) => unknown },
      'stepValidatorAt',
    ).mockImplementation((index: number) => (index === 2 ? stubComPersistir : stubSemPersistir));

    store.goTo(store.totalSteps - 1);
    fixture.detectChanges();
    await page.nextOrPublish();

    expect(persistirDoPassoAnterior).toHaveBeenCalledTimes(1);
    expect(store.stepError()).toBeNull();
  });

  it('relê o processo uma vez no fim da varredura quando uma gravação deixou o quadro congelado velho', async () => {
    const { fixture, page, store } = montar();
    const releitura = fixture.debugElement.injector.get(ReleituraDoSnapshot);
    const reler = vi.spyOn(releitura, 'reler').mockResolvedValue(true);
    const stubQueMarca = {
      validate: () => ({ valid: true }),
      persistir: vi.fn(async () => {
        store.marcarClassificacaoDesconhecida();
        return { valid: false, messages: ['Falha ao gravar de novo.'] };
      }),
    };
    const stubSemPersistir = { validate: () => ({ valid: true }) };

    vi.spyOn(
      page as unknown as { stepValidatorAt: (index: number) => unknown },
      'stepValidatorAt',
    ).mockImplementation((index: number) => (index === 2 ? stubQueMarca : stubSemPersistir));

    store.goTo(store.totalSteps - 1);
    fixture.detectChanges();
    await page.nextOrPublish();

    // Mesmo com a varredura falhando, a leitura acontece — sem ela a marca ficaria para sempre.
    expect(reler).toHaveBeenCalledTimes(1);
  });

  it('a cópia que a gravação na varredura presumiu é confirmada por uma releitura no fim, com o que o servidor congelou', async () => {
    const { fixture, page, store } = montar();
    // O processo já criado ganha endereço próprio; a rota dele não está neste teste.
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    store.processoSeletivoId.set('processo-1');
    const detalhe = {
      id: 'processo-1',
      classificacao: {
        resolucaoPesoAreaEnem: 'Resolução nova',
        quadroPesoAreaEnem: [
          {
            grupoAreaEnem: { codigo: 'G', rotulo: 'Grupo' },
            baseLegal: 'Anexo I',
            areas: [{ codigo: 'REDACAO', rotulo: 'Redação', peso: 3, corte: null }],
          },
        ],
      },
      criteriosDesempate: [],
    } as unknown as ProcessoSeletivoDto;
    const obterDetalhe = vi
      .spyOn(fixture.debugElement.injector.get(CadastroInicialService), 'obterDetalhe')
      .mockResolvedValue(apiOk(detalhe, 200, new HttpHeaders()));
    // O cadastro lido aqui tinha peso 1; o servidor copiou o dele, mais novo, com peso 3.
    const stubDaEliminacao = {
      validate: () => ({ valid: true }),
      persistir: vi.fn(async () => {
        store.registrarClassificacaoGravadaComQuadro('Resolução nova', [
          {
            codigo: 'G',
            rotulo: 'Grupo',
            baseLegal: 'Anexo I',
            areas: [{ codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte: null }],
          },
        ]);
        return { valid: true };
      }),
    };
    const stubSemPersistir = { validate: () => ({ valid: true }) };
    // A Revisão para a publicação depois da releitura: o que importa aqui é o que veio antes.
    const stubDaRevisao = { validate: () => ({ valid: false, messages: ['Revisão pendente.'] }) };
    vi.spyOn(
      page as unknown as { stepValidatorAt: (index: number) => unknown },
      'stepValidatorAt',
    ).mockImplementation((index: number) =>
      index === 2
        ? stubDaEliminacao
        : index === store.totalSteps - 1
          ? stubDaRevisao
          : stubSemPersistir,
    );

    store.goTo(store.totalSteps - 1);
    fixture.detectChanges();
    await page.nextOrPublish();

    expect(stubDaEliminacao.persistir).toHaveBeenCalledTimes(1);
    expect(obterDetalhe).toHaveBeenCalledTimes(1);
    expect(store.copiaCongeladaEmVigor()).toEqual({
      resolucao: 'Resolução nova',
      grupos: quadroCongelado(detalhe.classificacao?.quadroPesoAreaEnem ?? []),
    });
  });

  it('com a classificação gravada desconhecida, valida, relê e valida de novo', async () => {
    const { fixture, page, store } = montar();
    const releitura = fixture.debugElement.injector.get(ReleituraDoSnapshot);
    const ordem: string[] = [];
    vi.spyOn(releitura, 'reler').mockImplementation(async () => {
      ordem.push('releu');
      store.registrarClassificacaoGravadaSemQuadro();
      return true;
    });
    // O Desempate recusa enquanto não se sabe o que a classificação gravada tem.
    const stubQueDependeDaClassificacao = {
      validate: () => {
        ordem.push('validou');
        return store.motivoDaReleituraDaClassificacao() === 'desconhecida'
          ? { valid: false, messages: ['Classificação desconhecida.'] }
          : { valid: true };
      },
    };
    vi.spyOn(
      page as unknown as { stepValidatorAt: (index: number) => unknown },
      'stepValidatorAt',
    ).mockImplementation(() => stubQueDependeDaClassificacao);
    store.marcarClassificacaoDesconhecida();

    store.goTo(store.totalSteps - 1);
    fixture.detectChanges();
    await page.nextOrPublish();

    // Valida antes de ir à rede, e de novo depois da releitura.
    expect(ordem[0]).toBe('validou');
    expect(ordem).toContain('releu');
    expect(ordem.slice(ordem.indexOf('releu'))).toContain('validou');
    expect(JSON.stringify(store.stepError() ?? null)).not.toContain('Classificação desconhecida.');
  });

  it('sem nada por reler, o rascunho incompleto é barrado sem ir à rede', async () => {
    const { fixture, page, store } = montar();
    const reler = vi.spyOn(fixture.debugElement.injector.get(ReleituraDoSnapshot), 'reler');
    const stubIncompleto = { validate: () => ({ valid: false, messages: ['Falta a regra.'] }) };
    vi.spyOn(
      page as unknown as { stepValidatorAt: (index: number) => unknown },
      'stepValidatorAt',
    ).mockImplementation(() => stubIncompleto);

    store.goTo(store.totalSteps - 1);
    fixture.detectChanges();
    await page.nextOrPublish();

    expect(reler).not.toHaveBeenCalled();
    expect(JSON.stringify(store.stepError())).toContain('Falta a regra.');
  });

  it('cada leitura do cadastro que dá certo reavalia a recusa pelo desempate', () => {
    const { fixture, store } = montar();
    store.criteriosDesempateGravados.set([]);
    store.recusarPeloDesempate('Recusa pelo desempate.', 0);

    fixture.debugElement.injector
      .get(CatalogosDeClassificacaoService)
      .pesosLidosNaLeitura.update((leitura) => leitura + 1);
    TestBed.tick();

    expect(store.recusaPeloDesempatePorArea()).toBeNull();
  });

  it('critérios de desempate gravados que mudam reavaliam a recusa pelo desempate', () => {
    const { store } = montar();
    store.criteriosDesempateGravados.set([CRITERIO_POR_AREA]);
    store.recusarPeloDesempate('Recusa pelo desempate.', 0);
    TestBed.tick();
    expect(store.recusaPeloDesempatePorArea()).toBe('Recusa pelo desempate.');

    // A releitura do processo, ou a gravação do Desempate, trouxe critérios sem área.
    store.criteriosDesempateGravados.set([]);
    TestBed.tick();

    expect(store.recusaPeloDesempatePorArea()).toBeNull();
  });

  describe('critérios de desempate por área antes da classificação com quadro', () => {
    const INDICE_DO_DESEMPATE = STEP_LABELS.indexOf('Desempate');
    const INDICE_DA_ELIMINACAO = STEP_LABELS.indexOf('Eliminação');

    const RESOLUCAO = 'Resolução nº 805/2024/Consepe';
    const DETALHE_COM_QUADRO = {
      id: 'processo-1',
      classificacao: {
        resolucaoPesoAreaEnem: RESOLUCAO,
        quadroPesoAreaEnem: [
          {
            grupoAreaEnem: { codigo: 'G', rotulo: 'Grupo' },
            baseLegal: 'Anexo I',
            areas: [{ codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte: null }],
          },
        ],
      },
      criteriosDesempate: [],
    } as unknown as ProcessoSeletivoDto;
    const COPIA_PRESUMIDA = quadroCongelado(
      DETALHE_COM_QUADRO.classificacao?.quadroPesoAreaEnem ?? [],
    );

    /**
     * O Desempate adia os critérios, a Eliminação grava a classificação e deixa a cópia por
     * confirmar, e a releitura a confirma — ou falha. A gravação pendente do Desempate é observada,
     * sem ir à rede.
     */
    function montarFluxo(
      recusaDosCriterios: string[] | null = null,
      {
        releituraFalha = false,
        trocaDeProcesso = false,
      }: { readonly releituraFalha?: boolean; readonly trocaDeProcesso?: boolean } = {},
    ) {
      const montagem = montar();
      const { fixture, page, store } = montagem;
      const ordem: string[] = [];
      vi.spyOn(fixture.debugElement.injector.get(ReleituraDoSnapshot), 'reler').mockImplementation(
        async () => {
          ordem.push('releitura');
          if (trocaDeProcesso) store.geracao.update((valor) => valor + 1);
          else if (!releituraFalha) store.registrarGravadoLido(DETALHE_COM_QUADRO);
          return true;
        },
      );
      const passos = (page as unknown as { passos: () => readonly unknown[] }).passos();
      const desempate = passos.find(
        (passo): passo is DesempateStepComponent => passo instanceof DesempateStepComponent,
      );
      if (desempate === undefined) throw new Error('passo Desempate ausente');
      vi.spyOn(desempate, 'gravarPendente').mockImplementation(async () => {
        ordem.push('critérios');
        if (recusaDosCriterios !== null) return { valid: false, messages: recusaDosCriterios };
        store.desempatePendenteDeGravacao.set(false);
        return { valid: true };
      });
      const stubDoDesempate = {
        validate: () => ({ valid: true }),
        persistir: vi.fn(async () => {
          ordem.push('critérios adiados');
          store.desempatePendenteDeGravacao.set(true);
          return { valid: true };
        }),
      };
      const stubDaEliminacao = {
        validate: () => ({ valid: true }),
        persistir: vi.fn(async () => {
          ordem.push('classificação');
          store.registrarClassificacaoGravadaComQuadro(RESOLUCAO, COPIA_PRESUMIDA);
          return { valid: true };
        }),
      };
      const stubSemPersistir = { validate: () => ({ valid: true }) };
      vi.spyOn(
        page as unknown as { stepValidatorAt: (index: number) => unknown },
        'stepValidatorAt',
      ).mockImplementation((index: number) =>
        index === INDICE_DO_DESEMPATE
          ? stubDoDesempate
          : index === INDICE_DA_ELIMINACAO
            ? stubDaEliminacao
            : stubSemPersistir,
      );
      fixture.detectChanges();
      return { ...montagem, ordem };
    }

    it('avançando do Desempate à Eliminação, grava a classificação e depois os critérios', async () => {
      const { page, store, ordem } = montarFluxo();

      store.goTo(INDICE_DO_DESEMPATE);
      await page.nextOrPublish();
      await page.nextOrPublish();

      expect(ordem).toEqual(['critérios adiados', 'classificação', 'releitura', 'critérios']);
      expect(store.currentStep()).toBe(INDICE_DA_ELIMINACAO + 1);
      expect(store.stepError()).toBeNull();
      expect(store.desempatePendenteDeGravacao()).toBe(false);
    });

    it('a recusa dos critérios gravados depois da classificação leva ao passo Desempate', async () => {
      const { page, store, ordem } = montarFluxo(['Critério de desempate 1: recusado.']);

      store.goTo(INDICE_DO_DESEMPATE);
      await page.nextOrPublish();
      await page.nextOrPublish();

      expect(ordem).toEqual(['critérios adiados', 'classificação', 'releitura', 'critérios']);
      expect(store.currentStep()).toBe(INDICE_DO_DESEMPATE);
      expect(store.stepError()).toEqual(['Critério de desempate 1: recusado.']);
    });

    it('na varredura da publicação, a mesma ordem: classificação, depois critérios', async () => {
      const { page, store, ordem } = montarFluxo();

      store.goTo(store.totalSteps - 1);
      await page.nextOrPublish();

      expect(ordem).toEqual(['critérios adiados', 'classificação', 'releitura', 'critérios']);
    });

    it('sem a cópia confirmada pela releitura, não grava os critérios e diz por quê', async () => {
      const { page, store, ordem } = montarFluxo(null, { releituraFalha: true });

      store.goTo(INDICE_DO_DESEMPATE);
      await page.nextOrPublish();
      await page.nextOrPublish();

      expect(ordem).toEqual(['critérios adiados', 'classificação', 'releitura']);
      expect(store.currentStep()).toBe(INDICE_DO_DESEMPATE);
      expect(JSON.stringify(store.stepError())).toContain('não pôde ser confirmado');
    });

    /**
     * A varredura com o Desempate de verdade: `aoGravarAClassificacao` diz o que a Eliminação deixa
     * no store, e `detalhe`, o que a releitura traz.
     */
    async function montarVarreduraReal(
      aoGravarAClassificacao: (store: ProcessoSeletivoStore) => void,
      detalhe: ProcessoSeletivoDto = DETALHE_COM_QUADRO,
    ) {
      // O cadastro de Peso por Área tem a resolução com o quadro que a gravação vai copiar.
      TestBed.overrideProvider(PesosEnemApi, {
        useValue: {
          listar: () =>
            of(
              apiOk(
                [
                  {
                    id: 'g',
                    resolucao: RESOLUCAO,
                    grupoCurso: { codigo: 'G', rotulo: 'Grupo' },
                    areas: [{ codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte: null }],
                    baseLegal: 'Anexo I',
                    criadoEm: '2026-09-01T00:00:00Z',
                  },
                ],
                200,
                new HttpHeaders(),
              ),
            ),
          listarAreas: () =>
            of(apiOk([{ codigo: 'REDACAO', rotulo: 'Redação' }], 200, new HttpHeaders())),
        },
      });
      const { fixture, page, store } = montar();
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      store.processoSeletivoId.set('processo-1');
      store.patchObjectSection('classificacao', {
        regraCalculoCodigo: 'FORMULA-MEDIA-PONDERADA',
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });
      store.patchSection('desempate', [CRITERIO_POR_AREA]);
      fixture.detectChanges();
      await fixture.whenStable();

      const ordem: string[] = [];
      const cadastro = fixture.debugElement.injector.get(CadastroInicialService);
      vi.spyOn(cadastro, 'obterDetalhe').mockImplementation(async () => {
        ordem.push('releitura');
        return apiOk(detalhe, 200, new HttpHeaders());
      });
      const gravarCriterios = vi
        .spyOn(cadastro, 'definirCriteriosDesempate')
        .mockImplementation(async () => {
          ordem.push('critérios');
          return { ok: true };
        });
      const passos = (page as unknown as { passos: () => readonly PassoDoWizard[] }).passos();
      const stubDaEliminacao = {
        validate: () => ({ valid: true }),
        persistir: vi.fn(async () => {
          ordem.push('classificação');
          aoGravarAClassificacao(store);
          return { valid: true };
        }),
      };
      const stubSemPersistir = { validate: () => ({ valid: true }) };
      vi.spyOn(
        page as unknown as { stepValidatorAt: (index: number) => unknown },
        'stepValidatorAt',
      ).mockImplementation((index: number) =>
        index === INDICE_DO_DESEMPATE
          ? passos[index]
          : index === INDICE_DA_ELIMINACAO
            ? stubDaEliminacao
            : stubSemPersistir,
      );
      return { page, store, ordem, gravarCriterios };
    }

    it('na varredura, com o Desempate de verdade, confirma a cópia e grava os critérios sem recusa', async () => {
      const { page, store, ordem, gravarCriterios } = await montarVarreduraReal((store) =>
        store.registrarClassificacaoGravadaComQuadro(RESOLUCAO, COPIA_PRESUMIDA),
      );

      store.goTo(store.totalSteps - 1);
      await page.nextOrPublish();

      expect(ordem).toEqual(['classificação', 'releitura', 'critérios']);
      expect(gravarCriterios).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(store.stepError() ?? null)).not.toContain('Desempate');
      expect(store.desempatePendenteDeGravacao()).toBe(false);
    });

    it('trocado o processo durante a releitura, não grava os critérios nem acusa nada', async () => {
      const { page, store, ordem } = montarFluxo(null, { trocaDeProcesso: true });

      store.goTo(INDICE_DO_DESEMPATE);
      await page.nextOrPublish();
      await page.nextOrPublish();

      expect(ordem).toEqual(['critérios adiados', 'classificação', 'releitura']);
      expect(store.stepError()).toBeNull();
    });

    it('na varredura, com a classificação desconhecida depois de gravar, relê e grava os critérios', async () => {
      const { page, store, ordem, gravarCriterios } = await montarVarreduraReal((store) =>
        store.marcarClassificacaoDesconhecida(),
      );

      store.goTo(store.totalSteps - 1);
      await page.nextOrPublish();

      expect(ordem).toEqual(['classificação', 'releitura', 'critérios']);
      expect(gravarCriterios).toHaveBeenCalledTimes(1);
      expect(store.desempatePendenteDeGravacao()).toBe(false);
      expect(JSON.stringify(store.stepError() ?? null)).not.toContain('Desempate');
    });

    it('com os critérios ainda pendentes ao fim da varredura, a publicação é barrada no Desempate', async () => {
      const { page, store, gravarCriterios } = await montarVarreduraReal(
        (store) => store.marcarClassificacaoDesconhecida(),
        {
          id: 'processo-1',
          classificacao: null,
          criteriosDesempate: [],
        } as unknown as ProcessoSeletivoDto,
      );

      store.goTo(store.totalSteps - 1);
      await page.nextOrPublish();

      expect(gravarCriterios).not.toHaveBeenCalled();
      expect(JSON.stringify(store.stepError())).toContain(
        `Passo ${INDICE_DO_DESEMPATE + 1} — Desempate: Os critérios de desempate por área não foram gravados`,
      );
    });

    it('na varredura, a recusa dos critérios é dita no passo Desempate', async () => {
      const { page, store } = montarFluxo(['recusado.']);

      store.goTo(store.totalSteps - 1);
      await page.nextOrPublish();

      expect(store.stepError()).toContain(
        `Passo ${INDICE_DO_DESEMPATE + 1} — Desempate: recusado.`,
      );
    });
  });

  it('um segundo clique durante a releitura inicial não começa outra varredura', async () => {
    const { fixture, page, store } = montar();
    const releitura = fixture.debugElement.injector.get(ReleituraDoSnapshot);
    const releiturasPendentes: (() => void)[] = [];
    vi.spyOn(releitura, 'reler').mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          releiturasPendentes.push(() => {
            store.registrarClassificacaoGravadaSemQuadro();
            resolve(true);
          });
        }),
    );
    const persistir = vi.fn().mockResolvedValue({ valid: true });
    const stubComPersistir = { validate: () => ({ valid: true }), persistir };
    // Com a classificação desconhecida o passo recusa, e a publicação relê antes de validar de novo.
    const stubQueAguarda = {
      validate: () =>
        store.motivoDaReleituraDaClassificacao() === 'desconhecida'
          ? { valid: false, messages: ['Classificação desconhecida.'] }
          : { valid: true },
    };
    vi.spyOn(
      page as unknown as { stepValidatorAt: (index: number) => unknown },
      'stepValidatorAt',
    ).mockImplementation((index: number) => (index === 2 ? stubComPersistir : stubQueAguarda));
    store.marcarClassificacaoDesconhecida();
    store.goTo(store.totalSteps - 1);
    fixture.detectChanges();

    const primeiro = page.nextOrPublish();
    const segundo = page.nextOrPublish();
    releiturasPendentes.forEach((terminar) => terminar());
    await Promise.all([primeiro, segundo]);

    expect(persistir).toHaveBeenCalledTimes(1);
  });

  it('recusa publicar e nomeia o passo quando a gravação de um passo anterior falha', async () => {
    const { fixture, page, store } = montar();
    const stubSemPersistir = { validate: () => ({ valid: true }) };
    const stubComFalha = {
      validate: () => ({ valid: true }),
      persistir: vi
        .fn()
        .mockResolvedValue({ valid: false, messages: ['Falha ao gravar de novo.'] }),
    };

    vi.spyOn(
      page as unknown as { stepValidatorAt: (index: number) => unknown },
      'stepValidatorAt',
    ).mockImplementation((index: number) => (index === 2 ? stubComFalha : stubSemPersistir));

    store.goTo(store.totalSteps - 1);
    fixture.detectChanges();
    await page.nextOrPublish();

    const erros = store.stepError() ?? [];
    expect(
      erros.some((erro) => erro.includes('Passo 3') && erro.includes('Falha ao gravar de novo.')),
    ).toBe(true);
  });

  /**
   * A Revisão fica de fora da primeira passada de `validarRascunho()`
   * porque seu checklist pode estar desatualizado — mas sem recarregá-lo
   * entre gravar de novo e a segunda passada, `validate()` recusaria com a
   * foto de antes da correção mesmo depois de ela já ter sido gravada
   * (achado do Codex na #486, P1).
   */
  it('recarrega o checklist da Revisão entre gravar de novo e validar, antes de publicar', async () => {
    const { fixture, page, store } = montar();
    const stubSemPersistir = { validate: () => ({ valid: true }) };
    let checklistRecarregado = false;
    const recarregarChecklist = vi.fn().mockImplementation(async () => {
      checklistRecarregado = true;
    });
    const stubRevisao = {
      validate: () =>
        checklistRecarregado
          ? { valid: true }
          : { valid: false, messages: ['Checklist desatualizado.'] },
      recarregarChecklist,
    };

    vi.spyOn(
      page as unknown as { stepValidatorAt: (index: number) => unknown },
      'stepValidatorAt',
    ).mockImplementation((index: number) =>
      index === store.totalSteps - 1 ? stubRevisao : stubSemPersistir,
    );

    store.goTo(store.totalSteps - 1);
    fixture.detectChanges();
    await page.nextOrPublish();

    expect(recarregarChecklist).toHaveBeenCalledTimes(1);
    expect(store.stepError()).toBeNull();
  });

  /**
   * Cada `persistir()` individual solta `store.salvando` no próprio
   * `finally` assim que a PRÓPRIA chamada termina — mas a orquestração de
   * `publicar()` (gravar os passos anteriores, recarregar o checklist,
   * validar de novo) ainda não acabou. Sem uma trava que cubra a
   * orquestração inteira, o intervalo entre um passo terminar e a recarga
   * do checklist começar liberava o stepper e os campos por um instante
   * real: o operador podia navegar e editar antes da recarga concluir
   * (achado do Codex na #486, P1 — a quarta ocorrência de "estado
   * intermediário tratado como final" nesta Story).
   */
  it('mantém a edição e a navegação travadas durante toda a orquestração de publicar, não só em cada passo isolado', async () => {
    const { fixture, page, store } = montar();
    const estadosDurante: boolean[] = [];
    const passoAtingidoDuranteATrava: number[] = [];
    const stubSemPersistir = { validate: () => ({ valid: true }) };
    const stubComPersistir = {
      validate: () => ({ valid: true }),
      // Não mexe em store.salvando — como o persistir() real de cada passo
      // já soltou o próprio no finally antes de retornar, chegar aqui com
      // operacaoEmAndamento() ainda true só é possível pela trava nova.
      persistir: vi.fn().mockResolvedValue({ valid: true }),
    };
    const recarregarChecklist = vi.fn().mockImplementation(async () => {
      estadosDurante.push(store.operacaoEmAndamento());
      store.goTo(0); // tentativa de navegar por baixo, durante a recarga
      passoAtingidoDuranteATrava.push(store.currentStep());
    });
    const stubRevisao = { validate: () => ({ valid: true }), recarregarChecklist };

    vi.spyOn(
      page as unknown as { stepValidatorAt: (index: number) => unknown },
      'stepValidatorAt',
    ).mockImplementation((index: number) => {
      if (index === store.totalSteps - 1) return stubRevisao;
      if (index === 1) return stubComPersistir;
      return stubSemPersistir;
    });

    store.goTo(store.totalSteps - 1);
    fixture.detectChanges();
    await page.nextOrPublish();

    expect(estadosDurante).toEqual([true]);
    // goTo(0) foi barrado: o passo continuou sendo o último (Revisão).
    expect(passoAtingidoDuranteATrava).toEqual([store.totalSteps - 1]);
    expect(store.operacaoEmAndamento()).toBe(false);
  });

  /**
   * `gravarPassosAnteriores()` grava vários passos em sequência — se o
   * operador trocar de processo em pleno voo (`geracao` muda), continuar a
   * varredura chamaria `persistir()` dos passos seguintes contra o
   * rascunho do processo NOVO, gravando lá por engano (achado do Codex na
   * #486, P1 — o mais sério dos três desta rodada).
   */
  it('para a varredura sem gravar no processo errado quando geracao muda em pleno voo', async () => {
    const { fixture, page, store } = montar();
    const persistirDoSegundoPasso = vi.fn().mockResolvedValue({ valid: true });
    const persistirDoPrimeiroPasso = vi.fn().mockImplementation(async () => {
      // Simula o operador trocando de processo enquanto este passo ainda
      // gravava — mesmo efeito de `store.hidratar()` mudar a geracao.
      store.reset();
      return { valid: true };
    });
    const stubSemPersistir = { validate: () => ({ valid: true }) };
    const stub1 = { validate: () => ({ valid: true }), persistir: persistirDoPrimeiroPasso };
    const stub2 = { validate: () => ({ valid: true }), persistir: persistirDoSegundoPasso };

    vi.spyOn(
      page as unknown as { stepValidatorAt: (index: number) => unknown },
      'stepValidatorAt',
    ).mockImplementation((index: number) => {
      if (index === 1) return stub1;
      if (index === 2) return stub2;
      return stubSemPersistir;
    });

    store.goTo(store.totalSteps - 1);
    fixture.detectChanges();
    await page.nextOrPublish();

    expect(persistirDoPrimeiroPasso).toHaveBeenCalledTimes(1);
    expect(persistirDoSegundoPasso).not.toHaveBeenCalled();
  });
});

/** Garante que o store exposto pela página é o mesmo instanciado na rota. */
describe('ProcessoSeletivoStore — progresso', () => {
  it('substitui o conjunto de concluídos em syncCompleted', () => {
    const store = new ProcessoSeletivoStore();

    store.syncCompleted([0, 3]);
    expect([...store.completedSteps()]).toEqual([0, 3]);

    store.syncCompleted([1]);
    expect([...store.completedSteps()]).toEqual([1]);
  });
});

describe('ProcessoSeletivoPage — confirmação antes de gravar', () => {
  const MARABA = { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' } as const;

  /**
   * Um `criar` que registra a chamada. O ponto dos testes abaixo é que ele
   * **não** seja chamado enquanto o operador não confirma.
   */
  function cenario() {
    const criar = vi.fn(() => of(apiOk({ id: 'x' }, 201, new HttpHeaders())));

    TestBed.configureTestingModule({
      imports: [ProcessoSeletivoPage],
      providers: [
        ...PAGE_PROVIDERS,
        {
          provide: ProcessosSeletivosApi,
          useValue: { criar, listarFundamentosIsencao: listarFundamentos },
        },
      ],
    });

    const fixture = TestBed.createComponent(ProcessoSeletivoPage);
    // O store é provido pela própria página, então vem do injector dela.
    const store = fixture.debugElement.injector.get(ProcessoSeletivoStore);
    fixture.detectChanges();

    store.patchObjectSection('tipoProcesso', { selected: 'tipo-1', rotulo: 'Vestibular' });
    store.patchObjectSection('identificacao', {
      nome: 'Vestibular 2027',
      unidadeAdministradoraId: 'unidade-1',
      origemCandidatos: 'inscricaoPropria',
      localidade: MARABA,
      identificadorLegivel: 'vestibular-2027',
    });
    store.goTo(1);
    fixture.detectChanges();

    return { fixture, store, criar, page: fixture.componentInstance };
  }

  afterEach(() => TestBed.resetTestingModule());

  /**
   * O clique que grava precisa parar aqui: depois da criação, nenhum destes
   * campos volta atrás pelo contrato desta tela.
   */
  it('abre a confirmação sem enviar nada à API', async () => {
    const { page, criar, fixture } = cenario();

    await page.nextOrPublish();
    fixture.detectChanges();

    expect(page.confirmacaoPendente()).not.toBeNull();
    expect(criar).not.toHaveBeenCalled();
  });

  it('desiste sem requisição e mantém o operador no passo', () => {
    const { page, criar, store, fixture } = cenario();

    void page.nextOrPublish();
    fixture.detectChanges();
    page.cancelarGravacao();
    fixture.detectChanges();

    expect(page.confirmacaoPendente()).toBeNull();
    expect(criar).not.toHaveBeenCalled();
    expect(store.currentStep()).toBe(1);
    expect(store.draft().identificacao.nome).toBe('Vestibular 2027');
  });

  it('exibe na tela os dados que serão gravados', async () => {
    const { page, fixture } = cenario();

    await page.nextOrPublish();
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Vestibular 2027');
    expect(texto).toContain('Vestibular');
    expect(texto).toContain('Marabá — PA');
    expect(texto).toContain('não poderão ser alterados');
  });

  /**
   * O aviso precisa se distinguir de uma mensagem informativa comum — a cor
   * sozinha não pode carregar essa distinção (WCAG 2.1 — 1.4.1), daí o rótulo
   * textual "Atenção!" ao lado da variante `alert--warning`.
   */
  it('destaca o aviso de irreversibilidade e o botão de desistência', async () => {
    const { page, fixture } = cenario();

    await page.nextOrPublish();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const aviso = host.querySelector('.alert--warning');
    expect(aviso).not.toBeNull();
    expect(aviso?.getAttribute('role')).toBe('status');
    expect(aviso?.querySelector('.alert__title')?.textContent).toContain('Atenção!');

    const botao = [...host.querySelectorAll('button')].find((b) =>
      /Voltar e corrigir/.test(b.textContent ?? ''),
    );
    expect(botao).toBeDefined();
  });

  it('anuncia no botão que o avanço grava', async () => {
    const { page, fixture } = cenario();
    fixture.detectChanges();

    expect(page.rotuloDeAvanco()).toBe('Gravar e avançar');
  });

  /**
   * O resumo vale para o passo que o produziu. A rota reusa esta página, então
   * sem descartá-lo ele sobreviveria a uma troca de processo e confirmar
   * aplicaria a decisão lida numa tela ao efeito de outra.
   */
  it('descarta o resumo quando o passo muda', async () => {
    const { page, store, fixture } = cenario();

    await page.nextOrPublish();
    fixture.detectChanges();
    expect(page.confirmacaoPendente()).not.toBeNull();

    store.goTo(4);
    fixture.detectChanges();

    expect(page.confirmacaoPendente()).toBeNull();
  });

  /**
   * O diálogo precisa continuar no DOM para fechar pelo caminho do componente:
   * destruí-lo pularia a devolução do foco ao botão que o abriu.
   */
  it('fecha o diálogo pela visibilidade, sem removê-lo do DOM', async () => {
    const { page, fixture } = cenario();
    const host = fixture.nativeElement as HTMLElement;

    await page.nextOrPublish();
    fixture.detectChanges();
    expect(host.querySelector('ui-dialog')).not.toBeNull();

    page.cancelarGravacao();
    fixture.detectChanges();

    expect(page.confirmacaoPendente()).toBeNull();
    expect(host.querySelector('ui-dialog')).not.toBeNull();
  });

  /**
   * `persistir()` desabilita o botão de avanço enquanto grava. Fechar o
   * diálogo no clique mandaria o foco de volta para esse botão desabilitado, e
   * o teclado ficaria fora dos controles da página por toda a requisição.
   */
  it('mantém o diálogo aberto enquanto a gravação corre', async () => {
    // A criação fica em voo: é o intervalo em que o botão que abriu o diálogo
    // está desabilitado e não pode receber o foco de volta.
    const emVoo = new Subject<never>();
    TestBed.configureTestingModule({
      imports: [ProcessoSeletivoPage],
      providers: [
        ...PAGE_PROVIDERS,
        {
          provide: ProcessosSeletivosApi,
          useValue: { criar: () => emVoo, listarFundamentosIsencao: listarFundamentos },
        },
      ],
    });

    const fixture = TestBed.createComponent(ProcessoSeletivoPage);
    const store = fixture.debugElement.injector.get(ProcessoSeletivoStore);
    const page = fixture.componentInstance;
    fixture.detectChanges();

    store.patchObjectSection('tipoProcesso', { selected: 'tipo-1', rotulo: 'Vestibular' });
    store.patchObjectSection('identificacao', {
      nome: 'Vestibular 2027',
      unidadeAdministradoraId: 'unidade-1',
      origemCandidatos: 'inscricaoPropria',
      localidade: MARABA,
      identificadorLegivel: 'vestibular-2027',
    });
    store.goTo(1);
    fixture.detectChanges();

    await page.nextOrPublish();
    fixture.detectChanges();
    expect(page.confirmacaoPendente()).not.toBeNull();

    void page.confirmarGravacao();
    await Promise.resolve();
    fixture.detectChanges();

    // Requisição ainda em voo: o resumo continua na tela.
    expect(store.salvando()).toBe(true);
    expect(page.confirmacaoPendente()).not.toBeNull();

    // Com fechar, cancelar e confirmar todos desabilitados, a janela ficaria
    // aberta sem destino de foco nem de Tab. O de confirmar permanece
    // operável pelo teclado, anunciado como ocupado.
    const host = fixture.nativeElement as HTMLElement;
    const confirmar = [...host.querySelectorAll('button')].find((b) =>
      /Gravando/.test(b.textContent ?? ''),
    );
    expect(confirmar).toBeDefined();
    expect(confirmar?.disabled).toBe(false);
    expect(confirmar?.getAttribute('aria-busy')).toBe('true');
    expect(confirmar?.getAttribute('aria-disabled')).toBe('true');

    emVoo.complete();
  });

  /** Acionar de novo enquanto grava não pode disparar uma segunda criação. */
  it('ignora novo acionamento do confirmar enquanto grava', async () => {
    let chamadas = 0;
    const emVoo = new Subject<never>();
    TestBed.configureTestingModule({
      imports: [ProcessoSeletivoPage],
      providers: [
        ...PAGE_PROVIDERS,
        {
          provide: ProcessosSeletivosApi,
          useValue: {
            criar: () => {
              chamadas += 1;
              return emVoo;
            },
            listarFundamentosIsencao: listarFundamentos,
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(ProcessoSeletivoPage);
    const store = fixture.debugElement.injector.get(ProcessoSeletivoStore);
    const page = fixture.componentInstance;
    fixture.detectChanges();

    store.patchObjectSection('tipoProcesso', { selected: 'tipo-1', rotulo: 'Vestibular' });
    store.patchObjectSection('identificacao', {
      nome: 'Vestibular 2027',
      unidadeAdministradoraId: 'unidade-1',
      origemCandidatos: 'inscricaoPropria',
      localidade: MARABA,
      identificadorLegivel: 'vestibular-2027',
    });
    store.goTo(1);
    fixture.detectChanges();

    await page.nextOrPublish();
    fixture.detectChanges();

    void page.confirmarGravacao();
    await Promise.resolve();
    void page.confirmarGravacao();
    await Promise.resolve();

    expect(chamadas).toBe(1);
    emVoo.complete();
  });

  /**
   * O resumo do passo descreve a última conferência. Quando o operador corrige
   * o campo e a conferência passa, o erro antigo não pode continuar anunciado
   * atrás do diálogo em que ele decide gravar.
   */
  it('tira o erro já corrigido do resumo antes de abrir a confirmação', async () => {
    const { page, store, fixture } = cenario();

    store.patchObjectSection('identificacao', { identificadorLegivel: 'Vestibular 2027' });
    fixture.detectChanges();
    await page.nextOrPublish();
    fixture.detectChanges();
    expect(store.stepError()).not.toBeNull();
    expect(page.confirmacaoPendente()).toBeNull();

    store.patchObjectSection('identificacao', { identificadorLegivel: 'vestibular-2027' });
    fixture.detectChanges();
    await page.nextOrPublish();
    fixture.detectChanges();

    expect(page.confirmacaoPendente()).not.toBeNull();
    expect(store.stepError()).toBeNull();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.step-error')).toBeNull();
  });

  it('desistir da confirmação não traz o erro corrigido de volta', async () => {
    const { page, store, fixture } = cenario();

    store.setStepError(['O identificador legível não pode ter a forma de um identificador técnico (Guid).']);
    fixture.detectChanges();
    await page.nextOrPublish();
    fixture.detectChanges();
    expect(page.confirmacaoPendente()).not.toBeNull();

    page.cancelarGravacao();
    fixture.detectChanges();

    expect(page.confirmacaoPendente()).toBeNull();
    expect(store.stepError()).toBeNull();
  });

  it('a recusa da gravação confirmada volta a preencher o resumo', async () => {
    const recusa = apiFailure(
      {
        type: 'about:blank',
        title: 'O identificador legível já é usado por outro processo seletivo',
        status: 409,
        code: 'uniplus.selecao.processo_seletivo.identificador_legivel_em_uso',
        traceId: 'teste',
      },
      409,
      new HttpHeaders(),
    );
    TestBed.configureTestingModule({
      imports: [ProcessoSeletivoPage],
      providers: [
        ...PAGE_PROVIDERS,
        {
          provide: ProcessosSeletivosApi,
          useValue: { criar: () => of(recusa), listarFundamentosIsencao: listarFundamentos },
        },
      ],
    });
    const fixture = TestBed.createComponent(ProcessoSeletivoPage);
    const store = fixture.debugElement.injector.get(ProcessoSeletivoStore);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    store.patchObjectSection('tipoProcesso', { selected: 'tipo-1', rotulo: 'Vestibular' });
    store.patchObjectSection('identificacao', {
      nome: 'Vestibular 2027',
      unidadeAdministradoraId: 'unidade-1',
      origemCandidatos: OrigemCandidatos.inscricaoPropria,
      localidade: MARABA,
      identificadorLegivel: 'vestibular-2027',
    });
    store.goTo(1);
    fixture.detectChanges();

    await page.nextOrPublish();
    fixture.detectChanges();
    expect(store.stepError()).toBeNull();

    await page.confirmarGravacao();
    fixture.detectChanges();

    expect(store.stepError()?.join(' ')).toContain('já é usado por outro processo seletivo');
  });

  /** O comando já saiu: fechar aqui só tiraria da tela o aviso da gravação. */
  it('não desiste da confirmação com a gravação em curso', async () => {
    const { page, store, fixture } = cenario();

    await page.nextOrPublish();
    fixture.detectChanges();
    store.salvando.set(true);

    page.cancelarGravacao();
    fixture.detectChanges();

    expect(page.confirmacaoPendente()).not.toBeNull();
  });
});
