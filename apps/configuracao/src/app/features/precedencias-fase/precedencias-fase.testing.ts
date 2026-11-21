import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CONFIGURACAO_BASE_PATH,
  FaseCanonicaDto,
  FaseCanonicaVocabularioDto,
  PrecedenciaFaseDto,
} from '@uniplus/shared-data/configuracao';
import { MockInstance, expect, vi } from 'vitest';
import { EdicaoDasPrecedencias } from './edicao-das-precedencias';
import { FasesDoGrafoStore } from './fases-do-grafo.store';
import { PrecedenciasFasePage } from './precedencias-fase.page';
import { PrecedenciasFaseStore } from './precedencias-fase.store';

const BASE = 'http://localhost:5000';
export const LISTA = `${BASE}/api/configuracao/precedencias-fase`;
export const FASES = `${BASE}/api/configuracao/fases-canonicas`;
export const CATALOGO = `${BASE}/api/configuracao/vocabularios/fases-canonicas`;
export const ESCRITA = `${BASE}/api/configuracao/admin/precedencias-fase`;
export const TITULO_DA_LISTA = '#cfg-precedencias-fase-list-title';

export const inscricaoHomologacao: PrecedenciaFaseDto = {
  id: '01960000-0000-7000-0000-0000000000a1',
  antecessoraCodigo: 'INSCRICAO',
  sucessoraCodigo: 'HOMOLOGACAO',
  permiteSobreposicao: false,
  criadoEm: '2026-07-15T12:00:00Z',
};

export const avaliacaoClassificacao: PrecedenciaFaseDto = {
  ...inscricaoHomologacao,
  id: '01960000-0000-7000-0000-0000000000a2',
  antecessoraCodigo: 'AVALIACAO',
  sucessoraCodigo: 'CLASSIFICACAO',
};

/** O catálogo da API, na ordem dela: as fases que os testes escolhem nos campos do formulário. */
export const CATALOGO_PADRAO: readonly FaseCanonicaVocabularioDto[] = [
  { codigo: 'INSCRICAO', nome: 'Inscrição' },
  { codigo: 'HOMOLOGACAO', nome: 'Homologação' },
  { codigo: 'AVALIACAO', nome: 'Avaliação' },
  { codigo: 'CLASSIFICACAO', nome: 'Classificação' },
  { codigo: 'RESULTADO_FINAL', nome: 'Resultado final' },
];

/** O que a API responde a uma leitura: a lista, a falha, ou nada ainda (o teste responde depois). */
export type RespostaDaLeitura<T> = readonly T[] | 'falha' | 'pendente';

export interface LeiturasDaPagina {
  readonly catalogo?: RespostaDaLeitura<FaseCanonicaVocabularioDto>;
  readonly cadastro?: RespostaDaLeitura<FaseCanonicaDto>;
  readonly linkDoCadastro?: string;
}

const FASE_CANONICA_PADRAO: Omit<FaseCanonicaDto, 'id' | 'codigo' | 'nome'> = {
  descricao: null,
  unidadeSugerida: null,
  agrupaEtapas: false,
  permiteComplementacao: false,
  admiteAgruparEtapas: false,
  admiteComplementacao: false,
  coletaInscricao: false,
  coletaSolicitacaoIsencao: false,
  origemData: 'NO_EDITAL',
  baseLegal: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

export function faseCanonica(codigo: string, nome: string): FaseCanonicaDto {
  return { ...FASE_CANONICA_PADRAO, id: `fase-${codigo}`, codigo, nome };
}

/** Um 409 de conflito de estado, recusa 4xx que chega à tela (o 403 vai à página de acesso negado). */
export const CONFLITO = {
  code: 'uniplus.configuracao.conflito',
  title: 'A aresta mudou desde a leitura.',
} as const;
/** O 500 que o middleware global de exceções da API emite. */
export const ERRO_INTERNO = {
  code: 'uniplus.internal.unexpected',
  title: 'Erro interno do servidor',
} as const;

export const problema = (status: number, corpo: object = {}) =>
  [
    JSON.stringify({ type: 'about:blank', title: 'Falha', status, ...corpo }),
    { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
  ] as const;

/** Violação de campo como a API a emite: o `code` da raiz é o da primeira violação, e o `field` vem em camelCase. */
export const recusaDeCampo = (
  field: string,
  message: string,
  code = 'uniplus.configuracao.precedencia_fase.sucessora_codigo_formato_invalido',
) => problema(422, { code, title: message, errors: [{ field, code, message }] });

export const sucesso = () => [null, { status: 204, statusText: 'No Content' }] as const;
export const criado = () => ['nova-aresta-id', { status: 201, statusText: 'Created' }] as const;

function configurarModuloDaPagina(): void {
  TestBed.configureTestingModule({
    imports: [PrecedenciasFasePage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
    ],
  });
}

/** A página com as ferramentas para conduzi-la como a pessoa faz. */
export class PaginaDePrecedencias {
  readonly fixture: ComponentFixture<PrecedenciasFasePage>;
  readonly http: HttpTestingController;
  readonly edicao: EdicaoDasPrecedencias;
  readonly store: PrecedenciasFaseStore;
  readonly fasesDoGrafo: FasesDoGrafoStore;
  readonly sucessos: MockInstance<NotificationService['success']>;
  readonly erros: MockInstance<NotificationService['errorFromProblem']>;
  private readonly app = TestBed.inject(ApplicationRef);
  private pedidoDoCatalogo!: TestRequest;
  private pedidoDoCadastro!: TestRequest;

  constructor() {
    this.fixture = TestBed.createComponent(PrecedenciasFasePage);
    this.http = TestBed.inject(HttpTestingController);
    const injetor = this.fixture.debugElement.injector;
    this.edicao = injetor.get(EdicaoDasPrecedencias);
    this.store = injetor.get(PrecedenciasFaseStore);
    this.fasesDoGrafo = injetor.get(FasesDoGrafoStore);
    const notificacoes = TestBed.inject(NotificationService);
    this.sucessos = vi.spyOn(notificacoes, 'success');
    this.erros = vi.spyOn(notificacoes, 'errorFromProblem');
  }

  async carregar(
    itens: readonly PrecedenciaFaseDto[],
    { catalogo = CATALOGO_PADRAO, cadastro = [], linkDoCadastro }: LeiturasDaPagina,
  ): Promise<void> {
    this.fixture.detectChanges();
    this.pedidoDoCatalogo = this.http.expectOne((r) => r.url === CATALOGO);
    this.pedidoDoCadastro = this.http.expectOne((r) => r.url === FASES);
    this.responder(this.pedidoDoCatalogo, catalogo);
    this.responder(this.pedidoDoCadastro, cadastro, linkDoCadastro);
    this.http.expectOne((r) => r.url === LISTA).flush(itens);
    await this.propagar();
  }

  // 'pendente': a requisição segue em aberto; o teste a responde com `responderCatalogo` ou `responderCadastro`.
  private responder<T>(pedido: TestRequest, resposta: RespostaDaLeitura<T>, link?: string): void {
    if (resposta === 'pendente') return;
    if (resposta === 'falha') pedido.flush(...problema(503));
    else pedido.flush(resposta, link ? { headers: { Link: link } } : {});
  }

  async responderCatalogo(corpo: readonly FaseCanonicaVocabularioDto[]): Promise<void> {
    this.pedidoDoCatalogo.flush(corpo);
    await this.propagar();
  }

  async responderCadastro(corpo: readonly FaseCanonicaDto[]): Promise<void> {
    this.pedidoDoCadastro.flush(corpo);
    await this.propagar();
  }

  async propagar(): Promise<void> {
    await Promise.resolve();
    this.app.tick();
    this.fixture.detectChanges();
  }

  elemento<T extends HTMLElement>(seletor: string): T {
    const encontrado = (this.fixture.nativeElement as HTMLElement).querySelector<T>(seletor);
    expect(encontrado, seletor).not.toBeNull();
    return encontrado as T;
  }

  async recarregarCom(lista: readonly PrecedenciaFaseDto[]): Promise<void> {
    await this.propagar();
    this.http.expectOne((r) => r.url === LISTA).flush(lista);
    await this.propagar();
  }

  selecionar(nome: string, valor: string): void {
    const campo = this.elemento<HTMLSelectElement>(`select[formcontrolname="${nome}"]`);
    const opcao = [...campo.options].find((o) => o.value === valor || o.text.trim() === valor);
    expect(opcao, `opção ${valor}`).toBeDefined();
    campo.value = (opcao as HTMLOptionElement).value;
    campo.dispatchEvent(new Event('change'));
  }

  formulario = (): HTMLFormElement => this.elemento('#cfg-precedencia-fase-form');
  novo = (): HTMLButtonElement => this.elemento('#cfg-precedencias-fase-nova');
  salvar = (): HTMLButtonElement => this.elemento('button[form="cfg-precedencia-fase-form"]');
  confirmar = (): HTMLButtonElement => this.elemento('[data-testid="confirm-dialog-confirm"]');
  cancelarDaConfirmacao = (): HTMLButtonElement =>
    this.elemento('[data-testid="confirm-dialog-cancel"]');
  campo = (nome: string): HTMLElement => this.elemento(`[formcontrolname="${nome}"]`);
  statusDaPagina = (): string =>
    this.elemento(':scope > span.sr-only[role="status"]').textContent ?? '';

  editar(aresta: PrecedenciaFaseDto = inscricaoHomologacao): HTMLButtonElement {
    return this.pelaEtiqueta(`Editar ${nomeDoPar(aresta)}`);
  }

  remover(aresta: PrecedenciaFaseDto = inscricaoHomologacao): HTMLButtonElement {
    return this.pelaEtiqueta(`Remover ${nomeDoPar(aresta)}`);
  }

  /** Clica de verdade em "Nova aresta" e escolhe um par válido. */
  async abrirCadastro(antecessora = 'AVALIACAO', sucessora = 'CLASSIFICACAO'): Promise<void> {
    this.novo().focus();
    this.novo().click();
    await this.propagar();
    this.selecionar('antecessoraCodigo', antecessora);
    this.selecionar('sucessoraCodigo', sucessora);
  }

  async abrirEdicao(aresta: PrecedenciaFaseDto = inscricaoHomologacao): Promise<void> {
    await this.clicarComFoco(this.editar(aresta));
  }

  /** Envia o formulário aberto, com o foco no botão de salvar, e devolve a requisição de escrita. */
  async enviar(url = ESCRITA): Promise<TestRequest> {
    await this.clicarComFoco(this.salvar());
    return this.http.expectOne(url);
  }

  async confirmarRemocao(aresta: PrecedenciaFaseDto = inscricaoHomologacao): Promise<TestRequest> {
    await this.clicarComFoco(this.remover(aresta));
    this.confirmar().click();
    await this.propagar();
    return this.http.expectOne(`${ESCRITA}/${aresta.id}`);
  }

  private pelaEtiqueta(nome: string): HTMLButtonElement {
    return this.elemento(`button[aria-label="${nome}"]`);
  }

  private async clicarComFoco(botao: HTMLButtonElement): Promise<void> {
    botao.focus();
    botao.click();
    await this.propagar();
  }
}

const nomeDoPar = (a: PrecedenciaFaseDto): string =>
  `precedência entre ${a.antecessoraCodigo} e ${a.sucessoraCodigo}`;

/** A página montada com a lista, o catálogo e o cadastro de fases já carregados. */
export async function montarPagina(
  itens: readonly PrecedenciaFaseDto[] = [inscricaoHomologacao],
  leituras: LeiturasDaPagina = {},
): Promise<PaginaDePrecedencias> {
  configurarModuloDaPagina();
  const pagina = new PaginaDePrecedencias();
  await pagina.carregar(itens, leituras);
  return pagina;
}

export type Pagina = PaginaDePrecedencias;
