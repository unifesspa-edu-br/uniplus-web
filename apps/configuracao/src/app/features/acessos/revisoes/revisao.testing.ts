import { HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationRef, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { map, of, type Observable } from 'rxjs';
import { vi } from 'vitest';
import { PERMISSAO, PermissoesService, UserContextService } from '@uniplus/shared-auth/bootstrap';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AUTORIZACAO_BASE_PATH,
  RevisoesApi,
  type ItemDaRevisaoDto,
  type RevisaoDeAcessosDto,
} from '@uniplus/shared-data/autorizacao';
import { UnidadesApi } from '@uniplus/shared-data/organizacao';
import { provideMensagensDeAcesso } from '../mensagens-de-acesso';
import { EU, ok } from '../testes';
import { RevisaoDetalhePage } from './revisao-detalhe.page';

const { autorizacao } = PERMISSAO;
export const CONDUZIR = autorizacao.revisoesConduzir;
export const REVER = autorizacao.revisoesReverProtecaoDeDados;
export const CONSULTAR = autorizacao.revisoesConsultar;
export const ID = '01960000-0000-7000-0000-0000000000a1';
export const SUB_DE_QUEM_LE = 'sub-betina';
const EMISSOR = 'https://sso.unifesspa.edu.br/realms/unifesspa';

export const api = { confirmar: vi.fn(), revogar: vi.fn(), abrir: vi.fn() };
export const notificacoes = { success: vi.fn(), errorFromProblem: vi.fn() };
/** A leitura da revisão, chamada a cada GET; cada teste define as respostas em sequência. */
export const leituras = vi.fn<(url: string) => Observable<unknown>>();

const ITEM_PENDENTE = {
  id: 'i1',
  concessaoId: 'c1',
  perfil: { id: 'p1', nome: 'Operador de inscrições' },
  escopo: { tipo: 'unidade', unidadeId: 'unidade-1' },
  validaAte: null,
  decide: 'representante-do-controlador',
  situacao: 'pendente',
  decididoPor: null,
  decididoEm: null,
  ehDoLeitor: false,
} as const satisfies Partial<ItemDaRevisaoDto>;

export function pessoa(sub: string, nome: string) {
  return { emissor: EMISSOR, sub, nome };
}

/** Um item pendente da Fernanda Drumond, que o Representante do controlador decide. */
export function item(parcial: Partial<ItemDaRevisaoDto> = {}): ItemDaRevisaoDto {
  return { ...ITEM_PENDENTE, beneficiario: pessoa('sub-fernanda', 'Fernanda Drumond'), ...parcial };
}

/** O item já decidido: confirmado por quem lê, com a governança gravada. */
export function itemDecidido(parcial: Partial<ItemDaRevisaoDto> = {}): ItemDaRevisaoDto {
  return item({
    situacao: 'confirmada',
    decididoPor: pessoa(SUB_DE_QUEM_LE, 'Betina Neves'),
    decididoEm: '2026-11-10T13:00:00Z',
    ...parcial,
  });
}

const REVISAO_ABERTA = {
  id: ID,
  abertaEm: '2026-11-09T12:00:00Z',
  situacao: 'em_andamento',
  totalDeItens: 4,
  pendentes: 3,
} as const satisfies Partial<RevisaoDeAcessosDto>;

/**
 * Os itens da revisão aberta: um comum da Fernanda, outro dela já confirmado, o do Diogo (que é
 * Representante e cabe à gestão de acessos) e o da própria pessoa que lê.
 */
export function itensDaRevisao(): ItemDaRevisaoDto[] {
  return [
    item(),
    itemDecidido({ id: 'i2', perfil: { id: 'p2', nome: 'Avaliador de recursos' } }),
    item({
      id: 'i3',
      beneficiario: pessoa('sub-diogo', 'Diogo Souza'),
      decide: 'gestor-de-acessos',
    }),
    item({ id: 'i4', beneficiario: pessoa(SUB_DE_QUEM_LE, 'Betina Neves') }),
  ];
}

export function revisao(parcial: Partial<RevisaoDeAcessosDto> = {}): RevisaoDeAcessosDto {
  return {
    ...REVISAO_ABERTA,
    abertaPor: pessoa(SUB_DE_QUEM_LE, 'Betina Neves'),
    itens: itensDaRevisao(),
    ...parcial,
  };
}

function permissoesDe(concedidas: readonly string[]) {
  return {
    tem: (c: string) => concedidas.includes(c),
    temAlguma: (...c: string[]) => c.some((x) => concedidas.includes(x)),
  };
}

const UNIDADES = {
  listar: () => of(ok([{ id: 'unidade-1', nome: 'Centro de Seleção', sigla: 'CEPS' }])),
};

const leituraPeloInterceptor = withInterceptors([
  (req) => leituras(req.url).pipe(map((body) => new HttpResponse({ body }))),
]);

export function provedores(concedidas: readonly string[]) {
  return [
    provideRouter([]),
    provideMensagensDeAcesso(),
    { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
    provideHttpClient(leituraPeloInterceptor),
    { provide: RevisoesApi, useValue: api },
    { provide: NotificationService, useValue: notificacoes },
    { provide: PermissoesService, useValue: permissoesDe(concedidas) },
    { provide: UserContextService, useValue: { user: signal({ ...EU, id: SUB_DE_QUEM_LE }) } },
    { provide: UnidadesApi, useValue: UNIDADES },
  ];
}

export async function assentar(): Promise<void> {
  for (let vez = 0; vez < 2; vez++) {
    await new Promise((resolver) => setTimeout(resolver));
    TestBed.inject(ApplicationRef).tick();
  }
}

export interface PaginaDaRevisao {
  readonly fixture: ComponentFixture<RevisaoDetalhePage>;
  readonly host: HTMLElement;
}

/** Abre o detalhe com as leituras em sequência (a última se repete) e as permissões informadas. */
export async function abrirRevisao(
  respostas: readonly unknown[] = [ok(revisao())],
  concedidas: readonly string[] = [CONDUZIR],
): Promise<PaginaDaRevisao> {
  let vez = 0;
  leituras.mockImplementation(() => of(respostas[Math.min(vez++, respostas.length - 1)]));
  TestBed.configureTestingModule({ providers: provedores(concedidas) });
  const fixture = TestBed.createComponent(RevisaoDetalhePage);
  fixture.componentRef.setInput('id', ID);
  const host = fixture.nativeElement as HTMLElement;
  document.body.appendChild(host);
  fixture.detectChanges();
  await assentar();
  return { fixture, host };
}

/** A linha do item na tabela do beneficiário. */
export function linha(host: HTMLElement, id: string): HTMLElement {
  const encontrada = host.querySelector<HTMLElement>(`tr[data-item-id="${id}"]`);
  if (encontrada === null) throw new Error(`item ${id} ausente`);
  return encontrada;
}

export const botoes = (raiz: ParentNode): string[] =>
  [...raiz.querySelectorAll('button')].map((b) => b.textContent?.trim() ?? '');

export const botao = (raiz: ParentNode, texto: string): HTMLButtonElement => {
  const encontrado = [...raiz.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === texto,
  );
  if (encontrado === undefined) throw new Error(`botão ${texto} ausente`);
  return encontrado;
};
