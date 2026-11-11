import { HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { EnvironmentProviders, Provider } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { map, of } from 'rxjs';
import { vi } from 'vitest';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AUTORIZACAO_BASE_PATH,
  PerfisApi,
  VersoesDoPerfilApi,
  type PerfilDto,
} from '@uniplus/shared-data/autorizacao';
import {
  botaoComTexto,
  caixaDaPermissao,
  campoPorRotulo,
  dialogoComTitulo,
  digitar,
  escolherArquivoNoCampo,
  escolherNaLista,
  listaPorRotulo,
} from '../interacao.testing';
import { provideMensagensDeAcesso } from '../mensagens-de-acesso';
import { ok, recusa } from '../testes';
import { DocumentoDaVersaoService } from './documento-da-versao.service';
import { PerfilDetalhePage } from './perfil-detalhe.page';
import { APROVACAO, ESCRITA, LEITURA, perfilDoDetalhe } from './perfis.testing';

export const perfis = { remover: vi.fn(), criar: vi.fn() };
export const versoes = { cancelar: vi.fn(), propor: vi.fn() };
export const documento = { reenviar: vi.fn(), abrir: vi.fn(), enviar: vi.fn() };
export const notificacoes = { success: vi.fn(), errorFromProblem: vi.fn() };
export const leitura = vi.fn();

export interface OpcoesDaPagina {
  readonly concedidas?: readonly string[];
  readonly versaoId?: string;
}

export type Assentavel = { detectChanges(): void; whenStable(): Promise<unknown> };

export function presente<T>(valor: T | null | undefined): T {
  if (valor == null) throw new Error('elemento ausente');
  return valor;
}

export async function assentar(fixture: Assentavel): Promise<void> {
  await new Promise((resolver) => setTimeout(resolver));
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

export function botao(host: HTMLElement, texto: string): HTMLButtonElement | undefined {
  return [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto);
}

export function reiniciarDuplas(): void {
  vi.resetAllMocks();
  TestBed.resetTestingModule();
}

const CATALOGO = [
  {
    modulo: 'selecao',
    resources: [
      {
        resource: 'processos',
        permissoes: [LEITURA, ESCRITA, APROVACAO].map((p) => ({ ...p, descricao: '' })),
      },
    ],
  },
];

function respostaDaApi({ url }: { url: string }) {
  if (url.endsWith('/permissoes')) return of(ok(CATALOGO));
  return url.endsWith('/contencao') ? of(ok([])) : leitura();
}

function provedoresDeHttp(): (Provider | EnvironmentProviders)[] {
  const comoHttp = (body: unknown) => new HttpResponse({ body });
  return [
    { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
    provideHttpClient(withInterceptors([(req) => respostaDaApi(req).pipe(map(comoHttp))])),
  ];
}

function provedoresDeDuplas(concedidas?: readonly string[]): Provider[] {
  const tem = (c: string) => concedidas === undefined || concedidas.includes(c);
  return [
    { provide: PerfisApi, useValue: perfis },
    { provide: PermissoesService, useValue: { tem } },
    { provide: VersoesDoPerfilApi, useValue: versoes },
    { provide: DocumentoDaVersaoService, useValue: documento },
    { provide: NotificationService, useValue: notificacoes },
  ];
}

function configurarOTestBed(resposta: unknown, concedidas?: readonly string[]): void {
  leitura.mockReturnValue(of(resposta));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideMensagensDeAcesso(),
      ...provedoresDeHttp(),
      ...provedoresDeDuplas(concedidas),
    ],
  });
}

function criarAPagina(versaoId?: string): ComponentFixture<PerfilDetalhePage> {
  const fixture = TestBed.createComponent(PerfilDetalhePage);
  fixture.componentRef.setInput('id', 'p1');
  if (versaoId !== undefined) fixture.componentRef.setInput('versaoId', versaoId);
  return fixture;
}

function resultadoDaPagina(fixture: ComponentFixture<PerfilDetalhePage>) {
  return {
    fixture,
    host: fixture.nativeElement as HTMLElement,
  };
}

/** Monta a página do perfil com a leitura dada; `versaoId` simula o link da versão. */
export async function abrir(
  resposta: unknown = ok(perfilDoDetalhe()),
  { concedidas, versaoId }: OpcoesDaPagina = {},
) {
  configurarOTestBed(resposta, concedidas);
  const fixture = criarAPagina(versaoId);
  await assentar(fixture);
  return resultadoDaPagina(fixture);
}

export const arquivoPdf = (): File =>
  new File(['%PDF'], 'portaria.pdf', { type: 'application/pdf' });

/** O campo de envio de PDF dentro do componente dado (`cfg-versao-pendente`, `cfg-perfil-formulario`). */
export function campoDeEnvio(fixture: ComponentFixture<PerfilDetalhePage>, dentroDe: string) {
  return fixture.debugElement.query(
    (d) => d.name === 'ui-file-upload' && d.nativeElement.closest(dentroDe) !== null,
  );
}

/** Escolhe um arquivo no `<input type="file">` do campo de envio, como o navegador faz, e assenta. */
export async function escolherArquivo(
  fixture: ComponentFixture<PerfilDetalhePage>,
  dentroDe: string,
  arquivo: File | null = arquivoPdf(),
): Promise<void> {
  escolherArquivoNoCampo(campoDeEnvio(fixture, dentroDe).nativeElement, arquivo);
  await assentar(fixture);
}

export interface ErroDeCampo {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

/** Recusa 422 da API com erros por campo. */
export function recusaDeCampos(...erros: ErroDeCampo[]) {
  const base = recusa('validacao', 422);
  return {
    ...base,
    problem: {
      type: 'x',
      title: 'Recusado',
      status: 422,
      code: 'validacao',
      traceId: '',
      errors: erros,
    },
  };
}

export function botaoDoDialogoDeRemocao(host: HTMLElement): HTMLButtonElement {
  const botoes = host.querySelectorAll<HTMLButtonElement>('cfg-remocao-dialog button');
  return presente([...botoes].find((b) => b.textContent?.includes('Remover permissões')));
}

type Pagina = ComponentFixture<PerfilDetalhePage>;

/** Clica no botão da página e devolve o diálogo que ele abre. */
async function abrirODialogo(
  fixture: Pagina,
  host: HTMLElement,
  [botaoQueAbre, titulo]: readonly [string, string],
): Promise<HTMLDialogElement> {
  presente(botao(host, botaoQueAbre)).click();
  await assentar(fixture);
  return presente(dialogoComTitulo(host, titulo));
}

export const abrirODialogoDeCancelamento = (fixture: Pagina, host: HTMLElement) =>
  abrirODialogo(fixture, host, ['Cancelar versão pendente', 'Cancelar a versão pendente']);

export const abrirODialogoDeRemocao = (fixture: Pagina, host: HTMLElement) =>
  abrirODialogo(fixture, host, ['Remover permissões', 'Remover permissões']);

/** Clica no botão do diálogo pelo rótulo e deixa a tela assentar. */
export async function confirmarNoDialogo(
  fixture: Pagina,
  dialogo: HTMLElement,
  rotulo: string,
): Promise<void> {
  presente(botaoComTexto(dialogo, rotulo)).click();
  await assentar(fixture);
}

export function preencherOMotivo(dialogo: HTMLElement, texto: string): void {
  digitar(campoPorRotulo(dialogo, 'Motivo'), texto);
}

export interface RemocaoPreenchida {
  readonly permissao: string;
  readonly motivo: string;
  readonly categoria: string;
}

export const REMOCAO_DA_TELA: RemocaoPreenchida = {
  permissao: LEITURA.nome,
  motivo: 'x',
  categoria: 'incidente',
};

/** Marca a permissão, escreve o motivo e escolhe a categoria no diálogo de remoção. */
export function preencherARemocao(dialogo: HTMLElement, dados: RemocaoPreenchida): void {
  caixaDaPermissao(dialogo, dados.permissao).click();
  preencherOMotivo(dialogo, dados.motivo);
  escolherNaLista(listaPorRotulo(dialogo, 'Categoria'), dados.categoria);
}

/** Abre o diálogo de remoção e o preenche com o que a API vai recusar. */
export async function prepararARemocao(fixture: Pagina, host: HTMLElement) {
  const dialogo = await abrirODialogoDeRemocao(fixture, host);
  preencherARemocao(dialogo, REMOCAO_DA_TELA);
  return dialogo;
}

/** Perfil em vigor cuja última versão proposta terminou sem entrar em vigor. */
export function perfilComEncerrada(situacao: string, numero: number): PerfilDto {
  return perfilDoDetalhe({
    ultimaVersaoEncerradaSemVigor: {
      numero,
      situacao,
      etapa: 'protecao_de_dados',
      instante: '2026-11-03T12:00:00Z',
    },
  });
}
