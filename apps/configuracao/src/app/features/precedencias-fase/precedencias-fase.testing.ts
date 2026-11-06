import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CONFIGURACAO_BASE_PATH,
  FaseCanonicaDto,
  PrecedenciaFaseDto,
} from '@uniplus/shared-data/configuracao';
import { expect, vi } from 'vitest';
import { EdicaoDasPrecedencias } from './edicao-das-precedencias';
import { FasesDoGrafoStore } from './fases-do-grafo.store';
import { PrecedenciasFasePage } from './precedencias-fase.page';
import { PrecedenciasFaseStore } from './precedencias-fase.store';

const BASE = 'http://localhost:5000';
export const LISTA = `${BASE}/api/configuracao/precedencias-fase`;
export const FASES = `${BASE}/api/configuracao/fases-canonicas`;
export const ESCRITA = `${BASE}/api/configuracao/admin/precedencias-fase`;
export const TITULO_DA_LISTA = '#cfg-precedencias-fase-list-title';

export const inscricaoHomologacao: PrecedenciaFaseDto = {
  id: '01960000-0000-7000-0000-0000000000a1',
  antecessoraCodigo: 'INSCRICAO',
  sucessoraCodigo: 'HOMOLOGACAO',
  permiteSobreposicao: false,
  criadoEm: '2026-07-15T12:00:00Z',
};

export const avaliacaoClassificacao: PrecedenciaFaseDto = {
  ...inscricaoHomologacao,
  id: '01960000-0000-7000-0000-0000000000a2',
  antecessoraCodigo: 'AVALIACAO',
  sucessoraCodigo: 'CLASSIFICACAO',
};

export function faseCanonica(codigo: string, nome: string): FaseCanonicaDto {
  return {
    id: `fase-${codigo}`,
    codigo,
    nome,
    descricao: null,
    unidadeSugerida: null,
    agrupaEtapas: false,
    permiteComplementacao: false,
    coletaInscricao: false,
    coletaSolicitacaoIsencao: false,
    origemData: 'NO_EDITAL',
    baseLegal: null,
    criadoEm: '2026-06-10T12:00:00Z',
  };
}

/** Um 409 de conflito de estado, recusa 4xx que chega à tela (o 403 vai à página de acesso negado). */
export const CONFLITO = {
  code: 'uniplus.configuracao.conflito',
  title: 'A aresta mudou desde a leitura.',
} as const;
/** O 500 que o middleware global de exceções da API emite. */
export const ERRO_INTERNO = {
  code: 'uniplus.internal.unexpected',
  title: 'Erro interno do servidor',
} as const;

export const problema = (status: number, corpo: object = {}) =>
  [
    JSON.stringify({ type: 'about:blank', title: 'Falha', status, ...corpo }),
    { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
  ] as const;

/** Violação de campo como a API a emite: o `code` da raiz é o da primeira violação, e o `field` vem em camelCase. */
export const recusaDeCampo = (
  field: string,
  message: string,
  code = 'uniplus.configuracao.precedencia_fase.sucessora_codigo_formato_invalido',
) => problema(422, { code, title: message, errors: [{ field, code, message }] });

export const sucesso = () => [null, { status: 204, statusText: 'No Content' }] as const;
export const criado = () => ['nova-aresta-id', { status: 201, statusText: 'Created' }] as const;

/** A página montada com a lista e as fases já carregadas, e as ferramentas para conduzi-la como a pessoa faz. */
export async function montarPagina(
  itens: readonly PrecedenciaFaseDto[] = [inscricaoHomologacao],
  fases: readonly FaseCanonicaDto[] | 'falha' | 'pendente' = [],
  linkDasFases?: string,
) {
  TestBed.configureTestingModule({
    imports: [PrecedenciasFasePage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
    ],
  });
  const fixture: ComponentFixture<PrecedenciasFasePage> =
    TestBed.createComponent(PrecedenciasFasePage);
  const http = TestBed.inject(HttpTestingController);
  const app = TestBed.inject(ApplicationRef);
  const injetor = fixture.debugElement.injector;
  const edicao = injetor.get(EdicaoDasPrecedencias);
  const store = injetor.get(PrecedenciasFaseStore);
  const fasesDoGrafo = injetor.get(FasesDoGrafoStore);
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
  const nomeDoPar = (a: PrecedenciaFaseDto): string =>
    `precedência entre ${a.antecessoraCodigo} e ${a.sucessoraCodigo}`;
  const recarregarCom = async (lista: readonly PrecedenciaFaseDto[]): Promise<void> => {
    await propagar();
    http.expectOne((r) => r.url === LISTA).flush(lista);
    await propagar();
  };
  const selecionar = (nome: string, valor: string): void => {
    const campo = elemento<HTMLSelectElement>(`select[formcontrolname="${nome}"]`);
    const opcao = [...campo.options].find((o) => o.value === valor || o.text.trim() === valor);
    expect(opcao, `opção ${valor}`).toBeDefined();
    campo.value = (opcao as HTMLOptionElement).value;
    campo.dispatchEvent(new Event('change'));
  };

  fixture.detectChanges();
  const pedidoDeFases = http.expectOne((r) => r.url === FASES);
  if (fases === 'pendente') {
    // a requisição das fases segue em aberto; o teste a responde com `responderFases`
  } else if (fases === 'falha') {
    pedidoDeFases.flush(...problema(503));
  } else {
    pedidoDeFases.flush(fases, linkDasFases ? { headers: { Link: linkDasFases } } : {});
  }
  http.expectOne((r) => r.url === LISTA).flush(itens);
  await propagar();

  return {
    fixture,
    http,
    responderFases: async (corpo: readonly FaseCanonicaDto[]): Promise<void> => {
      pedidoDeFases.flush(corpo);
      await propagar();
    },
    edicao,
    store,
    fasesDoGrafo,
    sucessos,
    erros,
    propagar,
    elemento,
    recarregarCom,
    selecionar,
    formulario: (): HTMLFormElement => elemento('#cfg-precedencia-fase-form'),
    novo: (): HTMLButtonElement => elemento('#cfg-precedencias-fase-nova'),
    editar: (a: PrecedenciaFaseDto = inscricaoHomologacao) =>
      pelaEtiqueta(`Editar ${nomeDoPar(a)}`),
    remover: (a: PrecedenciaFaseDto = inscricaoHomologacao) =>
      pelaEtiqueta(`Remover ${nomeDoPar(a)}`),
    salvar: (): HTMLButtonElement => elemento('button[form="cfg-precedencia-fase-form"]'),
    confirmar: (): HTMLButtonElement => elemento('[data-testid="confirm-dialog-confirm"]'),
    cancelarDaConfirmacao: (): HTMLButtonElement =>
      elemento('[data-testid="confirm-dialog-cancel"]'),
    campo: (nome: string): HTMLElement => elemento(`[formcontrolname="${nome}"]`),
    statusDaPagina: (): string =>
      elemento(':scope > span.sr-only[role="status"]').textContent ?? '',
    /** Clica de verdade em "Nova aresta" e escolhe um par válido. */
    async abrirCadastro(antecessora = 'AVALIACAO', sucessora = 'CLASSIFICACAO'): Promise<void> {
      elemento<HTMLButtonElement>('#cfg-precedencias-fase-nova').focus();
      elemento<HTMLButtonElement>('#cfg-precedencias-fase-nova').click();
      await propagar();
      selecionar('antecessoraCodigo', antecessora);
      selecionar('sucessoraCodigo', sucessora);
    },
    async abrirEdicao(aresta: PrecedenciaFaseDto = inscricaoHomologacao): Promise<void> {
      const botao = pelaEtiqueta(`Editar ${nomeDoPar(aresta)}`);
      botao.focus();
      botao.click();
      await propagar();
    },
    /** Envia o formulário aberto, com o foco no botão de salvar, e devolve a requisição de escrita. */
    async enviar(url = ESCRITA) {
      const botao = elemento<HTMLButtonElement>('button[form="cfg-precedencia-fase-form"]');
      botao.focus();
      botao.click();
      await propagar();
      return http.expectOne(url);
    },
    async confirmarRemocao(aresta: PrecedenciaFaseDto = inscricaoHomologacao) {
      const lixeira = pelaEtiqueta(`Remover ${nomeDoPar(aresta)}`);
      lixeira.focus();
      lixeira.click();
      await propagar();
      elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
      await propagar();
      return http.expectOne(`${ESCRITA}/${aresta.id}`);
    },
  };
}

export type Pagina = Awaited<ReturnType<typeof montarPagina>>;
