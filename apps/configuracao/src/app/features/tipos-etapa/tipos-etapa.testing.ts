import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CONFIGURACAO_BASE_PATH,
  TipoConceitoDto,
  TipoEtapaDto,
} from '@uniplus/shared-data/configuracao';
import { expect, vi } from 'vitest';
import { EdicaoDosTiposEtapa } from './edicao-dos-tipos-etapa';
import { TiposEtapaPage } from './tipos-etapa.page';
import { TiposEtapaStore } from './tipos-etapa.store';

const BASE = 'http://localhost:5000';
export const LISTA = `${BASE}/api/configuracao/tipos-etapa`;
export const ESCRITA = `${BASE}/api/configuracao/admin/tipos-etapa`;
export const CONCEITOS = `${BASE}/api/configuracao/tipos-conceito`;
export const TITULO_DA_LISTA = '#cfg-tipos-etapa-list-title';

export const prova: TipoEtapaDto = {
  id: '01960000-0000-7000-0000-0000000000e1',
  codigo: 'PROVA',
  nome: 'Prova',
  descricao: null,
  ativo: true,
  avaliacao: {
    admitePontuacao: true,
    admiteEliminacao: true,
    notaDeOrigemNoEnem: false,
    exigeCorrecaoIndependente: false,
    conceitosAdmitidos: [],
  },
  criadoEm: '2026-08-11T00:00:00Z',
};

export const analiseDocumental: TipoEtapaDto = {
  ...prova,
  id: '01960000-0000-7000-0000-0000000000e2',
  codigo: 'ANALISE_DOCUMENTAL',
  nome: 'Análise Documental',
  avaliacao: { ...prova.avaliacao, admitePontuacao: false },
};

export const problema = (status: number, corpo: object = {}) =>
  [
    JSON.stringify({ type: 'about:blank', title: 'Falha', status, ...corpo }),
    { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
  ] as const;

export const recusaDeCampo = (field: string, message: string) =>
  problema(422, {
    code: 'uniplus.validacao',
    errors: [{ field, code: 'uniplus.configuracao.tipo_etapa.nome_tamanho', message }],
  });

export const sucesso = () => [null, { status: 204, statusText: 'No Content' }] as const;
export const criado = () => ['novo-id', { status: 201, statusText: 'Created' }] as const;

function criarPagina(): ComponentFixture<TiposEtapaPage> {
  TestBed.configureTestingModule({
    imports: [TiposEtapaPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
    ],
  });
  return TestBed.createComponent(TiposEtapaPage);
}

function ferramentasDoDom(fixture: ComponentFixture<TiposEtapaPage>) {
  const app = TestBed.inject(ApplicationRef);
  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    app.tick();
    fixture.detectChanges();
  };
  const elemento = <T extends HTMLElement>(seletor: string): T => {
    const encontrado = (fixture.nativeElement as HTMLElement).querySelector<T>(seletor);
    expect(encontrado, seletor).not.toBeNull();
    return encontrado as T;
  };
  return { propagar, elemento };
}

type Dom = ReturnType<typeof ferramentasDoDom>;

const pelaEtiqueta = (dom: Dom, nome: string): HTMLButtonElement =>
  dom.elemento(`button[aria-label="${nome}"]`);

function leiturasDaPagina(dom: Dom, http: HttpTestingController) {
  const recarregarCom = async (lista: readonly TipoEtapaDto[]): Promise<void> => {
    await dom.propagar();
    http.expectOne((r) => r.url === LISTA).flush(lista);
    await dom.propagar();
  };
  /** O drawer pede o catálogo de conceitos ao abrir; a gravação só segue com ele completo. */
  const responderConceitos = async (catalogo: readonly TipoConceitoDto[]): Promise<void> => {
    await dom.propagar();
    http.expectOne((r) => r.url === CONCEITOS).flush(catalogo);
    await dom.propagar();
  };
  return { recarregarCom, responderConceitos };
}

function preencher(dom: Dom, nome: string, valor: string): void {
  const campo = dom.elemento<HTMLInputElement>(`[formcontrolname="${nome}"]`);
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
}

function controlesDaPagina(dom: Dom) {
  const { elemento } = dom;
  return {
    novo: (): HTMLButtonElement => elemento('#cfg-tipos-etapa-novo'),
    editar: (t: TipoEtapaDto = prova) => pelaEtiqueta(dom, `Editar tipo de etapa ${t.codigo}`),
    remover: (t: TipoEtapaDto = prova) => pelaEtiqueta(dom, `Remover tipo de etapa ${t.codigo}`),
    salvar: (): HTMLButtonElement => elemento('button[form="cfg-tipo-etapa-form"]'),
    confirmar: (): HTMLButtonElement => elemento('[data-testid="confirm-dialog-confirm"]'),
    cancelarDaConfirmacao: (): HTMLButtonElement =>
      elemento('[data-testid="confirm-dialog-cancel"]'),
  };
}

function leiturasDoFormulario(dom: Dom) {
  const { elemento } = dom;
  return {
    formulario: (): HTMLFormElement => elemento('#cfg-tipo-etapa-form'),
    campo: (nome: string): HTMLInputElement => elemento(`[formcontrolname="${nome}"]`),
    statusDaPagina: (): string =>
      elemento(':scope > span.sr-only[role="status"]').textContent ?? '',
  };
}

type Leituras = ReturnType<typeof leiturasDaPagina>;

/** Clica de verdade em "Novo tipo de etapa" e preenche o mínimo para enviar. */
async function abrirCadastro(
  dom: Dom,
  leituras: Leituras,
  catalogo: readonly TipoConceitoDto[] = [],
): Promise<void> {
  dom.elemento<HTMLButtonElement>('#cfg-tipos-etapa-novo').focus();
  dom.elemento<HTMLButtonElement>('#cfg-tipos-etapa-novo').click();
  await leituras.responderConceitos(catalogo);
  preencher(dom, 'codigo', 'NOVA_PROVA');
  preencher(dom, 'nome', 'Nova prova');
}

async function abrirEdicao(
  dom: Dom,
  leituras: Leituras,
  tipo: TipoEtapaDto,
  catalogo: readonly TipoConceitoDto[],
): Promise<void> {
  const botao = pelaEtiqueta(dom, `Editar tipo de etapa ${tipo.codigo}`);
  botao.focus();
  botao.click();
  await leituras.responderConceitos(catalogo);
}

/** Envia o formulário aberto, com o foco no botão de salvar, e devolve a requisição de escrita. */
async function enviar(dom: Dom, http: HttpTestingController, url: string) {
  const botao = dom.elemento<HTMLButtonElement>('button[form="cfg-tipo-etapa-form"]');
  botao.focus();
  botao.click();
  await dom.propagar();
  return http.expectOne(url);
}

async function confirmarRemocao(dom: Dom, http: HttpTestingController, tipo: TipoEtapaDto) {
  const lixeira = pelaEtiqueta(dom, `Remover tipo de etapa ${tipo.codigo}`);
  lixeira.focus();
  lixeira.click();
  await dom.propagar();
  dom.elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
  await dom.propagar();
  return http.expectOne(`${ESCRITA}/${tipo.id}`);
}

function fluxosDaPagina(dom: Dom, http: HttpTestingController, leituras: Leituras) {
  return {
    abrirCadastro: (catalogo?: readonly TipoConceitoDto[]) =>
      abrirCadastro(dom, leituras, catalogo),
    abrirEdicao: (tipo: TipoEtapaDto = prova, catalogo: readonly TipoConceitoDto[] = []) =>
      abrirEdicao(dom, leituras, tipo, catalogo),
    enviar: (url = ESCRITA) => enviar(dom, http, url),
    confirmarRemocao: (tipo: TipoEtapaDto = prova) => confirmarRemocao(dom, http, tipo),
  };
}

function espiasDeAviso() {
  const notificacoes = TestBed.inject(NotificationService);
  return {
    sucessos: vi.spyOn(notificacoes, 'success'),
    erros: vi.spyOn(notificacoes, 'errorFromProblem'),
  };
}

function condutoresDaPagina(dom: Dom, http: HttpTestingController, leituras: Leituras) {
  return {
    ...leituras,
    preencher: (nome: string, valor: string): void => preencher(dom, nome, valor),
    ...controlesDaPagina(dom),
    ...leiturasDoFormulario(dom),
    ...fluxosDaPagina(dom, http, leituras),
  };
}

function montarAparelho() {
  const fixture = criarPagina();
  const http = TestBed.inject(HttpTestingController);
  const dom = ferramentasDoDom(fixture);
  const injetor = fixture.debugElement.injector;
  return {
    fixture,
    http,
    edicao: injetor.get(EdicaoDosTiposEtapa),
    store: injetor.get(TiposEtapaStore),
    ...espiasDeAviso(),
    ...dom,
    ...condutoresDaPagina(dom, http, leiturasDaPagina(dom, http)),
  };
}

/** A página montada com a lista já carregada, e as ferramentas para conduzi-la como a pessoa faz. */
export async function montarPagina(itens: readonly TipoEtapaDto[] = [prova]) {
  const aparelho = montarAparelho();
  aparelho.fixture.detectChanges();
  aparelho.http.expectOne((r) => r.url === LISTA).flush(itens);
  await aparelho.propagar();
  return aparelho;
}

export type Pagina = Awaited<ReturnType<typeof montarPagina>>;
