import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
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
        { provide: GEO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(CalendarioDiasUteisNovoPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  function adicionarDia(abrangencia = 'NACIONAL', data = '2026-09-07'): number {
    component['adicionaNovoDiaNaoUtilFormGroup']();
    const index = component['form'].controls.diasNaoUteis.length - 1;
    const grupo = component['form'].controls.diasNaoUteis.at(index);
    grupo.controls.abrangencia.setValue(abrangencia);
    component['mudaAbrangencia'](index);
    grupo.controls.data.setValue(data);
    grupo.controls.descricao.setValue('Independência do Brasil');
    fixture.detectChanges();
    return index;
  }

  it('valida client-side quando tenta salvar sem dia não util', async () => {
    component['form'].controls.versaoDataset.setValue('2026.1');
    component['salvar']();

    controller.expectNone(`${BASE}/api/configuracao/admin/calendarios-dias-uteis`);
  });

  it('inicia nova linha como estadual com Pará e municipal com Marabá', () => {
    component['adicionaNovoDiaNaoUtilFormGroup']();
    const grupo = component['form'].controls.diasNaoUteis.at(0);

    expect(grupo.controls.abrangencia.value).toBe('ESTADUAL');
    expect(grupo.controls.uf.value).toBe('PA');

    grupo.controls.abrangencia.setValue('MUNICIPAL');
    component['mudaAbrangencia'](0);

    expect(grupo.controls.uf.value).toBe('PA');
    expect(grupo.controls.codigoMunicipio.value).toBe('1504208');
    expect(grupo.controls.buscaMunicipio.value).toBe('Marabá');
    expect(component['municipioSelecionado'](0)).toMatchObject({
      codigoIbge: '1504208',
      nome: 'Marabá',
      uf: 'PA',
    });
  });

  it('mantém o formulário inválido quando a seleção municipal é removida', () => {
    component['form'].controls.versaoDataset.setValue('2026.1');
    adicionarDia('MUNICIPAL');

    const municipio = component['form'].controls.diasNaoUteis.at(0).controls.codigoMunicipio;
    municipio.setValue('');

    expect(municipio.invalid).toBe(true);
    expect(component['form'].invalid).toBe(true);
  });

  it('rejeita código municipal cujo prefixo não corresponde a uma UF', () => {
    component['form'].controls.versaoDataset.setValue('2026.1');
    adicionarDia('MUNICIPAL');

    const municipio = component['form'].controls.diasNaoUteis.at(0).controls.codigoMunicipio;
    municipio.setValue('9904208');
    expect(municipio.invalid).toBe(true);

    municipio.setValue('1504208');
    expect(municipio.valid).toBe(true);
  });

  it('limpa os campos regionais ao mudar para abrangência nacional', () => {
    adicionarDia('MUNICIPAL');
    const grupo = component['form'].controls.diasNaoUteis.at(0);
    grupo.controls.codigoMunicipio.setValue('1504208');

    grupo.controls.abrangencia.setValue('NACIONAL');
    component['mudaAbrangencia'](0);

    expect(grupo.controls.codigoMunicipio.value).toBe('');
    expect(grupo.controls.uf.value).toBe('');
    expect(grupo.controls.buscaMunicipio.value).toBe('');
    expect(grupo.controls.codigoMunicipio.validator).toBeNull();
  });

  it('pesquisa municípios pelo nome e pela UF usando a API Geo', async () => {
    adicionarDia('MUNICIPAL');
    const grupo = component['form'].controls.diasNaoUteis.at(0);

    component['buscarMunicipios'](0, 'Parauapebas');
    await new Promise((resolve) => setTimeout(resolve, 350));

    const req = controller.expectOne((request) => request.url === `${BASE}/api/cidades`);
    expect(req.request.params.get('uf')).toBe('PA');
    expect(req.request.params.get('q')).toBe('Parauapebas');
    expect(req.request.params.get('limit')).toBe('20');
    req.flush([
      {
        id: 'cidade-parauapebas',
        codigoIbge: '1505536',
        nome: 'Parauapebas',
        uf: 'PA',
        ddd: '94',
      },
    ]);
    fixture.detectChanges();

    expect(component['estadoBuscaMunicipio'](0).opcoes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codigoIbge: '1505536', nome: 'Parauapebas', uf: 'PA' }),
      ]),
    );
    grupo.controls.codigoMunicipio.setValue('1505536');
    component['selecionarMunicipio'](0);
    expect(grupo.controls.buscaMunicipio.value).toBe('Parauapebas');
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

  it('envia somente o código IBGE selecionado na abrangência municipal', () => {
    component['form'].controls.versaoDataset.setValue('2026.1');
    adicionarDia('MUNICIPAL');
    component['salvar']();

    const req = controller.expectOne(`${BASE}/api/configuracao/admin/calendarios-dias-uteis`);
    expect(req.request.body.diasNaoUteis[0]).toMatchObject({
      abrangencia: 'MUNICIPAL',
      municipioIbge: '1504208',
      uf: null,
    });
    req.flush(mockProblemDetails({ status: 422, code: 'uniplus.test.validation' }), {
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: { 'Content-Type': 'application/problem+json' },
    });
  });

  it('permite a mesma data em abrangências diferentes', () => {
    component['form'].controls.versaoDataset.setValue('2026.1');
    adicionarDia('NACIONAL');
    adicionarDia('INSTITUCIONAL');

    const dias = component['form'].controls.diasNaoUteis;
    expect(dias.at(0).controls.data.errors?.['dataDuplicada']).toBeUndefined();
    expect(dias.at(1).controls.data.errors?.['dataDuplicada']).toBeUndefined();
    expect(component['form'].valid).toBe(true);
  });

  it('remove a duplicidade de ambas as linhas quando uma delas é corrigida', () => {
    component['form'].controls.versaoDataset.setValue('2026.1');
    adicionarDia('NACIONAL');
    adicionarDia('NACIONAL');

    const dias = component['form'].controls.diasNaoUteis;
    dias.at(0).controls.data.markAsTouched();
    dias.at(1).controls.data.markAsTouched();
    expect(dias.errors?.['dataDuplicada']).toBe(true);
    expect(component['erroDoCampoDiasNaoUteis']('data', 0)).toContain('duplicada');
    expect(component['erroDoCampoDiasNaoUteis']('data', 1)).toContain('duplicada');
    expect(component['form'].invalid).toBe(true);

    dias.at(1).controls.data.setValue('2026-09-08');

    expect(dias.errors?.['dataDuplicada']).toBeUndefined();
    expect(component['erroDoCampoDiasNaoUteis']('data', 0)).toBeNull();
    expect(component['erroDoCampoDiasNaoUteis']('data', 1)).toBeNull();
    expect(component['form'].valid).toBe(true);
  });

  it('associa erro de município à linha municipal com a mesma data', async () => {
    component['form'].controls.versaoDataset.setValue('2026.1');
    adicionarDia('NACIONAL');
    const municipalIndex = adicionarDia('MUNICIPAL');
    component['form'].controls.diasNaoUteis
      .at(municipalIndex)
      .controls.codigoMunicipio.setValue('1504208');
    component['salvar']();

    const req = controller.expectOne(`${BASE}/api/configuracao/admin/calendarios-dias-uteis`);
    req.flush(
      mockProblemDetails({
        status: 422,
        code: 'uniplus.configuracao.calendario_dias_uteis.municipio_ibge_formato_invalido',
        title: 'Código IBGE inválido',
        detail: 'Código IBGE inválido (data 2026-09-07)',
      }),
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );
    await Promise.resolve();
    const dias = component['form'].controls.diasNaoUteis;
    expect(dias.at(0).controls.codigoMunicipio.errors?.['backend']).toBeUndefined();
    expect(dias.at(municipalIndex).controls.codigoMunicipio.errors?.['backend']).toMatchObject({
      code: 'uniplus.configuracao.calendario_dias_uteis.municipio_ibge_formato_invalido',
    });
  });

  it('bloqueia textos obrigatórios compostos apenas por espaços', () => {
    component['form'].controls.versaoDataset.setValue('   ');
    adicionarDia();
    const descricao = component['form'].controls.diasNaoUteis.at(0).controls.descricao;
    descricao.setValue('   ');

    expect(component['form'].controls.versaoDataset.errors?.['required']).toBe(true);
    expect(descricao.errors?.['required']).toBe(true);
    component['salvar']();
    controller.expectNone(`${BASE}/api/configuracao/admin/calendarios-dias-uteis`);
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
