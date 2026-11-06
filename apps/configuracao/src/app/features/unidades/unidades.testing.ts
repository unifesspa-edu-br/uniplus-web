import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { apiResultInterceptor, okResult } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { GeoApi, type CidadeResumoDto } from '@uniplus/shared-data/geo';
import { ORGANIZACAO_BASE_PATH, TipoUnidade, UnidadeDto } from '@uniplus/shared-data/organizacao';
import { expect, vi } from 'vitest';
import { BuscaDeCidade } from './busca-de-cidade';
import { EdicaoDasUnidades } from './edicao-das-unidades';
import { OpcoesDaUnidadeSuperior } from './opcoes-da-unidade-superior';
import { UnidadesPage } from './unidades.page';
import { UnidadesStore } from './unidades.store';

const BASE = 'http://localhost:5000';
export const LISTA = `${BASE}/api/organizacao/unidades`;
export const ESCRITA = `${BASE}/api/organizacao/admin/unidades`;
export const TITULO_DA_LISTA = '#cfg-unidades-list-title';

export const CODIGO_DA_SIGLA_REPETIDA = 'uniplus.organizacao.unidade.sigla_ja_existe';
export const CODIGO_DO_CODIGO_REPETIDO = 'uniplus.organizacao.unidade.codigo_ja_existe';
export const CODIGO_DO_SLUG_REPETIDO = 'uniplus.organizacao.unidade.slug_ja_existe';
export const REMOCAO_BLOQUEADA = 'uniplus.organizacao.unidade.remocao_bloqueada_por_subordinadas';
export const PROCESSANDO = 'uniplus.idempotency.processing_conflict';
export const ERRO_INTERNO = 'uniplus.internal.unexpected';

export const reitoria: UnidadeDto = {
  id: '01960000-0000-7000-0000-0000000000a1',
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
  criadoEm: '2020-01-01T00:00:00Z',
  cidadeCodigoIbge: '1504208',
  cidadeNome: 'Marabá',
  cidadeUf: 'PA',
};

export const instituto: UnidadeDto = {
  ...reitoria,
  id: '01960000-0000-7000-0000-0000000000a2',
  nome: 'Instituto de Ciências Exatas',
  sigla: 'ICE',
  codigo: '002',
  slug: 'ice',
  alias: 'Exatas',
  tipo: TipoUnidade.instituto,
  unidadeSuperiorId: reitoria.id,
  unidadeAcademica: true,
  vigenciaInicio: '2021-01-01',
};

export const marabaGeo: CidadeResumoDto = {
  id: 'cid-1504208',
  codigoIbge: '1504208',
  nome: 'Marabá',
  uf: 'PA',
  ddd: null,
};
export const belemGeo: CidadeResumoDto = {
  id: 'cid-1501402',
  codigoIbge: '1501402',
  nome: 'Belém',
  uf: 'PA',
  ddd: null,
};

export const problema = (status: number, corpo: object = {}) =>
  [
    JSON.stringify({ type: 'about:blank', title: 'Falha', status, ...corpo }),
    { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
  ] as const;

/** A recusa 422 de um campo, com o código de domínio na raiz e no item de `errors[]`. */
export const recusaDeCampo = (field: string, message: string, code: string) =>
  problema(422, { code, errors: [{ field, code, message }] });

export const sucesso = () => [null, { status: 204, statusText: 'No Content' }] as const;
export const criado = () => ['novo-id', { status: 201, statusText: 'Created' }] as const;

export const comLink = (link: string) => ({ headers: { Link: link } });

/** A página montada com a lista já carregada, e as ferramentas para conduzi-la como a pessoa faz. */
export async function montarPagina(
  itens: readonly UnidadeDto[] = [reitoria, instituto],
  resposta: { headers?: Record<string, string> } = {},
) {
  const geo = { listarCidades: vi.fn().mockReturnValue(of(okResult([]))) };
  TestBed.configureTestingModule({
    imports: [UnidadesPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
      { provide: GeoApi, useValue: geo },
    ],
  });
  const fixture: ComponentFixture<UnidadesPage> = TestBed.createComponent(UnidadesPage);
  const http = TestBed.inject(HttpTestingController);
  const app = TestBed.inject(ApplicationRef);
  const injetor = fixture.debugElement.injector;
  const edicao = injetor.get(EdicaoDasUnidades);
  const store = injetor.get(UnidadesStore);
  const superior = injetor.get(OpcoesDaUnidadeSuperior);
  const cidade = injetor.get(BuscaDeCidade);
  const notificacoes = TestBed.inject(NotificationService);
  const sucessos = vi.spyOn(notificacoes, 'success');
  const erros = vi.spyOn(notificacoes, 'errorFromProblem');

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
  const pelaEtiqueta = (nome: string): HTMLButtonElement =>
    elemento(`button[aria-label="${nome}"]`);
  const recarregarCom = async (lista: readonly UnidadeDto[]): Promise<void> => {
    await propagar();
    http.expectOne((r) => r.url === LISTA).flush(lista);
    await propagar();
  };
  const preencher = (nome: string, valor: string): void => {
    const campo = elemento<HTMLInputElement>(`[formcontrolname="${nome}"]`);
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  };
  /** A consulta de opções de unidade superior que a abertura do formulário dispara. */
  const responderOpcoes = async (lista: readonly UnidadeDto[] = [reitoria]): Promise<void> => {
    await propagar();
    http.expectOne((r) => r.url === LISTA).flush(lista);
    await propagar();
  };

  fixture.detectChanges();
  const primeiraConsulta = http.expectOne((r) => r.url === LISTA);
  primeiraConsulta.flush(itens, resposta);
  await propagar();

  return {
    fixture,
    http,
    primeiraConsulta,
    geo,
    edicao,
    store,
    superior,
    cidade,
    sucessos,
    erros,
    propagar,
    elemento,
    recarregarCom,
    responderOpcoes,
    preencher,
    formulario: (): HTMLFormElement => elemento('#cfg-unidade-form'),
    novo: (): HTMLButtonElement => elemento('#cfg-unidades-novo'),
    editar: (u: UnidadeDto = reitoria) => pelaEtiqueta(`Editar unidade ${u.sigla}`),
    remover: (u: UnidadeDto = reitoria) => pelaEtiqueta(`Remover unidade ${u.sigla}`),
    salvar: (): HTMLButtonElement => elemento('button[form="cfg-unidade-form"]'),
    confirmar: (): HTMLButtonElement => elemento('[data-testid="confirm-dialog-confirm"]'),
    cancelarDaConfirmacao: (): HTMLButtonElement =>
      elemento('[data-testid="confirm-dialog-cancel"]'),
    campo: (nome: string): HTMLInputElement => elemento(`[formcontrolname="${nome}"]`),
    statusDaPagina: (): string =>
      elemento(':scope > span.sr-only[role="status"]').textContent ?? '',
    nomeDoNo: (u: UnidadeDto): HTMLButtonElement =>
      elemento(`[data-unidade-id="${u.id}"] .unit-node__name`),
    /** Clica de verdade em "Nova unidade" e preenche o mínimo para enviar. */
    async abrirCadastro(opcoes: readonly UnidadeDto[] = [reitoria]): Promise<void> {
      const novo = elemento<HTMLButtonElement>('#cfg-unidades-novo');
      novo.focus();
      novo.click();
      await responderOpcoes(opcoes);
      preencher('sigla', 'NTEC');
      preencher('slug', 'ntec');
      preencher('codigo', '500');
      preencher('nome', 'Núcleo de Tecnologia');
    },
    async abrirEdicao(unidade: UnidadeDto = reitoria): Promise<void> {
      const botao = pelaEtiqueta(`Editar unidade ${unidade.sigla}`);
      botao.focus();
      botao.click();
      await responderOpcoes();
    },
    /** Envia o formulário aberto, com o foco no botão de salvar, e devolve a requisição de escrita. */
    async enviar(url = ESCRITA): Promise<TestRequest> {
      const botao = elemento<HTMLButtonElement>('button[form="cfg-unidade-form"]');
      botao.focus();
      botao.click();
      await propagar();
      return http.expectOne(url);
    },
    async confirmarRemocao(unidade: UnidadeDto = reitoria): Promise<TestRequest> {
      const lixeira = pelaEtiqueta(`Remover unidade ${unidade.sigla}`);
      lixeira.focus();
      lixeira.click();
      await propagar();
      elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
      await propagar();
      return http.expectOne(`${ESCRITA}/${unidade.id}`);
    },
  };
}

export type Pagina = Awaited<ReturnType<typeof montarPagina>>;
