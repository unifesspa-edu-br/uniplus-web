import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ProblemI18nService } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { GeoApi } from '@uniplus/shared-data/geo';
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

  /**
   * Responde a requisição principal da lista de unidades.
   */
  async function responderListaUnidades(
    unidades: UnidadeDto[] = [mockUnidadeRaiz, mockUnidadeFilho],
  ) {
    fixture.detectChanges();
    TestBed.flushEffects();

    const req = httpMock.expectOne((r) => r.url.includes('/api/organizacao/unidades'));

    req.flush(
      {
        ok: true,
        data: unidades,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Link: '<.../unidades?cursor=next_123&direction=next>; rel="next"',
        },
      },
    );

    TestBed.flushEffects();

    await Promise.resolve();

    TestBed.flushEffects();
    fixture.detectChanges();
  }

  /**
   * Responde à requisição usada para buscar unidades superiores
   * durante o cadastro/edição.
   */
  async function responderLookupSuperior(unidades: UnidadeDto[] = [mockUnidadeRaiz]) {
    fixture.detectChanges();
    TestBed.flushEffects();

    const req = httpMock.expectOne((r) => r.url.includes('/api/organizacao/unidades'));

    req.flush(
      {
        ok: true,
        data: unidades,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    TestBed.flushEffects();

    await Promise.resolve();

    TestBed.flushEffects();
    fixture.detectChanges();
  }

  it('deve carregar e renderizar a árvore de unidades organizadas hierarquicamente', async () => {
    await responderListaUnidades();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('REIT');
    expect(compiled.textContent).toContain('Reitoria');

    // A árvore inicia recolhida; expande a raiz para validar o filho.
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

  it('deve exibir o botão Nova unidade', async () => {
    await responderListaUnidades();

    const compiled = fixture.nativeElement as HTMLElement;

    const botoes = Array.from(compiled.querySelectorAll('button'));

    const botaoNovaUnidade = botoes.find((button) => button.textContent?.includes('Nova unidade'));

    expect(botaoNovaUnidade).toBeDefined();
  });

  it('deve exibir Nova unidade mesmo quando não houver unidades cadastradas', async () => {
    await responderListaUnidades([]);

    const compiled = fixture.nativeElement as HTMLElement;

    const botoes = Array.from(compiled.querySelectorAll('button'));

    const botaoNovaUnidade = botoes.find((button) => button.textContent?.includes('Nova unidade'));

    expect(botaoNovaUnidade).toBeDefined();
  });

  it('deve exibir Editar e Remover para cada unidade da árvore', async () => {
    await responderListaUnidades();

    const compiled = fixture.nativeElement as HTMLElement;

    const toggleRaiz = compiled.querySelector(
      '.unit-tree > .unit-node > .unit-node__row .unit-node__toggle',
    ) as HTMLButtonElement | null;

    expect(toggleRaiz).not.toBeNull();

    toggleRaiz!.click();

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    const tree = compiled.querySelector('.unit-tree');

    expect(tree).not.toBeNull();

    const botoesEditar = tree!.querySelectorAll(
      '.unit-node__actions button[aria-label^="Editar unidade"]',
    );

    const botoesRemover = tree!.querySelectorAll(
      '.unit-node__actions button[aria-label^="Remover unidade"]',
    );

    expect(botoesEditar).toHaveLength(2);
    expect(botoesRemover).toHaveLength(2);
  });

  it('deve permitir expandir e recolher um nó com filhos', async () => {
    await responderListaUnidades();

    const compiled = fixture.nativeElement as HTMLElement;

    const toggle = compiled.querySelector('.unit-node__toggle') as HTMLButtonElement | null;

    expect(toggle).not.toBeNull();

    expect(toggle?.getAttribute('aria-expanded')).toBe('false');

    toggle?.click();

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(toggle?.getAttribute('aria-expanded')).toBe('true');

    toggle?.click();

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
  });

  it('deve expor aria-expanded no controle de expansão', async () => {
    await responderListaUnidades();

    const compiled = fixture.nativeElement as HTMLElement;

    const toggle = compiled.querySelector('.unit-node__toggle') as HTMLButtonElement | null;

    expect(toggle).not.toBeNull();
    expect(toggle?.hasAttribute('aria-expanded')).toBe(true);
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
  });

  it('deve permitir expandir e recolher pelo teclado', async () => {
    await responderListaUnidades();

    const compiled = fixture.nativeElement as HTMLElement;

    const row = compiled.querySelector('.unit-node__row') as HTMLElement | null;

    expect(row).not.toBeNull();

    row?.dispatchEvent(
      new KeyboardEvent('keyup', {
        key: 'Enter',
        bubbles: true,
      }),
    );

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    const toggle = compiled.querySelector('.unit-node__toggle') as HTMLButtonElement | null;

    expect(toggle).not.toBeNull();
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');

    row?.dispatchEvent(
      new KeyboardEvent('keyup', {
        key: ' ',
        bubbles: true,
      }),
    );

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
  });

  it('não deve exibir controle de expansão para unidade folha', async () => {
      await responderListaUnidades();

      const compiled = fixture.nativeElement as HTMLElement;

      // A raiz começa recolhida.
      const toggleRaiz = compiled.querySelector(
        '.unit-tree > .unit-node > .unit-node__row .unit-node__toggle',
      ) as HTMLButtonElement | null;

      expect(toggleRaiz).not.toBeNull();

      // Expande a Reitoria para tornar o ICE visível.
      toggleRaiz!.click();

      fixture.detectChanges();
      TestBed.flushEffects();
      fixture.detectChanges();

      const nodes = Array.from(compiled.querySelectorAll('.unit-tree > .unit-node'));

      expect(nodes).toHaveLength(1);

      const nodeRaiz = nodes[0] as HTMLElement;

      const nodeFilho = nodeRaiz.querySelector(
        ':scope > .unit-node__children > .unit-node',
      ) as HTMLElement | null;

      expect(nodeFilho).not.toBeNull();

      // A raiz possui filho e, portanto, possui controle de expansão.
      expect(nodeRaiz.querySelector(':scope > .unit-node__row .unit-node__toggle')).not.toBeNull();

      // O ICE é folha e não possui controle de expansão.
      expect(nodeFilho!.querySelector(':scope > .unit-node__row .unit-node__toggle')).toBeNull();

      // Folha utiliza o ícone estático.
      expect(nodeFilho!.querySelector(':scope > .unit-node__row .unit-node__icon')).not.toBeNull();
  });

  it('deve solicitar remoção da unidade correta', async () => {
    await responderListaUnidades();

    const compiled = fixture.nativeElement as HTMLElement;

    const toggleRaiz = compiled.querySelector(
      '.unit-tree > .unit-node > .unit-node__row .unit-node__toggle',
    ) as HTMLButtonElement | null;

    expect(toggleRaiz).not.toBeNull();

    toggleRaiz!.click();

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    const nodeIce = Array.from(compiled.querySelectorAll('.unit-tree .unit-node')).find((node) => {
      const name = node.querySelector('.unit-node__name');
      return name?.textContent?.trim() === 'ICE';
    }) as HTMLElement | undefined;

    expect(nodeIce).toBeDefined();

    const botaoRemoverIce = nodeIce?.querySelector(
      'button[aria-label="Remover unidade ICE"]',
    ) as HTMLButtonElement | null;

    expect(botaoRemoverIce).not.toBeNull();

    botaoRemoverIce!.click();

    fixture.detectChanges();

    expect(component['unidadeParaRemover']()).toEqual(mockUnidadeFilho);
  });

  it('deve processar remoção com sucesso e disparar notificação', async () => {
    await responderListaUnidades();

    unidadesApiMock.remover.mockReturnValue(
      of({
        ok: true,
        data: undefined,
      }),
    );

    component['pedirRemocao'](mockUnidadeFilho);

    component['removerConfirmado']();

    fixture.detectChanges();
    TestBed.flushEffects();

    const reqReload = httpMock.expectOne((r) => r.url.includes('/api/organizacao/unidades'));

    reqReload.flush(
      {
        ok: true,
        data: [mockUnidadeRaiz],
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    TestBed.flushEffects();

    await Promise.resolve();

    TestBed.flushEffects();
    fixture.detectChanges();

    expect(unidadesApiMock.remover).toHaveBeenCalledWith('u-2');

    expect(notificationMock.success).toHaveBeenCalledWith('Unidade removida', 'ICE');
  });

  it('deve realizar busca por cidade com debounce de 300ms e mínimo de 3 caracteres', async () => {
    vi.useFakeTimers();

    await responderListaUnidades();

    component['abrirCadastro']();

    fixture.detectChanges();

    await responderLookupSuperior();

    component['buscaCidade'].set('Ma');

    fixture.detectChanges();
    TestBed.flushEffects();

    await vi.advanceTimersByTimeAsync(300);

    expect(geoApiMock.listarCidades).not.toHaveBeenCalled();

    component['buscaCidade'].set('Marabá');

    fixture.detectChanges();
    TestBed.flushEffects();

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

    fixture.detectChanges();

    expect(component['erroDoCampo']('sigla')).toBe('Sigla já está em uso.');
  });
});
