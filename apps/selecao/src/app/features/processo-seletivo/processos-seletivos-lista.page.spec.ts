import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor, mockProblemDetails } from '@uniplus/shared-core/http';
import { ProcessoSeletivoResumoDto, SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessosSeletivosListaPage } from './processos-seletivos-lista.page';

const BASE = 'http://localhost:5000';
const URL_LISTA = `${BASE}/api/selecao/processos-seletivos`;

/** Papéis de quem está autenticado — o atalho de cadastro depende deles. */
const papeis = signal<readonly string[]>(['plataforma-admin']);
const authServiceStub = { roles: papeis };

function processo(overrides: Partial<ProcessoSeletivoResumoDto> = {}): ProcessoSeletivoResumoDto {
  return {
    id: '019f41cf-69fd-759a-ac6d-09acabc1b027',
    nome: 'Vestibular 2026.1',
    tipoProcesso: {
      origemId: '019f41cf-69fd-759a-ac6d-09acabc1b028',
      codigo: 'VESTIBULAR',
      nome: 'Vestibular',
    },
    status: 'Rascunho',
    criadoEm: '2026-08-20T13:23:42.707136+00:00',
    ...overrides,
  };
}

describe('ProcessosSeletivosListaPage', () => {
  let fixture: ComponentFixture<ProcessosSeletivosListaPage>;
  let component: ProcessosSeletivosListaPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    papeis.set(['plataforma-admin']);

    TestBed.configureTestingModule({
      imports: [ProcessosSeletivosListaPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: AuthService, useValue: authServiceStub },
      ],
    });

    fixture = TestBed.createComponent(ProcessosSeletivosListaPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const propagate = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
  };

  async function flushLista(
    itens: readonly ProcessoSeletivoResumoDto[],
    link?: string,
  ): Promise<void> {
    const req = controller.expectOne((r) => r.url === URL_LISTA);
    req.flush(itens, { headers: link ? { Link: link } : undefined });
    await propagate();
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('pede a primeira página sem cursor e com a janela declarada', async () => {
    const req = controller.expectOne((r) => r.url === URL_LISTA);

    expect(req.request.params.get('limit')).toBe('50');
    expect(req.request.params.get('cursor')).toBeNull();
    expect(req.request.params.get('direction')).toBeNull();

    req.flush([processo()]);
    await propagate();
  });

  it('lê apenas uma vez a listagem ao montar', async () => {
    await flushLista([processo()]);

    controller.verify();
  });

  it('mostra os campos que o resumo devolve', async () => {
    await flushLista([processo()]);

    const linha = host().querySelector('tbody tr');

    expect(linha?.querySelector('[data-label="Processo"]')?.textContent).toContain(
      'Vestibular 2026.1',
    );
    expect(linha?.querySelector('[data-label="Tipo"]')?.textContent).toContain('Vestibular');
    expect(linha?.querySelector('[data-label="Tipo"]')?.textContent).toContain('VESTIBULAR');
    expect(linha?.querySelector('[data-label="Data de criação"]')?.textContent?.trim()).toMatch(
      /^\d{2}\/\d{2}\/\d{4}/,
    );
  });

  /**
   * O backend projeta `StatusProcesso.ToString()`, em PascalCase. Comparar com
   * `'RASCUNHO'` deixaria toda tag em `neutral` e apagaria a distinção visual
   * entre um rascunho e um certame publicado.
   */
  it.each([
    ['Rascunho', 'Rascunho', 'tag--warning'],
    ['Publicado', 'Publicado', 'tag--success'],
    ['Encerrado', 'Encerrado', ''],
    ['Cancelado', 'Cancelado', 'tag--danger'],
  ])('rotula e colore o status %s', async (status, rotulo, classe) => {
    await flushLista([processo({ status })]);

    const tag = host().querySelector('[data-label="Status"] .tag');

    expect(tag?.textContent?.trim()).toBe(rotulo);
    if (classe) {
      expect(tag?.classList.contains(classe)).toBe(true);
    }
  });

  /** Status vindo de um backend mais novo aparece cru, em vez de sumir. */
  it('exibe um status que esta versão não reconhece', async () => {
    await flushLista([processo({ status: 'Suspenso' })]);

    expect(host().querySelector('[data-label="Status"] .tag')?.textContent?.trim()).toBe(
      'Suspenso',
    );
  });

  /**
   * O token vem do servidor. Num objeto literal, `constructor` resolveria para
   * o membro herdado de `Object.prototype` — uma função, que o `??` não trata
   * como ausência e que a interpolação renderizaria como código-fonte.
   */
  it.each(['constructor', 'toString', 'hasOwnProperty'])(
    'não confunde o status %s com membro herdado de Object',
    async (status) => {
      await flushLista([processo({ status })]);

      const tag = host().querySelector('[data-label="Status"] .tag');

      expect(tag?.textContent?.trim()).toBe(status);
      expect(tag?.textContent).not.toContain('native code');
      expect(tag?.classList.contains('tag--warning')).toBe(false);
      expect(tag?.classList.contains('tag--success')).toBe(false);
    },
  );

  it('anuncia o estado vazio quando a coleção não tem itens', async () => {
    await flushLista([]);

    expect(host().querySelector('.empty-state')).not.toBeNull();
    expect(host().querySelector('tbody tr')).toBeNull();
  });

  it('navega para a próxima página com o cursor do header Link', async () => {
    await flushLista([processo()], `<${URL_LISTA}?cursor=pagina-2&direction=next>; rel="next"`);

    (host().querySelector('[data-pager="next"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const req = controller.expectOne((r) => r.url === URL_LISTA);

    expect(req.request.params.get('cursor')).toBe('pagina-2');
    expect(req.request.params.get('direction')).toBe('next');
    // O cursor já carrega a janela; reenviar `limit` seria divergir do
    // contrato de navegação (ADR-0026).
    expect(req.request.params.get('limit')).toBeNull();

    req.flush([processo({ id: 'outro-id', nome: 'Vestibular 2026.2' })]);
    await propagate();
  });

  it('volta para a página anterior com o cursor rel="prev"', async () => {
    await flushLista([processo()], `<${URL_LISTA}?cursor=pagina-0&direction=prev>; rel="prev"`);

    (host().querySelector('[data-pager="prev"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const req = controller.expectOne((r) => r.url === URL_LISTA);

    expect(req.request.params.get('cursor')).toBe('pagina-0');
    expect(req.request.params.get('direction')).toBe('prev');

    req.flush([processo()]);
    await propagate();
  });

  it('esconde o pager quando o header Link não traz cursor algum', async () => {
    await flushLista([processo()]);

    expect(host().querySelector('[data-pager="next"]')).toBeNull();
  });

  /**
   * Invariante da ADR-0026: falha de **navegação** preserva a página em tela e
   * os cursores. Esvaziar a tabela tiraria do operador o conteúdo que ele já
   * estava lendo por causa de uma rede que caiu.
   */
  it('preserva a página atual quando a navegação falha', async () => {
    await flushLista([processo()], `<${URL_LISTA}?cursor=pagina-2&direction=next>; rel="next"`);

    (host().querySelector('[data-pager="next"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    controller
      .expectOne((r) => r.url === URL_LISTA)
      .flush(mockProblemDetails({ status: 503, title: 'Serviço indisponível' }), {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/problem+json' },
      });
    await propagate();
    fixture.detectChanges();

    expect(host().querySelectorAll('tbody tr')).toHaveLength(1);
    expect(host().querySelector('.alert--danger')?.textContent).toContain('Serviço indisponível');
    expect(host().querySelector('[data-pager="next"]')).not.toBeNull();
  });

  /** Falha na primeira página limpa: o que estava em tela pode não valer mais. */
  it('limpa a lista quando a primeira página falha', async () => {
    controller
      .expectOne((r) => r.url === URL_LISTA)
      .flush(mockProblemDetails({ status: 500, title: 'Falha ao listar' }), {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'application/problem+json' },
      });
    await propagate();
    fixture.detectChanges();

    expect(host().querySelector('tbody tr')).toBeNull();
    expect(host().querySelector('.alert--danger')).not.toBeNull();
    expect(host().querySelector('[data-pager="next"]')).toBeNull();
  });

  it('relê a página pelo botão de nova tentativa', async () => {
    controller
      .expectOne((r) => r.url === URL_LISTA)
      .flush(mockProblemDetails({ status: 500, title: 'Falha ao listar' }), {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'application/problem+json' },
      });
    await propagate();
    fixture.detectChanges();

    const botao = [...host().querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Tentar novamente'),
    );
    botao?.click();
    fixture.detectChanges();

    await flushLista([processo()]);

    expect(host().querySelectorAll('tbody tr')).toHaveLength(1);
    expect(host().querySelector('.alert--danger')).toBeNull();
  });

  it('nomeia a seção de processos por um id existente', async () => {
    await flushLista([processo()]);

    const secao = host().querySelector('section.panel[aria-labelledby]');
    const id = secao?.getAttribute('aria-labelledby');

    expect(id).toBeTruthy();
    expect(host().querySelector(`#${id}`)).not.toBeNull();
  });

  it('rotula todas as células com o cabeçalho correspondente', async () => {
    await flushLista([processo()]);

    const cabecalhos = [...host().querySelectorAll('thead th')].map((th) => th.textContent?.trim());
    const rotulos = [...host().querySelectorAll('tbody tr td')].map((td) =>
      td.getAttribute('data-label'),
    );

    expect(rotulos).toEqual(cabecalhos);
  });

  it('não expõe âncoras sem destino', async () => {
    await flushLista([processo()]);

    const vazias = [...host().querySelectorAll('a')].filter((a) => a.getAttribute('href') === '#');

    expect(vazias).toHaveLength(0);
  });

  /**
   * Sem esta ação a rota de retomada só seria alcançável digitando o endereço
   * à mão — o operador não teria caminho pela interface.
   */
  it('oferece o caminho para retomar cada processo da lista', async () => {
    await flushLista([processo()]);

    const abrir = host().querySelector<HTMLAnchorElement>('tbody tr [data-label="Ações"] a');

    expect(abrir?.getAttribute('href')).toBe(
      '/processo-seletivo/019f41cf-69fd-759a-ac6d-09acabc1b027',
    );
    expect(abrir?.getAttribute('aria-label')).toBe('Abrir Vestibular 2026.1');
  });

  it('leva ao cadastro pelo atalho de novo processo', async () => {
    await flushLista([processo()]);

    const atalho = [...host().querySelectorAll('a')].find((a) =>
      a.textContent?.includes('Novo Processo'),
    );

    expect(atalho?.getAttribute('href')).toBe('/processo-seletivo/novo');
  });

  /**
   * O cadastro do certame é restrito a `plataforma-admin` na rota e na API.
   * Oferecer o atalho a quem não tem o papel levaria direto ao acesso negado.
   */
  it('esconde o atalho de novo processo de quem não administra a plataforma', async () => {
    papeis.set(['gestor']);
    await flushLista([processo()]);

    const atalho = [...host().querySelectorAll('a')].find((a) =>
      a.textContent?.includes('Novo Processo'),
    );

    expect(atalho).toBeUndefined();
  });

  it('não injeta o total de processos como se fosse agregado da coleção', async () => {
    await flushLista([processo(), processo({ id: 'outro-id' })]);

    const contador = host().querySelector('.list-count');

    expect(contador?.getAttribute('aria-label')).toBe('Processos seletivos nesta página');
    expect(contador?.textContent?.trim()).toBe('2');
    expect(component['processos']()).toHaveLength(2);
  });

  /**
   * O percurso que a Story existe para garantir: cadastrar e voltar à listagem
   * mostra o processo novo. Prova que a página relê da API ao ser montada, em
   * vez de servir o que trouxe da visita anterior — se ela guardasse a coleção,
   * o registro recém-criado não apareceria sem um refresh do navegador.
   */
  it('mostra o processo recém-criado ao voltar para a listagem', async () => {
    await flushLista([processo({ nome: 'Vestibular 2026.1' })]);
    expect(nomesNaTabela()).toEqual(['Vestibular 2026.1']);

    // Sai da listagem e volta, como quem foi ao cadastro e concluiu.
    fixture.destroy();
    fixture = TestBed.createComponent(ProcessosSeletivosListaPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    await flushLista([
      processo({ nome: 'Vestibular 2026.1' }),
      processo({ id: '019f41cf-69fd-759a-ac6d-09acabc1b099', nome: 'PSIQ 2026' }),
    ]);

    expect(nomesNaTabela()).toEqual(['Vestibular 2026.1', 'PSIQ 2026']);
  });

  function nomesNaTabela(): string[] {
    return [...host().querySelectorAll('tbody tr')].map(
      (linha) => linha.querySelector('td')?.textContent?.trim().split('\n')[0] ?? '',
    );
  }
});
