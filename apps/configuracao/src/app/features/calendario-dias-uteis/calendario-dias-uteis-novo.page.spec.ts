import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { apiResultInterceptor, mockProblemDetails } from '@uniplus/shared-core/http';
import { CalendarioDiasUteisNovoPage } from './calendario-dias-uteis-novo.page';

const BASE = 'http://localhost:5000';

describe('CalendarioDiasUteisNovoPage', async () => {
  let fixture: ComponentFixture<CalendarioDiasUteisNovoPage>;
  let component: CalendarioDiasUteisNovoPage;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CalendarioDiasUteisNovoPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(CalendarioDiasUteisNovoPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  function adicionarDia(abrangencia = 'NACIONAL'): void {
    component['adicionaNovoDiaNaoUtilFormGroup']();
    const grupo = component['form'].controls.diasNaoUteis.at(0);
    grupo.controls.abrangencia.setValue(abrangencia);
    component['mudaAbrangencia'](0);
    grupo.controls.data.setValue('2026-09-07');
    grupo.controls.descricao.setValue('Independência do Brasil');
    fixture.detectChanges();
  }

  it('valida client-side quando tenta salvar sem dia não util', async () => {
    component['form'].controls.versaoDataset.setValue('2026.1');
    component['salvar']();

    controller.expectNone(`${BASE}/api/configuracao/admin/calendarios-dias-uteis`);
  });

  it('mantém o formulário inválido enquanto o código municipal obrigatório está vazio', () => {
    component['form'].controls.versaoDataset.setValue('2026.1');
    adicionarDia('MUNICIPAL');

    const grupo = component['form'].controls.diasNaoUteis.at(0);
    expect(grupo.controls.codigoMunicipio.invalid).toBe(true);
    expect(component['form'].invalid).toBe(true);

    grupo.controls.codigoMunicipio.setValue('1504208');
    expect(component['form'].valid).toBe(true);
  });

  it('limpa os campos regionais ao mudar para abrangência nacional', () => {
    adicionarDia('MUNICIPAL');
    const grupo = component['form'].controls.diasNaoUteis.at(0);
    grupo.controls.codigoMunicipio.setValue('1504208');

    grupo.controls.abrangencia.setValue('NACIONAL');
    component['mudaAbrangencia'](0);

    expect(grupo.controls.codigoMunicipio.value).toBe('');
    expect(grupo.controls.uf.value).toBe('');
    expect(grupo.controls.codigoMunicipio.validator).toBeNull();
  });

  it('envia nulo nos campos regionais que não se aplicam', () => {
    component['form'].controls.versaoDataset.setValue('2026.1');
    adicionarDia();
    component['salvar']();

    const req = controller.expectOne(`${BASE}/api/configuracao/admin/calendarios-dias-uteis`);
    expect(req.request.body.diasNaoUteis[0]).toMatchObject({
      data: '2026-09-07',
      municipioIbge: null,
      uf: null,
    });
    req.flush(mockProblemDetails({ status: 422, code: 'uniplus.test.validation' }), {
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: { 'Content-Type': 'application/problem+json' },
    });
  });

  it('associa a duplicidade retornada pela API à linha correspondente', async () => {
    component['form'].controls.versaoDataset.setValue('2026.1');
    adicionarDia();
    component['salvar']();

    const req = controller.expectOne(`${BASE}/api/configuracao/admin/calendarios-dias-uteis`);
    req.flush(
      mockProblemDetails({
        status: 422,
        code: 'uniplus.configuracao.calendario_dias_uteis.data_duplicada_no_dataset',
        title: 'Data duplicada no dataset',
        detail: 'Data 2026-09-07 duplicada no dataset.',
      }),
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );
    await Promise.resolve();
    fixture.detectChanges();
    const data = component['form'].controls.diasNaoUteis.at(0).controls.data;
    expect(data.errors?.['backend']).toMatchObject({
      code: 'uniplus.configuracao.calendario_dias_uteis.data_duplicada_no_dataset',
    });
  });

  it('gera IDs únicos e nome acessível para a remoção de cada linha', () => {
    adicionarDia();
    component['adicionaNovoDiaNaoUtilFormGroup']();
    fixture.detectChanges();

    const selects = fixture.nativeElement.querySelectorAll('select[id^="abrangencia-"]');
    expect(selects[0].id).toBe('abrangencia-0');
    expect(selects[1].id).toBe('abrangencia-1');
    expect(
      fixture.nativeElement.querySelector('[aria-label="Remover dia não útil 1"]'),
    ).not.toBeNull();
  });
});
