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
  CursoDto,
  LocalOfertaDto,
  OfertaCursoDto,
  TipoLocalOfertaCodigo,
} from '@uniplus/shared-data/configuracao';
import {
  ORGANIZACAO_BASE_PATH,
  TipoUnidadeCodigo,
  UnidadeDto,
} from '@uniplus/shared-data/organizacao';
import { MockInstance, expect, vi } from 'vitest';
import { EdicaoDasOfertasCurso } from './edicao-das-ofertas-curso';
import { OfertasCursoPage } from './ofertas-curso.page';
import { OfertasCursoStore } from './ofertas-curso.store';
import { VinculosDaOferta } from './vinculos-da-oferta';
import { valoresDaOferta, vocabulariosDaOferta } from './valores-da-oferta.testing';

const BASE = 'http://localhost:5000';
/** Teto de página da API: `limit` fora de 1..100 responde 422 e o lookup rejeitado deixa o select vazio. */
export const LIMITE_MAXIMO_API = 100;
export const LISTA = `${BASE}/api/configuracao/ofertas-curso`;
export const ESCRITA = `${BASE}/api/configuracao/admin/ofertas-curso`;
export const CURSOS = `${BASE}/api/configuracao/cursos`;
export const LOCAIS = `${BASE}/api/configuracao/locais-oferta`;
export const UNIDADES = `${BASE}/api/organizacao/unidades`;
export const TITULO_DA_LISTA = '#cfg-ofertas-list-title';

const CODIGO = 'uniplus.configuracao.oferta_curso.';
export const NAO_ENCONTRADA = `${CODIGO}nao_encontrada`;
export const PROCESSANDO = 'uniplus.idempotency.processing_conflict';
export const CORPO_DIVERGENTE = 'uniplus.idempotency.body_mismatch';
export const ERRO_INTERNO = 'uniplus.internal.unexpected';
export const SEM_PERMISSAO = 'uniplus.auth.forbidden';

export const engCiv: CursoDto = {
  id: '01960000-0000-7000-0000-0000000000c1',
  codigo: 'ENG-CIV',
  nome: 'Engenharia Civil',
  grau: 'Bacharelado',
  nivelEnsino: 'Graduação',
  grupoAreaEnem: { codigo: 'TECNOLOGICA', rotulo: 'Tecnológica' },
  criadoEm: '2026-06-10T12:00:00Z',
};

export const engMinas: CursoDto = {
  ...engCiv,
  id: '01960000-0000-7000-0000-0000000000c2',
  codigo: 'ENG-MIN',
  nome: 'Engenharia de Minas',
};

export const maraba: LocalOfertaDto = {
  id: '01960000-0000-7000-0000-0000000000e1',
  tipo: { codigo: TipoLocalOfertaCodigo.CAMPUS_SEDE, rotulo: 'Campus sede' },
  campusResponsavelId: null,
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  codigoEmec: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

export const ige = {
  id: '01960000-0000-7000-0000-0000000000f1',
  nome: 'Instituto de Geociências e Engenharias',
  alias: null,
  slug: 'ige',
  sigla: 'IGE',
  codigo: 'IGE',
  unidadeSuperiorId: null,
  tipo: TipoUnidadeCodigo.INSTITUTO,
  unidadeAcademica: true,
  vigenciaInicio: '2020-01-01',
  vigenciaFim: null,
} as UnidadeDto;

export const oferta: OfertaCursoDto = {
  id: '01960000-0000-7000-0000-0000000000d1',
  codigo: 'ENG_CIVIL_MARABA',
  cursoId: engCiv.id,
  localOfertaId: maraba.id,
  unidadeOfertante: {
    origemId: ige.id,
    sigla: 'IGE',
    nome: 'Instituto de Geociências e Engenharias',
    tipo: 'Instituto',
  },
  programaDeOferta: valoresDaOferta.programa,
  formatoPedagogico: valoresDaOferta.formato,
  regimeDeTurno: valoresDaOferta.regime,
  regimeDeFuncionamento: valoresDaOferta.funcionamento,
  turnos: [valoresDaOferta.turnos[0]],
  eMecCodigo: '123456',
  codigoSga: null,
  vagasAnuaisAutorizadas: 40,
  baseLegal: null,
  atoAutorizacaoMec: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

/** O nome acessível das ações da linha de `oferta`. */
export const identificador = 'Engenharia Civil · IGE · Campus sede — Marabá · Regular · Matutino';

export const mesmaOferta = (
  id: string,
  mudancas: Partial<OfertaCursoDto> = {},
): OfertaCursoDto => ({
  ...oferta,
  id,
  ...mudancas,
});

export const problema = (status: number, corpo: object = {}) =>
  [
    JSON.stringify({ type: 'about:blank', title: 'Falha', status, ...corpo }),
    { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
  ] as const;

export const recusaDoDominio = (code: string, title = 'Falha') => problema(422, { code, title });

/** A recusa de validação como o endpoint a emite: `errors[]` com o campo em camelCase; o código do problema é o do primeiro erro. */
export const recusaDeCampos = (
  ...erros: readonly { field: string; code: string; message: string }[]
) =>
  problema(422, {
    code: `${CODIGO}${erros[0].code}`,
    title: erros[0].message,
    errors: erros.map(({ field, code, message }) => ({ field, code: `${CODIGO}${code}`, message })),
  });

export const sucesso = () => [null, { status: 204, statusText: 'No Content' }] as const;
export const criado = () => ['novo-id', { status: 201, statusText: 'Created' }] as const;

/** O que cada catálogo responde ao carregar a página; `'falha'` é uma recusa 500. */
export interface CatalogosDaPagina {
  readonly cursos?: readonly CursoDto[] | 'falha';
  readonly locais?: readonly LocalOfertaDto[] | 'falha';
}

function responder(pedido: TestRequest, resposta: readonly unknown[] | 'falha'): void {
  if (resposta === 'falha') {
    pedido.flush(...problema(500, { code: ERRO_INTERNO }));
    return;
  }
  pedido.flush(resposta);
}

/** Os selects de vínculo são gerados em laço: a diretiva não grava o atributo, então são achados pelo id. */
const ID_DOS_VINCULOS: Readonly<Record<string, string>> = {
  cursoId: 'cfg-oferta-curso-id',
  localOfertaId: 'cfg-oferta-local-id',
  unidadeOfertanteOrigemId: 'cfg-oferta-unidade-id',
};

function configurarModuloDaPagina(): void {
  TestBed.configureTestingModule({
    imports: [OfertasCursoPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
    ],
  });
}

/** A página com as ferramentas para conduzi-la como a pessoa faz. */
export class PaginaDeOfertas {
  readonly fixture: ComponentFixture<OfertasCursoPage>;
  readonly http: HttpTestingController;
  readonly edicao: EdicaoDasOfertasCurso;
  readonly store: OfertasCursoStore;
  readonly vinculos: VinculosDaOferta;
  readonly sucessos: MockInstance<NotificationService['success']>;
  readonly erros: MockInstance<NotificationService['errorFromProblem']>;
  private readonly app = TestBed.inject(ApplicationRef);

  constructor() {
    this.fixture = TestBed.createComponent(OfertasCursoPage);
    this.http = TestBed.inject(HttpTestingController);
    const injetor = this.fixture.debugElement.injector;
    this.edicao = injetor.get(EdicaoDasOfertasCurso);
    this.store = injetor.get(OfertasCursoStore);
    this.vinculos = injetor.get(VinculosDaOferta);
    const notificacoes = TestBed.inject(NotificationService);
    this.sucessos = vi.spyOn(notificacoes, 'success');
    this.erros = vi.spyOn(notificacoes, 'errorFromProblem');
  }

  async carregar(itens: readonly OfertaCursoDto[], catalogos: CatalogosDaPagina): Promise<void> {
    this.fixture.detectChanges();
    this.responderVocabularios();
    this.http.expectOne((r) => r.url === LISTA).flush(itens);
    responder(this.doCatalogo(CURSOS), catalogos.cursos ?? [engCiv]);
    responder(this.doCatalogo(LOCAIS), catalogos.locais ?? [maraba]);
    await this.propagar();
  }

  private responderVocabularios(): void {
    for (const [nome, itens] of Object.entries(vocabulariosDaOferta)) {
      this.http
        .match(`${BASE}/api/configuracao/vocabularios/${nome}`)
        .forEach((pedido) => pedido.flush(itens));
    }
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

  doCatalogo(url: string): TestRequest {
    const pedido = this.http.expectOne((r) => r.url === url);
    const limite = Number(pedido.request.params.get('limit'));
    expect(limite).toBeGreaterThanOrEqual(1);
    expect(limite).toBeLessThanOrEqual(LIMITE_MAXIMO_API);
    return pedido;
  }

  async recarregarCom(lista: readonly OfertaCursoDto[]): Promise<void> {
    await this.propagar();
    this.http.expectOne((r) => r.url === LISTA).flush(lista);
    await this.propagar();
  }

  preencher(nome: string, valor: string): void {
    const campo = this.elemento<HTMLInputElement>(seletorDoCampo(nome));
    campo.value = valor;
    campo.dispatchEvent(new Event(campo.tagName === 'SELECT' ? 'change' : 'input'));
  }

  turno(rotulo: string): HTMLInputElement {
    const caixa = [
      ...(this.fixture.nativeElement as HTMLElement).querySelectorAll('label.checkbox'),
    ]
      .find((item) => item.textContent?.trim() === rotulo)
      ?.querySelector('input');
    expect(caixa, rotulo).toBeTruthy();
    return caixa as HTMLInputElement;
  }

  async responderUnidades(unidades: readonly UnidadeDto[] = [ige]): Promise<void> {
    await this.propagar();
    this.doCatalogo(UNIDADES).flush(unidades);
    await this.propagar();
  }

  /** Confere que nada ficou pendente. */
  encerrar(): void {
    this.http.verify();
  }

  formulario = (): HTMLFormElement => this.elemento('#cfg-oferta-curso-form');
  novo = (): HTMLButtonElement => this.elemento('#cfg-ofertas-novo');
  salvar = (): HTMLButtonElement => this.elemento('button[form="cfg-oferta-curso-form"]');
  confirmar = (): HTMLButtonElement => this.elemento('[data-testid="confirm-dialog-confirm"]');
  cancelarDaConfirmacao = (): HTMLButtonElement =>
    this.elemento('[data-testid="confirm-dialog-cancel"]');
  campo = (nome: string): HTMLInputElement => this.elemento(seletorDoCampo(nome));
  statusDaPagina = (): string =>
    this.elemento(':scope > span.sr-only[role="status"]').textContent ?? '';

  editar(alvo: string = identificador): HTMLButtonElement {
    return this.pelaEtiqueta(`Editar oferta de curso ${alvo}`);
  }

  remover(alvo: string = identificador): HTMLButtonElement {
    return this.pelaEtiqueta(`Remover oferta de curso ${alvo}`);
  }

  /** Clica de verdade em "Nova oferta de curso", responde as unidades e preenche o mínimo para enviar. */
  async abrirCadastro(): Promise<void> {
    this.novo().focus();
    this.novo().click();
    await this.responderUnidades();
    this.preencher('codigo', oferta.codigo);
    this.preencher('cursoId', engCiv.id);
    this.preencher('localOfertaId', maraba.id);
    this.preencher('unidadeOfertanteOrigemId', ige.id);
    this.turno(valoresDaOferta.turnos[0].rotulo).click();
    await this.propagar();
  }

  async abrirEdicao(alvo: string = identificador): Promise<void> {
    await this.clicarComFoco(this.editar(alvo));
  }

  /** Envia o formulário aberto, com o foco no botão de salvar, e devolve a requisição de escrita. */
  async enviar(url = ESCRITA): Promise<TestRequest> {
    await this.clicarComFoco(this.salvar());
    return this.http.expectOne(url);
  }

  async confirmarRemocao(
    alvo: string = identificador,
    id: string = oferta.id,
  ): Promise<TestRequest> {
    await this.clicarComFoco(this.remover(alvo));
    this.confirmar().click();
    await this.propagar();
    return this.http.expectOne(`${ESCRITA}/${id}`);
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

const seletorDoCampo = (nome: string): string =>
  nome in ID_DOS_VINCULOS ? `#${ID_DOS_VINCULOS[nome]}` : `[formcontrolname="${nome}"]`;

/** A página montada com a lista e os catálogos já carregados. */
export async function montarPagina(
  itens: readonly OfertaCursoDto[] = [oferta],
  catalogos: CatalogosDaPagina = {},
): Promise<PaginaDeOfertas> {
  configurarModuloDaPagina();
  const pagina = new PaginaDeOfertas();
  await pagina.carregar(itens, catalogos);
  return pagina;
}

export type Pagina = PaginaDeOfertas;
