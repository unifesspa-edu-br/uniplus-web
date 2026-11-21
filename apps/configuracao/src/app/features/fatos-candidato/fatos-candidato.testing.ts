import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef, signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CONFIGURACAO_BASE_PATH,
  type FatoCandidatoDto,
  type FatoCandidatoView,
} from '@uniplus/shared-data/configuracao';
import { expect, vi } from 'vitest';
import { EdicaoDoFato } from './edicao-do-fato';
import { EdicaoDosFatos } from './edicao-dos-fatos';
import {
  FASES_DA_API,
  corRaca,
  emManutencao,
  noCatalogo,
  trabalha,
} from './fatos-candidato.fixtures';
import { FatosCandidatoPage } from './fatos-candidato.page';
import { FatosCandidatoStore } from './fatos-candidato.store';

const BASE = 'http://localhost:5000';
export const LISTA = `${BASE}/api/configuracao/admin/fatos-candidato`;
export const CATALOGO = `${BASE}/api/configuracao/fatos-candidato`;
export const FASES = `${BASE}/api/configuracao/fases-canonicas`;
export const PROTECAO = `${BASE}/api/configuracao/admin/protecao-do-catalogo`;
export const TITULO_DA_LISTA = 'cfg-fatos-list-title';
export const PERMISSAO_DE_MANTER = 'configuracao:fatos-candidato:manter';
export const PERMISSAO_DE_CONSULTAR = 'configuracao:fatos-candidato:consultar';

export const problema = (status: number, corpo: object = {}) =>
  [
    JSON.stringify({ type: 'about:blank', title: 'Falha', status, ...corpo }),
    { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
  ] as const;

export const recusaDeCampo = (field: string, message: string, code = 'x') =>
  problema(422, {
    code: 'uniplus.validation_failed',
    title: 'Requisição inválida',
    errors: [{ field, code, message }],
  });

export const sucesso = () => [null, { status: 204, statusText: 'No Content' }] as const;
export const criado = (id = 'novo-id') => [id, { status: 201, statusText: 'Created' }] as const;

export const urlDoFato = (fato: FatoCandidatoDto): string => `${LISTA}/${fato.id}`;

export interface OpcoesDaPagina {
  readonly concedidas?: readonly string[];
  readonly pendencias?: readonly unknown[];
}

/** O dublê das permissões, que a diretiva consulta por uma ou por qualquer de várias. */
function permissoesConcedidas(concedidas: () => readonly string[]) {
  const tem = (codigo: string) => concedidas().includes(codigo);
  return { tem, temAlguma: (...codigos: string[]) => codigos.some(tem) };
}

function configurarModulo(concedidas: () => readonly string[]): void {
  TestBed.configureTestingModule({
    imports: [FatosCandidatoPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      { provide: PermissoesService, useValue: permissoesConcedidas(concedidas) },
    ],
  });
}

/** A página montada, e as ferramentas para conduzi-la como a pessoa faz. */
export class PaginaDosFatos {
  readonly fixture: ComponentFixture<FatosCandidatoPage> =
    TestBed.createComponent(FatosCandidatoPage);
  readonly http = TestBed.inject(HttpTestingController);
  private readonly app = TestBed.inject(ApplicationRef);
  private readonly injetor = this.fixture.debugElement.injector;
  readonly edicao = this.injetor.get(EdicaoDosFatos);
  readonly editor = this.injetor.get(EdicaoDoFato);
  readonly store = this.injetor.get(FatosCandidatoStore);
  private readonly notificacoes = TestBed.inject(NotificationService);
  readonly sucessos = vi.spyOn(this.notificacoes, 'success');
  readonly erros = vi.spyOn(this.notificacoes, 'errorFromProblem');
  readonly informacoes = vi.spyOn(this.notificacoes, 'info');

  constructor(readonly permissoes: WritableSignal<readonly string[]>) {}

  readonly propagar = async (): Promise<void> => {
    await Promise.resolve();
    this.app.tick();
    this.fixture.detectChanges();
  };
  readonly raiz = (): HTMLElement => this.fixture.nativeElement as HTMLElement;
  readonly elemento = <T extends HTMLElement>(seletor: string): T => {
    const encontrado = this.raiz().querySelector<T>(seletor);
    expect(encontrado, seletor).not.toBeNull();
    return encontrado as T;
  };
  readonly existe = (seletor: string): boolean => this.raiz().querySelector(seletor) !== null;
  readonly texto = (seletor?: string): string =>
    ((seletor ? this.elemento(seletor) : this.raiz()).textContent ?? '').replace(/\s+/gu, ' ');
  readonly pelaEtiqueta = (nome: string): HTMLButtonElement =>
    this.elemento(`button[aria-label="${nome}"]`);
  readonly botaoPeloTexto = (
    rotulo: string,
    dentro: ParentNode = this.raiz(),
  ): HTMLButtonElement | undefined =>
    [...dentro.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.replace(/\s+/gu, ' ').trim() === rotulo,
    );
  readonly acionar = async (botao: HTMLElement): Promise<void> => {
    botao.focus();
    botao.click();
    await this.propagar();
  };
  /** A releitura da lista que a escrita pede; a ausência dela é falha do teste, não indiferença. */
  readonly pedidoDaLista = (): TestRequest =>
    this.http.expectOne((r) => r.url === LISTA && r.method === 'GET');
  readonly atenderPendencias = (itensPendentes: readonly unknown[] = []): void => {
    for (const req of this.http.match((r) => r.url === PROTECAO)) {
      if (!req.cancelled) req.flush(itensPendentes);
    }
  };
  readonly recarregarCom = async (
    lista: readonly FatoCandidatoDto[],
    pendentes: readonly unknown[] = [],
  ): Promise<void> => {
    await this.propagar();
    this.pedidoDaLista().flush(lista.map(emManutencao));
    this.atenderPendencias(pendentes);
    await this.propagar();
  };
  readonly digitar = (seletor: string, valor: string): void => {
    const campo = this.elemento<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      seletor,
    );
    campo.value = valor;
    campo.dispatchEvent(new Event(campo instanceof HTMLSelectElement ? 'change' : 'input'));
  };
  readonly submeter = (seletor: string): void => {
    this.elemento<HTMLFormElement>(seletor).dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
  };
  readonly atenderApoios = (catalogo: readonly FatoCandidatoView[] = []): void => {
    for (const req of this.http.match((r) => r.url === CATALOGO && r.method === 'GET')) {
      if (!req.cancelled) req.flush(catalogo.map(noCatalogo));
    }
    for (const req of this.http.match((r) => r.url === FASES && r.method === 'GET')) {
      if (!req.cancelled) req.flush(FASES_DA_API);
    }
  };
  readonly titulo = (): HTMLElement => this.elemento(`#${TITULO_DA_LISTA}`);
  readonly novo = (): HTMLButtonElement => this.elemento('#cfg-fatos-novo');
  readonly editar = (f: FatoCandidatoDto = trabalha) =>
    this.pelaEtiqueta(`Editar o fato ${f.codigo}`);
  readonly desativar = (f: FatoCandidatoDto = trabalha) =>
    this.pelaEtiqueta(`Desativar o fato ${f.codigo}`);
  readonly reativar = (f: FatoCandidatoDto = trabalha) =>
    this.pelaEtiqueta(`Reativar o fato ${f.codigo}`);
  readonly nomeDaLinha = (f: FatoCandidatoDto = trabalha) =>
    this.pelaEtiqueta(`Ver o detalhe de ${f.descritivo.nome}`);
  readonly drawerDoFato = (): HTMLDialogElement =>
    this.elemento('dialog[aria-label="Fato do candidato"]');
  readonly detalhe = (): HTMLDialogElement =>
    this.elemento('dialog[aria-label="Detalhe do fato do candidato"]');
  readonly statusDaPagina = (): string =>
    this.elemento(':scope > span.sr-only[role="status"]').textContent ?? '';

  /** Carrega a lista e a situação da proteção, como a página faz ao abrir. */
  async carregar(
    itens: readonly FatoCandidatoDto[],
    pendencias: readonly unknown[],
  ): Promise<void> {
    this.fixture.detectChanges();
    this.pedidoDaLista().flush(itens.map(emManutencao));
    this.atenderPendencias(pendencias);
    await this.propagar();
  }

  /** Clica de verdade em "Editar" da linha e entrega o fato, o catálogo e as fases que a edição lê. */
  async abrirEdicao(
    fato: FatoCandidatoDto = trabalha,
    carregado: FatoCandidatoDto = fato,
    catalogo: readonly FatoCandidatoView[] = [],
  ): Promise<void> {
    await this.acionar(this.editar(fato));
    this.http.expectOne(urlDoFato(fato)).flush(emManutencao(carregado));
    await this.propagar();
    this.atenderApoios(catalogo);
    await this.propagar();
  }

  /** Clica de verdade em "Novo fato"; as fases chegam logo em seguida. */
  async abrirCriacao(): Promise<void> {
    await this.acionar(this.novo());
    this.atenderApoios();
    await this.propagar();
  }

  /** Entrega a recarga do fato aberto, que segue a toda escrita da edição; a cópia faz o sinal mudar, como o JSON novo da API. */
  async recarregarOFato(fato: FatoCandidatoDto, comLista = true): Promise<void> {
    await this.propagar();
    this.http.expectOne(urlDoFato(fato)).flush(emManutencao(structuredClone(fato)));
    this.atenderPendencias();
    if (comLista) this.pedidoDaLista().flush([emManutencao(fato)]);
    else this.http.expectNone((r) => r.url === LISTA && r.method === 'GET');
    await this.propagar();
    this.atenderPendencias();
    await this.propagar();
  }
}

/** A página montada com a lista já carregada. */
export async function montarPagina(
  itens: readonly FatoCandidatoDto[] = [trabalha, corRaca],
  opcoes: OpcoesDaPagina = {},
): Promise<PaginaDosFatos> {
  const concedidas = signal<readonly string[]>(opcoes.concedidas ?? [PERMISSAO_DE_MANTER]);
  configurarModulo(concedidas);
  const pagina = new PaginaDosFatos(concedidas);
  await pagina.carregar(itens, opcoes.pendencias ?? []);
  return pagina;
}

export type Pagina = PaginaDosFatos;

/**
 * Compila a página uma vez, antes dos testes do arquivo. Assim, o primeiro teste
 * não paga sozinho a compilação de toda a árvore de componentes.
 */
export async function compilarPaginaUmaVez(): Promise<void> {
  configurarModulo(() => [PERMISSAO_DE_MANTER]);
  await TestBed.compileComponents();
  TestBed.createComponent(FatosCandidatoPage).destroy();
  TestBed.resetTestingModule();
}
