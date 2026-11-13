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
import { CONFIGURACAO_BASE_PATH, type FatoCandidatoDto } from '@uniplus/shared-data/configuracao';
import { expect, vi } from 'vitest';
import { EdicaoDoFato } from './edicao-do-fato';
import { EdicaoDosFatos } from './edicao-dos-fatos';
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

const APROVADA = {
  situacao: 'APROVADA',
  solicitadaEm: null,
  decididaEm: null,
  classificacaoRecomendada: null,
  justificativa: null,
  aceitaEm: null,
  ciclo: 0,
  manifestadaEm: null,
  manifestacaoDesfavoravel: false,
  manifestacoesNoCiclo: 0,
};

export const comAprovacao = (
  fato: FatoCandidatoDto,
  situacao: string,
  classificacaoRecomendada: string | null = null,
  justificativa: string | null = null,
): FatoCandidatoDto => ({
  ...fato,
  aprovacao: { ...APROVADA, situacao, classificacaoRecomendada, justificativa },
});

/** Fato declarado de sim ou não: o mais simples de editar. */
export const trabalha: FatoCandidatoDto = {
  id: '01960000-0000-7000-0000-0000000000a1',
  codigo: 'TRABALHA',
  nome: 'Trabalha',
  descricao: 'Se o candidato trabalha.',
  componenteExibicao: null,
  dominio: 'BOOLEANO',
  origem: 'DECLARADO',
  cardinalidade: 'ESCALAR',
  fonteValores: null,
  formato: null,
  pontoResolucao: 'INSCRICAO',
  binding: 'CAMPO_INSCRICAO:TRABALHA',
  escopo: 'CANDIDATO',
  classificacaoProtecao: 'PESSOAL',
  finalidadeTratamento: 'Classificar a reserva de vagas.',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  sistema: false,
  ativo: true,
  valores: [],
  regrasPadrao: [],
  aprovacao: APROVADA,
};

/** Fato declarado categórico, com um valor. */
export const corRaca: FatoCandidatoDto = {
  ...trabalha,
  id: '01960000-0000-7000-0000-0000000000f1',
  codigo: 'COR_RACA',
  nome: 'Cor ou raça',
  descricao: 'Cor ou raça autodeclarada.',
  dominio: 'CATEGORICO',
  fonteValores: 'GLOBAL',
  binding: 'CAMPO_INSCRICAO:COR_RACA',
  classificacaoProtecao: 'SENSIVEL',
  finalidadeTratamento: 'Reserva de vagas.',
  hipoteseLegal: 'CUMPRIMENTO_OBRIGACAO_LEGAL',
  valores: [{ codigo: 'PRETA', descricao: 'Preta', ordem: 0, ativo: true, orientacao: null }],
};

export const comValores = (fato: FatoCandidatoDto = corRaca): FatoCandidatoDto => ({
  ...fato,
  valores: [
    { codigo: 'PRETA', descricao: 'Preta', ordem: 0, ativo: true, orientacao: null },
    { codigo: 'PARDA', descricao: 'Parda', ordem: 1, ativo: false, orientacao: null },
    { codigo: 'BRANCA', descricao: 'Branca', ordem: 2, ativo: true, orientacao: null },
  ],
});

export const derivado: FatoCandidatoDto = {
  ...trabalha,
  id: '01960000-0000-7000-0000-0000000000d1',
  codigo: 'PERFIL',
  nome: 'Perfil',
  origem: 'DERIVADO',
  binding: 'REGRA_DERIVACAO:PERFIL',
};

export const agregado: FatoCandidatoDto = {
  ...derivado,
  id: '01960000-0000-7000-0000-0000000000e1',
  codigo: 'PERFIL_FAMILIAR',
  nome: 'Perfil familiar',
  binding: 'AGREGACAO_GRUPO:RENDA',
};

export const quilombola = {
  id: 'q',
  codigo: 'QUILOMBOLA',
  nome: 'Quilombola',
  descricao: null,
  dominio: 'BOOLEANO',
  origem: 'DECLARADO',
  cardinalidade: 'ESCALAR',
  valoresDominio: null,
  pontoResolucao: 'INSCRICAO',
  binding: 'CAMPO_INSCRICAO:QUILOMBOLA',
  valoresDominioDeclarados: null,
  fonteValores: null,
  ativo: true,
  escopo: 'CANDIDATO',
};

export const FASES_DA_API = [
  { id: 'f1', codigo: 'INSCRICAO', nome: 'Inscrição', descricao: null },
  { id: 'f2', codigo: 'HOMOLOGACAO', nome: 'Homologação', descricao: null },
];

export const pendencia = (fato: FatoCandidatoDto) => ({
  tipo: 'FATO',
  id: fato.id,
  codigo: fato.codigo,
  nome: fato.nome,
  classificacaoProtecao: fato.classificacaoProtecao,
  finalidadeTratamento: fato.finalidadeTratamento,
  hipoteseLegal: fato.hipoteseLegal,
  aprovacao: { ...APROVADA, situacao: 'PENDENTE' },
});

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
    this.pedidoDaLista().flush(lista);
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
  readonly atenderApoios = (catalogo: readonly unknown[] = []): void => {
    for (const req of this.http.match((r) => r.url === CATALOGO && r.method === 'GET')) {
      if (!req.cancelled) req.flush(catalogo);
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
    this.pelaEtiqueta(`Ver o detalhe de ${f.nome}`);
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
    this.pedidoDaLista().flush(itens);
    this.atenderPendencias(pendencias);
    await this.propagar();
  }

  /** Clica de verdade em "Editar" da linha e entrega o fato, o catálogo e as fases que a edição lê. */
  async abrirEdicao(
    fato: FatoCandidatoDto = trabalha,
    carregado: FatoCandidatoDto = fato,
    catalogo: readonly unknown[] = [],
  ): Promise<void> {
    await this.acionar(this.editar(fato));
    this.http.expectOne(urlDoFato(fato)).flush(carregado);
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
    this.http.expectOne(urlDoFato(fato)).flush(structuredClone(fato));
    this.atenderPendencias();
    if (comLista) this.pedidoDaLista().flush([fato]);
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
