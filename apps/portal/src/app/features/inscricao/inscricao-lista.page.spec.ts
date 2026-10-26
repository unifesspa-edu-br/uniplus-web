import { HttpHeaders } from '@angular/common/http';
import { signal } from '@angular/core';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, of, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import { type ApiResult, apiFailure, apiOk } from '@uniplus/shared-core/http';
import { type MinhaInscricaoDto, SituacaoInscricao } from '@uniplus/shared-data/selecao';

import { type ItemDaLista, itemDaLista } from './inscricao-lista.model';
import { InscricaoListaPage } from './inscricao-lista.page';
import { MinhasInscricoesService } from './minhas-inscricoes.service';

/** Fernanda Drumond, persona fictícia do portal de documentação, que prefere o nome social. */
function inscricao(
  id: string,
  situacao: SituacaoInscricao,
  nomeDoProcesso: string | null,
  aberta = true,
): MinhaInscricaoDto {
  const enviada = situacao === SituacaoInscricao.submetida;
  const rascunho = situacao === SituacaoInscricao.rascunho;
  return {
    inscricaoId: `i-${id}`,
    processoSeletivoId: id,
    nomeDoProcesso,
    numeroInscricao: situacao === SituacaoInscricao.rascunho ? null : '00000042',
    situacao,
    opcoesDeCurso: rascunho ? [] : [{ ordem: 1, cursoNome: 'Medicina', cursoGrau: 'Bacharelado' }],
    canceladaEm: null,
    motivoDoCancelamento: null,
    acoes: {
      podeContinuar: rascunho && aberta,
      podeCorrigir: enviada && aberta,
      podeCancelar: enviada && aberta,
      podeDescartar: rascunho && aberta,
    },
    comprovantes: [],
  };
}

const INSCRICOES: readonly MinhaInscricaoDto[] = [
  inscricao('p1', SituacaoInscricao.rascunho, 'Auxílio estudantil 2026'),
  inscricao('p2', SituacaoInscricao.submetida, 'Bolsa de iniciação científica'),
  inscricao('p3', SituacaoInscricao.submetida, 'Morada estudantil'),
  inscricao('p4', SituacaoInscricao.rascunho, 'Auxílio transporte'),
];

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
  private subjects: Subject<ApiResult<readonly MinhaInscricaoDto[]>>[] = [];

  listar(): Observable<ApiResult<readonly MinhaInscricaoDto[]>> {
    const sub = new Subject<ApiResult<readonly MinhaInscricaoDto[]>>();
    this.subjects.push(sub);
    return sub.asObservable();
  }

  get ultimo(): Subject<ApiResult<readonly MinhaInscricaoDto[]>> {
    return this.subjects[this.subjects.length - 1];
  }

  flush(inscricoes: readonly MinhaInscricaoDto[] = INSCRICOES): void {
    this.ultimo.next(apiOk(inscricoes, 200, new HttpHeaders()));
    this.ultimo.complete();
  }

  cancelar: (processoId: string, motivo: string | null) => Observable<ApiResult<void>> = () =>
    of(apiOk<void>(undefined, 204, new HttpHeaders()));

  descartar: (processoId: string) => Observable<ApiResult<void>> = () =>
    of(apiOk<void>(undefined, 204, new HttpHeaders()));

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
        provideRouter([]),
        { provide: MinhasInscricoesService, useValue: listagemService },
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

  function botaoDoItem(item: Element, rotulo: string): HTMLButtonElement | null {
    return (
      Array.from(item.querySelectorAll<HTMLButtonElement>('button')).find((el) =>
        el.textContent?.includes(rotulo),
      ) ?? null
    );
  }

  const rotulosDe = (item: Element): string[] =>
    Array.from(item.querySelectorAll('button')).map((b) => b.textContent?.trim() ?? '');

  async function carregar(inscricoes: readonly MinhaInscricaoDto[]): Promise<void> {
    listagemService.flush(inscricoes);
    await propagate();
    fixture.detectChanges();
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
    listagemService.flush(INSCRICOES);
    await propagate();
    fixture.detectChanges();

    const itens = host().querySelectorAll('li.inscricao-lista-item');
    expect(itens.length).toBe(INSCRICOES.length);
  });

  it('inscrição em rascunho exibe "Continuar inscrição" com variante primary (CA-09, CA-15)', async () => {
    listagemService.flush(INSCRICOES);
    await propagate();
    fixture.detectChanges();

    // INSCRICOES[0] está em rascunho
    const item = host().querySelectorAll('li.inscricao-lista-item')[0];
    const btn = botaoDoItem(item, 'Continuar inscrição');
    expect(btn?.textContent?.trim()).toContain('Continuar inscrição');
    // variant 'primary' não adiciona classe extra — ausência de btn--tertiary comprova
    expect(btn?.classList.contains('btn--tertiary')).toBe(false);
  });

  it('inscrição enviada exibe "Ver comprovante" e abre o comprovante da última submissão', async () => {
    listagemService.flush(INSCRICOES);
    await propagate();
    fixture.detectChanges();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    const item = host().querySelectorAll('li.inscricao-lista-item')[1];
    const btn = botaoDoItem(item, 'Ver comprovante');
    expect(btn).toBeTruthy();
    btn?.click();

    expect(navegar).toHaveBeenCalledWith(['/inscricao', 'comprovante', 'i-p2']);
  });

  it('as ações vêm das permissões da API: enviada com as inscrições abertas, rascunho e encerrada', async () => {
    await carregar([
      inscricao('p1', SituacaoInscricao.rascunho, 'Auxílio'),
      inscricao('p2', SituacaoInscricao.submetida, 'Bolsa'),
      inscricao('p3', SituacaoInscricao.submetida, 'Morada', false),
      inscricao('p4', SituacaoInscricao.rascunho, 'Auxílio transporte', false),
    ]);

    const itens = host().querySelectorAll('li.inscricao-lista-item');
    expect(rotulosDe(itens[0])).toEqual(['Continuar inscrição', 'Descartar rascunho']);
    expect(rotulosDe(itens[1])).toEqual([
      'Corrigir dados',
      'Ver comprovante',
      'Cancelar inscrição',
    ]);
    expect(rotulosDe(itens[2])).toEqual(['Ver comprovante']);
    expect(rotulosDe(itens[3])).toEqual([]);
  });

  it('a cancelada e a nova do mesmo processo aparecem as duas, cada uma com a sua chave', async () => {
    const cancelada = {
      ...inscricao('p1', SituacaoInscricao.cancelada, 'Medicina 2027'),
      inscricaoId: 'i-velha',
      canceladaEm: '2026-12-13T12:00:00Z',
      motivoDoCancelamento: 'Mudei de curso',
    };
    const nova = {
      ...inscricao('p1', SituacaoInscricao.rascunho, 'Medicina 2027'),
      inscricaoId: 'i-nova',
    };
    await carregar([cancelada, nova]);

    const itens = host().querySelectorAll('li.inscricao-lista-item');
    expect(itens.length).toBe(2);
    expect(itens[0].textContent).toContain('Cancelada');
    expect(itens[0].textContent).toContain('Motivo: Mudei de curso');
    expect(rotulosDe(itens[0])).toEqual(['Ver comprovante']);
    expect(rotulosDe(itens[1])).toEqual(['Continuar inscrição', 'Descartar rascunho']);
  });

  it('Corrigir dados abre o formulário do processo', async () => {
    await carregar(INSCRICOES);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    botaoDoItem(host().querySelectorAll('li.inscricao-lista-item')[1], 'Corrigir dados')?.click();

    expect(navegar).toHaveBeenCalledWith(['/inscricao', 'p2']);
  });

  it('Cancelar inscrição avisa que será preciso se inscrever de novo e só cancela depois da confirmação', async () => {
    const cancelar = vi.fn(() => of(apiOk<void>(undefined, 204, new HttpHeaders())));
    listagemService.cancelar = cancelar;
    await carregar(INSCRICOES);

    botaoDoItem(
      host().querySelectorAll('li.inscricao-lista-item')[1],
      'Cancelar inscrição',
    )?.click();
    fixture.detectChanges();

    const dialogo = host().querySelector('dialog');
    expect(dialogo?.textContent).toContain(
      'você precisará fazer uma nova inscrição, do zero, com o formulário vigente',
    );
    expect(cancelar).not.toHaveBeenCalled();

    const campo = dialogo?.querySelector('textarea') as HTMLTextAreaElement;
    campo.value = '  Mudei de curso  ';
    campo.dispatchEvent(new Event('input'));
    botaoDoItem(dialogo as Element, 'Cancelar inscrição')?.click();
    await propagate();
    fixture.detectChanges();

    expect(cancelar).toHaveBeenCalledWith('p2', 'Mudei de curso');
    expect(
      host().querySelector('[role="status"][aria-live="polite"] .alert')?.textContent,
    ).toContain('Inscrição em Bolsa de iniciação científica cancelada.');
  });

  it('o cancelamento sem motivo vai sem motivo', async () => {
    const cancelar = vi.fn(() => of(apiOk<void>(undefined, 204, new HttpHeaders())));
    listagemService.cancelar = cancelar;
    await carregar(INSCRICOES);

    botaoDoItem(
      host().querySelectorAll('li.inscricao-lista-item')[1],
      'Cancelar inscrição',
    )?.click();
    fixture.detectChanges();
    botaoDoItem(host().querySelector('dialog') as Element, 'Cancelar inscrição')?.click();

    expect(cancelar).toHaveBeenCalledWith('p2', null);
  });

  it('Descartar rascunho pede confirmação e, confirmado, recarrega a lista, anuncia e leva o foco ao título', async () => {
    const descartar = vi.fn(() => of(apiOk<void>(undefined, 204, new HttpHeaders())));
    listagemService.descartar = descartar;
    await carregar(INSCRICOES);

    botaoDoItem(
      host().querySelectorAll('li.inscricao-lista-item')[0],
      'Descartar rascunho',
    )?.click();
    fixture.detectChanges();
    expect(descartar).not.toHaveBeenCalled();

    botaoDoItem(host().querySelector('dialog') as Element, 'Descartar rascunho')?.click();
    await propagate();
    fixture.detectChanges();
    listagemService.flush(INSCRICOES.slice(1));
    await propagate();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));

    expect(descartar).toHaveBeenCalledWith('p1');
    expect(host().querySelectorAll('li.inscricao-lista-item').length).toBe(INSCRICOES.length - 1);
    expect(
      host().querySelector('[role="status"][aria-live="polite"] .alert')?.textContent,
    ).toContain('Rascunho de Auxílio estudantil 2026 descartado.');
    expect(document.activeElement).toBe(host().querySelector('h1'));
  });

  it('a recusa da API mantém o diálogo aberto, com o motivo, e não anuncia sucesso', async () => {
    listagemService.cancelar = () =>
      of(
        apiFailure(
          {
            type: 'about:blank',
            title: 'Recusado',
            detail: 'O motivo do cancelamento aceita até 500 caracteres.',
            status: 422,
            code: 'x',
            traceId: '',
          },
          422,
          new HttpHeaders(),
        ),
      );
    await carregar(INSCRICOES);

    botaoDoItem(
      host().querySelectorAll('li.inscricao-lista-item')[1],
      'Cancelar inscrição',
    )?.click();
    fixture.detectChanges();
    botaoDoItem(host().querySelector('dialog') as Element, 'Cancelar inscrição')?.click();
    await propagate();
    fixture.detectChanges();

    expect(host().querySelector('dialog')?.hasAttribute('open')).toBe(true);
    expect(host().querySelector('dialog .alert')?.textContent).toContain('até 500 caracteres');
    expect(host().querySelector('[role="status"] .alert')).toBeNull();
  });

  it('sem o nome do processo, que deixou de ser público, mostra um texto neutro', () => {
    expect(itemDaLista(inscricao('p9', SituacaoInscricao.rascunho, null)).nome).toBe(
      'Processo seletivo',
    );
  });

  it('cada inscrição mostra o curso escolhido, sem repetir o nome nem o CPF do titular (CA-01)', async () => {
    await carregar(INSCRICOES);

    const itens = host().querySelectorAll('li.inscricao-lista-item');
    expect(itens[1].textContent).toContain('Medicina (Bacharelado)');
    expect(itens[1].textContent).not.toContain('1ª opção');
    expect(itens[1].textContent).not.toContain('CPF');
  });

  it('com duas opções de curso, cada uma sai com a sua ordem', async () => {
    await carregar([
      {
        ...inscricao('p1', SituacaoInscricao.submetida, 'Medicina 2027'),
        opcoesDeCurso: [
          { ordem: 1, cursoNome: 'Direito', cursoGrau: 'Bacharelado' },
          { ordem: 2, cursoNome: 'Medicina', cursoGrau: 'Bacharelado' },
        ],
      },
    ]);

    const cursos = Array.from(host().querySelectorAll('.inscricao-curso')).map((c) =>
      c.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(cursos).toEqual(['1ª opção Direito (Bacharelado)', '2ª opção Medicina (Bacharelado)']);
  });

  it('rascunho que ainda não escolheu curso diz que o curso não foi escolhido', async () => {
    await carregar([inscricao('p1', SituacaoInscricao.rascunho, 'Auxílio estudantil 2026')]);

    expect(host().querySelector('li.inscricao-lista-item')?.textContent).toContain(
      'Curso ainda não escolhido',
    );
  });

  it('a ação que desfaz a inscrição sai depois das demais, em botão próprio', async () => {
    await carregar([inscricao('p2', SituacaoInscricao.submetida, 'Bolsa de iniciação científica')]);

    const item = host().querySelector('li.inscricao-lista-item')!;
    expect(rotulosDe(item)).toEqual(['Corrigir dados', 'Ver comprovante', 'Cancelar inscrição']);
    expect(item.querySelector('.inscricao-acao-destrutiva')?.textContent?.trim()).toBe(
      'Cancelar inscrição',
    );
  });

  it('clique no botão de ação chama executar com a ação e a inscrição corretas (CA-16)', async () => {
    listagemService.flush(INSCRICOES);
    await propagate();
    fixture.detectChanges();

    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const spy = vi.spyOn(
      component as unknown as { executar: (a: unknown, i: ItemDaLista) => void },
      'executar',
    );
    botao('Continuar inscrição')?.click();

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'continuar' }),
      itemDaLista(INSCRICOES[0]),
    );
  });

  it('títulos de inscrição são h2 (não pula nível de h1)', async () => {
    listagemService.flush(INSCRICOES);
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
    listagemService.flush(INSCRICOES);
    await propagate();
    fixture.detectChanges();

    component['termoBusca'].set('xyzzy-nao-existe-em-nenhum-registro');
    fixture.detectChanges();

    expect(host().textContent).toContain('Nenhuma inscrição encontrada.');
    expect(host().textContent).toContain('todas as inscrições');
  });

  it('busca normaliza acento: "Auxilio" encontra "Auxílio estudantil 2026"', async () => {
    listagemService.flush(INSCRICOES);
    await propagate();
    fixture.detectChanges();

    component['termoBusca'].set('Auxilio');
    fixture.detectChanges();

    expect(host().querySelectorAll('li.inscricao-lista-item').length).toBeGreaterThan(0);
    expect(host().textContent).not.toContain('Nenhuma inscrição encontrada.');
  });

  it('busca normaliza maiúscula: "MORADA" encontra "Morada estudantil"', async () => {
    listagemService.flush(INSCRICOES);
    await propagate();
    fixture.detectChanges();

    component['termoBusca'].set('MORADA');
    fixture.detectChanges();

    expect(host().querySelectorAll('li.inscricao-lista-item').length).toBeGreaterThan(0);
  });

  it('"Limpar" redefine a busca e exibe todas as inscrições', async () => {
    listagemService.flush(INSCRICOES);
    await propagate();
    fixture.detectChanges();

    component['termoBusca'].set('nao-existe');
    fixture.detectChanges();
    expect(host().textContent).toContain('Nenhuma inscrição encontrada.');

    botao('Limpar')?.click();
    fixture.detectChanges();

    expect(host().querySelectorAll('li.inscricao-lista-item').length).toBe(INSCRICOES.length);
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

    listagemService.flush(INSCRICOES);
    await propagate();
    fixture.detectChanges();

    expect(host().querySelector('ui-alert')).toBeFalsy();
    expect(host().querySelectorAll('li.inscricao-lista-item').length).toBe(INSCRICOES.length);
  });

  // --- responsivo ---

  it('abaixo de 600px trava a visualização em lista e oculta o controle de alternância', async () => {
    listagemService.flush(INSCRICOES);
    await propagate();
    fixture.detectChanges();

    stubMatchMedia(true);
    const fixtureCompacto = TestBed.createComponent(InscricaoListaPage);
    fixtureCompacto.detectChanges();
    listagemService.flush(INSCRICOES);
    await propagate();
    fixtureCompacto.detectChanges();

    (fixtureCompacto.componentInstance as unknown as Record<string, { set: (v: string) => void }>)[
      'visao'
    ].set('cards');
    fixtureCompacto.detectChanges();

    expect(
      (fixtureCompacto.componentInstance as unknown as Record<string, () => string>)[
        'visaoEfetiva'
      ](),
    ).toBe('lista');
    expect((fixtureCompacto.nativeElement as HTMLElement).querySelector('ui-segmented')).toBeNull();
  });

  // --- localStorage ---

  it('lembra a visão escolhida entre visitas (localStorage)', async () => {
    listagemService.flush(INSCRICOES);
    await propagate();
    fixture.detectChanges();

    (component as unknown as Record<string, { set: (v: string) => void }>)['visao'].set('cards');
    fixture.detectChanges();

    expect(localStorage.getItem('uniplus.portal.inscricao-lista-visao')).toBe('cards');
  });
});
