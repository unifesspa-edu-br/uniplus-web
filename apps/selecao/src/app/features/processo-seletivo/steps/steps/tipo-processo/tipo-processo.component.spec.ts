import { HttpHeaders } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiResult, apiFailure, apiOk } from '@uniplus/shared-core/http';
import {
  TipoProcessoDto,
  TiposProcessoApi,
  TiposProcessoQuery,
} from '@uniplus/shared-data/configuracao';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { TipoProcessoStepComponent } from './tipo-processo.component';

const ID_SISU = '01960000-0000-7000-0000-000000000515';
const ID_MEDICINA = '01960000-0000-7000-0000-000000000516';
const headers = new HttpHeaders();

const tiposSeed: readonly TipoProcessoDto[] = [
  {
    id: ID_SISU,
    codigo: 'SISU',
    nome: 'SiSU',
    descricao: 'Sistema de Seleção Unificada.',
    ativo: true,
    criadoEm: '2026-08-11T12:00:00Z',
  },
  {
    id: ID_MEDICINA,
    codigo: 'MEDICINA',
    nome: 'Medicina',
    descricao: null,
    ativo: true,
    criadoEm: '2026-08-11T12:00:00Z',
  },
];

describe('TipoProcessoStepComponent', () => {
  let fixture: ComponentFixture<TipoProcessoStepComponent>;
  let listar: (query?: TiposProcessoQuery) => Observable<ApiResult<readonly TipoProcessoDto[]>>;

  beforeEach(async () => {
    listar = () => of(apiOk(tiposSeed, 200, headers));
    await TestBed.configureTestingModule({
      imports: [TipoProcessoStepComponent],
      providers: [
        ProcessoSeletivoStore,
        {
          provide: TiposProcessoApi,
          useValue: { listar: (query?: TiposProcessoQuery) => listar(query) },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => fixture?.destroy());

  function montar(): TipoProcessoStepComponent {
    fixture = TestBed.createComponent(TipoProcessoStepComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('exibe os tipos retornados pela API e guarda o UUID selecionado', () => {
    const component = montar();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('SiSU');
    expect(host.textContent).toContain('Medicina');

    const radio = host.querySelector<HTMLInputElement>(`input[value="${ID_SISU}"]`);
    if (radio === null) throw new Error('O card do tipo retornado pela API não foi renderizado.');
    expect(radio.name).toBe('tipo-processo');
    radio.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(component.store.draft().tipoProcesso.selected).toBe(ID_SISU);
  });

  it('percorre todos os cursores next do catálogo antes de exibir os tipos', () => {
    const consultas: Array<TiposProcessoQuery | undefined> = [];
    const headersComProximaPagina = new HttpHeaders({
      Link: '</api/configuracao/tipos-processo?cursor=proxima%2Bpagina&direction=next>; rel="next"',
    });
    listar = (query) => {
      consultas.push(query);
      return consultas.length === 1
        ? of(apiOk([tiposSeed[0]], 200, headersComProximaPagina))
        : of(apiOk([tiposSeed[1]], 200, headers));
    };

    montar();
    const host = fixture.nativeElement as HTMLElement;

    expect(consultas).toEqual([undefined, { cursor: 'proxima+pagina', direction: 'next' }]);
    expect(host.textContent).toContain('SiSU');
    expect(host.textContent).toContain('Medicina');
  });

  it('filtra pelo nome dos tipos retornados pela API', () => {
    montar();
    const host = fixture.nativeElement as HTMLElement;
    const search = host.querySelector<HTMLInputElement>('input[type="search"]');
    if (search === null) throw new Error('Busca de tipos ausente.');

    search.value = 'med';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(host.textContent).toContain('Medicina');
    expect(host.textContent).not.toContain('SiSU');
  });

  it('expõe estado de carregamento enquanto a consulta está pendente', () => {
    const response = new Subject<ApiResult<readonly TipoProcessoDto[]>>();
    listar = () => response.asObservable();

    montar();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Carregando');

    response.next(apiOk(tiposSeed, 200, headers));
    response.complete();
    fixture.detectChanges();
    expect(host.textContent).toContain('SiSU');
  });

  it('expõe estado vazio quando não há tipos ativos', () => {
    listar = () => of(apiOk([], 200, headers));

    montar();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Não há tipos');
  });

  it('permite nova tentativa depois de falha na consulta', () => {
    let attempts = 0;
    listar = () => {
      attempts += 1;
      return attempts === 1
        ? throwError(() => new Error('indisponível'))
        : of(apiOk(tiposSeed, 200, headers));
    };

    montar();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'Não foi possível carregar',
    );

    const retry = host.querySelector<HTMLButtonElement>('button');
    if (retry === null) throw new Error('Ação de nova tentativa ausente.');
    expect(retry.className).toBe('btn btn--secondary');
    retry.click();
    fixture.detectChanges();

    expect(attempts).toBe(2);
    expect(host.textContent).toContain('SiSU');
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it('permite nova tentativa depois de ApiFailure normalizado', () => {
    let attempts = 0;
    listar = () => {
      attempts += 1;
      return attempts === 1
        ? of(
            apiFailure(
              {
                type: 'https://unifesspa-edu-br.github.io/uniplus-developers/erros/uniplus.internal.unexpected',
                title: 'Erro interno do servidor',
                status: 500,
                code: 'uniplus.internal.unexpected',
                traceId: '01960000000070000000000000000515',
              },
              500,
              headers,
            ),
          )
        : of(apiOk(tiposSeed, 200, headers));
    };

    montar();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'Não foi possível carregar',
    );

    const retry = host.querySelector<HTMLButtonElement>('button');
    if (retry === null) throw new Error('Ação de nova tentativa ausente.');
    retry.click();
    fixture.detectChanges();

    expect(attempts).toBe(2);
    expect(host.textContent).toContain('SiSU');
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });
});
