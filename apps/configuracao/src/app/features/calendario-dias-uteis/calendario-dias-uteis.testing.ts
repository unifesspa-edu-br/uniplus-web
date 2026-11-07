import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { Subject } from 'rxjs';
import { expect, vi } from 'vitest';
import { BuscaDeMunicipios } from './busca-de-municipios';
import { CalendarioDiasUteisDetalhePage } from './calendario-dias-uteis-detalhe.page';
import { CalendarioDiasUteisNovoPage } from './calendario-dias-uteis-novo.page';
import { CalendarioStore } from './calendario.store';
import { EdicaoDoCalendario } from './edicao-do-calendario';
import { EdicaoDosDiasNaoUteis } from './edicao-dos-dias-nao-uteis';
import { SelecaoDoDia } from './selecao-do-dia';

export const BASE = 'http://localhost:5000';
export const CALENDARIO_ID = '019f41cf-69fd-759a-ac6d-09acabc1b027';
export const ESCRITA_DO_CALENDARIO = `${BASE}/api/configuracao/admin/calendarios-dias-uteis`;
export const ESCRITA_DO_DIA = `${ESCRITA_DO_CALENDARIO}/${CALENDARIO_ID}/dias-nao-uteis`;
export const LEITURA = `${BASE}/api/configuracao/calendarios-dias-uteis/${CALENDARIO_ID}`;
export const CIDADES = `${BASE}/api/cidades`;
/** Mais que o debounce da busca de municípios. */
export const ESPERA_DA_BUSCA_EM_MS = 350;

export const MARABA = { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' } as const;
export const PARAUAPEBAS = { codigoIbge: '1505536', nome: 'Parauapebas', uf: 'PA' } as const;

export const DIA_MUNICIPAL = {
  id: '019f41cf-69fd-759a-ac6d-09acabc1b100',
  abrangencia: 'MUNICIPAL',
  municipioIbge: '1504208',
  municipioNome: 'Marabá',
  municipioUf: 'PA',
  uf: null,
  data: '2026-04-05',
  descricao: 'Aniversário de Marabá',
};

export const DIA_ESTADUAL = {
  id: '019f41cf-69fd-759a-ac6d-09acabc1b101',
  abrangencia: 'ESTADUAL',
  municipioIbge: null,
  municipioNome: null,
  municipioUf: null,
  uf: 'PA',
  data: '2026-08-15',
  descricao: 'Adesão do Grão-Pará à Independência',
};

export const DIA_NACIONAL_JANEIRO = {
  id: '019f41cf-69fd-759a-ac6d-09acabc1b102',
  abrangencia: 'NACIONAL',
  municipioIbge: null,
  municipioNome: null,
  municipioUf: null,
  uf: null,
  data: '2027-01-01',
  descricao: 'Confraternização Universal',
};

export const calendarioCom = (diasNaoUteis: readonly unknown[], vigente = false) => ({
  id: CALENDARIO_ID,
  versaoDataset: '2026.1',
  vigente,
  criadoEm: '2026-08-13T00:00:00Z',
  diasNaoUteis,
});

export const problema = (status: number, corpo: object = {}) =>
  [
    JSON.stringify({
      type: 'about:blank',
      title: 'Falha',
      status,
      code: 'uniplus.internal.unexpected',
      ...corpo,
    }),
    { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
  ] as const;

export const criado = () => [CALENDARIO_ID, { status: 201, statusText: 'Created' }] as const;

export const esperar = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function configurar(raiz: unknown, rota?: Partial<ActivatedRoute>) {
  TestBed.configureTestingModule({
    imports: [raiz as never],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([{ path: 'calendario-dias-uteis', children: [] }]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      { provide: GEO_BASE_PATH, useValue: BASE },
      ...(rota ? [{ provide: ActivatedRoute, useValue: rota }] : []),
    ],
  });
}

/** O que as duas páginas oferecem para conduzi-las como a pessoa faz. */
function ferramentas<T>(fixture: ComponentFixture<T>) {
  const http = TestBed.inject(HttpTestingController);
  const app = TestBed.inject(ApplicationRef);
  const notificacoes = TestBed.inject(NotificationService);
  const sucessos = vi.spyOn(notificacoes, 'success');
  const erros = vi.spyOn(notificacoes, 'errorFromProblem');
  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    app.tick();
    fixture.detectChanges();
  };
  const elemento = <E extends HTMLElement>(seletor: string): E => {
    const encontrado = (fixture.nativeElement as HTMLElement).querySelector<E>(seletor);
    expect(encontrado, seletor).not.toBeNull();
    return encontrado as E;
  };
  const escrever = (campo: HTMLInputElement | HTMLTextAreaElement, valor: string): void => {
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  };
  const escolher = (campo: HTMLSelectElement, valor: string): void => {
    campo.value = valor;
    campo.dispatchEvent(new Event('change'));
  };
  const buscarMunicipio = async (
    ids: { busca: string; opcoes: string },
    municipio: { codigoIbge: string; nome: string; uf: string },
  ): Promise<void> => {
    escrever(elemento<HTMLInputElement>(ids.busca), municipio.nome);
    await esperar(ESPERA_DA_BUSCA_EM_MS);
    http
      .expectOne((r) => r.url === CIDADES)
      .flush([{ id: `cidade-${municipio.codigoIbge}`, ddd: '94', ...municipio }]);
    await propagar();
    escolher(elemento<HTMLSelectElement>(ids.opcoes), municipio.codigoIbge);
    await propagar();
  };
  return {
    fixture,
    http,
    sucessos,
    erros,
    propagar,
    elemento,
    escrever,
    escolher,
    buscarMunicipio,
  };
}

/** A página de novo calendário, com a rota da lista pronta para o redirecionamento. */
export async function montarNovo() {
  configurar(CalendarioDiasUteisNovoPage);
  const fixture = TestBed.createComponent(CalendarioDiasUteisNovoPage);
  const base = ferramentas(fixture);
  const injetor = fixture.debugElement.injector;
  const edicao = injetor.get(EdicaoDoCalendario);
  const busca = injetor.get(BuscaDeMunicipios);
  fixture.detectChanges();
  const dia = (indice: number, campo: string): HTMLElement => base.elemento(`#${campo}-${indice}`);
  return {
    ...base,
    edicao,
    busca,
    router: TestBed.inject(Router),
    dia,
    versao: (): HTMLInputElement => base.elemento('[formcontrolname="versaoDataset"]'),
    salvar: (): HTMLButtonElement => base.elemento('button[form="cfg-calendario-dias-uteis-form"]'),
    formulario: (): HTMLFormElement => base.elemento('#cfg-calendario-dias-uteis-form'),
    async adicionarDia(): Promise<number> {
      base.elemento<HTMLButtonElement>('#cfg-calendario-adicionar-dia').click();
      await base.propagar();
      return edicao.form.controls.diasNaoUteis.length - 1;
    },
    /** Preenche o dia pelo que a pessoa vê: abrangência, data e descrição. */
    async preencherDia(indice: number, abrangencia: string, data: string): Promise<void> {
      base.escolher(dia(indice, 'abrangencia') as HTMLSelectElement, abrangencia);
      await base.propagar();
      base.escrever(dia(indice, 'data') as HTMLInputElement, data);
      base.escrever(dia(indice, 'descricao') as HTMLTextAreaElement, 'Independência do Brasil');
      await base.propagar();
    },
    /** Envia com o foco no botão de salvar e devolve a requisição de escrita. */
    async enviar(): Promise<ReturnType<typeof base.http.expectOne>> {
      const botao = base.elemento<HTMLButtonElement>(
        'button[form="cfg-calendario-dias-uteis-form"]',
      );
      botao.focus();
      botao.click();
      await base.propagar();
      return base.http.expectOne(ESCRITA_DO_CALENDARIO);
    },
    async municipioDoDia(indice: number, municipio = MARABA): Promise<void> {
      await base.buscarMunicipio(
        { busca: `#busca-municipio-${indice}`, opcoes: `#codigo-municipio-${indice}` },
        municipio,
      );
    },
  };
}

/** O detalhe com o dataset carregado. */
export async function montarDetalhe(diasNaoUteis: readonly unknown[] = [DIA_ESTADUAL]) {
  const parametros = new Subject<{ id: string }>();
  configurar(CalendarioDiasUteisDetalhePage, {
    snapshot: { paramMap: convertToParamMap({ id: CALENDARIO_ID }) },
    params: parametros,
  } as unknown as Partial<ActivatedRoute>);
  const fixture = TestBed.createComponent(CalendarioDiasUteisDetalhePage);
  const base = ferramentas(fixture);
  const injetor = fixture.debugElement.injector;
  const edicao = injetor.get(EdicaoDosDiasNaoUteis);
  const store = injetor.get(CalendarioStore);
  const selecao = injetor.get(SelecaoDoDia);
  const busca = injetor.get(BuscaDeMunicipios);
  fixture.detectChanges();
  const carregar = async (dias: readonly unknown[], vigente = false): Promise<void> => {
    await Promise.resolve();
    base.http.expectOne(LEITURA).flush(calendarioCom(dias, vigente));
    await base.propagar();
  };
  await carregar(diasNaoUteis);

  const botaoDoDia = (rotuloInicio: string): HTMLButtonElement =>
    base.elemento(`button.cfg-calendario-mensal__dia[aria-label^="${rotuloInicio}"]`);
  return {
    ...base,
    edicao,
    store,
    selecao,
    busca,
    parametros,
    carregar,
    botaoDoDia,
    dialogo: (): HTMLDialogElement => base.elemento('cfg-dia-nao-util-dialogo dialog'),
    campo: (nome: string): HTMLElement => base.elemento(`[formcontrolname="${nome}"]`),
    salvar: (): HTMLButtonElement => base.elemento('button[form="cfg-calendario-dias-uteis-form"]'),
    formulario: (): HTMLFormElement => base.elemento('#cfg-calendario-dias-uteis-form'),
    /** Clica no dia e em "Adicionar feriado", como a pessoa faz. */
    async abrirCadastro(rotuloInicio = '16 de setembro de 2026'): Promise<void> {
      botaoDoDia(rotuloInicio).focus();
      botaoDoDia(rotuloInicio).click();
      await base.propagar();
      const adicionar = base.elemento<HTMLButtonElement>('cfg-ocorrencias-do-dia .btn--primary');
      adicionar.focus();
      adicionar.click();
      await base.propagar();
    },
    /** Envia o diálogo aberto, com o foco no botão, e devolve a requisição de escrita. */
    async enviar(): Promise<ReturnType<typeof base.http.expectOne>> {
      const botao = base.elemento<HTMLButtonElement>(
        'button[form="cfg-calendario-dias-uteis-form"]',
      );
      botao.focus();
      botao.click();
      await base.propagar();
      return base.http.expectOne(ESCRITA_DO_DIA);
    },
    async municipioDoDialogo(municipio = MARABA): Promise<void> {
      await base.buscarMunicipio(
        { busca: '#busca-municipio-novo', opcoes: '#codigo-municipio-novo' },
        municipio,
      );
    },
  };
}

export type PaginaNova = Awaited<ReturnType<typeof montarNovo>>;
export type PaginaDoDetalhe = Awaited<ReturnType<typeof montarDetalhe>>;
