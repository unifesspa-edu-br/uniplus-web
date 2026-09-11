import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';

import { ProblemI18nService, ApiResult } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { GeoApi, CidadeResumoDto } from '@uniplus/shared-data/geo';
import {
  ORGANIZACAO_BASE_PATH,
  TipoUnidade,
  UnidadeDto,
  UnidadesApi,
} from '@uniplus/shared-data/organizacao';

import { UnidadesPage } from './unidades.page';

const mockUnidadeRaiz: UnidadeDto = {
  id: 'u-1',
  nome: 'Reitoria',
  sigla: 'REIT',
  codigo: '001',
  slug: 'reitoria',
  alias: null,
  tipo: TipoUnidade.reitoria,
  unidadeSuperiorId: null,
  unidadeAcademica: false,
  vigenciaInicio: '2020-01-01',
  vigenciaFim: null,
  cidadeCodigoIbge: '1504208',
  cidadeNome: 'Marabá',
  cidadeUf: 'PA',
};

const mockUnidadeFilho: UnidadeDto = {
  id: 'u-2',
  nome: 'Instituto de Ciências Exatas',
  sigla: 'ICE',
  codigo: '002',
  slug: 'ice',
  alias: 'Exatas',
  tipo: TipoUnidade.instituto,
  unidadeSuperiorId: 'u-1',
  unidadeAcademica: true,
  vigenciaInicio: '2021-01-01',
  vigenciaFim: null,
  cidadeCodigoIbge: '1504208',
  cidadeNome: 'Marabá',
  cidadeUf: 'PA',
};

describe('UnidadesPage', () => {
  let fixture: ComponentFixture<UnidadesPage>;
  let component: UnidadesPage;
  let httpMock: HttpTestingController;
  let unidadesApiMock: vi.Mocked<UnidadesApi>;
  let geoApiMock: vi.Mocked<GeoApi>;
  let notificationMock: vi.Mocked<NotificationService>;

  beforeEach(async () => {
    unidadesApiMock = {
      criar: vi.fn(),
      atualizar: vi.fn(),
      remover: vi.fn(),
    } as unknown as vi.Mocked<UnidadesApi>;

    geoApiMock = {
      listarCidades: vi.fn().mockReturnValue(
        of({
          ok: true,
          data: [],
        }),
      ),
    } as unknown as vi.Mocked<GeoApi>;

    notificationMock = {
      success: vi.fn(),
      errorFromProblem: vi.fn(),
    } as unknown as vi.Mocked<NotificationService>;

    await TestBed.configureTestingModule({
      imports: [UnidadesPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        {
          provide: ORGANIZACAO_BASE_PATH,
          useValue: '',
        },
        {
          provide: UnidadesApi,
          useValue: unidadesApiMock,
        },
        {
          provide: GeoApi,
          useValue: geoApiMock,
        },
        {
          provide: NotificationService,
          useValue: notificationMock,
        },
        {
          provide: ProblemI18nService,
          useValue: {
            resolve: (p: { detail?: string; title?: string }) => ({
              title: p.detail || p.title || 'Erro na requisição',
            }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UnidadesPage);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
    if (httpMock) {
      httpMock.verify();
    }
  });

  async function responderListaUnidades(
    unidades: UnidadeDto[] = [mockUnidadeRaiz, mockUnidadeFilho],
    linkHeader = '<.../unidades?cursor=next_123&direction=next>; rel="next"',
  ) {
    fixture.detectChanges();
    TestBed.flushEffects();

    const req = httpMock.expectOne((r) => r.url.includes('/api/organizacao/unidades'));
    req.flush(
      { ok: true, data: unidades },
      { headers: { 'Content-Type': 'application/json', Link: linkHeader } },
    );

    TestBed.flushEffects();
    await Promise.resolve();
    TestBed.flushEffects();
    fixture.detectChanges();
  }

  async function responderLookupSuperior(unidades: UnidadeDto[] = [mockUnidadeRaiz]) {
    fixture.detectChanges();
    TestBed.flushEffects();

    const req = httpMock.expectOne((r) => r.url.includes('/api/organizacao/unidades'));
    req.flush({ ok: true, data: unidades }, { headers: { 'Content-Type': 'application/json' } });

    TestBed.flushEffects();
    await Promise.resolve();
    TestBed.flushEffects();
    fixture.detectChanges();
  }

  /**
   * Simula uma falha da listagem (`lista`) — a API sempre responde 200 com o
   * envelope `ApiResult` no corpo (mesmo padrão de `criar`/`atualizar`/
   * `remover` mockados no resto do arquivo); erros de negócio vêm como
   * `{ ok: false, problem }`, não como status HTTP não-2xx. Um flush com
   * status 500 real faz o `lista.value()` simplesmente não atualizar (o
   * `linkedSignal` preserva o valor anterior por não detectar mudança), então
   * NÃO simule com `{ status: 500 }` no segundo argumento do `flush`.
   */
  function reqFlushErro(req: TestRequest): void {
    req.flush({
      ok: false,
      problem: { type: 'server-error', title: 'Erro interno', status: 500 },
    });
  }

  it('deve carregar e renderizar a árvore de unidades organizadas hierarquicamente', async () => {
    await responderListaUnidades();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('REIT');
    expect(compiled.textContent).toContain('Reitoria');

    const toggleRaiz = compiled.querySelector('.unit-node__toggle') as HTMLButtonElement | null;
    expect(toggleRaiz).not.toBeNull();
    toggleRaiz?.click();

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(compiled.textContent).toContain('ICE');
    expect(compiled.textContent).toContain('Instituto de Ciências Exatas');
  });

  it('não deve renderizar a tabela antiga de unidades', async () => {
    await responderListaUnidades();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('table')).toBeNull();
    expect(compiled.querySelector('tbody')).toBeNull();
  });

  it('deve exibir o botão Nova unidade mesmo quando vazia', async () => {
    await responderListaUnidades([]);
    const compiled = fixture.nativeElement as HTMLElement;
    const botoes = Array.from(compiled.querySelectorAll('button'));

    expect(botoes.some((b) => b.textContent?.includes('Nova unidade'))).toBe(true);
  });

  it('deve exibir Editar e Remover para cada unidade da árvore', async () => {
    await responderListaUnidades();
    const compiled = fixture.nativeElement as HTMLElement;

    const toggleRaiz = compiled.querySelector('.unit-node__toggle') as HTMLButtonElement | null;
    toggleRaiz!.click();

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    const botoesEditar = compiled.querySelectorAll(
      '.unit-node__actions button[aria-label^="Editar unidade"]',
    );
    const botoesRemover = compiled.querySelectorAll(
      '.unit-node__actions button[aria-label^="Remover unidade"]',
    );

    expect(botoesEditar).toHaveLength(2);
    expect(botoesRemover).toHaveLength(2);
  });

  it('deve permitir expandir e recolher um nó com filhos alterando aria-expanded', async () => {
    await responderListaUnidades();
    const compiled = fixture.nativeElement as HTMLElement;
    const toggle = compiled.querySelector('.unit-node__toggle') as HTMLButtonElement | null;

    expect(toggle?.getAttribute('aria-expanded')).toBe('false');

    toggle?.click();
    fixture.detectChanges();
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');

    toggle?.click();
    fixture.detectChanges();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
  });

  it('não deve exibir controle de expansão para unidade folha e deve renderizar ícone estático', async () => {
    await responderListaUnidades();
    const compiled = fixture.nativeElement as HTMLElement;

    const toggleRaiz = compiled.querySelector('.unit-node__toggle') as HTMLButtonElement | null;
    toggleRaiz!.click();
    fixture.detectChanges();

    const nodeFilho = compiled.querySelectorAll('.unit-node')[1] as HTMLElement;
    expect(nodeFilho.querySelector('.unit-node__toggle')).toBeNull();
    expect(nodeFilho.querySelector('.unit-node__icon')).not.toBeNull();
  });

  it('deve solicitar remoção da unidade correta e emitir notificação de sucesso', async () => {
    await responderListaUnidades();
    unidadesApiMock.remover.mockReturnValue(of({ ok: true, data: undefined }));

    component['pedirRemocao'](mockUnidadeFilho);
    component['removerConfirmado']();

    fixture.detectChanges();
    TestBed.flushEffects();

    const reqReload = httpMock.expectOne((r) => r.url.includes('/api/organizacao/unidades'));
    reqReload.flush({ ok: true, data: [mockUnidadeRaiz] });

    expect(unidadesApiMock.remover).toHaveBeenCalledWith('u-2');
    expect(notificationMock.success).toHaveBeenCalledWith('Unidade removida', 'ICE');
  });

  it('deve desabilitar as ações da linha durante o refetch pós-mutação (recarregandoLista)', async () => {
    await responderListaUnidades();
    unidadesApiMock.remover.mockReturnValue(of({ ok: true, data: undefined }));

    component['pedirRemocao'](mockUnidadeRaiz);
    component['removerConfirmado']();

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    // O refetch pós-mutação já está em voo (é o que `httpMock.expectOne`
    // confirma abaixo) — enquanto ele não responde, `recarregandoLista()`
    // deve estar true e as ações da linha, desabilitadas.
    expect(component['recarregandoLista']()).toBe(true);

    const compiled = fixture.nativeElement as HTMLElement;
    const botaoEditar = compiled.querySelector(
      '.unit-node__actions button[aria-label="Editar unidade REIT"]',
    ) as HTMLButtonElement | null;
    expect(botaoEditar?.disabled).toBe(true);

    const reqReload = httpMock.expectOne((r) => r.url.includes('/api/organizacao/unidades'));
    reqReload.flush({ ok: true, data: [mockUnidadeRaiz] });

    TestBed.flushEffects();
    await Promise.resolve();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(component['recarregandoLista']()).toBe(false);
    expect(botaoEditar?.disabled).toBe(false);
  });

  it('deve limpar a lista quando o refetch pós-mutação falha na primeira página', async () => {
    await responderListaUnidades();
    unidadesApiMock.remover.mockReturnValue(of({ ok: true, data: undefined }));

    component['pedirRemocao'](mockUnidadeRaiz);
    component['removerConfirmado']();

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    const reqReload = httpMock.expectOne((r) => r.url.includes('/api/organizacao/unidades'));
    reqFlushErro(reqReload);

    TestBed.flushEffects();
    await Promise.resolve();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(component['unidades']()).toEqual([]);
  });

  it('deve realizar busca server-side com debounce de 300ms na listagem principal', async () => {
    vi.useFakeTimers();
    await responderListaUnidades();

    component['busca'].set('REIT');
    fixture.detectChanges();

    await vi.advanceTimersByTimeAsync(290);
    httpMock.expectNone((r) => r.url.includes('/api/organizacao/unidades') && r.params.has('q'));

    await vi.advanceTimersByTimeAsync(20);
    fixture.detectChanges();

    const req = httpMock.expectOne(
      (r) => r.url.includes('/api/organizacao/unidades') && r.params.get('q') === 'REIT',
    );
    req.flush({ ok: true, data: [mockUnidadeRaiz] });

    TestBed.flushEffects();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(component['unidades']()).toEqual([mockUnidadeRaiz]);
  });

  it('deve filtrar por tipo de unidade enviando o ordinal numérico do backend', async () => {
    await responderListaUnidades();

    component['tipoFiltro'].set('4'); // Ordinal de TipoUnidade.instituto
    fixture.detectChanges();

    const req = httpMock.expectOne(
      (r) => r.url.includes('/api/organizacao/unidades') && r.params.get('tipo') === '4',
    );
    req.flush({ ok: true, data: [mockUnidadeFilho] });

    TestBed.flushEffects();
    await Promise.resolve();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(component['unidades']()).toEqual([mockUnidadeFilho]);
  });

  it('deve permitir navegar entre páginas por cursor e resetar ao alterar filtro', async () => {
    await responderListaUnidades();

    component['proximaPagina']();
    fixture.detectChanges();

    const reqNext = httpMock.expectOne(
      (r) => r.url.includes('/api/organizacao/unidades') && r.params.get('cursor') === 'next_123',
    );
    reqNext.flush(
      { ok: true, data: [mockUnidadeFilho] },
      {
        headers: {
          'Content-Type': 'application/json',
          Link: '<.../unidades?cursor=prev_123&direction=prev>; rel="prev"',
        },
      },
    );

    TestBed.flushEffects();
    await Promise.resolve();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(component['prevCursor']()).toBe('prev_123');

    component['tipoFiltro'].set('1');
    fixture.detectChanges();

    const reqReset = httpMock.expectOne(
      (r) => r.url.includes('/api/organizacao/unidades') && r.params.get('tipo') === '1',
    );
    expect(reqReset.request.params.has('cursor')).toBe(false);
  });

  it('deve permitir navegar para a página anterior usando o cursor "prev"', async () => {
    await responderListaUnidades();

    component['proximaPagina']();
    fixture.detectChanges();

    const reqNext = httpMock.expectOne(
      (r) => r.url.includes('/api/organizacao/unidades') && r.params.get('cursor') === 'next_123',
    );
    reqNext.flush(
      { ok: true, data: [mockUnidadeFilho] },
      {
        headers: {
          'Content-Type': 'application/json',
          Link:
            '<.../unidades?cursor=prev_123&direction=prev>; rel="prev", ' +
            '<.../unidades?cursor=next_456&direction=next>; rel="next"',
        },
      },
    );

    TestBed.flushEffects();
    await Promise.resolve();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(component['prevCursor']()).toBe('prev_123');

    component['paginaAnterior']();
    fixture.detectChanges();

    const reqPrev = httpMock.expectOne(
      (r) =>
        r.url.includes('/api/organizacao/unidades') &&
        r.params.get('cursor') === 'prev_123' &&
        r.params.get('direction') === 'prev',
    );
    reqPrev.flush(
      { ok: true, data: [mockUnidadeRaiz, mockUnidadeFilho] },
      { headers: { 'Content-Type': 'application/json' } },
    );

    TestBed.flushEffects();
    await Promise.resolve();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(component['unidades']()).toEqual([mockUnidadeRaiz, mockUnidadeFilho]);
  });

  it('deve preservar cursores e lista quando a navegação falha, e o retry deve refazer a mesma página', async () => {
    await responderListaUnidades(); // página 1: prev=null, next='next_123'

    component['proximaPagina']();
    fixture.detectChanges();

    const reqNext = httpMock.expectOne(
      (r) => r.url.includes('/api/organizacao/unidades') && r.params.get('cursor') === 'next_123',
    );
    reqFlushErro(reqNext);

    TestBed.flushEffects();
    await Promise.resolve();
    TestBed.flushEffects();
    fixture.detectChanges();

    // Falha em navegação (não é a primeira página) preserva cursores e lista
    // da página anterior, em vez de zerar o pager.
    expect(component['prevCursor']()).toBeNull();
    expect(component['nextCursor']()).toBe('next_123');
    expect(component['unidades']()).toEqual([mockUnidadeRaiz, mockUnidadeFilho]);

    // Retry refaz a MESMA página (mesmo cursor) — `pagina` não é resetado.
    component['tentarNovamente']();
    fixture.detectChanges();

    const reqRetry = httpMock.expectOne(
      (r) => r.url.includes('/api/organizacao/unidades') && r.params.get('cursor') === 'next_123',
    );
    reqRetry.flush(
      { ok: true, data: [mockUnidadeFilho] },
      { headers: { 'Content-Type': 'application/json' } },
    );

    TestBed.flushEffects();
    await Promise.resolve();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(component['unidades']()).toEqual([mockUnidadeFilho]);
  });

  it('deve limpar a lista e os cursores quando a primeira página falha', async () => {
    fixture.detectChanges();
    TestBed.flushEffects();

    const req = httpMock.expectOne((r) => r.url.includes('/api/organizacao/unidades'));
    reqFlushErro(req);

    TestBed.flushEffects();
    await Promise.resolve();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(component['unidades']()).toEqual([]);
    expect(component['prevCursor']()).toBeNull();
    expect(component['nextCursor']()).toBeNull();
  });

  it('deve executar o fluxo completo de edição enviando payload correto e chave de idempotência', async () => {
    await responderListaUnidades();
    unidadesApiMock.atualizar.mockReturnValue(of({ ok: true, data: undefined }));

    component['abrirEdicao'](mockUnidadeFilho);
    fixture.detectChanges();
    await responderLookupSuperior();

    component['form'].patchValue({
      nome: 'Instituto de Ciências Exatas e Tecnológicas',
      alias: 'ICET',
    });

    component['salvar']();

    expect(unidadesApiMock.atualizar).toHaveBeenCalledWith(
      'u-2',
      expect.objectContaining({
        id: 'u-2',
        nome: 'Instituto de Ciências Exatas e Tecnológicas',
        alias: 'ICET',
        sigla: 'ICE',
        codigo: '002',
        slug: 'ice',
        tipo: TipoUnidade.instituto,
      }),
      expect.anything(),
    );
  });

  it('deve executar o fluxo completo de criação enviando payload correto, notificando sucesso e fechando o formulário', async () => {
    await responderListaUnidades();
    unidadesApiMock.criar.mockReturnValue(of({ ok: true, data: 'u-novo-id' }));

    component['abrirCadastro']();
    fixture.detectChanges();
    await responderLookupSuperior();

    component['form'].patchValue({
      nome: 'Núcleo de Tecnologia',
      sigla: 'NTEC',
      slug: 'ntec',
      codigo: '500',
      tipo: TipoUnidade.nucleo,
      unidadeSuperiorId: 'u-1',
      unidadeAcademica: true,
      vigenciaInicio: '2026-02-01',
    });
    component['selecionarCidade']({ codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' });

    const chaveOriginal = component['idempotencyKeyAtual']();
    component['salvar']();

    expect(unidadesApiMock.criar).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: 'Núcleo de Tecnologia',
        alias: null,
        slug: 'ntec',
        sigla: 'NTEC',
        codigo: '500',
        unidadeSuperiorId: 'u-1',
        tipo: TipoUnidade.nucleo,
        unidadeAcademica: true,
        vigenciaInicio: '2026-02-01',
        vigenciaFim: null,
        cidadeCodigoIbge: '1504208',
        cidadeNome: 'Marabá',
        cidadeUf: 'PA',
      }),
      expect.anything(),
    );

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    const reqReload = httpMock.expectOne((r) => r.url.includes('/api/organizacao/unidades'));
    reqReload.flush({ ok: true, data: [mockUnidadeRaiz] });

    TestBed.flushEffects();
    await Promise.resolve();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(notificationMock.success).toHaveBeenCalledWith('Unidade criada');
    expect(component['formOpen']()).toBe(false);
    expect(component['idempotencyKeyAtual']()).not.toBe(chaveOriginal);
  });

  it('deve renovar a chave de idempotência em erro 409 de conflito', async () => {
    await responderListaUnidades();
    unidadesApiMock.criar.mockReturnValue(
      of({
        ok: false,
        problem: {
          status: 409,
          type: 'conflict-error',
          title: 'Conflito de dados',
          // `code` no nível raiz do problem (não só em `errors[].code`):
          // `aplicarFalha` chama `ehErroDeEndereco(problem.code)` antes de
          // checar o status 409, e essa função não trata `undefined`.
          code: 'Conflict',
          field: 'sigla',
          errors: [
            {
              field: 'sigla',
              code: 'Conflict',
              message: 'Conflito de dados',
            },
          ],
        },
      }),
    );

    component['abrirCadastro']();
    fixture.detectChanges();
    await responderLookupSuperior();

    component['form'].patchValue({
      nome: 'Nova Unidade',
      sigla: 'NOVA',
      slug: 'nova',
      codigo: '100',
      tipo: TipoUnidade.faculdade,
      vigenciaInicio: '2026-01-01',
    });

    const chaveOriginal = component['idempotencyKeyAtual']();
    component['salvar']();

    expect(component['idempotencyKeyAtual']()).not.toBe(chaveOriginal);
  });

  it('deve renovar a chave de idempotência em erro 422 de validação de campo', async () => {
    await responderListaUnidades();
    unidadesApiMock.criar.mockReturnValue(
      of({
        ok: false,
        problem: {
          status: 422,
          type: 'validation-error',
          title: 'Erro de validação',
          errors: [{ field: 'Sigla', code: 'Duplicate', message: 'Sigla já está em uso.' }],
        },
      }),
    );

    component['abrirCadastro']();
    fixture.detectChanges();
    await responderLookupSuperior();

    component['form'].patchValue({
      nome: 'Nova Unidade',
      sigla: 'REIT',
      slug: 'nova-unidade',
      codigo: '999',
      tipo: TipoUnidade.faculdade,
      vigenciaInicio: '2026-01-01',
    });

    const chaveOriginal = component['idempotencyKeyAtual']();
    component['salvar']();

    expect(component['idempotencyKeyAtual']()).not.toBe(chaveOriginal);
  });

  it('deve renovar a chave de idempotência quando o backend reporta body_mismatch', async () => {
    await responderListaUnidades();
    unidadesApiMock.criar.mockReturnValue(
      of({
        ok: false,
        problem: {
          status: 400,
          type: 'idempotency-error',
          title: 'Requisição divergente da original',
          code: 'uniplus.idempotency.body_mismatch',
        },
      }),
    );

    component['abrirCadastro']();
    fixture.detectChanges();
    await responderLookupSuperior();

    component['form'].patchValue({
      nome: 'Nova Unidade',
      sigla: 'NOVA2',
      slug: 'nova2',
      codigo: '101',
      tipo: TipoUnidade.faculdade,
      vigenciaInicio: '2026-01-01',
    });

    const chaveOriginal = component['idempotencyKeyAtual']();
    component['salvar']();

    expect(component['idempotencyKeyAtual']()).not.toBe(chaveOriginal);
  });

  it('deve resolver o rótulo da unidade superior mesmo quando filtrada para fora da página', async () => {
    await responderListaUnidades([mockUnidadeRaiz, mockUnidadeFilho]);

    component['tipoFiltro'].set('4');
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.includes('/api/organizacao/unidades'));
    req.flush({ ok: true, data: [mockUnidadeFilho] });
    fixture.detectChanges();

    expect(component['unidadeSuperiorLabel']('u-1')).toBe('REIT — Reitoria');
  });

  it('deve descartar resultados obsoletos de busca de cidade (proteção contra o bug #639)', async () => {
    vi.useFakeTimers();
    await responderListaUnidades();

    component['abrirCadastro']();
    fixture.detectChanges();
    await responderLookupSuperior();

    component['buscaCidade'].set('Marab');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(300);

    component['buscaCidade'].set('Belém');
    fixture.detectChanges();

    expect(component['buscaCidadeSemResultado']()).toBe(false);
  });

  it('não deve rotular o campo Cidade com o erro de uma busca de termo já abandonado', async () => {
    vi.useFakeTimers();
    await responderListaUnidades();

    geoApiMock.listarCidades.mockReturnValueOnce(
      of({
        ok: false,
        problem: { status: 500, type: 'server-error', title: 'Erro ao buscar cidade' },
      }),
    );

    component['abrirCadastro']();
    fixture.detectChanges();
    await responderLookupSuperior();

    component['buscaCidade'].set('Marab');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(300);

    // A resposta de erro do termo 'Marab' já chegou (o mock é síncrono); o
    // usuário já trocou de termo antes de qualquer nova busca disparar —
    // o erro de 'Marab' não pode aparecer sob 'Belém'.
    component['buscaCidade'].set('Belém');
    fixture.detectChanges();

    expect(component['buscaCidadeErro']()).toBeNull();
  });

  it('deve cancelar uma busca de cidade em andamento ao digitar um novo termo (switchMap)', async () => {
    vi.useFakeTimers();
    await responderListaUnidades();

    const respostaMarab = new Subject<ApiResult<readonly CidadeResumoDto[]>>();
    const respostaBelem = new Subject<ApiResult<readonly CidadeResumoDto[]>>();
    geoApiMock.listarCidades.mockImplementation((params) =>
      params.q === 'Marabá' ? respostaMarab.asObservable() : respostaBelem.asObservable(),
    );

    component['abrirCadastro']();
    fixture.detectChanges();
    await responderLookupSuperior();

    component['buscaCidade'].set('Marabá');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(300);

    component['buscaCidade'].set('Belém');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(300);

    // 'Belém' já disparou a request; a busca de 'Marabá' deveria ter sido
    // cancelada pelo switchMap ao trocar de termo, então mesmo que sua
    // resposta chegue depois, ela não deve mais ser aplicada.
    respostaMarab.next({ ok: true, data: [{ codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' }] });
    respostaBelem.next({ ok: true, data: [{ codigoIbge: '1501402', nome: 'Belém', uf: 'PA' }] });
    fixture.detectChanges();

    expect(component['cidadeOpcoes']()).toEqual([
      { codigoIbge: '1501402', nome: 'Belém', uf: 'PA' },
    ]);
  });

  it('deve realizar busca por cidade com debounce de 300ms e mínimo de 3 caracteres', async () => {
    vi.useFakeTimers();
    await responderListaUnidades();

    component['abrirCadastro']();
    fixture.detectChanges();
    await responderLookupSuperior();

    component['buscaCidade'].set('Ma');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(300);
    expect(geoApiMock.listarCidades).not.toHaveBeenCalled();

    component['buscaCidade'].set('Marabá');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(300);

    expect(geoApiMock.listarCidades).toHaveBeenCalledWith({
      q: 'Marabá',
      limit: 20,
    });
  });

  it('deve mapear erros 422 de validação retornados pelo backend para os controles do formulário', async () => {
    await responderListaUnidades();

    unidadesApiMock.criar.mockReturnValue(
      of({
        ok: false,
        problem: {
          status: 422,
          type: 'validation-error',
          title: 'Erro de validação',
          errors: [
            {
              field: 'Sigla',
              code: 'Duplicate',
              message: 'Sigla já está em uso.',
            },
          ],
        },
      }),
    );

    component['abrirCadastro']();
    fixture.detectChanges();
    await responderLookupSuperior();

    component['form'].patchValue({
      nome: 'Nova Unidade',
      sigla: 'REIT',
      slug: 'nova-unidade',
      codigo: '999',
      tipo: TipoUnidade.faculdade,
      vigenciaInicio: '2026-01-01',
    });

    component['salvar']();

    expect(unidadesApiMock.criar).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: 'Nova Unidade',
        sigla: 'REIT',
        slug: 'nova-unidade',
        codigo: '999',
        tipo: TipoUnidade.faculdade,
        vigenciaInicio: '2026-01-01',
      }),
      expect.anything(),
    );

    fixture.detectChanges();
    expect(component['erroDoCampo']('sigla')).toBe('Sigla já está em uso.');
  });
});
