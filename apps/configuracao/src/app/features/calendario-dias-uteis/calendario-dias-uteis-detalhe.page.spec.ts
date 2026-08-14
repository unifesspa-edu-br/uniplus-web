import { ApplicationRef } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { apiResultInterceptor, mockProblemDetails } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { of } from 'rxjs';

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

describe('CalendarioDiasUteisDetalhePage', () => {
  let fixture: ComponentFixture<CalendarioDiasUteisDetalhePage>;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
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
            params: of({ id: CALENDARIO_ID }),
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

  const carregar = async (diasNaoUteis: readonly unknown[]): Promise<void> => {
    controller.expectOne(URL).flush({
      id: CALENDARIO_ID,
      versaoDataset: '2026.1',
      vigente: false,
      criadoEm: '2026-08-13T00:00:00Z',
      diasNaoUteis,
    });
    await propagate();
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
    expect(fixture.nativeElement.querySelector('section.form-section')).toBeNull();

    const retry = fixture.nativeElement.querySelector(
      '.cfg-calendario-dias-uteis__retry button',
    ) as HTMLButtonElement;
    retry.click();
    fixture.detectChanges();

    await carregar([]);

    expect((fixture.nativeElement.querySelector('input') as HTMLInputElement).value).toBe('2026.1');
  });

  it('apresenta o município pelo snapshot persistido, com o código IBGE como apoio', async () => {
    await carregar([DIA_MUNICIPAL]);

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Marabá — PA');
    expect(texto).toContain('Código IBGE: 1504208');
    // Nenhuma requisição à Geo: `controller.verify()` no afterEach falharia.
    controller.expectNone((request) => request.url.includes('/api/cidades'));
  });

  it('não escreve "null" quando o dia municipal é anterior ao snapshot', async () => {
    await carregar([{ ...DIA_MUNICIPAL, municipioNome: null, municipioUf: null }]);

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).not.toContain('null');
    expect(texto).toContain('Código IBGE: 1504208');
  });

  it('apresenta a abrangência estadual com a UF por extenso', async () => {
    await carregar([DIA_ESTADUAL]);

    expect(fixture.nativeElement.textContent).toContain('Pará — PA');
  });

  it('não usa controles de formulário para exibir a localidade', async () => {
    await carregar([DIA_MUNICIPAL, DIA_ESTADUAL]);

    const saidas = fixture.nativeElement.querySelectorAll('output.field__readonly');
    expect(saidas).toHaveLength(2);
    expect(fixture.nativeElement.querySelectorAll('input[type="text"]')).toHaveLength(1);
  });
});
