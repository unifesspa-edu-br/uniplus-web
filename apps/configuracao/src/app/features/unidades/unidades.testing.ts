import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { ApplicationRef, type EnvironmentProviders, type Provider } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { GeoApi, type CidadeResumoDto } from '@uniplus/shared-data/geo';
import {
  ORGANIZACAO_BASE_PATH,
  TipoUnidadeCodigo,
  UnidadeDto,
} from '@uniplus/shared-data/organizacao';
import { okResult, passarOTempo } from '@uniplus/shared-testing';
import { expect, vi, type Mock } from 'vitest';
import { ESPERA_DA_DIGITACAO_MS } from '@uniplus/shared-ui/components';
import { EdicaoDasUnidades } from './edicao-das-unidades';
import { OpcoesDaUnidadeSuperior } from './opcoes-da-unidade-superior';
import { UnidadesPage } from './unidades.page';
import { UnidadesStore } from './unidades.store';

const BASE = 'http://localhost:5000';
export const LISTA = `${BASE}/api/organizacao/unidades`;
export const ESCRITA = `${BASE}/api/organizacao/admin/unidades`;
export const TITULO_DA_LISTA = '#cfg-unidades-list-title';

export const CODIGO_DA_SIGLA_REPETIDA = 'uniplus.organizacao.unidade.sigla_ja_existe';
export const CODIGO_DO_CODIGO_REPETIDO = 'uniplus.organizacao.unidade.codigo_ja_existe';
export const CODIGO_DO_SLUG_REPETIDO = 'uniplus.organizacao.unidade.slug_ja_existe';
export const REMOCAO_BLOQUEADA = 'uniplus.organizacao.unidade.remocao_bloqueada_por_subordinadas';
export const PROCESSANDO = 'uniplus.idempotency.processing_conflict';
export const ERRO_INTERNO = 'uniplus.internal.unexpected';

export const reitoria: UnidadeDto = {
  id: '01960000-0000-7000-0000-0000000000a1',
  nome: 'Reitoria',
  sigla: 'REIT',
  codigo: '001',
  slug: 'reitoria',
  alias: null,
  tipo: TipoUnidadeCodigo.REITORIA,
  unidadeSuperiorId: null,
  unidadeAcademica: false,
  vigenciaInicio: '2020-01-01',
  vigenciaFim: null,
  criadoEm: '2020-01-01T00:00:00Z',
  cidadeCodigoIbge: '1504208',
  cidadeNome: 'Marabá',
  cidadeUf: 'PA',
};

export const instituto: UnidadeDto = {
  ...reitoria,
  id: '01960000-0000-7000-0000-0000000000a2',
  nome: 'Instituto de Ciências Exatas',
  sigla: 'ICE',
  codigo: '002',
  slug: 'ice',
  alias: 'Exatas',
  tipo: TipoUnidadeCodigo.INSTITUTO,
  unidadeSuperiorId: reitoria.id,
  unidadeAcademica: true,
  vigenciaInicio: '2021-01-01',
};

export const marabaGeo: CidadeResumoDto = {
  id: 'cid-1504208',
  codigoIbge: '1504208',
  nome: 'Marabá',
  uf: 'PA',
  ddd: null,
};
export const belemGeo: CidadeResumoDto = {
  id: 'cid-1501402',
  codigoIbge: '1501402',
  nome: 'Belém',
  uf: 'PA',
  ddd: null,
};

export const codigoDaUnidade = (sufixo: string): string => `uniplus.organizacao.unidade.${sufixo}`;

export const problema = (status: number, corpo: object = {}) =>
  [
    JSON.stringify({ type: 'about:blank', title: 'Falha', status, ...corpo }),
    { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
  ] as const;

/** A recusa 422 de um campo, com o código de domínio na raiz e no item de `errors[]`. */
export const recusaDeCampo = (field: string, message: string, code: string) =>
  problema(422, { code, errors: [{ field, code, message }] });

export const sucesso = () => [null, { status: 204, statusText: 'No Content' }] as const;
export const criado = () => ['novo-id', { status: 201, statusText: 'Created' }] as const;

export const comLink = (link: string) => ({ headers: { Link: link } });

interface GeoSimulado {
  listarCidades: Mock;
}

function provedoresDaPagina(geo: GeoSimulado): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(withInterceptors([apiResultInterceptor])),
    provideHttpClientTesting(),
    provideRouter([]),
    { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
    { provide: GeoApi, useValue: geo },
  ];
}

/** A página de unidades com a lista já carregada, e as ferramentas para conduzi-la como a pessoa faz. */
export class CenarioDaPaginaDeUnidades {
  readonly http = TestBed.inject(HttpTestingController);
  readonly sucessos = vi.spyOn(TestBed.inject(NotificationService), 'success');
  readonly erros = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');
  private readonly app = TestBed.inject(ApplicationRef);
  readonly edicao: EdicaoDasUnidades;
  readonly store: UnidadesStore;
  readonly superior: OpcoesDaUnidadeSuperior;
  readonly primeiraConsulta: TestRequest;

  static async abrir(
    itens: readonly UnidadeDto[] = [reitoria, instituto],
    resposta: { headers?: Record<string, string> } = {},
  ): Promise<CenarioDaPaginaDeUnidades> {
    const geo: GeoSimulado = { listarCidades: vi.fn().mockReturnValue(of(okResult([]))) };
    TestBed.configureTestingModule({
      imports: [UnidadesPage],
      providers: provedoresDaPagina(geo),
    });
    const cenario = new CenarioDaPaginaDeUnidades(TestBed.createComponent(UnidadesPage), geo);
    cenario.primeiraConsulta.flush(itens, resposta);
    await cenario.propagar();
    return cenario;
  }

  private constructor(
    readonly fixture: ComponentFixture<UnidadesPage>,
    readonly geo: GeoSimulado,
  ) {
    const injetor = fixture.debugElement.injector;
    this.edicao = injetor.get(EdicaoDasUnidades);
    this.store = injetor.get(UnidadesStore);
    this.superior = injetor.get(OpcoesDaUnidadeSuperior);
    fixture.detectChanges();
    this.primeiraConsulta = this.http.expectOne((r) => r.url === LISTA);
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

  /** A consulta de unidades que a abertura do formulário e cada recarga disparam. */
  async responderAConsultaDasUnidades(lista: readonly UnidadeDto[] = [reitoria]): Promise<void> {
    await this.propagar();
    this.http.expectOne((r) => r.url === LISTA).flush(lista);
    await this.propagar();
  }

  /** Destrói a página e abre outra com a lista dada, para o cenário que depende de como ela chega. */
  async reabrirCom(itens: readonly UnidadeDto[]): Promise<CenarioDaPaginaDeUnidades> {
    this.http.verify();
    this.fixture.destroy();
    TestBed.resetTestingModule();
    return CenarioDaPaginaDeUnidades.abrir(itens);
  }

  preencher(nome: string, valor: string): void {
    const campo = this.elemento<HTMLInputElement>(`[formcontrolname="${nome}"]`);
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  }

  /** Digita no campo como a pessoa faz, sem esperar a busca que a digitação dispara. */
  async digitar(campo: HTMLInputElement, texto: string): Promise<void> {
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    await this.propagar();
  }

  /** Digita no campo e deixa passar a espera da busca, com o relógio controlado ligado. */
  async digitarEAguardarBusca(campo: HTMLInputElement, texto: string): Promise<void> {
    await this.digitar(campo, texto);
    await passarOTempo(ESPERA_DA_DIGITACAO_MS);
    await this.propagar();
  }

  formulario(): HTMLFormElement {
    return this.elemento('#cfg-unidade-form');
  }

  submeterOFormulario(): void {
    this.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
  }

  alertaDoDrawer(): HTMLElement {
    return this.elemento('ui-drawer ui-alert');
  }

  novo(): HTMLButtonElement {
    return this.elemento('#cfg-unidades-novo');
  }

  editar(unidade: UnidadeDto = reitoria): HTMLButtonElement {
    return this.pelaEtiqueta(`Editar unidade ${unidade.sigla}`);
  }

  remover(unidade: UnidadeDto = reitoria): HTMLButtonElement {
    return this.pelaEtiqueta(`Remover unidade ${unidade.sigla}`);
  }

  salvar(): HTMLButtonElement {
    return this.elemento('button[form="cfg-unidade-form"]');
  }

  confirmar(): HTMLButtonElement {
    return this.elemento('[data-testid="confirm-dialog-confirm"]');
  }

  cancelarDaConfirmacao(): HTMLButtonElement {
    return this.elemento('[data-testid="confirm-dialog-cancel"]');
  }

  campo(nome: string): HTMLInputElement {
    return this.elemento(`[formcontrolname="${nome}"]`);
  }

  statusDaPagina(): string {
    return this.elemento(':scope > span.sr-only[role="status"]').textContent ?? '';
  }

  nomeDoNo(unidade: UnidadeDto): HTMLButtonElement {
    return this.elemento(`[data-unidade-id="${unidade.id}"] .unit-node__name`);
  }

  /** Clica de verdade em "Nova unidade" e preenche o mínimo para enviar. */
  async abrirCadastro(opcoes: readonly UnidadeDto[] = [reitoria]): Promise<void> {
    const novo = this.novo();
    novo.focus();
    novo.click();
    await this.responderAConsultaDasUnidades(opcoes);
    this.preencher('sigla', 'NTEC');
    this.preencher('slug', 'ntec');
    this.preencher('codigo', '500');
    this.preencher('nome', 'Núcleo de Tecnologia');
  }

  async abrirEdicao(unidade: UnidadeDto = reitoria): Promise<void> {
    const botao = this.editar(unidade);
    botao.focus();
    botao.click();
    await this.responderAConsultaDasUnidades();
  }

  /** Envia o formulário aberto, com o foco no botão de salvar, e devolve a requisição de escrita. */
  async enviar(url = ESCRITA): Promise<TestRequest> {
    const botao = this.salvar();
    botao.focus();
    botao.click();
    await this.propagar();
    return this.http.expectOne(url);
  }

  async confirmarRemocao(unidade: UnidadeDto = reitoria): Promise<TestRequest> {
    const lixeira = this.remover(unidade);
    lixeira.focus();
    lixeira.click();
    await this.propagar();
    this.confirmar().click();
    await this.propagar();
    return this.http.expectOne(`${ESCRITA}/${unidade.id}`);
  }

  private pelaEtiqueta(nome: string): HTMLButtonElement {
    return this.elemento(`button[aria-label="${nome}"]`);
  }
}
