import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CONFIGURACAO_BASE_PATH, TipoProcessoDto } from '@uniplus/shared-data/configuracao';
import { expect, vi } from 'vitest';
import { EdicaoDosTiposProcesso } from './edicao-dos-tipos-processo';
import { TiposProcessoPage } from './tipos-processo.page';
import { TiposProcessoStore } from './tipos-processo.store';

const BASE = 'http://localhost:5000';
export const LISTA = `${BASE}/api/configuracao/admin/tipos-processo`;
export const TITULO_DA_LISTA = '#cfg-tipos-processo-list-title';
export const PERMISSAO_DE_MANTER = 'configuracao:tipos-processo:manter';
export const PERMISSAO_DE_CONSULTAR = 'configuracao:tipos-processo:consultar';

export const sisu: TipoProcessoDto = {
  id: '01960000-0000-7000-0000-000000000051',
  codigo: 'SISU',
  nome: 'SiSU',
  descricao: 'Sistema de Seleção Unificada.',
  ativo: true,
  criadoEm: '2026-08-11T12:00:00Z',
};

export const vestibular: TipoProcessoDto = {
  id: '01960000-0000-7000-0000-0000000000f0',
  codigo: 'VESTIBULAR_TRAD',
  nome: 'Vestibular tradicional',
  descricao: null,
  ativo: false,
  criadoEm: '2026-05-01T12:00:00Z',
};

export const problema = (status: number, corpo: object = {}) =>
  [
    JSON.stringify({ type: 'about:blank', title: 'Falha', status, ...corpo }),
    { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
  ] as const;

export const recusaDeCampo = (field: string, message: string) =>
  problema(422, {
    code: 'uniplus.validacao',
    errors: [{ field, code: 'uniplus.configuracao.tipo_processo.nome_tamanho', message }],
  });

export const sucesso = () => [null, { status: 204, statusText: 'No Content' }] as const;
export const criado = () => ['novo-id', { status: 201, statusText: 'Created' }] as const;

/** A página montada com a lista já carregada, e as ferramentas para conduzi-la como a pessoa faz. */
export async function montarPagina(
  itens: readonly TipoProcessoDto[] = [sisu, vestibular],
  concedidas: readonly string[] = [PERMISSAO_DE_MANTER],
) {
  const permissoes = signal<readonly string[]>(concedidas);
  TestBed.configureTestingModule({
    imports: [TiposProcessoPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      { provide: PermissoesService, useValue: { tem: (c: string) => permissoes().includes(c) } },
    ],
  });
  const fixture: ComponentFixture<TiposProcessoPage> = TestBed.createComponent(TiposProcessoPage);
  const http = TestBed.inject(HttpTestingController);
  const app = TestBed.inject(ApplicationRef);
  const injetor = fixture.debugElement.injector;
  const edicao = injetor.get(EdicaoDosTiposProcesso);
  const store = injetor.get(TiposProcessoStore);
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
  const recarregarCom = async (lista: readonly TipoProcessoDto[]): Promise<void> => {
    await propagar();
    http.expectOne((r) => r.url === LISTA && r.method === 'GET').flush(lista);
    await propagar();
  };
  const preencher = (nome: string, valor: string): void => {
    const campo = elemento<HTMLInputElement>(`[formcontrolname="${nome}"]`);
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  };
  const confirmacao = (qual: 'desativar' | 'reativar'): HTMLElement =>
    elemento(`cfg-confirmacao-de-remocao:nth-of-type(${qual === 'desativar' ? 1 : 2})`);
  const acionar = async (botao: HTMLButtonElement): Promise<void> => {
    botao.focus();
    botao.click();
    await propagar();
  };

  fixture.detectChanges();
  http.expectOne((r) => r.url === LISTA && r.method === 'GET').flush(itens);
  await propagar();

  return {
    fixture,
    http,
    edicao,
    store,
    sucessos,
    erros,
    propagar,
    elemento,
    recarregarCom,
    preencher,
    confirmacao,
    permissoes,
    formulario: (): HTMLFormElement => elemento('#cfg-tipo-processo-form'),
    novo: (): HTMLButtonElement => elemento('#cfg-tipos-processo-novo'),
    editar: (t: TipoProcessoDto = sisu) => pelaEtiqueta(`Editar tipo de processo ${t.codigo}`),
    desativar: (t: TipoProcessoDto = sisu) =>
      pelaEtiqueta(`Desativar tipo de processo ${t.codigo}`),
    reativar: (t: TipoProcessoDto = vestibular) =>
      pelaEtiqueta(`Reativar tipo de processo ${t.codigo}`),
    salvar: (): HTMLButtonElement => elemento('button[form="cfg-tipo-processo-form"]'),
    confirmar: (qual: 'desativar' | 'reativar' = 'desativar'): HTMLButtonElement =>
      confirmacao(qual).querySelector(
        '[data-testid="confirm-dialog-confirm"]',
      ) as HTMLButtonElement,
    cancelarDaConfirmacao: (qual: 'desativar' | 'reativar' = 'desativar'): HTMLButtonElement =>
      confirmacao(qual).querySelector('[data-testid="confirm-dialog-cancel"]') as HTMLButtonElement,
    campo: (nome: string): HTMLInputElement => elemento(`[formcontrolname="${nome}"]`),
    statusDaPagina: (): string =>
      elemento(':scope > span.sr-only[role="status"]').textContent ?? '',
    /** Clica de verdade em "Novo tipo de processo" e preenche o mínimo para enviar. */
    async abrirCadastro(): Promise<void> {
      await acionar(elemento('#cfg-tipos-processo-novo'));
      preencher('nome', 'Processo seletivo');
      await propagar();
    },
    async abrirEdicao(tipo: TipoProcessoDto = sisu): Promise<void> {
      await acionar(pelaEtiqueta(`Editar tipo de processo ${tipo.codigo}`));
    },
    /** Envia o formulário aberto, com o foco no botão de salvar, e devolve a requisição de escrita. */
    async enviar(url = LISTA) {
      await acionar(elemento('button[form="cfg-tipo-processo-form"]'));
      return http.expectOne((r) => r.url === url && r.method !== 'GET');
    },
    async confirmarDesativacao(tipo: TipoProcessoDto = sisu) {
      await acionar(pelaEtiqueta(`Desativar tipo de processo ${tipo.codigo}`));
      elemento<HTMLButtonElement>(
        'cfg-confirmacao-de-remocao:nth-of-type(1) [data-testid="confirm-dialog-confirm"]',
      ).click();
      await propagar();
      return http.expectOne(`${LISTA}/${tipo.id}`);
    },
    async confirmarReativacao(tipo: TipoProcessoDto = vestibular) {
      await acionar(pelaEtiqueta(`Reativar tipo de processo ${tipo.codigo}`));
      elemento<HTMLButtonElement>(
        'cfg-confirmacao-de-remocao:nth-of-type(2) [data-testid="confirm-dialog-confirm"]',
      ).click();
      await propagar();
      return http.expectOne(`${LISTA}/${tipo.id}/ativacao`);
    },
  };
}

export type Pagina = Awaited<ReturnType<typeof montarPagina>>;
