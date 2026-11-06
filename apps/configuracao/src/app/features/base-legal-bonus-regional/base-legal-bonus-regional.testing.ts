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
  type TipoInstrumentoNormativoVocabularioDto,
} from '@uniplus/shared-data/configuracao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
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

export const TIPOS: readonly TipoInstrumentoNormativoVocabularioDto[] = [
  { codigo: 'PORTARIA', nome: 'Portaria', descricao: 'Ato administrativo.' },
  { codigo: 'LEI', nome: 'Lei', descricao: 'Ato normativo.' },
];

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
  tipoInstrumento: 'PORTARIA',
  identificacao: 'Portaria Unifesspa nº 2514/2023',
  descricao: 'Institui inclusão regional.',
  municipios: [{ codigoIbge: MARABA.codigoIbge, nome: MARABA.nome, uf: MARABA.uf }],
  criadoEm: '2026-01-01T00:00:00Z',
};

export const decreto: BaseLegalBonusRegionalDto = {
  ...portaria,
  id: 'ba5e0000-0000-7000-8000-000000000002',
  tipoInstrumento: 'LEI',
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

/** A recusa 422 como a API a emite: `field` em camelCase e o `code` da raiz igual ao do primeiro erro. */
export const recusaDeCampo = (field: string, message: string) => {
  const code = `${PREFIXO_DOS_CODIGOS}.${CODIGO_DO_CAMPO[field.replace(/\[\d+\]$/, '')] ?? 'sem_municipios'}`;
  return problema(422, { code, errors: [{ field, code, message }] });
};

export const sucesso = () => [null, { status: 204, statusText: 'No Content' }] as const;
export const criado = () => ['novo-id', { status: 201, statusText: 'Created' }] as const;

/** O vocabulário chega, falha com o status dado ou fica pendente até o teste responder. */
export type RespostaDosTipos =
  | readonly TipoInstrumentoNormativoVocabularioDto[]
  | { readonly falha: number }
  | 'pendente';

/** A página montada com a lista e o vocabulário já carregados, e as ferramentas para conduzi-la. */
export async function montarPagina(
  itens: readonly BaseLegalBonusRegionalDto[] = [portaria, decreto],
  tipos: RespostaDosTipos = TIPOS,
) {
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
  const fixture: ComponentFixture<BaseLegalBonusRegionalPage> = TestBed.createComponent(
    BaseLegalBonusRegionalPage,
  );
  const http = TestBed.inject(HttpTestingController);
  const app = TestBed.inject(ApplicationRef);
  const injetor = fixture.debugElement.injector;
  const edicao = injetor.get(EdicaoDasBasesLegais);
  const store = injetor.get(BaseLegalBonusRegionalStore);
  const municipios = injetor.get(MunicipiosDaBaseLegal);
  const notificacoes = TestBed.inject(NotificationService);
  const sucessos = vi.spyOn(notificacoes, 'success');
  const erros = vi.spyOn(notificacoes, 'errorFromProblem');

  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    app.tick();
    fixture.detectChanges();
  };
  const elemento = <T extends HTMLElement>(seletor: string): T => {
    const encontrado = (fixture.nativeElement as HTMLElement).querySelector<T>(seletor);
    expect(encontrado, seletor).not.toBeNull();
    return encontrado as T;
  };
  const pelaEtiqueta = (nome: string): HTMLButtonElement =>
    elemento(`button[aria-label="${nome}"]`);
  const recarregarCom = async (lista: readonly BaseLegalBonusRegionalDto[]): Promise<void> => {
    await propagar();
    http.expectOne((r) => r.url === LISTA).flush(lista);
    await propagar();
  };
  const preencher = (nome: string, valor: string): void => {
    const campo = elemento<HTMLInputElement>(`[formcontrolname="${nome}"]`);
    campo.value = valor;
    campo.dispatchEvent(new Event(campo.tagName === 'SELECT' ? 'change' : 'input'));
  };
  const acionar = async (botao: HTMLButtonElement): Promise<void> => {
    botao.focus();
    botao.click();
    await propagar();
  };
  const dialogoDaRemocao = (): HTMLElement => elemento('cfg-confirmacao-de-remocao');

  fixture.detectChanges();
  await propagar();
  if (tipos !== 'pendente') {
    const resposta = http.expectOne((r) => r.url === TIPOS_URL);
    if ('falha' in tipos) resposta.flush(...problema(tipos.falha, corpoDaFalha(tipos.falha)));
    else resposta.flush(tipos);
  }
  http.expectOne((r) => r.url === LISTA).flush(itens);
  await propagar();

  return {
    fixture,
    http,
    edicao,
    store,
    municipios,
    sucessos,
    erros,
    propagar,
    elemento,
    recarregarCom,
    preencher,
    formulario: (): HTMLFormElement => elemento(FORMULARIO),
    novo: (): HTMLButtonElement => elemento('#cfg-base-legal-novo'),
    editar: (b: BaseLegalBonusRegionalDto = portaria) =>
      pelaEtiqueta(`Editar base legal ${b.identificacao}`),
    remover: (b: BaseLegalBonusRegionalDto = portaria) =>
      pelaEtiqueta(`Remover base legal de bônus regional ${b.identificacao}`),
    salvar: (): HTMLButtonElement => elemento('button[form="cfg-base-legal-form"]'),
    confirmar: (): HTMLButtonElement =>
      dialogoDaRemocao().querySelector(
        '[data-testid="confirm-dialog-confirm"]',
      ) as HTMLButtonElement,
    cancelarDaConfirmacao: (): HTMLButtonElement =>
      dialogoDaRemocao().querySelector(
        '[data-testid="confirm-dialog-cancel"]',
      ) as HTMLButtonElement,
    campo: (nome: string): HTMLInputElement => elemento(`[formcontrolname="${nome}"]`),
    buscaDeMunicipio: (): HTMLInputElement =>
      elemento('input[aria-labelledby="cfg-blbr-municipios-label"]'),
    statusDaPagina: (): string =>
      elemento(':scope > span.sr-only[role="status"]').textContent ?? '',
    /** Clica de verdade em "Nova base legal", preenche o mínimo e escolhe Marabá como município. */
    async abrirCadastro(): Promise<void> {
      await acionar(elemento('#cfg-base-legal-novo'));
      preencher('tipoInstrumento', 'PORTARIA');
      preencher('identificacao', 'Portaria de teste');
      preencher('descricao', 'Descrição de teste válida.');
      municipios.adicionar(MARABA);
      await propagar();
    },
    async abrirEdicao(base: BaseLegalBonusRegionalDto = portaria): Promise<void> {
      await acionar(pelaEtiqueta(`Editar base legal ${base.identificacao}`));
    },
    /** Envia o formulário aberto, com o foco no botão de salvar, e devolve a requisição de escrita. */
    async enviar(url = ESCRITA) {
      await acionar(elemento('button[form="cfg-base-legal-form"]'));
      return http.expectOne((r) => r.url === url && r.method !== 'GET');
    },
    async confirmarRemocao(base: BaseLegalBonusRegionalDto = portaria) {
      await acionar(pelaEtiqueta(`Remover base legal de bônus regional ${base.identificacao}`));
      elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
      await propagar();
      return http.expectOne(`${ESCRITA}/${base.id}`);
    },
  };
}

export type Pagina = Awaited<ReturnType<typeof montarPagina>>;
