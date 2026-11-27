import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CONFIGURACAO_BASE_PATH, TipoProcessoDto } from '@uniplus/shared-data/configuracao';
import { vi } from 'vitest';
import { InteracaoComATela } from '../../shared/interacao-com-a-tela/interacao-com-a-tela.testing';
import { EdicaoDosTiposProcesso } from './edicao-dos-tipos-processo';
import { TiposProcessoPage } from './tipos-processo.page';
import { TiposProcessoStore } from './tipos-processo.store';

const BASE = 'http://localhost:5000';
export const LISTA = `${BASE}/api/configuracao/admin/tipos-processo`;
export const TITULO_DA_LISTA = '#cfg-tipos-processo-list-title';
export const PERMISSAO_DE_MANTER = 'configuracao:tipos-processo:manter';
export const PERMISSAO_DE_CONSULTAR = 'configuracao:tipos-processo:consultar';

export const sisu: TipoProcessoDto = {
  id: '01960000-0000-7000-0000-000000000051',
  codigo: 'SISU',
  nome: 'SiSU',
  descricao: 'Sistema de Seleção Unificada.',
  ativo: true,
  criadoEm: '2026-08-11T12:00:00Z',
};

export const vestibular: TipoProcessoDto = {
  id: '01960000-0000-7000-0000-0000000000f0',
  codigo: 'VESTIBULAR_TRAD',
  nome: 'Vestibular tradicional',
  descricao: null,
  ativo: false,
  criadoEm: '2026-05-01T12:00:00Z',
};

export const problema = (status: number, corpo: object = {}) =>
  [
    JSON.stringify({ type: 'about:blank', title: 'Falha', status, ...corpo }),
    { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
  ] as const;

export const recusaDeCampo = (field: string, message: string) =>
  problema(422, {
    code: 'uniplus.validacao',
    errors: [{ field, code: 'uniplus.configuracao.tipo_processo.nome_tamanho', message }],
  });

export const sucesso = () => [null, { status: 204, statusText: 'No Content' }] as const;
export const criado = () => ['novo-id', { status: 201, statusText: 'Created' }] as const;

type Confirmacao = 'desativar' | 'reativar';

function prepararModulo(permissoes: WritableSignal<readonly string[]>): void {
  TestBed.configureTestingModule({
    imports: [TiposProcessoPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      { provide: PermissoesService, useValue: { tem: (c: string) => permissoes().includes(c) } },
    ],
  });
}

function servicosDaPagina(
  fixture: ComponentFixture<TiposProcessoPage>,
  permissoes: WritableSignal<readonly string[]>,
) {
  const injetor = fixture.debugElement.injector;
  const notificacoes = TestBed.inject(NotificationService);
  return {
    permissoes,
    edicao: injetor.get(EdicaoDosTiposProcesso),
    store: injetor.get(TiposProcessoStore),
    sucessos: vi.spyOn(notificacoes, 'success'),
    erros: vi.spyOn(notificacoes, 'errorFromProblem'),
  };
}

function botoesDaListagem({ pelaEtiqueta, elemento }: InteracaoComATela) {
  return {
    novo: (): HTMLButtonElement => elemento('#cfg-tipos-processo-novo'),
    editar: (t: TipoProcessoDto = sisu) => pelaEtiqueta(`Editar tipo de processo ${t.codigo}`),
    desativar: (t: TipoProcessoDto = sisu) =>
      pelaEtiqueta(`Desativar tipo de processo ${t.codigo}`),
    reativar: (t: TipoProcessoDto = vestibular) =>
      pelaEtiqueta(`Reativar tipo de processo ${t.codigo}`),
    salvar: (): HTMLButtonElement => elemento('button[form="cfg-tipo-processo-form"]'),
  };
}

function confirmacaoDaPagina({ elemento }: InteracaoComATela) {
  const confirmacao = (qual: Confirmacao): HTMLElement =>
    elemento(`cfg-confirmacao-de-remocao:nth-of-type(${qual === 'desativar' ? 1 : 2})`);
  const doDialogo = (qual: Confirmacao, id: string): HTMLButtonElement =>
    confirmacao(qual).querySelector(`[data-testid="${id}"]`) as HTMLButtonElement;
  return {
    confirmacao,
    confirmar: (qual: Confirmacao = 'desativar') => doDialogo(qual, 'confirm-dialog-confirm'),
    cancelarDaConfirmacao: (qual: Confirmacao = 'desativar') =>
      doDialogo(qual, 'confirm-dialog-cancel'),
  };
}

function camposDaPagina({ elemento }: InteracaoComATela) {
  return {
    formulario: (): HTMLFormElement => elemento('#cfg-tipo-processo-form'),
    campo: (nome: string): HTMLInputElement => elemento(`[formcontrolname="${nome}"]`),
    statusDaPagina: (): string =>
      elemento(':scope > span.sr-only[role="status"]').textContent ?? '',
  };
}

function roteirosDeAbertura(tela: InteracaoComATela) {
  return {
    /** Clica de verdade em "Novo tipo de processo" e preenche o mínimo para enviar. */
    async abrirCadastro(): Promise<void> {
      await tela.acionar(tela.elemento('#cfg-tipos-processo-novo'));
      tela.preencher('nome', 'Processo seletivo');
      await tela.propagar();
    },
    async abrirEdicao(tipo: TipoProcessoDto = sisu): Promise<void> {
      await tela.acionar(tela.pelaEtiqueta(`Editar tipo de processo ${tipo.codigo}`));
    },
  };
}

function roteirosDeEnvio(tela: InteracaoComATela, http: HttpTestingController) {
  return {
    /** Envia o formulário aberto, com o foco no botão de salvar, e devolve a requisição de escrita. */
    async enviar(url = LISTA) {
      await tela.acionar(tela.elemento('button[form="cfg-tipo-processo-form"]'));
      return http.expectOne((r) => r.url === url && r.method !== 'GET');
    },
  };
}

async function confirmarNaOpcao(
  tela: InteracaoComATela,
  opcao: number,
  botao: HTMLButtonElement,
): Promise<void> {
  await tela.acionar(botao);
  const confirmar = `cfg-confirmacao-de-remocao:nth-of-type(${opcao}) [data-testid="confirm-dialog-confirm"]`;
  tela.elemento<HTMLButtonElement>(confirmar).click();
  await tela.propagar();
}

function roteirosDeDesativacao(tela: InteracaoComATela, http: HttpTestingController) {
  return {
    async confirmarDesativacao(tipo: TipoProcessoDto = sisu) {
      await confirmarNaOpcao(
        tela,
        1,
        tela.pelaEtiqueta(`Desativar tipo de processo ${tipo.codigo}`),
      );
      return http.expectOne(`${LISTA}/${tipo.id}`);
    },
  };
}

function roteirosDeReativacao(tela: InteracaoComATela, http: HttpTestingController) {
  return {
    async confirmarReativacao(tipo: TipoProcessoDto = vestibular) {
      await confirmarNaOpcao(
        tela,
        2,
        tela.pelaEtiqueta(`Reativar tipo de processo ${tipo.codigo}`),
      );
      return http.expectOne(`${LISTA}/${tipo.id}/ativacao`);
    },
  };
}

function localizadoresDaPagina(tela: InteracaoComATela) {
  return { ...botoesDaListagem(tela), ...confirmacaoDaPagina(tela), ...camposDaPagina(tela) };
}

function roteirosDoOperador(tela: InteracaoComATela, http: HttpTestingController) {
  return {
    ...roteirosDeAbertura(tela),
    ...roteirosDeEnvio(tela, http),
    ...roteirosDeDesativacao(tela, http),
    ...roteirosDeReativacao(tela, http),
  };
}

async function carregarLista(
  tela: InteracaoComATela,
  http: HttpTestingController,
  itens: readonly TipoProcessoDto[],
): Promise<void> {
  http.expectOne((r) => r.url === LISTA && r.method === 'GET').flush(itens);
  await tela.propagar();
}

async function recarregar(
  tela: InteracaoComATela,
  http: HttpTestingController,
  lista: readonly TipoProcessoDto[],
): Promise<void> {
  await tela.propagar();
  await carregarLista(tela, http, lista);
}

async function carregarPagina(itens: readonly TipoProcessoDto[], concedidas: readonly string[]) {
  const permissoes = signal<readonly string[]>(concedidas);
  prepararModulo(permissoes);
  const fixture = TestBed.createComponent(TiposProcessoPage);
  const http = TestBed.inject(HttpTestingController);
  const tela = new InteracaoComATela(fixture);
  const servicos = servicosDaPagina(fixture, permissoes);
  fixture.detectChanges();
  await carregarLista(tela, http, itens);
  return { fixture, http, tela, servicos };
}

/** A página montada com a lista já carregada, e as ferramentas para conduzi-la como a pessoa faz. */
export async function montarPagina(
  itens: readonly TipoProcessoDto[] = [sisu, vestibular],
  concedidas: readonly string[] = [PERMISSAO_DE_MANTER],
) {
  const { fixture, http, tela, servicos } = await carregarPagina(itens, concedidas);
  return {
    fixture,
    http,
    ...servicos,
    ...tela,
    recarregarCom: (lista: readonly TipoProcessoDto[]) => recarregar(tela, http, lista),
    ...localizadoresDaPagina(tela),
    ...roteirosDoOperador(tela, http),
  };
}

export type Pagina = Awaited<ReturnType<typeof montarPagina>>;
