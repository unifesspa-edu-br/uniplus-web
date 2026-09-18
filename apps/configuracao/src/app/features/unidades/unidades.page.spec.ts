import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, Subject } from 'rxjs';
import { vi, type Mocked } from 'vitest';

import {
  ProblemI18nService,
  ApiResult,
  errorResult,
  mockProblemDetails,
  mockValidationError,
  okResult,
} from '@uniplus/shared-core/http';
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
  criadoEm: '2020-01-01T00:00:00Z',
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
  criadoEm: '2021-01-01T00:00:00Z',
  cidadeCodigoIbge: '1504208',
  cidadeNome: 'Marabá',
  cidadeUf: 'PA',
};

describe('UnidadesPage', () => {
  let fixture: ComponentFixture<UnidadesPage>;
  let component: UnidadesPage;
  let httpMock: HttpTestingController;
  let unidadesApiMock: Mocked<UnidadesApi>;
  let geoApiMock: Mocked<GeoApi>;
  let notificationMock: Mocked<NotificationService>;

  beforeEach(async () => {
    unidadesApiMock = {
      criar: vi.fn(),
      atualizar: vi.fn(),
      remover: vi.fn(),
    } as unknown as Mocked<UnidadesApi>;

    geoApiMock = {
      listarCidades: vi.fn().mockReturnValue(of(okResult([]))),
    } as unknown as Mocked<GeoApi>;

    notificationMock = {
      success: vi.fn(),
      errorFromProblem: vi.fn(),
    } as unknown as Mocked<NotificationService>;

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

  it('não deve pintar o botão Remover de vermelho permanente em nenhum nível, e o Editar segue intocado', async () => {
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

    for (const botao of Array.from(botoesRemover)) {
      expect(botao.classList.contains('btn--tertiary')).toBe(true);
      expect(botao.classList.contains('btn--danger')).toBe(false);
      // Sem o fundo vermelho, o glifo é o que resta identificando a ação como
      // destrutiva — trocá-lo apagaria o último sinal visual da remoção.
      expect(botao.querySelector('i')?.classList.contains('pi-trash')).toBe(true);
    }

    for (const botao of Array.from(botoesEditar)) {
      expect(botao.classList.contains('btn--tertiary')).toBe(true);
      expect(botao.classList.contains('btn--danger')).toBe(false);
      expect(botao.querySelector('i')?.classList.contains('pi-pencil')).toBe(true);
    }
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
    unidadesApiMock.remover.mockReturnValue(of(okResult(undefined)));

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
    unidadesApiMock.remover.mockReturnValue(of(okResult(undefined)));

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
    const botaoRemover = compiled.querySelector(
      '.unit-node__actions button[aria-label="Remover unidade REIT"]',
    ) as HTMLButtonElement | null;
    expect(botaoEditar?.disabled).toBe(true);
    expect(botaoRemover?.disabled).toBe(true);

    const reqReload = httpMock.expectOne((r) => r.url.includes('/api/organizacao/unidades'));
    reqReload.flush({ ok: true, data: [mockUnidadeRaiz] });

    TestBed.flushEffects();
    await Promise.resolve();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(component['recarregandoLista']()).toBe(false);
    expect(botaoEditar?.disabled).toBe(false);
    expect(botaoRemover?.disabled).toBe(false);
  });

  it('deve limpar a lista quando o refetch pós-mutação falha na primeira página', async () => {
    await responderListaUnidades();
    unidadesApiMock.remover.mockReturnValue(of(okResult(undefined)));

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
    unidadesApiMock.atualizar.mockReturnValue(of(okResult(undefined)));

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
    unidadesApiMock.criar.mockReturnValue(of(okResult('u-novo-id')));

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
      of(
        errorResult(
          mockProblemDetails({
            status: 409,
            type: 'conflict-error',
            title: 'Conflito de dados',
            // `code` no nível raiz do problem (não só em `errors[].code`):
            // `aplicarFalha` chama `ehErroDeEndereco(problem.code)` antes de
            // checar o status 409, e essa função não trata `undefined`.
            code: 'Conflict',
            errors: [mockValidationError({ field: 'sigla', code: 'Conflict', message: 'Conflito de dados' })],
          }),
        ),
      ),
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
      of(
        errorResult(
          mockProblemDetails({
            status: 422,
            type: 'validation-error',
            title: 'Erro de validação',
            errors: [mockValidationError({ field: 'Sigla', code: 'Duplicate', message: 'Sigla já está em uso.' })],
          }),
        ),
      ),
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
      of(
        errorResult(
          mockProblemDetails({
            status: 400,
            type: 'idempotency-error',
            title: 'Requisição divergente da original',
            code: 'uniplus.idempotency.body_mismatch',
          }),
        ),
      ),
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
      of(errorResult(mockProblemDetails({ status: 500, type: 'server-error', title: 'Erro ao buscar cidade' }))),
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
      params?.q === 'Marabá' ? respostaMarab.asObservable() : respostaBelem.asObservable(),
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
    respostaMarab.next(
      okResult([{ id: 'cid-1504208', codigoIbge: '1504208', nome: 'Marabá', uf: 'PA', ddd: null }]),
    );
    respostaBelem.next(
      okResult([{ id: 'cid-1501402', codigoIbge: '1501402', nome: 'Belém', uf: 'PA', ddd: null }]),
    );
    fixture.detectChanges();

    expect(component['cidadeOpcoes']()).toEqual([
      { id: 'cid-1501402', codigoIbge: '1501402', nome: 'Belém', uf: 'PA', ddd: null },
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
      of(
        errorResult(
          mockProblemDetails({
            status: 422,
            type: 'validation-error',
            title: 'Erro de validação',
            errors: [mockValidationError({ field: 'Sigla', code: 'Duplicate', message: 'Sigla já está em uso.' })],
          }),
        ),
      ),
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
  it('expõe a hierarquia em listas aninhadas, com nome acessível', async () => {
    await responderListaUnidades();
    const compiled = fixture.nativeElement as HTMLElement;

    // Sem a listagem tabular, o nome acessível que a legenda da tabela dava
    // passa a vir do `aria-label` da lista.
    const arvore = compiled.querySelector('ul.unit-tree');
    expect(arvore).not.toBeNull();
    expect(arvore?.getAttribute('aria-label')).toBe('Hierarquia de unidades da Unifesspa');

    // A relação pai/filho precisa ser programaticamente determinável, e não
    // apenas sugerida pelo recuo: cada nó é um `li`, e os filhos vivem numa
    // `ul` aninhada dentro do `li` do pai (WCAG SC 1.3.1).
    const raiz = arvore?.querySelector(':scope > li.unit-node');
    expect(raiz).not.toBeNull();

    raiz?.querySelector<HTMLButtonElement>('.unit-node__toggle')?.click();
    fixture.detectChanges();

    const filhos = raiz?.querySelectorAll(':scope > ul.unit-node__children > li.unit-node');
    expect(filhos?.length).toBeGreaterThan(0);
  });
  it('CA-19: com busca aplicada, o resultado dentro de ramo recolhido fica visível', async () => {
    vi.useFakeTimers();
    await responderListaUnidades();

    const compiled = fixture.nativeElement as HTMLElement;
    // Estado inicial: a raiz vem recolhida, então o filho não está na tela.
    expect(compiled.textContent).not.toContain('Instituto de Ciências Exatas');

    component['busca'].set('exatas');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(310);
    fixture.detectChanges();

    const req = httpMock.expectOne(
      (r) => r.url.includes('/api/organizacao/unidades') && r.params.get('q') === 'exatas',
    );
    req.flush({ ok: true, data: [mockUnidadeRaiz, mockUnidadeFilho] });

    TestBed.flushEffects();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
    TestBed.flushEffects();
    fixture.detectChanges();

    // Ninguém clicou no toggle: o ramo abre porque há filtro, senão o próprio
    // resultado da busca ficaria escondido.
    expect(compiled.textContent).toContain('Instituto de Ciências Exatas');

    // E o botão continua honesto — o estado que ele anuncia é o estado real.
    const toggle = compiled.querySelector<HTMLButtonElement>('.unit-node__toggle');
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(toggle?.getAttribute('aria-label')).toContain('Recolher');

    toggle?.click();
    fixture.detectChanges();

    // Recolher durante a busca recolhe de verdade, em vez de mudar o conjunto
    // interno em segredo e reaparecer invertido quando o filtro sai.
    expect(compiled.querySelector('.unit-node__toggle')?.getAttribute('aria-expanded')).toBe(
      'false',
    );
    expect(compiled.querySelector('.unit-node__toggle')?.getAttribute('aria-label')).toContain(
      'Expandir',
    );
    expect(compiled.textContent).not.toContain('Instituto de Ciências Exatas');
  });

  // Cobertura repositada pela #796: comportamento de formulário/mutação que a
  // reescrita do #747 (simplificação para árvore, #736) deixou de fora — nenhum
  // é código tocado por aquela Task, então nenhum destes casos protege a
  // árvore em si, e sim as regras abaixo dela.

  it('cria sem cidade selecionada enviando o trio (cidadeCodigoIbge/cidadeNome/cidadeUf) como null', async () => {
    await responderListaUnidades();
    unidadesApiMock.criar.mockReturnValue(of(okResult('nova-id')));

    component['abrirCadastro']();
    fixture.detectChanges();
    await responderLookupSuperior();

    component['form'].patchValue({
      nome: 'Núcleo Sem Cidade',
      sigla: 'NSC',
      slug: 'nsc',
      codigo: '600',
      tipo: TipoUnidade.nucleo,
      vigenciaInicio: '2026-01-01',
    });

    component['salvar']();

    expect(unidadesApiMock.criar).toHaveBeenCalledWith(
      expect.objectContaining({ cidadeCodigoIbge: null, cidadeNome: null, cidadeUf: null }),
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
  });

  it('abrirEdicao pré-preenche a cidade selecionada a partir da unidade', async () => {
    await responderListaUnidades();

    component['abrirEdicao'](mockUnidadeFilho);
    fixture.detectChanges();
    await responderLookupSuperior();

    expect(component['cidadeSelecionada']()).toEqual({
      codigoIbge: '1504208',
      nome: 'Marabá',
      uf: 'PA',
    });
  });

  it('edição: trocar a cidade e salvar envia o novo trio, sem cidadeErro residual', async () => {
    await responderListaUnidades();
    unidadesApiMock.atualizar.mockReturnValue(of(okResult(undefined)));

    component['abrirEdicao'](mockUnidadeFilho);
    fixture.detectChanges();
    await responderLookupSuperior();

    // "Trocar cidade" no drawer: limpa a seleção corrente antes de escolher outra.
    component['limparCidade']();
    component['selecionarCidade']({ codigoIbge: '1501402', nome: 'Belém', uf: 'PA' });

    component['salvar']();

    expect(unidadesApiMock.atualizar).toHaveBeenCalledWith(
      'u-2',
      expect.objectContaining({ cidadeCodigoIbge: '1501402', cidadeNome: 'Belém', cidadeUf: 'PA' }),
      expect.anything(),
    );
    expect(component['cidadeErro']()).toBeNull();

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();
    const reqReload = httpMock.expectOne((r) => r.url.includes('/api/organizacao/unidades'));
    reqReload.flush({ ok: true, data: [mockUnidadeRaiz] });
    TestBed.flushEffects();
    await Promise.resolve();
    TestBed.flushEffects();
    fixture.detectChanges();
  });

  it('reabrir a edição descarta o resíduo de uma busca de cidade malsucedida da tentativa anterior', async () => {
    vi.useFakeTimers();
    await responderListaUnidades();

    geoApiMock.listarCidades.mockReturnValueOnce(
      of(errorResult(mockProblemDetails({ status: 500, type: 'server-error', title: 'Falha ao buscar cidade' }))),
    );

    component['abrirEdicao'](mockUnidadeFilho);
    fixture.detectChanges();
    await responderLookupSuperior();

    component['limparCidade'](); // "Trocar cidade"
    component['buscaCidade'].set('Marab');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(300);
    expect(component['buscaCidadeErro']()).not.toBeNull();

    // O operador fecha sem salvar e reabre a edição da mesma unidade.
    component['abrirEdicao'](mockUnidadeFilho);
    fixture.detectChanges();
    await responderLookupSuperior();

    expect(component['buscaCidadeErro']()).toBeNull();
    expect(component['cidadeOpcoes']()).toEqual([]);
    expect(component['cidadeSelecionada']()).toEqual({
      codigoIbge: '1504208',
      nome: 'Marabá',
      uf: 'PA',
    });
  });

  it('exibe 422 de referência de cidade inline, sem contaminar o banner geral do formulário', async () => {
    await responderListaUnidades();
    unidadesApiMock.criar.mockReturnValue(
      of(
        errorResult(
          mockProblemDetails({
            status: 422,
            type: 'reference-error',
            title: 'Cidade inválida',
            // Sem `errors[]` (all-or-nothing, CA-06) — só o `code` de topo distingue
            // este 422 do 422 de validação de campo tratado no ramo anterior.
            code: 'CidadeCodigoIbge',
          }),
        ),
      ),
    );

    component['abrirCadastro']();
    fixture.detectChanges();
    await responderLookupSuperior();

    component['form'].patchValue({
      nome: 'Nova Unidade',
      sigla: 'NOVA3',
      slug: 'nova3',
      codigo: '102',
      tipo: TipoUnidade.faculdade,
      vigenciaInicio: '2026-01-01',
    });
    component['selecionarCidade']({ codigoIbge: '9999999', nome: 'Cidade Fantasma', uf: 'XX' });

    component['salvar']();
    fixture.detectChanges();

    expect(component['cidadeErro']()).toBe('Cidade inválida');
    expect(component['formError']()).toBeNull();

    // O sinal certo não basta: o que o operador enxerga é o `<span>` do campo.
    // Sem afirmar o DOM, apagar do template o bloco que renderiza `cidadeErro()`
    // deixa a suíte verde com o erro invisível na tela.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('#cfg-unidade-cidade-erro')?.textContent).toContain(
      'Cidade inválida',
    );
    // A outra metade do contrato: o banner geral do formulário não aparece.
    expect(compiled.textContent).not.toContain('Não foi possível salvar');
  });

  it('exibe a cidade no detalhe e "Não informada" quando ausente', async () => {
    await responderListaUnidades();
    const compiled = fixture.nativeElement as HTMLElement;

    component['abrirDetalhe'](mockUnidadeFilho);
    fixture.detectChanges();
    expect(compiled.textContent).toContain('Marabá — PA');

    const unidadeSemCidade: UnidadeDto = {
      ...mockUnidadeRaiz,
      cidadeCodigoIbge: null,
      cidadeNome: null,
      cidadeUf: null,
    };
    component['abrirDetalhe'](unidadeSemCidade);
    fixture.detectChanges();
    expect(compiled.textContent).toContain('Não informada');
  });

  it('exibe 422 de vigência inline no campo correspondente, sem contaminar o banner geral', async () => {
    await responderListaUnidades();
    unidadesApiMock.criar.mockReturnValue(
      of(
        errorResult(
          mockProblemDetails({
            status: 422,
            type: 'validation-error',
            title: 'Erro de validação',
            errors: [
              mockValidationError({
                field: 'VigenciaFim',
                code: 'InvalidRange',
                message: 'Fim de vigência deve ser posterior ao início.',
              }),
            ],
          }),
        ),
      ),
    );

    component['abrirCadastro']();
    fixture.detectChanges();
    await responderLookupSuperior();

    component['form'].patchValue({
      nome: 'Nova Unidade',
      sigla: 'NOVA4',
      slug: 'nova4',
      codigo: '103',
      tipo: TipoUnidade.faculdade,
      vigenciaInicio: '2026-01-01',
      vigenciaFim: '2025-01-01',
    });

    component['salvar']();
    fixture.detectChanges();

    expect(component['erroDoCampo']('vigenciaFim')).toBe(
      'Fim de vigência deve ser posterior ao início.',
    );
    expect(component['formError']()).toBeNull();

    // "No campo correspondente" é posicional: não basta existir um `.field__error`
    // na tela, ele tem de estar no rótulo do próprio `vigenciaFim`.
    const compiled = fixture.nativeElement as HTMLElement;
    const erroInline = compiled
      .querySelector('input[formcontrolname="vigenciaFim"]')
      ?.closest('label')
      ?.querySelector('.field__error');
    expect(erroInline?.textContent).toContain('Fim de vigência deve ser posterior ao início.');
    expect(compiled.textContent).not.toContain('Não foi possível salvar');
  });

  it('não envia vigenciaInicio no update — campo read-only na edição', async () => {
    await responderListaUnidades();
    unidadesApiMock.atualizar.mockReturnValue(of(okResult(undefined)));

    component['abrirEdicao'](mockUnidadeFilho);
    fixture.detectChanges();
    await responderLookupSuperior();

    component['salvar']();

    expect(unidadesApiMock.atualizar).toHaveBeenCalled();
    const [, command] = unidadesApiMock.atualizar.mock.calls[0];
    expect('vigenciaInicio' in (command as object)).toBe(false);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();
    const reqReload = httpMock.expectOne((r) => r.url.includes('/api/organizacao/unidades'));
    reqReload.flush({ ok: true, data: [mockUnidadeRaiz] });
    TestBed.flushEffects();
    await Promise.resolve();
    TestBed.flushEffects();
    fixture.detectChanges();
  });

  it('preserva o tipo Pró-Reitoria ao editar, mesmo com variação de acentuação/hífen vinda do backend', async () => {
    const unidadeProReitoria: UnidadeDto = {
      ...mockUnidadeRaiz,
      id: 'u-3',
      sigla: 'PROEG',
      // Backend pode devolver o rótulo sem diacríticos — o casamento com o
      // roster (`normalizarEnumLabel`) precisa sobreviver a isso.
      tipo: 'Pro-Reitoria' as TipoUnidade,
    };
    await responderListaUnidades([unidadeProReitoria]);

    component['abrirEdicao'](unidadeProReitoria);
    fixture.detectChanges();
    await responderLookupSuperior();

    expect(component['form'].controls.tipo.value).toBe(TipoUnidade.proReitoria);
    expect(component['tipoNaoReconhecido']()).toBe(false);
  });

  it('bloqueia o submit quando o tipo da unidade não casa com o roster conhecido', async () => {
    const unidadeTipoDesconhecido: UnidadeDto = {
      ...mockUnidadeFilho,
      tipo: 'TipoInexistente' as TipoUnidade,
    };
    await responderListaUnidades([mockUnidadeRaiz, unidadeTipoDesconhecido]);

    component['abrirEdicao'](unidadeTipoDesconhecido);
    fixture.detectChanges();
    await responderLookupSuperior();

    expect(component['tipoNaoReconhecido']()).toBe(true);
    expect(component['form'].invalid).toBe(true);

    component['salvar']();

    expect(unidadesApiMock.atualizar).not.toHaveBeenCalled();
  });

  it('busca de unidade superior usa q server-side, achando unidades fora da primeira página', async () => {
    vi.useFakeTimers();
    await responderListaUnidades();

    component['abrirCadastro']();
    fixture.detectChanges();
    await responderLookupSuperior([mockUnidadeRaiz]);

    const unidadeForaDaPagina: UnidadeDto = {
      ...mockUnidadeFilho,
      id: 'u-99',
      sigla: 'FORA',
      nome: 'Fora da Primeira Página',
    };

    component['buscaPai'].set('fora');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(300);
    fixture.detectChanges();
    TestBed.flushEffects();

    const req = httpMock.expectOne(
      (r) => r.url.includes('/api/organizacao/unidades') && r.params.get('q') === 'fora',
    );
    expect(req.request.params.get('limit')).toBe('100');
    req.flush({ ok: true, data: [unidadeForaDaPagina] });

    TestBed.flushEffects();
    await Promise.resolve();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(component['opcoesUnidadeSuperior']()).toEqual([unidadeForaDaPagina]);
  });

  it('permite retry quando a carga das opções de unidade superior falha', async () => {
    await responderListaUnidades();

    component['abrirCadastro']();
    fixture.detectChanges();
    TestBed.flushEffects();

    const req = httpMock.expectOne((r) => r.url.includes('/api/organizacao/unidades'));
    reqFlushErro(req);

    TestBed.flushEffects();
    await Promise.resolve();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(component['opcoesSuperiorComErro']()).toBe(true);

    component['recarregarOpcoesSuperior']();
    fixture.detectChanges();
    TestBed.flushEffects();

    const reqRetry = httpMock.expectOne((r) => r.url.includes('/api/organizacao/unidades'));
    reqRetry.flush({ ok: true, data: [mockUnidadeRaiz] });

    TestBed.flushEffects();
    await Promise.resolve();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(component['opcoesSuperiorComErro']()).toBe(false);
    expect(component['opcoesUnidadeSuperior']()).toEqual([mockUnidadeRaiz]);
  });

  it('reabrir o formulário não reusa a busca de unidade superior da abertura anterior', async () => {
    vi.useFakeTimers();
    await responderListaUnidades();

    component['abrirCadastro']();
    fixture.detectChanges();
    await responderLookupSuperior();

    component['buscaPai'].set('reitoria');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(300);
    fixture.detectChanges();
    TestBed.flushEffects();

    const reqComTermo = httpMock.expectOne(
      (r) => r.url.includes('/api/organizacao/unidades') && r.params.get('q') === 'reitoria',
    );
    reqComTermo.flush({ ok: true, data: [mockUnidadeRaiz] });
    TestBed.flushEffects();
    await Promise.resolve();
    TestBed.flushEffects();
    fixture.detectChanges();

    // Fecha sem salvar e reabre o cadastro — o reset de `buscaPai` é síncrono
    // (não espera o debounce), senão a reabertura reenviaria `?q=reitoria`.
    component['formOpen'].set(false);
    component['abrirCadastro']();
    fixture.detectChanges();
    TestBed.flushEffects();

    expect(component['buscaPai']()).toBe('');

    const reqReabertura = httpMock.expectOne((r) => r.url.includes('/api/organizacao/unidades'));
    expect(reqReabertura.request.params.has('q')).toBe(false);
    reqReabertura.flush({ ok: true, data: [mockUnidadeRaiz] });

    TestBed.flushEffects();
    await Promise.resolve();
    TestBed.flushEffects();
    fixture.detectChanges();
  });

  it('não afirma "nenhuma cidade encontrada" antes do debounce disparar', async () => {
    vi.useFakeTimers();
    await responderListaUnidades();

    component['abrirCadastro']();
    fixture.detectChanges();
    await responderLookupSuperior();

    component['buscaCidade'].set('Marabá');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(290);

    expect(component['buscaCidadeSemResultado']()).toBe(false);
  });

  it('não afirma "nenhuma cidade encontrada" ao rebuscar termo que já devolveu resultado', async () => {
    vi.useFakeTimers();
    await responderListaUnidades();

    component['abrirCadastro']();
    fixture.detectChanges();
    await responderLookupSuperior();

    geoApiMock.listarCidades.mockReturnValueOnce(
      of(okResult([{ id: 'cid-1504208', codigoIbge: '1504208', nome: 'Marabá', uf: 'PA', ddd: null }])),
    );

    component['buscaCidade'].set('Marabá');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(300);

    expect(component['buscaCidadeSemResultado']()).toBe(false);
    expect(component['cidadeOpcoes']().length).toBeGreaterThan(0);
  });

  it('avisa "nenhuma cidade encontrada" quando de fato não há resultado', async () => {
    vi.useFakeTimers();
    await responderListaUnidades();

    component['abrirCadastro']();
    fixture.detectChanges();
    await responderLookupSuperior();

    geoApiMock.listarCidades.mockReturnValueOnce(of(okResult([])));

    component['buscaCidade'].set('Xyzxyz');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(300);

    expect(component['buscaCidadeSemResultado']()).toBe(true);
  });

  it('primeira página da listagem principal usa limit=100', async () => {
    fixture.detectChanges();
    TestBed.flushEffects();

    const req = httpMock.expectOne((r) => r.url.includes('/api/organizacao/unidades'));
    expect(req.request.params.get('limit')).toBe('100');
    req.flush({ ok: true, data: [] });

    TestBed.flushEffects();
    await Promise.resolve();
    TestBed.flushEffects();
    fixture.detectChanges();
  });
});
