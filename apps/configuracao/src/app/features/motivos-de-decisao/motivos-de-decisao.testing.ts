import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef, Signal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { MotivoDeDecisaoDto, SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { vi } from 'vitest';
import { EdicaoDosMotivosDeDecisao } from './edicao-dos-motivos-de-decisao';
import { MotivosDeDecisaoPage } from './motivos-de-decisao.page';
import { MotivosDeDecisaoStore } from './motivos-de-decisao.store';

export const BASE = 'http://localhost:5000';
export const LISTA = `${BASE}/api/selecao/motivos-de-decisao`;
export const ESCRITA = `${BASE}/api/selecao/admin/motivos-de-decisao`;
export const FUNDAMENTOS = `${BASE}/api/selecao/fundamentos-isencao`;
export const PERMISSAO_DE_MANTER = PERMISSAO.selecao.motivosDeDecisaoManter;

export const isencao: MotivoDeDecisaoDto = {
  id: '01960000-0000-7000-0000-0000000000a1',
  tipo: 'ISENCAO_DA_TAXA',
  codigo: 'RENDA_ACIMA_DO_LIMITE',
  descricao: 'A renda familiar informada supera o limite do fundamento.',
  subclassificacao: 'BAIXA_RENDA',
  sentido: 'DESFAVORAVEL',
  ativo: true,
  _links: {},
};

export const desativado: MotivoDeDecisaoDto = {
  ...isencao,
  id: '01960000-0000-7000-0000-0000000000a2',
  codigo: 'DOCUMENTO_ILEGIVEL',
  descricao: 'O documento enviado não pôde ser lido.',
  sentido: 'FAVORAVEL',
  ativo: false,
};

export const FUNDAMENTOS_DA_API = [
  { codigo: 'BAIXA_RENDA', nome: 'Baixa renda', descricao: 'Renda familiar baixa.' },
  { codigo: 'DOADOR_DE_MEDULA', nome: 'Doador de medula', descricao: 'Doador cadastrado.' },
];

export const problema = (status: number, corpo: object) =>
  [
    JSON.stringify({ type: 'about:blank', title: 'Falha', status, ...corpo }),
    { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
  ] as const;

export interface OpcoesDaPagina {
  readonly concedidas?: readonly string[];
}

function configurarTestBed(concedidas: Signal<readonly string[]>): void {
  TestBed.configureTestingModule({
    imports: [MotivosDeDecisaoPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: SELECAO_BASE_PATH, useValue: BASE },
      { provide: PermissoesService, useValue: { tem: (c: string) => concedidas().includes(c) } },
    ],
  });
}

function elementoDe<T extends HTMLElement>(
  fixture: ComponentFixture<MotivosDeDecisaoPage>,
  seletor: string,
): T {
  const encontrado = (fixture.nativeElement as HTMLElement).querySelector<T>(seletor);
  expect(encontrado, seletor).not.toBeNull();
  return encontrado as T;
}

function consultasDaTela(fixture: ComponentFixture<MotivosDeDecisaoPage>) {
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const elemento = <T extends HTMLElement>(seletor: string): T => elementoDe<T>(fixture, seletor);
  return {
    raiz,
    elemento,
    texto: (seletor?: string): string =>
      ((seletor ? elemento(seletor) : raiz()).textContent ?? '').replace(/\s+/gu, ' '),
    existe: (seletor: string): boolean => raiz().querySelector(seletor) !== null,
    pelaEtiqueta: (nome: string) => elemento<HTMLButtonElement>(`button[aria-label="${nome}"]`),
  };
}

function ferramentasDaTela(fixture: ComponentFixture<MotivosDeDecisaoPage>) {
  const app = TestBed.inject(ApplicationRef);
  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    app.tick();
    fixture.detectChanges();
  };
  return { propagar, ...consultasDaTela(fixture) };
}

function parametrosDaLeitura(req: TestRequest): Record<string, string | null> {
  const { params } = req.request;
  return {
    tipo: params.get('tipo'),
    apenasAtivos: params.get('apenasAtivos'),
    limit: params.get('limit'),
  };
}

function leitorDaLista(http: HttpTestingController, propagar: () => Promise<void>) {
  return async (
    dados: readonly MotivoDeDecisaoDto[],
    conferir?: (params: Record<string, string | null>) => void,
  ): Promise<void> => {
    const req = http.expectOne((r) => r.url === LISTA && r.method === 'GET');
    conferir?.(parametrosDaLeitura(req));
    req.flush(dados);
    await propagar();
  };
}

function servicosDaPagina(fixture: ComponentFixture<MotivosDeDecisaoPage>) {
  const injetor = fixture.debugElement.injector;
  const notificacoes = TestBed.inject(NotificationService);
  return {
    edicao: injetor.get(EdicaoDosMotivosDeDecisao),
    store: injetor.get(MotivosDeDecisaoStore),
    sucessos: vi.spyOn(notificacoes, 'success'),
    erros: vi.spyOn(notificacoes, 'errorFromProblem'),
  };
}

async function carregarPagina(
  fixture: ComponentFixture<MotivosDeDecisaoPage>,
  tela: ReturnType<typeof ferramentasDaTela>,
  lerLista: ReturnType<typeof leitorDaLista>,
  itens: readonly MotivoDeDecisaoDto[],
): Promise<void> {
  fixture.detectChanges();
  await tela.propagar();
  await lerLista(itens);
}

/** A página montada com a lista do tipo inicial já carregada, e as ferramentas para conduzi-la. */
export async function montarPagina(
  itens: readonly MotivoDeDecisaoDto[] = [isencao],
  opcoes: OpcoesDaPagina = {},
) {
  const concedidas = signal<readonly string[]>(opcoes.concedidas ?? [PERMISSAO_DE_MANTER]);
  configurarTestBed(concedidas);
  const fixture = TestBed.createComponent(MotivosDeDecisaoPage);
  const http = TestBed.inject(HttpTestingController);
  const tela = ferramentasDaTela(fixture);
  const lerLista = leitorDaLista(http, tela.propagar);
  const servicos = servicosDaPagina(fixture);
  await carregarPagina(fixture, tela, lerLista, itens);
  return { ...tela, ...servicos, fixture, http, concedidas, lerLista };
}

export type Pagina = Awaited<ReturnType<typeof montarPagina>>;
