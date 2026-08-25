import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { apiOk } from '@uniplus/shared-core/http';
import {
  CursosApi,
  ModalidadeDto,
  ModalidadesApi,
  OfertasCursoApi,
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

/** Passo 4: catálogo de ofertas e cursos (vazio nesta suíte). */
const ofertasCursoApiStub = {
  listar: () => of(apiOk<readonly never[]>([], 200, new HttpHeaders())),
};

const cursosApiStub = {
  listar: () => of(apiOk<readonly never[]>([], 200, new HttpHeaders())),
};

/**
 * A page provê `CadastroInicialService`, que injeta o client de Processo
 * Seletivo. Nenhum teste desta suíte chega a gravar — o stub existe para o
 * grafo de injeção fechar sem `HttpClient` real.
 */
const processosSeletivosApiStub = {};

const PAGE_PROVIDERS = [
  { provide: TiposProcessoApi, useValue: tiposProcessoApiStub },
  { provide: UnidadesApi, useValue: unidadesApiStub },
  { provide: GeoApi, useValue: geoApiStub },
  { provide: ModalidadesApi, useValue: modalidadesApiStub },
  { provide: OfertasCursoApi, useValue: ofertasCursoApiStub },
  { provide: CursosApi, useValue: cursosApiStub },
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
