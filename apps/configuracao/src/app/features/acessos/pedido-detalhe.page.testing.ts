import {
  HttpResponse,
  provideHttpClient,
  withInterceptors,
  type HttpInterceptorFn,
} from '@angular/common/http';
import { signal, type EnvironmentProviders, type Provider } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { map, of, type Observable } from 'rxjs';
import { vi } from 'vitest';
import { PermissoesService, UserContextService } from '@uniplus/shared-auth/bootstrap';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { AUTORIZACAO_BASE_PATH, PedidosDeConcessaoApi } from '@uniplus/shared-data/autorizacao';
import { UnidadesApi } from '@uniplus/shared-data/organizacao';
import { AnexoDoPedidoService } from './anexo-do-pedido.service';
import { EdicaoDoPedido } from './edicao-do-pedido';
import { PedidoDetalhePage } from './pedido-detalhe.page';
import { EU, UNIDADES, concedidas, ok, pedido, recusa } from './testes';

/** Apoio dos specs da página do pedido: dublês da API, montagem da página e interações. */

export function presente<T>(valor: T | null | undefined): T {
  if (valor == null) throw new Error('elemento ausente');
  return valor;
}

export const MENSAGEM_DA_FALHA = 'Servidor indisponível';
export const servidorIndisponivel = () =>
  recusa('uniplus.internal.unexpected', 503, MENSAGEM_DA_FALHA);

export const GESTOR = 'autorizacao:pedidos:aprovar-funcional';
export const PROTECAO_DE_DADOS = 'autorizacao:pedidos:aprovar-protecao-de-dados';

export async function esperar(fixture: { detectChanges(): void }): Promise<void> {
  await new Promise((resolver) => setTimeout(resolver));
  fixture.detectChanges();
}

export type Cena = ComponentFixture<PedidoDetalhePage>;

export const botao = (raiz: ParentNode | null, texto: string): HTMLButtonElement | undefined =>
  [...(raiz?.querySelectorAll('button') ?? [])].find((b) => b.textContent?.trim() === texto);
export const noResumo = (host: HTMLElement) => host.querySelector('cfg-pedido-resumo');
export const dialogoDeConfirmacao = (host: HTMLElement) => host.querySelector(':scope > ui-dialog');
export const dialogoDeMotivo = (host: HTMLElement) => host.querySelector('cfg-motivo-dialog');
export const edicaoDe = (fixture: Cena) => fixture.debugElement.injector.get(EdicaoDoPedido);

export async function clicar(
  fixture: Cena,
  elemento: HTMLElement | null | undefined,
): Promise<void> {
  presente(elemento).click();
  await esperar(fixture);
}

export const decidirNoResumo = (fixture: Cena, host: HTMLElement, texto: string) =>
  clicar(fixture, botao(noResumo(host), texto));

export const botaoDeConfirmacao = (host: HTMLElement) =>
  presente(
    dialogoDeConfirmacao(host)?.querySelector<HTMLButtonElement>(
      '.uni-dialog__footer .btn--primary, .uni-dialog__footer .btn--danger',
    ),
  );

export const confirmarNoDialogo = (fixture: Cena, host: HTMLElement) =>
  clicar(fixture, botaoDeConfirmacao(host));

export const campoDoMotivo = (host: HTMLElement) =>
  host.querySelector<HTMLTextAreaElement>('cfg-motivo-dialog textarea');

export async function escreverMotivo(
  fixture: Cena,
  host: HTMLElement,
  texto: string,
): Promise<void> {
  const campo = presente(campoDoMotivo(host));
  campo.value = texto;
  campo.dispatchEvent(new Event('input'));
  await esperar(fixture);
}

export const confirmarRecusa = (fixture: Cena, host: HTMLElement) =>
  clicar(fixture, botao(dialogoDeMotivo(host), 'Recusar pedido'));

export async function recusarComMotivo(
  fixture: Cena,
  host: HTMLElement,
  motivo: string,
): Promise<void> {
  await decidirNoResumo(fixture, host, 'Recusar');
  await escreverMotivo(fixture, host, motivo);
  await confirmarRecusa(fixture, host);
}

export const decisoesOferecidas = (host: HTMLElement) =>
  ['Aprovar', 'Recusar'].map((texto) => botao(noResumo(host), texto) !== undefined);

export const dialogoAberto = (host: HTMLElement, seletor: string) =>
  host.querySelector(`${seletor} dialog[open]`) !== null;

export const dialogoMotivoAlerta = (host: HTMLElement) =>
  host.querySelector('cfg-motivo-dialog ui-alert')?.textContent ?? undefined;
export const textoDoAlerta = (host: HTMLElement) => host.querySelector('ui-alert')?.textContent;
export const titulosDosAlertas = (host: HTMLElement) =>
  Array.from(host.querySelectorAll('ui-alert .alert__title'), (titulo) =>
    titulo.textContent?.trim(),
  );

export async function selecionarArquivo(
  fixture: Cena,
  host: HTMLElement,
  arquivo: File,
): Promise<void> {
  const seletor = presente(
    host.querySelector<HTMLInputElement>('cfg-pedido-documentos input[type="file"]'),
  );
  Object.defineProperty(seletor, 'files', { value: [arquivo], configurable: true });
  seletor.dispatchEvent(new Event('change'));
  await esperar(fixture);
}

export const pdf = () => new File(['%PDF'], 'd.pdf', { type: 'application/pdf' });

/** Os dublês da API de pedidos, do anexo e das notificações, compartilhados pelos casos de um spec. */
export function dublesDoPedido() {
  return {
    api: {
      obter: vi.fn(),
      trilha: vi.fn(),
      aprovar: vi.fn(),
      aceitar: vi.fn(),
      recusar: vi.fn(),
      cancelar: vi.fn(),
    },
    anexos: { anexar: vi.fn(), abrir: vi.fn() },
    notificacoes: { success: vi.fn(), errorFromProblem: vi.fn() },
  };
}

export type DublesDoPedido = ReturnType<typeof dublesDoPedido>;

/** A leitura do pedido e da trilha passa pelo `HttpClient`, como na página; a resposta vem do dublê. */
function leituraPelosDubles(api: DublesDoPedido['api']): HttpInterceptorFn {
  const ultimoSegmento = (url: string, recuo: number) =>
    decodeURIComponent(url.split('/').at(recuo) ?? '');
  return (req) => {
    const resposta: Observable<unknown> = req.url.endsWith('/trilha')
      ? api.trilha(ultimoSegmento(req.url, -2))
      : api.obter(ultimoSegmento(req.url, -1));
    return resposta.pipe(map((body) => new HttpResponse({ body })));
  };
}

/** A API dublada: a leitura passa pelo `HttpClient`; as escritas e o anexo vão direto aos dublês. */
function provedoresDaApi(dubles: DublesDoPedido): (Provider | EnvironmentProviders)[] {
  return [
    { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
    provideHttpClient(withInterceptors([leituraPelosDubles(dubles.api)])),
    { provide: PedidosDeConcessaoApi, useValue: dubles.api },
    { provide: AnexoDoPedidoService, useValue: dubles.anexos },
    { provide: UnidadesApi, useValue: { listar: () => of(ok(UNIDADES)) } },
  ];
}

/** Os provedores da página com os dublês, as permissões concedidas e a pessoa autenticada. */
export function provedoresDaPagina(
  dubles: DublesDoPedido,
  permissoes: readonly string[],
  usuario: Partial<typeof EU> = {},
): (Provider | EnvironmentProviders)[] {
  return [
    ...provedoresDaApi(dubles),
    provideRouter([]),
    { provide: NotificationService, useValue: dubles.notificacoes },
    { provide: PermissoesService, useValue: concedidas(...permissoes) },
    { provide: UserContextService, useValue: { user: signal({ ...EU, ...usuario }) } },
  ];
}

/** Monta a página com o id do pedido e espera a primeira leitura. */
export async function montarPagina(id: string): Promise<Cena> {
  const fixture = TestBed.createComponent(PedidoDetalhePage);
  fixture.componentRef.setInput('id', id);
  fixture.detectChanges();
  await esperar(fixture);
  return fixture;
}

/**
 * Abre a página com o pedido dado, para quem tem as permissões dadas. Zera os dublês, configura a
 * leitura com o pedido e a trilha vazia e substitui a navegação.
 */
export function abrirPedido(dubles: DublesDoPedido) {
  return async (permissoes: string[], resposta = pedido(), usuario: Partial<typeof EU> = {}) => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
    dubles.api.obter.mockReturnValue(of(ok(resposta)));
    dubles.api.trilha.mockReturnValue(of(ok([])));
    TestBed.configureTestingModule({ providers: provedoresDaPagina(dubles, permissoes, usuario) });
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = await montarPagina(resposta.id);
    return { fixture, navegar, host: fixture.nativeElement as HTMLElement };
  };
}

export const solicitadoPorMim = () => pedido({ solicitante: { emissor: 'unifesspa', sub: EU.id } });
