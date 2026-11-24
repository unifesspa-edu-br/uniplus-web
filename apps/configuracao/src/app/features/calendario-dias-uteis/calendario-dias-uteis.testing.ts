import { VocabulariosDeConfiguracaoApi } from '@uniplus/shared-data/configuracao';
import { of } from 'rxjs';
import { ABRANGENCIAS } from './abrangencias.testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { passarOTempo } from '@uniplus/shared-testing';
import { Subject } from 'rxjs';
import { expect, vi } from 'vitest';
import { BuscaDeMunicipios } from './busca-de-municipios';
import { CalendarioDiasUteisDetalhePage } from './calendario-dias-uteis-detalhe.page';
import { CalendarioDiasUteisNovoPage } from './calendario-dias-uteis-novo.page';
import { ESPERA_DA_BUSCA_DE_MUNICIPIO_MS } from './calendario-dias-uteis.util';
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

export const MARABA = { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' } as const;
export const PARAUAPEBAS = { codigoIbge: '1505536', nome: 'Parauapebas', uf: 'PA' } as const;

export const DIA_MUNICIPAL = {
  id: '019f41cf-69fd-759a-ac6d-09acabc1b100',
  abrangencia: ABRANGENCIAS.MUNICIPAL,
  municipioIbge: '1504208',
  municipioNome: 'Marabá',
  municipioUf: 'PA',
  uf: null,
  data: '2026-04-05',
  descricao: 'Aniversário de Marabá',
};

export const DIA_ESTADUAL = {
  id: '019f41cf-69fd-759a-ac6d-09acabc1b101',
  abrangencia: ABRANGENCIAS.ESTADUAL,
  municipioIbge: null,
  municipioNome: null,
  municipioUf: null,
  uf: 'PA',
  data: '2026-08-15',
  descricao: 'Adesão do Grão-Pará à Independência',
};

export const DIA_NACIONAL_JANEIRO = {
  id: '019f41cf-69fd-759a-ac6d-09acabc1b102',
  abrangencia: ABRANGENCIAS.NACIONAL,
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

const vocabularioDeAbrangencias = {
  provide: VocabulariosDeConfiguracaoApi,
  useValue: { listar: () => of({ ok: true, data: Object.values(ABRANGENCIAS) }) },
};

const rotaDaLista = provideRouter([{ path: 'calendario-dias-uteis', children: [] }]);

const enderecosDaApi = [
  { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
  { provide: GEO_BASE_PATH, useValue: BASE },
];

function rotaAtivaComo(rota?: Partial<ActivatedRoute>) {
  return rota ? [{ provide: ActivatedRoute, useValue: rota }] : [];
}

function configurar(raiz: unknown, rota?: Partial<ActivatedRoute>) {
  TestBed.configureTestingModule({
    imports: [raiz as never],
    providers: [
      vocabularioDeAbrangencias,
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      rotaDaLista,
      ...enderecosDaApi,
      ...rotaAtivaComo(rota),
    ],
  });
}

function propagarEm<T>(fixture: ComponentFixture<T>) {
  const app = TestBed.inject(ApplicationRef);
  return async (): Promise<void> => {
    await Promise.resolve();
    app.tick();
    fixture.detectChanges();
  };
}

function elementoEm<T>(fixture: ComponentFixture<T>) {
  return <E extends HTMLElement>(seletor: string): E => {
    const encontrado = (fixture.nativeElement as HTMLElement).querySelector<E>(seletor);
    expect(encontrado, seletor).not.toBeNull();
    return encontrado as E;
  };
}

function escrever(campo: HTMLInputElement | HTMLTextAreaElement, valor: string): void {
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
}

function escolher(campo: HTMLSelectElement, valor: string): void {
  campo.value = valor;
  campo.dispatchEvent(new Event('change'));
}

function espiarNotificacoes() {
  const notificacoes = TestBed.inject(NotificationService);
  return {
    sucessos: vi.spyOn(notificacoes, 'success'),
    erros: vi.spyOn(notificacoes, 'errorFromProblem'),
  };
}

type Municipio = { codigoIbge: string; nome: string; uf: string };

async function responderBuscaDeCidades(
  http: HttpTestingController,
  municipio: Municipio,
): Promise<void> {
  await passarOTempo(ESPERA_DA_BUSCA_DE_MUNICIPIO_MS);
  http
    .expectOne((r) => r.url === CIDADES)
    .flush([{ id: `cidade-${municipio.codigoIbge}`, ddd: '94', ...municipio }]);
}

function buscadorDeMunicipio(
  elemento: ReturnType<typeof elementoEm>,
  propagar: () => Promise<void>,
  http: HttpTestingController,
) {
  return async (ids: { busca: string; opcoes: string }, municipio: Municipio): Promise<void> => {
    escrever(elemento<HTMLInputElement>(ids.busca), municipio.nome);
    await responderBuscaDeCidades(http, municipio);
    await propagar();
    escolher(elemento<HTMLSelectElement>(ids.opcoes), municipio.codigoIbge);
    await propagar();
  };
}

/** O que as duas páginas oferecem para conduzi-las como a pessoa faz. */
function ferramentas<T>(fixture: ComponentFixture<T>) {
  const http = TestBed.inject(HttpTestingController);
  const propagar = propagarEm(fixture);
  const elemento = elementoEm(fixture);
  return {
    fixture,
    http,
    ...espiarNotificacoes(),
    propagar,
    elemento,
    escrever,
    escolher,
    buscarMunicipio: buscadorDeMunicipio(elemento, propagar, http),
  };
}

type Ferramentas = ReturnType<typeof ferramentas>;

function abrirPagina<T>(pagina: Type<T>, rota?: Partial<ActivatedRoute>) {
  configurar(pagina, rota);
  return ferramentas(TestBed.createComponent(pagina));
}

function controlesDoFormulario(base: Ferramentas) {
  return {
    salvar: (): HTMLButtonElement => base.elemento('button[form="cfg-calendario-dias-uteis-form"]'),
    formulario: (): HTMLFormElement => base.elemento('#cfg-calendario-dias-uteis-form'),
  };
}

/** Envia com o foco no botão de salvar e devolve a requisição de escrita feita à API. */
async function enviarPeloBotao(base: Ferramentas, escrita: string): Promise<TestRequest> {
  const botao = controlesDoFormulario(base).salvar();
  botao.focus();
  botao.click();
  await base.propagar();
  return base.http.expectOne(escrita);
}

function campoDoDia(base: Ferramentas, indice: number, campo: string): HTMLElement {
  return base.elemento(`#${campo}-${indice}`);
}

async function adicionarDia(base: Ferramentas, edicao: EdicaoDoCalendario): Promise<number> {
  base.elemento<HTMLButtonElement>('#cfg-calendario-adicionar-dia').click();
  await base.propagar();
  return edicao.form.controls.diasNaoUteis.length - 1;
}

/** Preenche o dia pelo que a pessoa vê: abrangência, data e descrição. */
async function preencherDia(
  base: Ferramentas,
  indice: number,
  abrangencia: string,
  data: string,
): Promise<void> {
  base.escolher(campoDoDia(base, indice, 'abrangencia') as HTMLSelectElement, abrangencia);
  await base.propagar();
  base.escrever(campoDoDia(base, indice, 'data') as HTMLInputElement, data);
  base.escrever(
    campoDoDia(base, indice, 'descricao') as HTMLTextAreaElement,
    'Independência do Brasil',
  );
  await base.propagar();
}

function municipioDoDia(base: Ferramentas, indice: number, municipio: Municipio): Promise<void> {
  return base.buscarMunicipio(
    { busca: `#busca-municipio-${indice}`, opcoes: `#codigo-municipio-${indice}` },
    municipio,
  );
}

function acoesDoCalendarioNovo(base: Ferramentas, edicao: EdicaoDoCalendario) {
  return {
    dia: (indice: number, campo: string): HTMLElement => campoDoDia(base, indice, campo),
    adicionarDia: () => adicionarDia(base, edicao),
    preencherDia: (indice: number, abrangencia: string, data: string) =>
      preencherDia(base, indice, abrangencia, data),
    enviar: () => enviarPeloBotao(base, ESCRITA_DO_CALENDARIO),
    municipioDoDia: (indice: number, municipio: Municipio = MARABA) =>
      municipioDoDia(base, indice, municipio),
  };
}

function servicosDoCalendarioNovo(fixture: ComponentFixture<CalendarioDiasUteisNovoPage>) {
  const injetor = fixture.debugElement.injector;
  return {
    edicao: injetor.get(EdicaoDoCalendario),
    busca: injetor.get(BuscaDeMunicipios),
  };
}

function consultasDoCalendarioNovo(base: Ferramentas) {
  return {
    versao: (): HTMLInputElement => base.elemento('[formcontrolname="versaoDataset"]'),
    ...controlesDoFormulario(base),
  };
}

/** A página de novo calendário, com a rota da lista pronta para o redirecionamento. */
export async function montarNovo() {
  const base = abrirPagina(CalendarioDiasUteisNovoPage);
  const servicos = servicosDoCalendarioNovo(base.fixture);
  base.fixture.detectChanges();
  return {
    ...base,
    ...servicos,
    router: TestBed.inject(Router),
    ...consultasDoCalendarioNovo(base),
    ...acoesDoCalendarioNovo(base, servicos.edicao),
  };
}

function rotaDoDetalhe(parametros: Subject<{ id: string }>): Partial<ActivatedRoute> {
  return {
    snapshot: { paramMap: convertToParamMap({ id: CALENDARIO_ID }) },
    params: parametros,
  } as unknown as Partial<ActivatedRoute>;
}

function servicosDoDetalhe(fixture: ComponentFixture<CalendarioDiasUteisDetalhePage>) {
  const injetor = fixture.debugElement.injector;
  return {
    edicao: injetor.get(EdicaoDosDiasNaoUteis),
    store: injetor.get(CalendarioStore),
    selecao: injetor.get(SelecaoDoDia),
    busca: injetor.get(BuscaDeMunicipios),
  };
}

async function carregarCalendario(
  base: Ferramentas,
  dias: readonly unknown[],
  vigente: boolean,
): Promise<void> {
  await Promise.resolve();
  base.http.expectOne(LEITURA).flush(calendarioCom(dias, vigente));
  await base.propagar();
}

function botaoDoDia(base: Ferramentas, rotuloInicio: string): HTMLButtonElement {
  return base.elemento(`button.cfg-calendario-mensal__dia[aria-label^="${rotuloInicio}"]`);
}

/** Clica no dia e em "Adicionar feriado", como a pessoa faz. */
async function abrirCadastroPeloDia(base: Ferramentas, rotuloInicio: string): Promise<void> {
  botaoDoDia(base, rotuloInicio).focus();
  botaoDoDia(base, rotuloInicio).click();
  await base.propagar();
  const adicionar = base.elemento<HTMLButtonElement>('cfg-ocorrencias-do-dia .btn--primary');
  adicionar.focus();
  adicionar.click();
  await base.propagar();
}

function consultasDoDetalhe(base: Ferramentas) {
  return {
    botaoDoDia: (rotuloInicio: string) => botaoDoDia(base, rotuloInicio),
    dialogo: (): HTMLDialogElement => base.elemento('cfg-dia-nao-util-dialogo dialog'),
    campo: (nome: string): HTMLElement => base.elemento(`[formcontrolname="${nome}"]`),
    ...controlesDoFormulario(base),
  };
}

function acoesDoDetalhe(base: Ferramentas) {
  return {
    carregar: (dias: readonly unknown[], vigente = false) =>
      carregarCalendario(base, dias, vigente),
    abrirCadastro: (rotuloInicio = '16 de setembro de 2026') =>
      abrirCadastroPeloDia(base, rotuloInicio),
    enviar: () => enviarPeloBotao(base, ESCRITA_DO_DIA),
    municipioDoDialogo: (municipio: Municipio = MARABA) =>
      base.buscarMunicipio(
        { busca: '#busca-municipio-novo', opcoes: '#codigo-municipio-novo' },
        municipio,
      ),
  };
}

/** O detalhe com o dataset carregado. */
export async function montarDetalhe(diasNaoUteis: readonly unknown[] = [DIA_ESTADUAL]) {
  const parametros = new Subject<{ id: string }>();
  const base = abrirPagina(CalendarioDiasUteisDetalhePage, rotaDoDetalhe(parametros));
  const servicos = servicosDoDetalhe(base.fixture);
  base.fixture.detectChanges();
  const acoes = acoesDoDetalhe(base);
  await acoes.carregar(diasNaoUteis);
  return {
    ...base,
    ...servicos,
    parametros,
    ...consultasDoDetalhe(base),
    ...acoes,
  };
}

export type PaginaNova = Awaited<ReturnType<typeof montarNovo>>;
export type PaginaDoDetalhe = Awaited<ReturnType<typeof montarDetalhe>>;
