import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { apiOk } from '@uniplus/shared-core/http';
import {
  ModalidadeDto,
  ModalidadesApi,
  TipoProcessoDto,
  TiposProcessoApi,
} from '@uniplus/shared-data/configuracao';
import { UnidadeDto, UnidadesApi } from '@uniplus/shared-data/organizacao';
import { GeoApi } from '@uniplus/shared-data/geo';
import { ProcessosSeletivosApi } from '@uniplus/shared-data/selecao';
import { ProcessoSeletivoPage } from './processo-seletivo.page';
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

const modalidadesApiStub = {
  listar: () => of(apiOk<readonly ModalidadeDto[]>([], 200, new HttpHeaders())),
};

/**
 * A page provê `CadastroInicialService`, que injeta o client de Processo
 * Seletivo. Nenhum teste desta suíte chega a gravar — o stub existe para o
 * grafo de injeção fechar sem `HttpClient` real.
 */
const processosSeletivosApiStub = {};

const PAGE_PROVIDERS = [
  provideRouter([]),
  { provide: TiposProcessoApi, useValue: tiposProcessoApiStub },
  { provide: UnidadesApi, useValue: unidadesApiStub },
  { provide: GeoApi, useValue: geoApiStub },
  { provide: ModalidadesApi, useValue: modalidadesApiStub },
  { provide: ProcessosSeletivosApi, useValue: processosSeletivosApiStub },
];

describe('ProcessoSeletivoPage — estrutura', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProcessoSeletivoPage],
      providers: PAGE_PROVIDERS,
    }).compileComponents();
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

  it('recusa publicar rascunho vazio alcançado por salto de passo', () => {
    const { fixture, page, store } = montar();

    store.goTo(store.totalSteps - 1);
    fixture.detectChanges();
    page.nextOrPublish();
    fixture.detectChanges();

    expect(page.publicationMessage()).toBe('');
    const erros = store.stepError();
    expect(erros).not.toBeNull();
    expect(erros?.length).toBeGreaterThan(0);
    expect(erros?.[0]).toContain('Passo 1');
  });

  it('traz o aviso de pendências para a vista e para o foco', async () => {
    const { fixture, page, store } = montar();

    store.goTo(store.totalSteps - 1);
    fixture.detectChanges();
    page.nextOrPublish();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));

    const alerta = (fixture.nativeElement as HTMLElement).querySelector('.step-error');
    expect(alerta).not.toBeNull();
    expect(alerta?.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(alerta);
  });

  it('identifica cada pendência pelo passo de origem', () => {
    const { fixture, page, store } = montar();

    store.goTo(store.totalSteps - 1);
    fixture.detectChanges();
    page.nextOrPublish();

    const erros = store.stepError() ?? [];
    expect(erros.some((erro) => erro.startsWith('Passo 2 — Identificação'))).toBe(true);
  });

  it('reconcilia o progresso ao validar o rascunho inteiro', () => {
    const { fixture, page, store } = montar();

    store.syncCompleted([0, 1, 2]);
    store.goTo(store.totalSteps - 1);
    fixture.detectChanges();
    page.nextOrPublish();

    expect(store.completedSteps().has(0)).toBe(false);
    expect(store.completedSteps().has(1)).toBe(false);
  });

  it('exibe mensagem de sucesso quando não há pendência', () => {
    const { fixture, page, store } = montar();
    const stub = { validate: () => ({ valid: true }) };

    vi.spyOn(
      page as unknown as { stepValidatorAt: (index: number) => unknown },
      'stepValidatorAt',
    ).mockReturnValue(stub);

    store.goTo(store.totalSteps - 1);
    fixture.detectChanges();
    page.nextOrPublish();

    expect(store.stepError()).toBeNull();
    expect(page.publicationMessage()).toContain('Rascunho validado');
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
        provideRouter([]),
        { provide: TiposProcessoApi, useValue: tiposProcessoApiStub },
        { provide: UnidadesApi, useValue: unidadesApiStub },
        { provide: GeoApi, useValue: geoApiStub },
        { provide: ModalidadesApi, useValue: modalidadesApiStub },
        { provide: ProcessosSeletivosApi, useValue: { criar } },
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
        provideRouter([]),
        { provide: TiposProcessoApi, useValue: tiposProcessoApiStub },
        { provide: UnidadesApi, useValue: unidadesApiStub },
        { provide: GeoApi, useValue: geoApiStub },
        { provide: ModalidadesApi, useValue: modalidadesApiStub },
        { provide: ProcessosSeletivosApi, useValue: { criar: () => emVoo } },
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
        provideRouter([]),
        { provide: TiposProcessoApi, useValue: tiposProcessoApiStub },
        { provide: UnidadesApi, useValue: unidadesApiStub },
        { provide: GeoApi, useValue: geoApiStub },
        { provide: ModalidadesApi, useValue: modalidadesApiStub },
        {
          provide: ProcessosSeletivosApi,
          useValue: {
            criar: () => {
              chamadas += 1;
              return emVoo;
            },
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
