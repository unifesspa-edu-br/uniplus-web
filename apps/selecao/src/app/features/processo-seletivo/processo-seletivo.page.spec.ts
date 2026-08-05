import { TestBed } from '@angular/core/testing';
import { ProcessoSeletivoPage } from './processo-seletivo.page';
import { ProcessoSeletivoStore } from './steps/processo-seletivo.store';

describe('ProcessoSeletivoPage — estrutura', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProcessoSeletivoPage],
    }).compileComponents();
  });

  /**
   * O wizard é renderizado dentro do `<main>` do layout, via `router-outlet`.
   * Se ele trouxer o próprio `<main>`, a página passa a ter dois landmarks
   * aninhados — violação de WCAG 2.1 (1.3.1) e do e-MAG.
   */
  it('não declara landmark main próprio', () => {
    const fixture = TestBed.createComponent(ProcessoSeletivoPage);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('main').length).toBe(0);
  });

  /** O shell (sidebar, topbar, backdrop) pertence ao layout, não à rota. */
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

describe('ProcessoSeletivoPage — publicação', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProcessoSeletivoPage],
    }).compileComponents();
  });

  function montar() {
    const fixture = TestBed.createComponent(ProcessoSeletivoPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    return { fixture, page, store: page.store };
  }

  /** A navegação entre passos é livre: dá para saltar direto para a revisão. */
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

  it('identifica cada pendência pelo passo de origem', () => {
    const { fixture, page, store } = montar();

    store.goTo(store.totalSteps - 1);
    fixture.detectChanges();
    page.nextOrPublish();

    const erros = store.stepError() ?? [];
    expect(erros.some((erro) => erro.startsWith('Passo 2 — Identificação'))).toBe(true);
  });

  /**
   * Sem reconciliar `completedSteps`, um passo concluído e depois invalidado
   * continuaria contando como concluído no resumo do passo 13.
   */
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
