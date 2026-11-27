import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { PUBLICACOES_BASE_PATH, TipoAtoPublicadoDto } from '@uniplus/shared-data/publicacoes';
import { vi } from 'vitest';
import { InteracaoComATela } from '../../shared/interacao-com-a-tela/interacao-com-a-tela.testing';
import { EdicaoDosTiposAto } from './edicao-dos-tipos-ato';
import { TiposAtoPage } from './tipos-ato.page';
import { TiposAtoStore } from './tipos-ato.store';

const BASE = 'http://localhost:5000';
export const LISTA = `${BASE}/api/publicacoes/tipos-ato`;
export const ESCRITA = `${BASE}/api/publicacoes/admin/tipos-ato`;
export const TITULO_DA_LISTA = '#cfg-tipos-ato-list-title';

export const preliminar: TipoAtoPublicadoDto = {
  id: '01960000-0000-7000-0000-0000000000a1',
  codigo: 'RESULTADO_PRELIMINAR_INSCRICAO',
  nome: 'Resultado preliminar da inscrição',
  congelaConfiguracao: true,
  unicoPorObjeto: false,
  efeitoIrreversivel: false,
  ehResultado: true,
  publicavelComoAvulso: false,
  exigeAtoCorrigido: false,
  vigenciaInicio: '2026-01-01',
  vigenciaFim: null,
  baseLegal: null,
  criadoEm: '2026-08-30T12:00:00Z',
};

export const aviso: TipoAtoPublicadoDto = {
  ...preliminar,
  id: '01960000-0000-7000-0000-0000000000a2',
  codigo: 'AVISO',
  nome: 'Aviso',
  congelaConfiguracao: false,
  ehResultado: false,
  publicavelComoAvulso: true,
  vigenciaFim: '2026-06-30',
};

export const problema = (status: number, corpo: object = {}) =>
  [
    JSON.stringify({ type: 'about:blank', title: 'Falha', status, ...corpo }),
    { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
  ] as const;

export const recusaDeCampo = (
  field: string,
  message: string,
  code = 'uniplus.publicacoes.tipo_ato.nome_tamanho',
) =>
  problema(422, {
    code: 'uniplus.validacao',
    errors: [{ field, code, message }],
  });

export const sucesso = () => [null, { status: 204, statusText: 'No Content' }] as const;
export const criado = () => ['novo-id', { status: 201, statusText: 'Created' }] as const;

/** O nome acessível que distingue as vigências de um mesmo código. */
export const identificacaoDe = (ato: TipoAtoPublicadoDto): string => {
  const [ano, mes, dia] = ato.vigenciaInicio.split('-');
  return `${ato.codigo}, vigência iniciada em ${dia}/${mes}/${ano}`;
};

function prepararModulo(): void {
  TestBed.configureTestingModule({
    imports: [TiposAtoPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: PUBLICACOES_BASE_PATH, useValue: BASE },
    ],
  });
}

function servicosDaPagina(fixture: ComponentFixture<TiposAtoPage>) {
  const injetor = fixture.debugElement.injector;
  const notificacoes = TestBed.inject(NotificationService);
  return {
    edicao: injetor.get(EdicaoDosTiposAto),
    store: injetor.get(TiposAtoStore),
    sucessos: vi.spyOn(notificacoes, 'success'),
    erros: vi.spyOn(notificacoes, 'errorFromProblem'),
    informacoes: vi.spyOn(notificacoes, 'info'),
  };
}

function botoesDaPagina({ elemento, pelaEtiqueta }: InteracaoComATela) {
  const dialogoDaRemocao = (): HTMLElement => elemento('cfg-confirmacao-de-remocao');
  const doDialogo = (id: string): HTMLButtonElement =>
    dialogoDaRemocao().querySelector(`[data-testid="${id}"]`) as HTMLButtonElement;
  return {
    novo: (): HTMLButtonElement => elemento('#cfg-tipos-ato-novo'),
    editar: (a: TipoAtoPublicadoDto = preliminar) =>
      pelaEtiqueta(`Editar tipo de ato ${identificacaoDe(a)}`),
    remover: (a: TipoAtoPublicadoDto = preliminar) =>
      pelaEtiqueta(`Remover vigência do tipo de ato ${identificacaoDe(a)}`),
    salvar: (): HTMLButtonElement => elemento('button[form="cfg-tipo-ato-form"]'),
    confirmar: (): HTMLButtonElement => doDialogo('confirm-dialog-confirm'),
    cancelarDaConfirmacao: (): HTMLButtonElement => doDialogo('confirm-dialog-cancel'),
  };
}

function camposDaPagina({ elemento }: InteracaoComATela) {
  return {
    formulario: (): HTMLFormElement => elemento('#cfg-tipo-ato-form'),
    campo: (nome: string): HTMLInputElement => elemento(`[formcontrolname="${nome}"]`),
    statusDaPagina: (): string =>
      elemento(':scope > span.sr-only[role="status"]').textContent ?? '',
  };
}

async function preencherOMinimoDoCadastro(tela: InteracaoComATela): Promise<void> {
  tela.preencher('codigo', 'resultado_preliminar_inscricao');
  tela.preencher('nome', 'Resultado preliminar da inscrição');
  tela.preencher('vigenciaInicio', '2026-01-01');
  tela.responder('publicavelComoAvulso', false);
  tela.responder('exigeAtoCorrigido', false);
  await tela.propagar();
}

function roteirosDeAbertura(tela: InteracaoComATela) {
  return {
    /** Clica de verdade em "Novo tipo de ato" e preenche o mínimo para enviar. */
    async abrirCadastro(): Promise<void> {
      await tela.acionar(tela.elemento('#cfg-tipos-ato-novo'));
      await preencherOMinimoDoCadastro(tela);
    },
    async abrirEdicao(ato: TipoAtoPublicadoDto = preliminar): Promise<void> {
      await tela.acionar(tela.pelaEtiqueta(`Editar tipo de ato ${identificacaoDe(ato)}`));
    },
  };
}

function roteirosDeEnvio(tela: InteracaoComATela, http: HttpTestingController) {
  return {
    /** Envia o formulário aberto, com o foco no botão de salvar, e devolve a requisição de escrita. */
    async enviar(url = ESCRITA) {
      await tela.acionar(tela.elemento('button[form="cfg-tipo-ato-form"]'));
      return http.expectOne((r) => r.url === url && r.method !== 'GET');
    },
  };
}

function roteirosDeRemocao(tela: InteracaoComATela, http: HttpTestingController) {
  return {
    async confirmarRemocao(ato: TipoAtoPublicadoDto = preliminar) {
      const remover = tela.pelaEtiqueta(`Remover vigência do tipo de ato ${identificacaoDe(ato)}`);
      await tela.acionar(remover);
      tela.elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
      await tela.propagar();
      return http.expectOne(`${ESCRITA}/${ato.id}`);
    },
  };
}

async function carregarLista(
  { propagar }: InteracaoComATela,
  http: HttpTestingController,
  itens: readonly TipoAtoPublicadoDto[],
): Promise<void> {
  http.expectOne((r) => r.url === LISTA).flush(itens);
  await propagar();
}

async function recarregar(
  tela: InteracaoComATela,
  http: HttpTestingController,
  lista: readonly TipoAtoPublicadoDto[],
): Promise<void> {
  await tela.propagar();
  await carregarLista(tela, http, lista);
}

async function carregarPagina(itens: readonly TipoAtoPublicadoDto[]) {
  prepararModulo();
  const fixture = TestBed.createComponent(TiposAtoPage);
  const http = TestBed.inject(HttpTestingController);
  const tela = new InteracaoComATela(fixture);
  const servicos = servicosDaPagina(fixture);
  fixture.detectChanges();
  await carregarLista(tela, http, itens);
  return { fixture, http, tela, servicos };
}

/** A página montada com a lista já carregada, e as ferramentas para conduzi-la como a pessoa faz. */
export async function montarPagina(itens: readonly TipoAtoPublicadoDto[] = [preliminar, aviso]) {
  const { fixture, http, tela, servicos } = await carregarPagina(itens);
  return {
    fixture,
    http,
    ...servicos,
    ...tela,
    recarregarCom: (lista: readonly TipoAtoPublicadoDto[]) => recarregar(tela, http, lista),
    ...botoesDaPagina(tela),
    ...camposDaPagina(tela),
    ...roteirosDeAbertura(tela),
    ...roteirosDeEnvio(tela, http),
    ...roteirosDeRemocao(tela, http),
  };
}

export type Pagina = Awaited<ReturnType<typeof montarPagina>>;
