import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CONFIGURACAO_BASE_PATH, TipoEtapaDto } from '@uniplus/shared-data/configuracao';
import { expect, vi } from 'vitest';
import { EdicaoDosTiposEtapa } from './edicao-dos-tipos-etapa';
import { TiposEtapaPage } from './tipos-etapa.page';
import { TiposEtapaStore } from './tipos-etapa.store';

const BASE = 'http://localhost:5000';
export const LISTA = `${BASE}/api/configuracao/tipos-etapa`;
export const ESCRITA = `${BASE}/api/configuracao/admin/tipos-etapa`;
export const TITULO_DA_LISTA = '#cfg-tipos-etapa-list-title';

export const prova: TipoEtapaDto = {
  id: '01960000-0000-7000-0000-0000000000e1',
  codigo: 'PROVA',
  nome: 'Prova',
  descricao: null,
  ativo: true,
  admitePontuacao: true,
  admiteEliminacao: true,
  notaDeOrigemNoEnem: false,
  criadoEm: '2026-08-11T00:00:00Z',
};

export const analiseDocumental: TipoEtapaDto = {
  ...prova,
  id: '01960000-0000-7000-0000-0000000000e2',
  codigo: 'ANALISE_DOCUMENTAL',
  nome: 'Análise Documental',
  admitePontuacao: false,
};

export const problema = (status: number, corpo: object = {}) =>
  [
    JSON.stringify({ type: 'about:blank', title: 'Falha', status, ...corpo }),
    { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
  ] as const;

export const recusaDeCampo = (field: string, message: string) =>
  problema(422, {
    code: 'uniplus.validacao',
    errors: [{ field, code: 'uniplus.configuracao.tipo_etapa.nome_tamanho', message }],
  });

export const sucesso = () => [null, { status: 204, statusText: 'No Content' }] as const;
export const criado = () => ['novo-id', { status: 201, statusText: 'Created' }] as const;

/** A página montada com a lista já carregada, e as ferramentas para conduzi-la como a pessoa faz. */
export async function montarPagina(itens: readonly TipoEtapaDto[] = [prova]) {
  TestBed.configureTestingModule({
    imports: [TiposEtapaPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
    ],
  });
  const fixture: ComponentFixture<TiposEtapaPage> = TestBed.createComponent(TiposEtapaPage);
  const http = TestBed.inject(HttpTestingController);
  const app = TestBed.inject(ApplicationRef);
  const injetor = fixture.debugElement.injector;
  const edicao = injetor.get(EdicaoDosTiposEtapa);
  const store = injetor.get(TiposEtapaStore);
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
  const recarregarCom = async (lista: readonly TipoEtapaDto[]): Promise<void> => {
    await propagar();
    http.expectOne((r) => r.url === LISTA).flush(lista);
    await propagar();
  };
  const preencher = (nome: string, valor: string): void => {
    const campo = elemento<HTMLInputElement>(`[formcontrolname="${nome}"]`);
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  };
  const formulario = (): HTMLFormElement => elemento('#cfg-tipo-etapa-form');

  fixture.detectChanges();
  http.expectOne((r) => r.url === LISTA).flush(itens);
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
    formulario,
    novo: (): HTMLButtonElement => elemento('#cfg-tipos-etapa-novo'),
    editar: (t: TipoEtapaDto = prova) => pelaEtiqueta(`Editar tipo de etapa ${t.codigo}`),
    desativar: (t: TipoEtapaDto = prova) => pelaEtiqueta(`Desativar tipo de etapa ${t.codigo}`),
    salvar: (): HTMLButtonElement => elemento('button[form="cfg-tipo-etapa-form"]'),
    confirmar: (): HTMLButtonElement => elemento('[data-testid="confirm-dialog-confirm"]'),
    cancelarDaConfirmacao: (): HTMLButtonElement =>
      elemento('[data-testid="confirm-dialog-cancel"]'),
    campo: (nome: string): HTMLInputElement => elemento(`[formcontrolname="${nome}"]`),
    statusDaPagina: (): string =>
      elemento(':scope > span.sr-only[role="status"]').textContent ?? '',
    /** Clica de verdade em "Novo tipo de etapa" e preenche o mínimo para enviar. */
    async abrirCadastro(): Promise<void> {
      elemento<HTMLButtonElement>('#cfg-tipos-etapa-novo').focus();
      elemento<HTMLButtonElement>('#cfg-tipos-etapa-novo').click();
      await propagar();
      preencher('codigo', 'NOVA_PROVA');
      preencher('nome', 'Nova prova');
    },
    async abrirEdicao(tipo: TipoEtapaDto = prova): Promise<void> {
      const botao = pelaEtiqueta(`Editar tipo de etapa ${tipo.codigo}`);
      botao.focus();
      botao.click();
      await propagar();
    },
    /** Envia o formulário aberto, com o foco no botão de salvar, e devolve a requisição de escrita. */
    async enviar(url = ESCRITA) {
      const botao = elemento<HTMLButtonElement>('button[form="cfg-tipo-etapa-form"]');
      botao.focus();
      botao.click();
      await propagar();
      return http.expectOne(url);
    },
    async confirmarDesativacao(tipo: TipoEtapaDto = prova) {
      const lixeira = pelaEtiqueta(`Desativar tipo de etapa ${tipo.codigo}`);
      lixeira.focus();
      lixeira.click();
      await propagar();
      elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
      await propagar();
      return http.expectOne(`${ESCRITA}/${tipo.id}`);
    },
  };
}

export type Pagina = Awaited<ReturnType<typeof montarPagina>>;
