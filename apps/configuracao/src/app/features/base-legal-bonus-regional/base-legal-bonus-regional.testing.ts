import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  BaseLegalBonusRegionalDto,
  CONFIGURACAO_BASE_PATH,
  TipoInstrumentoNormativoCodigo,
  type TipoInstrumentoNormativoComDescricao,
} from '@uniplus/shared-data/configuracao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { NomesDeMunicipios, type MunicipioEncontrado } from '@uniplus/shared-ui/components';
import { expect, vi } from 'vitest';
import { BaseLegalBonusRegionalPage } from './base-legal-bonus-regional.page';
import { BaseLegalBonusRegionalStore } from './base-legal-bonus-regional.store';
import { EdicaoDasBasesLegais } from './edicao-das-bases-legais';
import { MunicipiosDaBaseLegal } from './municipios-da-base-legal';

const BASE = 'http://localhost:5000';
export const LISTA = `${BASE}/api/configuracao/base-legal-bonus-regional`;
export const ESCRITA = `${BASE}/api/configuracao/admin/base-legal-bonus-regional`;
export const TIPOS_URL = `${BASE}/api/configuracao/vocabularios/tipos-instrumento-normativo`;
export const CIDADES_URL = `${BASE}/api/cidades`;
export const TITULO_DA_LISTA = '#cfg-base-legal-list-title';
export const FORMULARIO = '#cfg-base-legal-form';

export const TIPO_PORTARIA: TipoInstrumentoNormativoComDescricao = {
  codigo: TipoInstrumentoNormativoCodigo.PORTARIA,
  rotulo: 'Rótulo do tipo portaria',
  descricao: 'Descrição do tipo portaria.',
};
export const TIPO_LEI: TipoInstrumentoNormativoComDescricao = {
  codigo: TipoInstrumentoNormativoCodigo.LEI,
  rotulo: 'Rótulo do tipo lei',
  descricao: 'Descrição do tipo lei.',
};
export const TIPOS: readonly TipoInstrumentoNormativoComDescricao[] = [TIPO_PORTARIA, TIPO_LEI];

/** O tipo como a base legal o traz: só código e rótulo, sem a descrição do vocabulário. */
const tipoDaBase = ({ codigo, rotulo }: TipoInstrumentoNormativoComDescricao) => ({
  codigo,
  rotulo,
});

export const MARABA = {
  id: 'cidade-1',
  codigoIbge: '1504208',
  nome: 'Marabá',
  uf: 'PA',
  ddd: '94',
};
export const ITUPIRANGA = {
  id: 'cidade-2',
  codigoIbge: '1503606',
  nome: 'Itupiranga',
  uf: 'PA',
  ddd: '94',
};

export const portaria: BaseLegalBonusRegionalDto = {
  id: 'ba5e0000-0000-7000-8000-000000000001',
  codigo: 'PORTARIA_UNIFESSPA_2514_2023',
  tipoInstrumento: tipoDaBase(TIPO_PORTARIA),
  identificacao: 'Portaria Unifesspa nº 2514/2023',
  descricao: 'Institui inclusão regional.',
  municipios: [{ codigoIbge: MARABA.codigoIbge, nome: MARABA.nome, uf: MARABA.uf }],
  criadoEm: '2026-01-01T00:00:00Z',
};

export const decreto: BaseLegalBonusRegionalDto = {
  ...portaria,
  id: 'ba5e0000-0000-7000-8000-000000000002',
  codigo: 'LEI_ESTADUAL_9999_2020',
  tipoInstrumento: tipoDaBase(TIPO_LEI),
  identificacao: 'Lei estadual nº 9.999/2020',
  municipios: [{ codigoIbge: ITUPIRANGA.codigoIbge, nome: ITUPIRANGA.nome, uf: ITUPIRANGA.uf }],
};

export const problema = (status: number, corpo: object = {}) =>
  [
    JSON.stringify({ type: 'about:blank', title: 'Falha', status, ...corpo }),
    { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
  ] as const;

/** O código que a API emite: 5xx é erro inesperado e 403 é falta de permissão. */
export const corpoDaFalha = (status: number): { code: string } => ({
  code: status >= 500 ? 'uniplus.internal.unexpected' : 'uniplus.auth.forbidden',
});

const PREFIXO_DOS_CODIGOS = 'uniplus.configuracao.base_legal_bonus_regional';
const CODIGO_DO_CAMPO: Readonly<Record<string, string>> = {
  tipoInstrumento: 'tipo_instrumento_invalido',
  identificacao: 'identificacao_tamanho',
  descricao: 'descricao_tamanho',
  municipios: 'municipio_invalido',
};

/** A recusa 422 como a API a emite: `field` em camelCase e o `code` geral igual ao do primeiro erro. */
export const recusaDeCampo = (field: string, message: string) => {
  const code = `${PREFIXO_DOS_CODIGOS}.${CODIGO_DO_CAMPO[field.replace(/\[\d+\]$/, '')] ?? 'sem_municipios'}`;
  return problema(422, { code, errors: [{ field, code, message }] });
};

export const sucesso = () => [null, { status: 204, statusText: 'No Content' }] as const;
export const criado = () => ['novo-id', { status: 201, statusText: 'Created' }] as const;

/** O vocabulário chega, falha com o status dado ou fica pendente até o teste responder. */
export type RespostaDosTipos =
  | readonly TipoInstrumentoNormativoComDescricao[]
  | { readonly falha: number }
  | 'pendente';

/** A página montada e as ferramentas para conduzi-la nos testes. */
export class PaginaDaBaseLegal {
  readonly http = TestBed.inject(HttpTestingController);
  private readonly app = TestBed.inject(ApplicationRef);
  readonly edicao: EdicaoDasBasesLegais;
  readonly store: BaseLegalBonusRegionalStore;
  readonly municipios: MunicipiosDaBaseLegal;
  readonly sucessos = vi.spyOn(TestBed.inject(NotificationService), 'success');
  readonly erros = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');

  constructor(readonly fixture: ComponentFixture<BaseLegalBonusRegionalPage>) {
    const injetor = fixture.debugElement.injector;
    this.edicao = injetor.get(EdicaoDasBasesLegais);
    this.store = injetor.get(BaseLegalBonusRegionalStore);
    this.municipios = injetor.get(MunicipiosDaBaseLegal);
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

  async recarregarCom(lista: readonly BaseLegalBonusRegionalDto[]): Promise<void> {
    await this.propagar();
    this.http.expectOne((r) => r.url === LISTA).flush(lista);
    await this.propagar();
  }

  /** O controle nativo do campo: o `select` que o `ui-select` do tipo guarda por dentro, ou o próprio campo. */
  campo(nome: string): HTMLInputElement | HTMLSelectElement {
    const campo = this.elemento<HTMLInputElement>(`[formcontrolname="${nome}"]`);
    return campo.querySelector('select') ?? campo;
  }

  preencher(nome: string, valor: string): void {
    const campo = this.campo(nome);
    campo.value = valor;
    campo.dispatchEvent(new Event(campo.tagName === 'SELECT' ? 'change' : 'input'));
  }

  formulario = (): HTMLFormElement => this.elemento(FORMULARIO);
  novo = (): HTMLButtonElement => this.elemento('#cfg-base-legal-novo');
  salvar = (): HTMLButtonElement => this.elemento('button[form="cfg-base-legal-form"]');
  buscaDeMunicipio = (): HTMLInputElement =>
    this.elemento('cfg-campo-de-municipios input[role="combobox"]');
  statusDaPagina = (): string =>
    this.elemento(':scope > span.sr-only[role="status"]').textContent ?? '';

  editar(base: BaseLegalBonusRegionalDto = portaria): HTMLButtonElement {
    return this.pelaEtiqueta(`Editar base legal ${base.identificacao}`);
  }

  remover(base: BaseLegalBonusRegionalDto = portaria): HTMLButtonElement {
    return this.pelaEtiqueta(`Remover base legal de bônus regional ${base.identificacao}`);
  }

  confirmar = (): HTMLButtonElement => this.botaoDoDialogo('confirm');
  cancelarDaConfirmacao = (): HTMLButtonElement => this.botaoDoDialogo('cancel');

  /** Clica de verdade em "Nova base legal", preenche o mínimo e escolhe Marabá como município. */
  async abrirCadastro(): Promise<void> {
    await this.acionar(this.novo());
    this.preencher('tipoInstrumento', TIPO_PORTARIA.codigo);
    this.preencher('identificacao', 'Portaria de teste');
    this.preencher('descricao', 'Descrição de teste válida.');
    this.escolherMunicipios(MARABA);
    await this.propagar();
  }

  preencherCadastroValido(): void {
    this.preencher('tipoInstrumento', TIPO_PORTARIA.codigo);
    this.preencher('identificacao', 'Portaria de teste');
    this.preencher('descricao', 'Descrição de teste válida.');
    this.escolherMunicipios(MARABA);
  }

  escolherMunicipios(...municipios: MunicipioEncontrado[]): void {
    TestBed.inject(NomesDeMunicipios).lembrar(municipios);
    this.municipios.escolher(municipios.map((municipio) => municipio.codigoIbge));
  }

  async abrirEdicao(base: BaseLegalBonusRegionalDto = portaria): Promise<void> {
    await this.acionar(this.editar(base));
  }

  /** Envia o formulário aberto, com o foco no botão de salvar, e devolve a requisição de escrita. */
  async enviar(url = ESCRITA) {
    await this.acionar(this.salvar());
    return this.http.expectOne((r) => r.url === url && r.method !== 'GET');
  }

  async confirmarRemocao(base: BaseLegalBonusRegionalDto = portaria) {
    await this.acionar(this.remover(base));
    this.confirmar().click();
    await this.propagar();
    return this.http.expectOne(`${ESCRITA}/${base.id}`);
  }

  private pelaEtiqueta(nome: string): HTMLButtonElement {
    return this.elemento(`button[aria-label="${nome}"]`);
  }

  private botaoDoDialogo(acao: 'confirm' | 'cancel'): HTMLButtonElement {
    return this.elemento(`cfg-confirmacao-de-remocao [data-testid="confirm-dialog-${acao}"]`);
  }

  private async acionar(botao: HTMLButtonElement): Promise<void> {
    botao.focus();
    botao.click();
    await this.propagar();
  }
}

function configurarModuloDaPagina(): void {
  TestBed.configureTestingModule({
    imports: [BaseLegalBonusRegionalPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      { provide: GEO_BASE_PATH, useValue: BASE },
    ],
  });
}

function responderAosTipos(http: HttpTestingController, tipos: RespostaDosTipos): void {
  if (tipos === 'pendente') return;
  const resposta = http.expectOne((r) => r.url === TIPOS_URL);
  if ('falha' in tipos) resposta.flush(...problema(tipos.falha, corpoDaFalha(tipos.falha)));
  else resposta.flush(tipos);
}

/** A página montada com a lista e o vocabulário já carregados, e as ferramentas para conduzi-la. */
export async function montarPagina(
  itens: readonly BaseLegalBonusRegionalDto[] = [portaria, decreto],
  tipos: RespostaDosTipos = TIPOS,
): Promise<PaginaDaBaseLegal> {
  configurarModuloDaPagina();
  const pagina = new PaginaDaBaseLegal(TestBed.createComponent(BaseLegalBonusRegionalPage));
  pagina.fixture.detectChanges();
  await pagina.propagar();
  responderAosTipos(pagina.http, tipos);
  pagina.http.expectOne((r) => r.url === LISTA).flush(itens);
  await pagina.propagar();
  return pagina;
}

export type Pagina = PaginaDaBaseLegal;

export function verificarErroDeMunicipioObrigatorio(p: Pagina): void {
  const erro = p.elemento('#cfg-blbr-municipios-erro');
  expect(erro.textContent?.trim()).toBe('Adicione ao menos um município.');
  expect(erro.getAttribute('role')).toBe('alert');
  expect(p.buscaDeMunicipio().getAttribute('aria-invalid')).toBe('true');
  expect(p.buscaDeMunicipio().getAttribute('aria-describedby')).toContain(
    'cfg-blbr-municipios-erro',
  );
  expect(document.activeElement).toBe(p.buscaDeMunicipio());
}
