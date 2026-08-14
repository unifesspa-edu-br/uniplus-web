import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';

import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { apiResultInterceptor, mockProblemDetails } from '@uniplus/shared-core/http';
import { CalendarioDiasUteisNovoPage } from './calendario-dias-uteis-novo.page';

const BASE = 'http://localhost:5000';
const MARABA = { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' } as const;
const PARAUAPEBAS = { codigoIbge: '1505536', nome: 'Parauapebas', uf: 'PA' } as const;

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
        // A rota da lista existe para que o redirect pós-criação resolva.
        provideRouter([{ path: 'calendario-dias-uteis', children: [] }]),
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

  /**
   * Percorre o caminho real de seleção: busca na Geo, resposta do serviço e
   * escolha da opção no `<select>`. É o único caminho que grava o snapshot.
   */
  async function selecionarMunicipioViaGeo(
    index: number,
    municipio: { codigoIbge: string; nome: string; uf: string } = MARABA,
  ): Promise<void> {
    component['buscarMunicipios'](index, municipio.nome);
    await new Promise((resolve) => setTimeout(resolve, 350));

    controller
      .expectOne((request) => request.url === `${BASE}/api/cidades`)
      .flush([{ id: `cidade-${municipio.codigoIbge}`, ddd: '94', ...municipio }]);
    fixture.detectChanges();

    component['form'].controls.diasNaoUteis
      .at(index)
      .controls.codigoMunicipio.setValue(municipio.codigoIbge);
    component['selecionarMunicipio'](index);
    fixture.detectChanges();
  }

  it('valida client-side quando tenta salvar sem dia não util', async () => {
    component['form'].controls.versaoDataset.setValue('2026.1');
    component['salvar']();

    controller.expectNone(`${BASE}/api/configuracao/admin/calendarios-dias-uteis`);
  });

  it('inicia nova linha como estadual com Pará e sem município escolhido', () => {
    component['adicionaNovoDiaNaoUtilFormGroup']();
    const grupo = component['form'].controls.diasNaoUteis.at(0);

    expect(grupo.controls.abrangencia.value).toBe('ESTADUAL');
    expect(grupo.controls.uf.value).toBe('PA');

    grupo.controls.abrangencia.setValue('MUNICIPAL');
    component['mudaAbrangencia'](0);

    // Nenhuma referência municipal nasce de constante do código (ADR-0090): o
    // snapshot só existe depois de uma escolha na Geo.
    expect(grupo.controls.codigoMunicipio.value).toBe('');
    expect(grupo.controls.municipioNome.value).toBeNull();
    expect(grupo.controls.municipioUf.value).toBeNull();
    expect(grupo.controls.buscaMunicipio.value).toBe('');
    expect(component['municipioSelecionado'](0)).toBeNull();
    expect(component['estadoBuscaMunicipio'](0).opcoes).toEqual([]);
  });

  it('envia o snapshot da opção escolhida na Geo', async () => {
    component['form'].controls.versaoDataset.setValue('2026.1');
    const index = adicionarDia('MUNICIPAL', '2026-04-05');
    await selecionarMunicipioViaGeo(index);

    expect(component['form'].valid).toBe(true);
    component['salvar']();

    const req = controller.expectOne(`${BASE}/api/configuracao/admin/calendarios-dias-uteis`);
    expect(req.request.body.diasNaoUteis[0]).toMatchObject({
      abrangencia: 'MUNICIPAL',
      municipioIbge: '1504208',
      municipioNome: 'Marabá',
      municipioUf: 'PA',
      uf: null,
    });
    req.flush('019f41cf-69fd-759a-ac6d-09acabc1b027');
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/calendario-dias-uteis');
  });

  it('impede o envio municipal enquanto não houver opção da Geo escolhida', () => {
    component['form'].controls.versaoDataset.setValue('2026.1');
    const index = adicionarDia('MUNICIPAL');

    const grupo = component['form'].controls.diasNaoUteis.at(index);
    expect(grupo.errors?.['snapshotMunicipal']).toBe(true);
    expect(component['form'].invalid).toBe(true);

    component['salvar']();

    controller.expectNone(`${BASE}/api/configuracao/admin/calendarios-dias-uteis`);
    expect(component['erroDoCampoDiasNaoUteis']('codigoMunicipio', index)).toBe(
      'Selecione um município na busca.',
    );
  });

  it('recusa snapshot cuja UF não corresponde ao prefixo do código IBGE', async () => {
    component['form'].controls.versaoDataset.setValue('2026.1');
    const index = adicionarDia('MUNICIPAL');
    await selecionarMunicipioViaGeo(index);
    const grupo = component['form'].controls.diasNaoUteis.at(index);
    expect(grupo.errors).toBeNull();

    grupo.controls.municipioUf.setValue('SP');

    expect(grupo.errors?.['snapshotMunicipal']).toBe(true);
    expect(component['form'].invalid).toBe(true);
  });

  it('descarta o snapshot inteiro quando a busca deixa de casar com o selecionado', async () => {
    const index = adicionarDia('MUNICIPAL');
    await selecionarMunicipioViaGeo(index);
    const grupo = component['form'].controls.diasNaoUteis.at(index);

    component['buscarMunicipios'](index, 'Belé');

    expect(grupo.controls.codigoMunicipio.value).toBe('');
    expect(grupo.controls.municipioNome.value).toBeNull();
    expect(grupo.controls.municipioUf.value).toBeNull();
    expect(component['municipioSelecionado'](index)).toBeNull();
  });

  it('descarta o snapshot ao trocar o estado usado na busca', async () => {
    const index = adicionarDia('MUNICIPAL');
    await selecionarMunicipioViaGeo(index);
    const grupo = component['form'].controls.diasNaoUteis.at(index);

    grupo.controls.uf.setValue('SP');
    component['mudaUf'](index);

    expect(grupo.controls.codigoMunicipio.value).toBe('');
    expect(grupo.controls.municipioNome.value).toBeNull();
    expect(grupo.controls.municipioUf.value).toBeNull();
    expect(grupo.controls.buscaMunicipio.value).toBe('');
  });

  it('limpa os campos regionais ao mudar para abrangência nacional', async () => {
    const index = adicionarDia('MUNICIPAL');
    await selecionarMunicipioViaGeo(index);
    const grupo = component['form'].controls.diasNaoUteis.at(index);

    grupo.controls.abrangencia.setValue('NACIONAL');
    component['mudaAbrangencia'](index);

    expect(grupo.controls.codigoMunicipio.value).toBe('');
    expect(grupo.controls.municipioNome.value).toBeNull();
    expect(grupo.controls.municipioUf.value).toBeNull();
    expect(grupo.controls.uf.value).toBe('');
    expect(grupo.controls.buscaMunicipio.value).toBe('');
    expect(grupo.controls.codigoMunicipio.validator).toBeNull();
    expect(grupo.errors).toBeNull();
  });

  it('pesquisa municípios pelo nome e pela UF usando a API Geo', async () => {
    const index = adicionarDia('MUNICIPAL');
    const grupo = component['form'].controls.diasNaoUteis.at(index);

    component['buscarMunicipios'](index, PARAUAPEBAS.nome);
    await new Promise((resolve) => setTimeout(resolve, 350));

    const req = controller.expectOne((request) => request.url === `${BASE}/api/cidades`);
    expect(req.request.params.get('uf')).toBe('PA');
    expect(req.request.params.get('q')).toBe('Parauapebas');
    expect(req.request.params.get('limit')).toBe('20');
    req.flush([{ id: 'cidade-parauapebas', ddd: '94', ...PARAUAPEBAS }]);
    fixture.detectChanges();

    expect(component['estadoBuscaMunicipio'](index).opcoes).toEqual(
      expect.arrayContaining([expect.objectContaining(PARAUAPEBAS)]),
    );

    grupo.controls.codigoMunicipio.setValue(PARAUAPEBAS.codigoIbge);
    component['selecionarMunicipio'](index);

    expect(grupo.controls.buscaMunicipio.value).toBe('Parauapebas');
    expect(grupo.controls.municipioNome.value).toBe('Parauapebas');
    expect(grupo.controls.municipioUf.value).toBe('PA');
  });

  it('busca em linhas municipais diferentes sem uma cancelar a outra', async () => {
    const primeira = adicionarDia('MUNICIPAL', '2026-04-05');
    const segunda = adicionarDia('MUNICIPAL', '2026-06-12');

    component['buscarMunicipios'](primeira, MARABA.nome);
    component['buscarMunicipios'](segunda, PARAUAPEBAS.nome);
    await new Promise((resolve) => setTimeout(resolve, 350));

    const requisicoes = controller.match((request) => request.url === `${BASE}/api/cidades`);
    expect(requisicoes).toHaveLength(2);
    for (const requisicao of requisicoes) {
      const termo = requisicao.request.params.get('q');
      const municipio = termo === MARABA.nome ? MARABA : PARAUAPEBAS;
      requisicao.flush([{ id: `cidade-${municipio.codigoIbge}`, ddd: '94', ...municipio }]);
    }
    fixture.detectChanges();

    // Nenhuma linha fica presa em "Buscando…" sem opções.
    for (const [index, esperado] of [
      [primeira, MARABA],
      [segunda, PARAUAPEBAS],
    ] as const) {
      const estado = component['estadoBuscaMunicipio'](index);
      expect(estado.carregando).toBe(false);
      expect(estado.opcoes).toEqual(expect.arrayContaining([expect.objectContaining(esperado)]));
    }
  });

  it('cancela a busca anterior da mesma linha em vez de aceitar duas respostas', async () => {
    const index = adicionarDia('MUNICIPAL');

    component['buscarMunicipios'](index, 'Marab');
    await new Promise((resolve) => setTimeout(resolve, 350));
    const primeira = controller.expectOne((request) => request.url === `${BASE}/api/cidades`);

    component['buscarMunicipios'](index, 'Parauapebas');
    await new Promise((resolve) => setTimeout(resolve, 350));
    const segunda = controller.expectOne((request) => request.url === `${BASE}/api/cidades`);

    // Sem cancelamento contínuo na linha, a resposta antiga ainda chegaria e
    // sobrescreveria a recente (ou marcaria erro depois de um sucesso).
    expect(primeira.cancelled).toBe(true);

    segunda.flush([{ id: 'cidade-parauapebas', ddd: '94', ...PARAUAPEBAS }]);
    fixture.detectChanges();

    expect(component['estadoBuscaMunicipio'](index).opcoes).toEqual(
      expect.arrayContaining([expect.objectContaining(PARAUAPEBAS)]),
    );
    expect(component['estadoBuscaMunicipio'](index).erro).toBe(false);
  });

  it('envia nulo nos campos regionais que não se aplicam', () => {
    component['form'].controls.versaoDataset.setValue('2026.1');
    adicionarDia();
    component['salvar']();

    const req = controller.expectOne(`${BASE}/api/configuracao/admin/calendarios-dias-uteis`);
    expect(req.request.body.diasNaoUteis[0]).toMatchObject({
      data: '2026-09-07',
      municipioIbge: null,
      municipioNome: null,
      municipioUf: null,
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

  it('associa o erro da referência de cidade à única linha municipal', async () => {
    component['form'].controls.versaoDataset.setValue('2026.1');
    adicionarDia('NACIONAL');
    const municipalIndex = adicionarDia('MUNICIPAL');
    await selecionarMunicipioViaGeo(municipalIndex);
    component['salvar']();

    const req = controller.expectOne(`${BASE}/api/configuracao/admin/calendarios-dias-uteis`);
    req.flush(
      mockProblemDetails({
        status: 422,
        code: 'uniplus.cidade_referencia.uf_incoerente',
        title: 'UF informada incompatível com o prefixo do código IBGE',
        detail: "O prefixo do código IBGE ('15') corresponde à UF 'PA', incompatível com 'SP'.",
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
      code: 'uniplus.cidade_referencia.uf_incoerente',
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
