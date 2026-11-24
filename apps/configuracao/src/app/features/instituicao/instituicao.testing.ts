import { TipoUnidadeCodigo } from '@uniplus/shared-data/organizacao';
import { HttpRequest, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor, buildVendorMimeAccept } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import {
  InstituicaoDto,
  ORGANIZACAO_BASE_PATH,
  UnidadeDto,
} from '@uniplus/shared-data/organizacao';
import { expect, vi } from 'vitest';
import { EdicaoDaInstituicao } from './edicao-da-instituicao';
import { InstituicaoPage } from './instituicao.page';
import { InstituicaoStore } from './instituicao.store';
import { ReitoriasStore } from './reitorias.store';

const BASE = 'http://localhost:5000';
export const LEITURA = `${BASE}/api/organizacao/instituicao`;
export const ESCRITA = `${BASE}/api/organizacao/admin/instituicao`;
export const REITORIAS = `${BASE}/api/organizacao/unidades`;
export const ID = '01960000-0000-7000-0000-0000000000a1';
export const REITORIA_ID = '01960000-0000-7000-0000-000000000001';

export const reitoria: UnidadeDto = {
  id: REITORIA_ID,
  nome: 'Reitoria',
  alias: null,
  slug: 'reitoria',
  sigla: 'REITORIA',
  codigo: 'REITORIA',
  unidadeSuperiorId: null,
  tipo: TipoUnidadeCodigo.REITORIA,
  unidadeAcademica: false,
  vigenciaInicio: '2026-01-01',
  vigenciaFim: null,
  cidadeCodigoIbge: null,
  cidadeNome: null,
  cidadeUf: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

export const unifesspa: InstituicaoDto = {
  id: ID,
  codigoEmec: '3990',
  nome: 'Universidade Federal do Sul e Sudeste do Pará',
  sigla: 'Unifesspa',
  organizacaoAcademica: 'Universidade',
  categoriaAdministrativa: 'Pública Federal',
  cnpj: null,
  mantenedora: null,
  codigoMantenedoraEmec: null,
  situacao: null,
  atoCredenciamento: null,
  atoRecredenciamento: null,
  conceitoInstitucional: null,
  igc: null,
  website: null,
  cidade: null,
  endereco: null,
  unidadeRaizId: REITORIA_ID,
  criadoEm: '2026-06-10T12:00:00Z',
};

export const problema = (status: number, corpo: object = {}) =>
  [
    JSON.stringify({ type: 'about:blank', title: 'Falha', status, ...corpo }),
    { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
  ] as const;

export const recusaDeCampo = (field: string, message: string) =>
  problema(422, {
    code: 'uniplus.validacao',
    errors: [{ field, code: 'uniplus.organizacao.instituicao.campo_opcional_tamanho', message }],
  });

export const sucesso = () => [null, { status: 204, statusText: 'No Content' }] as const;
export const criado = () => [ID, { status: 201, statusText: 'Created' }] as const;
export const naoCadastrada = () => [null, { status: 404, statusText: 'Not Found' }] as const;

const ehLeitura = (r: HttpRequest<unknown>): boolean => r.url === LEITURA && r.method === 'GET';

/** A leitura pede a versão do contrato que a tela entende (ADR-0028). */
function conferirAccept(req: TestRequest, recurso: 'instituicao' | 'unidade'): TestRequest {
  expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept(recurso, 1));
  return req;
}

function configurarTestBed(): void {
  TestBed.configureTestingModule({
    imports: [InstituicaoPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
      { provide: GEO_BASE_PATH, useValue: BASE },
    ],
  });
}

function criarContexto() {
  const fixture: ComponentFixture<InstituicaoPage> = TestBed.createComponent(InstituicaoPage);
  const http = TestBed.inject(HttpTestingController);
  const app = TestBed.inject(ApplicationRef);
  const injetor = fixture.debugElement.injector;
  const edicao = injetor.get(EdicaoDaInstituicao);
  const store = injetor.get(InstituicaoStore);
  const reitoriasStore = injetor.get(ReitoriasStore);
  const notificacoes = TestBed.inject(NotificationService);
  const sucessos = vi.spyOn(notificacoes, 'success');
  const erros = vi.spyOn(notificacoes, 'errorFromProblem');

  return { fixture, http, app, edicao, store, reitoriasStore, sucessos, erros };
}

type Contexto = ReturnType<typeof criarContexto>;

function criarPropagacao({ fixture, app }: Contexto) {
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

type Propagacao = ReturnType<typeof criarPropagacao>;

function criarRespostas({ http }: Contexto, { propagar }: Propagacao) {
  return {
    async responderLeitura(existente: InstituicaoDto | null): Promise<void> {
      await propagar();
      const leitura = conferirAccept(http.expectOne(ehLeitura), 'instituicao');
      if (existente === null) leitura.flush(...naoCadastrada());
      else leitura.flush(existente);
      await propagar();
    },
  };
}

function criarFalhaLeitura({ http }: Contexto, { propagar }: Propagacao) {
  return {
    async falharLeitura(status: number): Promise<void> {
      await propagar();
      conferirAccept(http.expectOne(ehLeitura), 'instituicao').flush(...problema(status));
      await propagar();
    },
  };
}

function criarInteracoes({ elemento, propagar }: Propagacao) {
  return {
    preencher(nome: string, valor: string): void {
      const campo = elemento<HTMLInputElement>(`[formcontrolname="${nome}"]`);
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
    },
    async acionar(botao: HTMLButtonElement): Promise<void> {
      botao.focus();
      botao.click();
      await propagar();
    },
    confirmacao: (): HTMLElement => elemento('cfg-confirmacao-de-remocao'),
  };
}

function criarFerramentas(contexto: Contexto) {
  const propagacao = criarPropagacao(contexto);
  return {
    ...propagacao,
    ...criarRespostas(contexto, propagacao),
    ...criarFalhaLeitura(contexto, propagacao),
    ...criarInteracoes(propagacao),
  };
}

type Ferramentas = ReturnType<typeof criarFerramentas>;

async function abrirPagina(
  { fixture, http }: Contexto,
  { responderLeitura }: Ferramentas,
  existente: InstituicaoDto | null,
  reitorias: readonly UnidadeDto[] | 'falha',
): Promise<void> {
  fixture.detectChanges();
  const consulta = conferirAccept(
    http.expectOne((r) => r.url === REITORIAS && r.params.get('tipo') === '1'),
    'unidade',
  );
  if (reitorias === 'falha') consulta.flush(...problema(503));
  else consulta.flush([...reitorias]);
  await responderLeitura(existente);
}

function dadosObrigatorios() {
  const { nome, sigla, codigoEmec, organizacaoAcademica, categoriaAdministrativa } = unifesspa;
  return { nome, sigla, codigoEmec, organizacaoAcademica, categoriaAdministrativa };
}

function criarAcaoCadastro({ elemento, preencher, acionar, propagar }: Ferramentas) {
  return {
    /** Clica de verdade em "Cadastrar instituição" e preenche o mínimo para enviar. */
    async abrirCadastro(): Promise<void> {
      await acionar(elemento('#cfg-instituicao-acao'));
      for (const [nome, valor] of Object.entries(dadosObrigatorios())) {
        preencher(nome, valor);
      }
      await propagar();
    },
  };
}

function criarAcoes({ http }: Contexto, { elemento, acionar }: Ferramentas) {
  return {
    async abrirFormulario(): Promise<void> {
      await acionar(elemento('#cfg-instituicao-acao'));
    },
    /** Envia o formulário aberto, com o foco no botão de salvar, e devolve a requisição de escrita. */
    async enviar(url = ESCRITA) {
      await acionar(elemento('button[form="cfg-instituicao-form"]'));
      return http.expectOne((r) => r.url === url && r.method !== 'GET');
    },
  };
}

function criarAcaoRemocao({ http }: Contexto, { elemento, acionar, propagar }: Ferramentas) {
  return {
    async confirmarRemocaoPeloFormulario() {
      await acionar(elemento('#cfg-instituicao-acao'));
      await acionar(elemento('.form-drawer__footer .btn--danger-ghost'));
      elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
      await propagar();
      return http.expectOne(`${ESCRITA}/${ID}`);
    },
  };
}

function criarSeletores({ http }: Contexto, { elemento }: Ferramentas) {
  return {
    acao: (): HTMLButtonElement => elemento('#cfg-instituicao-acao'),
    reitoriasRecarregadas: () =>
      conferirAccept(
        http.expectOne((r) => r.url === REITORIAS && r.params.get('tipo') === '1'),
        'unidade',
      ),
    campo: (nome: string): HTMLInputElement => elemento(`[formcontrolname="${nome}"]`),
    formulario: (): HTMLFormElement => elemento('#cfg-instituicao-form'),
    salvar: (): HTMLButtonElement => elemento('button[form="cfg-instituicao-form"]'),
    remover: (): HTMLButtonElement => elemento('.form-drawer__footer .btn--danger-ghost'),
  };
}

function criarSeletoresConfirmacao({ elemento, confirmacao }: Ferramentas) {
  return {
    confirmar: (): HTMLButtonElement =>
      confirmacao().querySelector('[data-testid="confirm-dialog-confirm"]') as HTMLButtonElement,
    cancelarDaConfirmacao: (): HTMLButtonElement =>
      confirmacao().querySelector('[data-testid="confirm-dialog-cancel"]') as HTMLButtonElement,
    statusDaPagina: (): string =>
      elemento(':scope > span.sr-only[role="status"]').textContent ?? '',
  };
}

function comporPagina(contexto: Contexto, ferramentas: Ferramentas) {
  return {
    ...contexto,
    ...ferramentas,
    ...criarSeletores(contexto, ferramentas),
    ...criarAcoes(contexto, ferramentas),
    ...criarAcaoRemocao(contexto, ferramentas),
    ...criarAcaoCadastro(ferramentas),
    ...criarSeletoresConfirmacao(ferramentas),
  };
}

export async function montarPagina(
  existente: InstituicaoDto | null = unifesspa,
  reitorias: readonly UnidadeDto[] | 'falha' = [reitoria],
) {
  configurarTestBed();
  const contexto = criarContexto();
  const ferramentas = criarFerramentas(contexto);
  await abrirPagina(contexto, ferramentas, existente, reitorias);
  return comporPagina(contexto, ferramentas);
}

export type Pagina = Awaited<ReturnType<typeof montarPagina>>;
