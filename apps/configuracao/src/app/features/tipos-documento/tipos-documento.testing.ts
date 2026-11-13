import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, signal, type Signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CONFIGURACAO_BASE_PATH,
  type CategoriaDocumentoDto,
  type ItemDaProtecaoDoCatalogoDto,
  TipoDocumentoDto,
} from '@uniplus/shared-data/configuracao';
import { expect, vi, type MockInstance } from 'vitest';
import { EdicaoDosTiposDocumento } from './edicao-dos-tipos-documento';
import { TiposDocumentoPage } from './tipos-documento.page';
import { TiposDocumentoStore } from './tipos-documento.store';
import { atenderHistoricosDoDrawer } from '../../shared/protecao-do-catalogo/historicos-do-drawer.testing';

const BASE = 'http://localhost:5000';
export const LISTA = `${BASE}/api/configuracao/tipos-documento`;
export const ESCRITA = `${BASE}/api/configuracao/admin/tipos-documento`;
export const CATEGORIAS_URL = `${BASE}/api/configuracao/categorias-documento`;
export const PROTECAO_URL = `${BASE}/api/configuracao/admin/protecao-do-catalogo`;
export const TITULO_DA_LISTA = '#cfg-tipos-documento-list-title';
export const PERMISSAO_DE_MANTER = 'configuracao:tipos-documento:manter';

/** A proteção de dados que o formulário exige, preenchida como Isabella faria. */
export const PROTECAO_PREENCHIDA = {
  classificacaoProtecao: 'PESSOAL',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  finalidadeTratamento: 'Conferir o documento do candidato.',
};

/** As dez categorias semeadas pelo cadastro. */
export const CATEGORIAS: readonly CategoriaDocumentoDto[] = [
  ['IDENTIFICACAO', 'Identificação', 1],
  ['ESCOLARIDADE', 'Escolaridade', 2],
  ['TITULACAO_EXPERIENCIA', 'Titulação e experiência', 3],
  ['RENDA', 'Renda', 4],
  ['RESIDENCIA', 'Residência', 5],
  ['RACA_ETNIA', 'Raça/etnia', 6],
  ['SAUDE', 'Saúde', 7],
  ['DOCUMENTO_PROCESSUAL', 'Documento processual', 8],
  ['PRODUCAO_AVALIATIVA', 'Produção avaliativa', 9],
  ['OUTROS', 'Outros', 10],
].map(([codigo, nome, ordem]) => ({
  id: `ca7e0000-0000-7000-8000-${String(ordem).padStart(12, '0')}`,
  codigo: codigo as string,
  nome: nome as string,
  descricao: null,
  ordem: ordem as number,
  criadoEm: '2026-01-01T00:00:00Z',
}));

export const rg: TipoDocumentoDto = {
  id: '01960000-0000-7000-0000-0000000000d1',
  codigo: 'RG',
  nome: 'Registro Geral',
  descricao: 'Documento de identificação civil.',
  categoria: 'IDENTIFICACAO',
  formatosAceitos: 'pdf,jpg',
  tamanhoMaximoMb: 10,
  tipoEquivalente: 'CIN',
  ...PROTECAO_PREENCHIDA,
  protecaoAprovada: true,
  criadoEm: '2026-06-10T12:00:00Z',
};

export const laudo: TipoDocumentoDto = {
  ...rg,
  id: '01960000-0000-7000-0000-0000000000d2',
  codigo: 'LAUDO_MEDICO',
  nome: 'Laudo médico — PcD',
  descricao: null,
  categoria: 'SAUDE',
  formatosAceitos: null,
  tamanhoMaximoMb: null,
  tipoEquivalente: null,
  criadoEm: '2026-06-11T12:00:00Z',
};

/** Tipo numa das categorias que o roster escrito à mão não conhecia. */
export const diploma: TipoDocumentoDto = {
  ...laudo,
  id: '01960000-0000-7000-0000-0000000000d3',
  codigo: 'DIPLOMA_GRADUACAO',
  nome: 'Diploma de graduação',
  categoria: 'TITULACAO_EXPERIENCIA',
  formatosAceitos: 'pdf',
  criadoEm: '2026-08-30T12:00:00Z',
};

/** Tipo cuja categoria saiu do cadastro depois de já tê-lo classificado. */
export const orfao: TipoDocumentoDto = {
  ...laudo,
  id: '01960000-0000-7000-0000-0000000000d4',
  codigo: 'CERTIDAO_MILITAR',
  nome: 'Certidão militar',
  categoria: 'DOCUMENTO_MILITAR',
  criadoEm: '2026-08-30T13:00:00Z',
};

export const problema = (status: number, corpo: object = {}) => {
  const padrao =
    status >= 500
      ? { code: 'uniplus.internal.unexpected', traceId: `trace-${status}` }
      : status === 403
        ? { code: 'uniplus.auth.forbidden' }
        : {};
  return [
    JSON.stringify({ type: 'about:blank', title: 'Falha', status, ...padrao, ...corpo }),
    { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
  ] as const;
};

/** A recusa de campo como o servidor a emite: o código da regra violada e o campo em camelCase. */
export const recusaDeCampo = (
  field: string,
  message: string,
  code = 'uniplus.configuracao.tipo_documento.nome_tamanho',
) => problema(422, { code, errors: [{ field, code, message }] });

export const sucesso = () => [null, { status: 204, statusText: 'No Content' }] as const;
export const criado = () => ['novo-id', { status: 201, statusText: 'Created' }] as const;

const APROVACAO_PENDENTE: ItemDaProtecaoDoCatalogoDto['aprovacao'] = {
  situacao: 'PENDENTE',
  ciclo: 0,
  solicitadaEm: null,
  decididaEm: null,
  classificacaoRecomendada: null,
  justificativa: null,
  aceitaEm: null,
  manifestadaEm: null,
  manifestacaoDesfavoravel: false,
  manifestacoesNoCiclo: 0,
};

/** Um item do que aguarda a proteção de dados, com a situação dada. */
export const pendencia = (
  tipo: TipoDocumentoDto,
  aprovacao: Partial<ItemDaProtecaoDoCatalogoDto['aprovacao']>,
): ItemDaProtecaoDoCatalogoDto => ({
  tipo: 'TIPO_DOCUMENTO',
  id: tipo.id,
  codigo: tipo.codigo,
  nome: tipo.nome,
  classificacaoProtecao: tipo.classificacaoProtecao,
  finalidadeTratamento: tipo.finalidadeTratamento,
  hipoteseLegal: tipo.hipoteseLegal,
  aprovacao: { ...APROVACAO_PENDENTE, ...aprovacao },
});

export interface OpcoesDaPagina {
  readonly concedidas?: readonly string[];
  readonly categorias?: readonly CategoriaDocumentoDto[] | 'falha' | 'pendente';
  readonly pendencias?: readonly ItemDaProtecaoDoCatalogoDto[] | 'falha';
  /** O status com que as leituras de apoio em falha respondem; o padrão é uma falha de servidor. */
  readonly statusDaFalha?: number;
}

function provedoresDaPagina(concedidas: Signal<readonly string[]>) {
  const tem = (c: string) => concedidas().includes(c);
  return [
    provideHttpClient(withInterceptors([apiResultInterceptor])),
    provideHttpClientTesting(),
    provideRouter([]),
    { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
    {
      provide: PermissoesService,
      useValue: { tem, temAlguma: (...cs: string[]) => cs.some(tem) },
    },
  ];
}

/**
 * A página dos tipos de documento montada com a lista carregada, e as ferramentas para conduzi-la
 * como a pessoa faz. As ações são propriedades, para seguirem válidas quando desestruturadas.
 */
export class PaginaDosTiposDocumento {
  readonly concedidas: WritableSignal<readonly string[]>;
  readonly fixture: ComponentFixture<TiposDocumentoPage>;
  readonly http: HttpTestingController;
  readonly edicao: EdicaoDosTiposDocumento;
  readonly store: TiposDocumentoStore;
  readonly sucessos: MockInstance<NotificationService['success']>;
  readonly erros: MockInstance<NotificationService['errorFromProblem']>;
  private readonly statusDaFalha: number;

  constructor(private readonly opcoes: OpcoesDaPagina) {
    this.concedidas = signal(opcoes.concedidas ?? [PERMISSAO_DE_MANTER]);
    this.statusDaFalha = opcoes.statusDaFalha ?? 503;
    TestBed.configureTestingModule({
      imports: [TiposDocumentoPage],
      providers: provedoresDaPagina(this.concedidas),
    });
    this.fixture = TestBed.createComponent(TiposDocumentoPage);
    this.http = TestBed.inject(HttpTestingController);
    this.edicao = this.fixture.debugElement.injector.get(EdicaoDosTiposDocumento);
    this.store = this.fixture.debugElement.injector.get(TiposDocumentoStore);
    const notificacoes = TestBed.inject(NotificationService);
    this.sucessos = vi.spyOn(notificacoes, 'success');
    this.erros = vi.spyOn(notificacoes, 'errorFromProblem');
  }

  /** Atende as leituras de apoio e a lista, como a abertura da página faz. */
  readonly carregar = async (itens: readonly TipoDocumentoDto[]): Promise<void> => {
    this.fixture.detectChanges();
    const { categorias, pendencias } = this.opcoes;
    this.atenderCategorias(categorias === 'pendente' ? 'pendente' : categorias);
    this.atenderProtecao(pendencias === 'falha' ? 'falha' : [...(pendencias ?? [])]);
    this.http.expectOne((r) => r.url === LISTA).flush(itens);
    await this.propagar();
  };

  readonly propagar = async (): Promise<void> => {
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();
    this.fixture.detectChanges();
  };

  readonly elemento = <T extends HTMLElement>(seletor: string): T => {
    const encontrado = (this.fixture.nativeElement as HTMLElement).querySelector<T>(seletor);
    expect(encontrado, seletor).not.toBeNull();
    return encontrado as T;
  };

  private readonly pelaEtiqueta = (nome: string): HTMLButtonElement =>
    this.elemento(`button[aria-label="${nome}"]`);

  readonly atenderProtecao = (pendentes: ItemDaProtecaoDoCatalogoDto[] | 'falha' = []): void => {
    for (const req of this.http.match((r) => r.url === PROTECAO_URL).filter((p) => !p.cancelled)) {
      if (pendentes === 'falha') req.flush(...problema(this.statusDaFalha));
      else req.flush(pendentes);
    }
  };

  readonly atenderCategorias = (resposta: OpcoesDaPagina['categorias'] = CATEGORIAS): void => {
    for (const req of this.http.match(CATEGORIAS_URL)) {
      if (resposta === 'pendente') continue;
      if (resposta === 'falha') req.flush(...problema(this.statusDaFalha));
      else req.flush(resposta);
    }
  };

  readonly recarregarCom = async (lista: readonly TipoDocumentoDto[]): Promise<void> => {
    await this.propagar();
    this.http.expectOne((r) => r.url === LISTA).flush(lista);
    this.atenderProtecao();
    await this.propagar();
  };

  readonly preencher = (nome: string, valor: string): void => {
    const campo = this.elemento<HTMLInputElement>(`[formcontrolname="${nome}"]`);
    campo.value = valor;
    campo.dispatchEvent(new Event(campo.tagName === 'SELECT' ? 'change' : 'input'));
  };

  readonly formulario = (): HTMLFormElement => this.elemento('#cfg-tipo-documento-form');
  readonly novo = (): HTMLButtonElement => this.elemento('#cfg-tipos-documento-novo');
  readonly editar = (t: TipoDocumentoDto = rg) =>
    this.pelaEtiqueta(`Editar tipo de documento ${t.codigo}`);
  readonly remover = (t: TipoDocumentoDto = rg) =>
    this.pelaEtiqueta(`Remover tipo de documento ${t.codigo}`);
  readonly nomeDaLinha = (t: TipoDocumentoDto = rg) =>
    this.pelaEtiqueta(`Ver o detalhe de ${t.nome}`);
  readonly salvar = (): HTMLButtonElement =>
    this.elemento('button[form="cfg-tipo-documento-form"]');
  readonly campo = (nome: string): HTMLInputElement => this.elemento(`[formcontrolname="${nome}"]`);
  readonly statusDaPagina = (): string =>
    this.elemento(':scope > span.sr-only[role="status"]').textContent ?? '';

  readonly confirmar = (dialogo = 'Remover tipo de documento'): HTMLButtonElement =>
    this.confirmacao(dialogo).querySelector(
      '[data-testid="confirm-dialog-confirm"]',
    ) as HTMLButtonElement;

  readonly cancelarDaConfirmacao = (dialogo = 'Remover tipo de documento'): HTMLButtonElement =>
    this.confirmacao(dialogo).querySelector(
      '[data-testid="confirm-dialog-cancel"]',
    ) as HTMLButtonElement;

  /** Clica de verdade em "Novo tipo" e preenche o mínimo para enviar. */
  readonly abrirCadastro = async (): Promise<void> => {
    await this.acionar(this.novo());
    this.preencher('nome', 'Declaração de renda');
    this.preencher('categoria', 'RENDA');
    this.preencher('classificacaoProtecao', PROTECAO_PREENCHIDA.classificacaoProtecao);
    await this.propagar();
    this.preencher('hipoteseLegal', PROTECAO_PREENCHIDA.hipoteseLegal);
    this.preencher('finalidadeTratamento', PROTECAO_PREENCHIDA.finalidadeTratamento);
    await this.propagar();
  };

  /** Abre o formulário em branco, sem preencher nada. */
  readonly acionarNovo = (): Promise<void> => this.acionar(this.novo());

  /** Envia o formulário aberto sem esperar requisição: a validação local deve barrá-lo. */
  readonly enviarSemRequisicao = async (): Promise<void> => {
    const botao = this.salvar();
    botao.focus();
    botao.click();
    this.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
    await this.propagar();
    await this.propagar();
    this.http.expectNone((r) => r.url.startsWith(ESCRITA));
  };

  readonly abrirEdicao = (tipo: TipoDocumentoDto = rg): Promise<void> =>
    this.acionar(this.editar(tipo));

  /** Envia o formulário aberto, com o foco no botão de salvar, e devolve a requisição de escrita. */
  readonly enviar = async (url = ESCRITA) => {
    await this.acionar(this.salvar());
    return this.http.expectOne((r) => r.url === url && r.method !== 'GET');
  };

  readonly confirmarRemocao = async (tipo: TipoDocumentoDto = rg) => {
    await this.acionar(this.remover(tipo));
    this.confirmar().click();
    await this.propagar();
    return this.http.expectOne(`${ESCRITA}/${tipo.id}`);
  };

  /**
   * Termina o teste sem requisição esquecida: a situação da proteção é relida a cada escrita, e o
   * drawer lê os atos e as manifestações técnicas do item.
   */
  readonly encerrar = (): void => {
    this.atenderProtecao();
    atenderHistoricosDoDrawer(this.http);
    this.http.verify();
  };

  private readonly acionar = async (botao: HTMLButtonElement): Promise<void> => {
    botao.focus();
    botao.click();
    await this.propagar();
  };

  private confirmacao(titulo: string): HTMLElement {
    const todas = [
      ...(this.fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        'cfg-confirmacao-de-remocao',
      ),
    ];
    const achada = todas.find((c) => c.textContent?.includes(titulo));
    expect(achada, titulo).toBeTruthy();
    return achada as HTMLElement;
  }
}

/** A página montada com a lista já carregada. */
export async function montarPagina(
  itens: readonly TipoDocumentoDto[] = [rg, laudo],
  opcoes: OpcoesDaPagina = {},
): Promise<PaginaDosTiposDocumento> {
  const pagina = new PaginaDosTiposDocumento(opcoes);
  await pagina.carregar(itens);
  return pagina;
}

export type Pagina = PaginaDosTiposDocumento;
