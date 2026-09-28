import { signal } from '@angular/core';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserContextService } from '@uniplus/shared-auth';

import { InscricaoListaPage } from './inscricao-lista.page';
import { InscricoesCandidatoMockService } from './inscricao-mock.service';
import { type Inscricao, INSCRICOES_MOCK } from './inscricao-lista.mock';

function stubMatchMedia(matches: boolean): void {
  window.matchMedia = ((consulta: string) =>
    ({
      matches,
      media: consulta,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

/**
 * Cada chamada a `listar()` entrega um Subject fresco — garante que
 * `inscricoesResource.reload()` recebe uma nova subscription controlável.
 */
class StubListagemService {
  private subjects: Subject<readonly Inscricao[]>[] = [];

  listar(): Observable<readonly Inscricao[]> {
    const sub = new Subject<readonly Inscricao[]>();
    this.subjects.push(sub);
    return sub.asObservable();
  }

  get ultimo(): Subject<readonly Inscricao[]> {
    return this.subjects[this.subjects.length - 1];
  }

  flush(inscricoes: readonly Inscricao[] = INSCRICOES_MOCK): void {
    this.ultimo.next(inscricoes);
    this.ultimo.complete();
  }

  rejeitar(): void {
    this.ultimo.error(new Error('Falha simulada no carregamento'));
  }
}

describe('InscricaoListaPage', () => {
  let fixture: ComponentFixture<InscricaoListaPage>;
  let component: InscricaoListaPage;
  let appRef: ApplicationRef;
  let listagemService: StubListagemService;
  const displayName = signal('');
  const matchMediaOriginal = window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    stubMatchMedia(false);
    listagemService = new StubListagemService();

    TestBed.configureTestingModule({
      imports: [InscricaoListaPage],
      providers: [
        { provide: InscricoesCandidatoMockService, useValue: listagemService },
        { provide: UserContextService, useValue: { displayName } },
      ],
    });

    fixture = TestBed.createComponent(InscricaoListaPage);
    component = fixture.componentInstance;
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => {
    window.matchMedia = matchMediaOriginal;
  });

  const propagate = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
  };

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function botao(rotulo: string): HTMLButtonElement | null {
    return (
      Array.from(host().querySelectorAll<HTMLButtonElement>('button')).find((el) =>
        el.textContent?.includes(rotulo),
      ) ?? null
    );
  }

  // --- estados iniciais ---

  it('exibe estado de carregamento antes dos dados chegarem', () => {
    const status = host().querySelector('[role="status"]');
    expect(status?.textContent).toContain('Carregando inscrições');
  });

  it('exibe ui-spinner durante o carregamento e o remove após os dados chegarem (CA-07)', async () => {
    expect(host().querySelector('ui-spinner')).toBeTruthy();

    listagemService.flush();
    await propagate();
    fixture.detectChanges();

    expect(host().querySelector('ui-spinner')).toBeNull();
  });

  // --- saudação (CA-03, CA-04) ---

  it('exibe saudação com o nome do candidato autenticado', async () => {
    displayName.set('Ana Silva');
    fixture.detectChanges();
    listagemService.flush();
    await propagate();
    fixture.detectChanges();

    expect(host().querySelector('h1')?.textContent?.trim()).toContain('Olá, Ana Silva');
  });

  it('usa "Candidato" como fallback quando displayName está vazio', async () => {
    displayName.set('');
    fixture.detectChanges();
    listagemService.flush();
    await propagate();
    fixture.detectChanges();

    expect(host().querySelector('h1')?.textContent?.trim()).toContain('Olá, Candidato');
  });

  it('exibe o texto de apoio da página', async () => {
    listagemService.flush();
    await propagate();
    fixture.detectChanges();

    expect(host().textContent).toContain('Aqui você acompanha todas as suas inscrições.');
  });

  // --- lista carregada ---

  it('exibe as inscrições após o carregamento', async () => {
    listagemService.flush(INSCRICOES_MOCK);
    await propagate();
    fixture.detectChanges();

    const itens = host().querySelectorAll('li.inscricao-lista-item');
    expect(itens.length).toBe(INSCRICOES_MOCK.length);
  });

  it('inscrição em rascunho exibe "Continuar inscrição" com variante primary (CA-09, CA-15)', async () => {
    listagemService.flush(INSCRICOES_MOCK);
    await propagate();
    fixture.detectChanges();

    // INSCRICOES_MOCK[0] tem status 'rascunho'
    const item = host().querySelectorAll('li.inscricao-lista-item')[0];
    const btn = item.querySelector('button');
    expect(btn?.textContent?.trim()).toContain('Continuar inscrição');
    // variant 'primary' não adiciona classe extra — ausência de btn--tertiary comprova
    expect(btn?.classList.contains('btn--tertiary')).toBe(false);
  });

  it('inscrições em analise, aprovada e reprovada exibem "Ver detalhes" com variante tertiary (CA-10, CA-15)', async () => {
    listagemService.flush(INSCRICOES_MOCK);
    await propagate();
    fixture.detectChanges();

    // indices 1, 2, 3 = analise, aprovada, reprovada
    const itens = Array.from(host().querySelectorAll('li.inscricao-lista-item')).slice(1);
    for (const item of itens) {
      const btn = item.querySelector('button');
      expect(btn?.textContent?.trim()).toContain('Ver detalhes');
      expect(btn?.classList.contains('btn--tertiary')).toBe(true);
    }
  });

  it('clique no botão de ação chama abrirInscricao com a inscrição correta (CA-16)', async () => {
    listagemService.flush(INSCRICOES_MOCK);
    await propagate();
    fixture.detectChanges();

    const spy = vi.spyOn(
      component as unknown as { abrirInscricao: (i: Inscricao) => void },
      'abrirInscricao',
    );
    botao('Continuar inscrição')?.click();

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(INSCRICOES_MOCK[0]);
  });

  it('títulos de inscrição são h2 (não pula nível de h1)', async () => {
    listagemService.flush(INSCRICOES_MOCK);
    await propagate();
    fixture.detectChanges();

    const titulos = host().querySelectorAll('h2.inscricao-lista-item__titulo');
    expect(titulos.length).toBeGreaterThan(0);
    expect(host().querySelector('h3.inscricao-lista-item__titulo')).toBeNull();
  });

  // --- estado vazio (CA-05) ---

  it('exibe estado vazio sem filtro quando não há inscrições', async () => {
    listagemService.flush([]);
    await propagate();
    fixture.detectChanges();

    expect(host().textContent).toContain('Não há inscrições cadastradas.');
  });

  // --- busca (CA filtro) ---

  it('busca sem resultado exibe estado vazio filtrado', async () => {
    listagemService.flush(INSCRICOES_MOCK);
    await propagate();
    fixture.detectChanges();

    component['termoBusca'].set('xyzzy-nao-existe-em-nenhum-registro');
    fixture.detectChanges();

    expect(host().textContent).toContain('Nenhuma inscrição encontrada.');
    expect(host().textContent).toContain('todas as inscrições');
  });

  it('busca normaliza acento: "Auxilio" encontra "Auxílio estudantil 2026"', async () => {
    listagemService.flush(INSCRICOES_MOCK);
    await propagate();
    fixture.detectChanges();

    component['termoBusca'].set('Auxilio');
    fixture.detectChanges();

    expect(host().querySelectorAll('li.inscricao-lista-item').length).toBeGreaterThan(0);
    expect(host().textContent).not.toContain('Nenhuma inscrição encontrada.');
  });

  it('busca normaliza maiúscula: "MORADA" encontra "Morada estudantil"', async () => {
    listagemService.flush(INSCRICOES_MOCK);
    await propagate();
    fixture.detectChanges();

    component['termoBusca'].set('MORADA');
    fixture.detectChanges();

    expect(host().querySelectorAll('li.inscricao-lista-item').length).toBeGreaterThan(0);
  });

  it('"Limpar" redefine a busca e exibe todas as inscrições', async () => {
    listagemService.flush(INSCRICOES_MOCK);
    await propagate();
    fixture.detectChanges();

    component['termoBusca'].set('nao-existe');
    fixture.detectChanges();
    expect(host().textContent).toContain('Nenhuma inscrição encontrada.');

    botao('Limpar')?.click();
    fixture.detectChanges();

    expect(host().querySelectorAll('li.inscricao-lista-item').length).toBe(INSCRICOES_MOCK.length);
  });

  // --- erro e recarregar (CA-06) ---

  it('exibe alerta de erro com botão "Tentar novamente"', async () => {
    listagemService.rejeitar();
    await propagate();
    fixture.detectChanges();

    expect(host().querySelector('ui-alert[variant="danger"]')).toBeTruthy();
    expect(botao('Tentar novamente')).toBeTruthy();
  });

  it('"Tentar novamente" recarrega e exibe a lista ao ter sucesso', async () => {
    listagemService.rejeitar();
    await propagate();
    fixture.detectChanges();

    botao('Tentar novamente')?.click();
    await propagate();
    fixture.detectChanges();

    listagemService.flush(INSCRICOES_MOCK);
    await propagate();
    fixture.detectChanges();

    expect(host().querySelector('ui-alert')).toBeFalsy();
    expect(host().querySelectorAll('li.inscricao-lista-item').length).toBe(INSCRICOES_MOCK.length);
  });

  // --- responsivo ---

  it('abaixo de 600px trava a visualização em lista e oculta o controle de alternância', async () => {
    listagemService.flush(INSCRICOES_MOCK);
    await propagate();
    fixture.detectChanges();

    stubMatchMedia(true);
    const fixtureCompacto = TestBed.createComponent(InscricaoListaPage);
    fixtureCompacto.detectChanges();
    listagemService.flush(INSCRICOES_MOCK);
    await propagate();
    fixtureCompacto.detectChanges();

    (fixtureCompacto.componentInstance as unknown as Record<string, { set: (v: string) => void }>)['visao'].set('cards');
    fixtureCompacto.detectChanges();

    expect(
      (fixtureCompacto.componentInstance as unknown as Record<string, () => string>)['visaoEfetiva'](),
    ).toBe('lista');
    expect((fixtureCompacto.nativeElement as HTMLElement).querySelector('ui-segmented')).toBeNull();
  });

  // --- localStorage ---

  it('lembra a visão escolhida entre visitas (localStorage)', async () => {
    listagemService.flush(INSCRICOES_MOCK);
    await propagate();
    fixture.detectChanges();

    (component as unknown as Record<string, { set: (v: string) => void }>)['visao'].set('cards');
    fixture.detectChanges();

    expect(localStorage.getItem('uniplus.portal.inscricao-lista-visao')).toBe('cards');
  });
});
