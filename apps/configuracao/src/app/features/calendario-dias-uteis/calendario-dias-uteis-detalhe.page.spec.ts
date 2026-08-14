import { ApplicationRef } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { apiResultInterceptor, mockProblemDetails } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Subject } from 'rxjs';

import { CalendarioDiasUteisDetalhePage } from './calendario-dias-uteis-detalhe.page';

const BASE = 'http://localhost:5000';
const CALENDARIO_ID = '019f41cf-69fd-759a-ac6d-09acabc1b027';
const URL = `${BASE}/api/configuracao/calendarios-dias-uteis/${CALENDARIO_ID}`;

const DIA_MUNICIPAL = {
  id: '019f41cf-69fd-759a-ac6d-09acabc1b100',
  abrangencia: 'MUNICIPAL',
  municipioIbge: '1504208',
  municipioNome: 'Marabá',
  municipioUf: 'PA',
  uf: null,
  data: '2026-04-05',
  descricao: 'Aniversário de Marabá',
};

const DIA_ESTADUAL = {
  id: '019f41cf-69fd-759a-ac6d-09acabc1b101',
  abrangencia: 'ESTADUAL',
  municipioIbge: null,
  municipioNome: null,
  municipioUf: null,
  uf: 'PA',
  data: '2026-08-15',
  descricao: 'Adesão do Grão-Pará à Independência',
};

const DIA_NACIONAL_JANEIRO = {
  id: '019f41cf-69fd-759a-ac6d-09acabc1b102',
  abrangencia: 'NACIONAL',
  municipioIbge: null,
  municipioNome: null,
  municipioUf: null,
  uf: null,
  data: '2027-01-01',
  descricao: 'Confraternização Universal',
};

describe('CalendarioDiasUteisDetalhePage', () => {
  let fixture: ComponentFixture<CalendarioDiasUteisDetalhePage>;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;
  let routeParams$: Subject<{ id: string }>;

  beforeEach(() => {
    routeParams$ = new Subject<{ id: string }>();
    TestBed.configureTestingModule({
      imports: [CalendarioDiasUteisDetalhePage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ id: CALENDARIO_ID }) },
            params: routeParams$,
          },
        },
      ],
      // GEO_BASE_PATH deliberadamente ausente: se a página injetasse a GeoApi,
      // o TestBed falharia em criar o componente (ADR-0090 — a localidade
      // persistida é lida do snapshot, sem consultar a Geo).
    });
    fixture = TestBed.createComponent(CalendarioDiasUteisDetalhePage);
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const propagate = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
  };

  const carregar = async (diasNaoUteis: readonly unknown[], vigente = false): Promise<void> => {
    controller.expectOne(URL).flush({
      id: CALENDARIO_ID,
      versaoDataset: '2026.1',
      vigente,
      criadoEm: '2026-08-13T00:00:00Z',
      diasNaoUteis,
    });
    await propagate();
  };

  const botaoDoDia = (data: string): HTMLButtonElement => {
    const botao = (fixture.nativeElement as HTMLElement).querySelector(
      `button[aria-label*="${data.split('-')[2].replace(/^0/, '')} de "]`,
    );
    if (!botao) throw new Error(`Nenhum botão de dia encontrado para ${data}`);
    return botao as HTMLButtonElement;
  };

  it('exibe erro de carregamento e permite tentar novamente', async () => {
    controller
      .expectOne(URL)
      .flush(mockProblemDetails({ status: 404, title: 'Calendário não encontrado' }), {
        status: 404,
        statusText: 'Not Found',
        headers: { 'Content-Type': 'application/problem+json' },
      });
    await propagate();

    expect(fixture.nativeElement.textContent).toContain('Calendário não encontrado');
    expect(fixture.nativeElement.querySelector('.cfg-calendario-resumo')).toBeNull();

    const retry = fixture.nativeElement.querySelector(
      '.cfg-calendario-dias-uteis__retry button',
    ) as HTMLButtonElement;
    retry.click();
    fixture.detectChanges();

    await carregar([]);

    expect(fixture.nativeElement.textContent).toContain('2026.1');
  });

  it('não renderiza controles de formulário para o dataset (CA-01)', async () => {
    await carregar([DIA_MUNICIPAL, DIA_ESTADUAL]);

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelectorAll('input')).toHaveLength(0);
    expect(raiz.querySelectorAll('select')).toHaveLength(0);
    expect(raiz.querySelectorAll('textarea')).toHaveLength(0);
  });

  it('apresenta versão, situação de vigência e total de dias não úteis no resumo (CA-02)', async () => {
    await carregar([DIA_MUNICIPAL, DIA_ESTADUAL], true);

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('2026.1');
    expect(texto).toContain('Vigente');
  });

  it('conta datas civis únicas no resumo, não ocorrências (CA-02)', async () => {
    const segunda_ocorrencia_mesmo_dia = { ...DIA_MUNICIPAL, id: 'outro-id', abrangencia: 'INSTITUCIONAL' };
    await carregar([DIA_MUNICIPAL, segunda_ocorrencia_mesmo_dia, DIA_ESTADUAL]);

    const resumo = fixture.nativeElement.querySelector('.cfg-calendario-resumo') as HTMLElement;
    expect(resumo.textContent).toContain('2');
    expect(resumo.textContent).not.toContain('3');
  });

  it('exibe só os meses com feriado, em ordem cronológica, mesmo atravessando anos (CA-03)', async () => {
    await carregar([DIA_ESTADUAL, DIA_NACIONAL_JANEIRO]);

    const titulos = [...fixture.nativeElement.querySelectorAll('.cfg-calendario-mensal__titulo')].map(
      (elemento: Element) => elemento.textContent?.trim(),
    );
    expect(titulos).toEqual(['Agosto de 2026', 'Janeiro de 2027']);
  });

  it('abre o drawer com heading e conteúdo do dia ao ativar o botão (CA-07)', async () => {
    await carregar([DIA_MUNICIPAL]);

    botaoDoDia(DIA_MUNICIPAL.data).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.drawerVisivel()).toBe(true);
    const dialogo = fixture.nativeElement.querySelector('dialog') as HTMLElement;
    expect(dialogo.getAttribute('aria-label')).toBe('5 de abril de 2026');
    expect(dialogo.textContent).toContain('Aniversário de Marabá');
  });

  it('lista todas as ocorrências quando há mais de um feriado na mesma data (CA-09)', async () => {
    const segunda_ocorrencia = {
      ...DIA_MUNICIPAL,
      id: 'segunda-ocorrencia',
      abrangencia: 'INSTITUCIONAL',
      descricao: 'Aniversário da Unifesspa',
    };
    await carregar([DIA_MUNICIPAL, segunda_ocorrencia]);

    const botao = botaoDoDia(DIA_MUNICIPAL.data);
    expect(botao.textContent).toContain('×2');

    botao.click();
    fixture.detectChanges();

    const dialogo = fixture.nativeElement.querySelector('dialog') as HTMLElement;
    expect(dialogo.querySelectorAll('.cfg-calendario-mensal__ocorrencia')).toHaveLength(2);
    expect(dialogo.textContent).toContain('Aniversário de Marabá');
    expect(dialogo.textContent).toContain('Aniversário da Unifesspa');
  });

  it('apresenta o município pelo snapshot persistido, com o código IBGE como apoio', async () => {
    await carregar([DIA_MUNICIPAL]);

    botaoDoDia(DIA_MUNICIPAL.data).click();
    fixture.detectChanges();

    const texto = fixture.nativeElement.querySelector('dialog')?.textContent as string;
    expect(texto).toContain('Marabá — PA');
    expect(texto).toContain('Código IBGE: 1504208');
    // Nenhuma requisição à Geo: `controller.verify()` no afterEach falharia.
    controller.expectNone((request) => request.url.includes('/api/cidades'));
  });

  it('não escreve "null" quando o dia municipal é anterior ao snapshot', async () => {
    await carregar([{ ...DIA_MUNICIPAL, municipioNome: null, municipioUf: null }]);

    botaoDoDia(DIA_MUNICIPAL.data).click();
    fixture.detectChanges();

    const texto = fixture.nativeElement.querySelector('dialog')?.textContent as string;
    expect(texto).not.toContain('null');
    expect(texto).toContain('Código IBGE: 1504208');
  });

  it('apresenta a abrangência estadual com a UF por extenso', async () => {
    await carregar([DIA_ESTADUAL]);

    botaoDoDia(DIA_ESTADUAL.data).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('dialog')?.textContent).toContain('Pará — PA');
  });

  it('fecha a prévia junto com o drawer, evitando que a restauração de foco a reabra (CA-06/CA-08)', async () => {
    await carregar([DIA_MUNICIPAL]);

    const botao = botaoDoDia(DIA_MUNICIPAL.data);
    botao.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.drawerVisivel()).toBe(true);

    // O clique também foca o botão (evento nativo do navegador), então a
    // prévia liga junto com a abertura — não é o cenário deste teste.
    fixture.componentInstance.mostrarPreview(DIA_MUNICIPAL.data);
    fixture.detectChanges();
    expect(fixture.componentInstance.diaEmPreview()).toBe(DIA_MUNICIPAL.data);

    const botaoFechar = fixture.nativeElement.querySelector(
      '.uni-drawer__header button',
    ) as HTMLButtonElement;
    botaoFechar.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.diaEmPreview()).toBeNull();
  });

  it('não expõe abrangência como token técnico cru (CA-10)', async () => {
    await carregar([DIA_ESTADUAL]);

    botaoDoDia(DIA_ESTADUAL.data).click();
    fixture.detectChanges();

    const texto = fixture.nativeElement.querySelector('dialog')?.textContent as string;
    expect(texto).toContain('Estadual');
    expect(texto).not.toContain('ESTADUAL');
  });

  it('reseta o drawer ao trocar de rota :id sem passar pela lista (reaproveitamento de componente pelo Router)', async () => {
    await carregar([DIA_MUNICIPAL]);

    botaoDoDia(DIA_MUNICIPAL.data).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.drawerVisivel()).toBe(true);

    const OUTRO_ID = '019f41cf-69fd-759a-ac6d-09acabc1b999';
    routeParams$.next({ id: OUTRO_ID });
    fixture.detectChanges();

    expect(fixture.componentInstance.drawerVisivel()).toBe(false);
    expect(fixture.componentInstance.diaSelecionado()).toBeNull();

    controller.expectOne(`${BASE}/api/configuracao/calendarios-dias-uteis/${OUTRO_ID}`).flush({
      id: OUTRO_ID,
      versaoDataset: '2027.1',
      vigente: false,
      criadoEm: '2026-08-13T00:00:00Z',
      diasNaoUteis: [DIA_ESTADUAL],
    });
    await propagate();

    // O drawer não reabre sozinho com o dia do calendário anterior.
    expect(fixture.componentInstance.drawerVisivel()).toBe(false);
    expect(fixture.nativeElement.querySelector('dialog[open]')).toBeNull();
  });
});
