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
  tipo: 'Reitoria',
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

/** A página montada com a leitura já respondida, e as ferramentas para conduzi-la como a pessoa faz. */
export async function montarPagina(
  existente: InstituicaoDto | null = unifesspa,
  reitorias: readonly UnidadeDto[] | 'falha' = [reitoria],
) {
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
  /** Responde a leitura da Instituição: o cadastro existente ou, com `null`, o 404 de nenhuma cadastrada. */
  const responderLeitura = async (existente: InstituicaoDto | null): Promise<void> => {
    await propagar();
    const leitura = conferirAccept(http.expectOne(ehLeitura), 'instituicao');
    if (existente === null) leitura.flush(...naoCadastrada());
    else leitura.flush(existente);
    await propagar();
  };
  const falharLeitura = async (status: number): Promise<void> => {
    await propagar();
    conferirAccept(http.expectOne(ehLeitura), 'instituicao').flush(...problema(status));
    await propagar();
  };
  const preencher = (nome: string, valor: string): void => {
    const campo = elemento<HTMLInputElement>(`[formcontrolname="${nome}"]`);
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  };
  const acionar = async (botao: HTMLButtonElement): Promise<void> => {
    botao.focus();
    botao.click();
    await propagar();
  };
  const confirmacao = (): HTMLElement => elemento('cfg-confirmacao-de-remocao');

  fixture.detectChanges();
  const consultaDeReitorias = conferirAccept(
    http.expectOne((r) => r.url === REITORIAS && r.params.get('tipo') === '1'),
    'unidade',
  );
  if (reitorias === 'falha') consultaDeReitorias.flush(...problema(503));
  else consultaDeReitorias.flush([...reitorias]);
  await responderLeitura(existente);

  return {
    fixture,
    http,
    edicao,
    store,
    reitoriasStore,
    sucessos,
    erros,
    propagar,
    elemento,
    responderLeitura,
    falharLeitura,
    preencher,
    confirmacao,
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
    confirmar: (): HTMLButtonElement =>
      confirmacao().querySelector('[data-testid="confirm-dialog-confirm"]') as HTMLButtonElement,
    cancelarDaConfirmacao: (): HTMLButtonElement =>
      confirmacao().querySelector('[data-testid="confirm-dialog-cancel"]') as HTMLButtonElement,
    statusDaPagina: (): string =>
      elemento(':scope > span.sr-only[role="status"]').textContent ?? '',
    /** Clica de verdade em "Cadastrar instituição" e preenche o mínimo para enviar. */
    async abrirCadastro(): Promise<void> {
      await acionar(elemento('#cfg-instituicao-acao'));
      for (const [nome, valor] of Object.entries({
        nome: unifesspa.nome,
        sigla: unifesspa.sigla,
        codigoEmec: unifesspa.codigoEmec,
        organizacaoAcademica: unifesspa.organizacaoAcademica,
        categoriaAdministrativa: unifesspa.categoriaAdministrativa,
      })) {
        preencher(nome, valor);
      }
      await propagar();
    },
    async abrirFormulario(): Promise<void> {
      await acionar(elemento('#cfg-instituicao-acao'));
    },
    /** Envia o formulário aberto, com o foco no botão de salvar, e devolve a requisição de escrita. */
    async enviar(url = ESCRITA) {
      await acionar(elemento('button[form="cfg-instituicao-form"]'));
      return http.expectOne((r) => r.url === url && r.method !== 'GET');
    },
    /** Abre a edição, pede a remoção pelo botão do formulário e confirma; devolve o DELETE. */
    async confirmarRemocaoPeloFormulario() {
      await acionar(elemento('#cfg-instituicao-acao'));
      await acionar(elemento('.form-drawer__footer .btn--danger-ghost'));
      elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
      await propagar();
      return http.expectOne(`${ESCRITA}/${ID}`);
    },
  };
}

export type Pagina = Awaited<ReturnType<typeof montarPagina>>;
