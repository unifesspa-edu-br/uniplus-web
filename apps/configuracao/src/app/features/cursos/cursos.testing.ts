import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CONFIGURACAO_BASE_PATH,
  CursoDto,
  OfertaCursoDto,
} from '@uniplus/shared-data/configuracao';
import { expect, vi } from 'vitest';
import { CursosPage } from './cursos.page';
import { CursosStore } from './cursos.store';
import { EdicaoDosCursos } from './edicao-dos-cursos';
import { OfertasDoCursoStore } from './ofertas-do-curso.store';

const BASE = 'http://localhost:5000';
export const LISTA = `${BASE}/api/configuracao/cursos`;
export const ESCRITA = `${BASE}/api/configuracao/admin/cursos`;
export const OFERTAS = `${BASE}/api/configuracao/ofertas-curso`;
export const GRUPOS = `${BASE}/api/configuracao/vocabularios/grupos-area-enem`;
export const TITULO_DA_LISTA = '#cfg-cursos-list-title';

export const CODIGO_JA_EXISTE = 'uniplus.configuracao.curso.codigo_ja_existe';
export const REMOCAO_BLOQUEADA = 'uniplus.configuracao.curso.remocao_bloqueada_por_oferta_curso';
export const PROCESSANDO = 'uniplus.idempotency.processing_conflict';

export const engCiv: CursoDto = {
  id: '01960000-0000-7000-0000-0000000000c1',
  codigo: 'ENG-CIV',
  nome: 'Engenharia Civil',
  grau: 'Bacharelado',
  nivelEnsino: 'Graduação',
  grupoAreaEnem: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

export const direito: CursoDto = {
  ...engCiv,
  id: '01960000-0000-7000-0000-0000000000c2',
  codigo: 'DIR',
  nome: 'Direito',
};

export const oferta: OfertaCursoDto = {
  id: '01960000-0000-7000-0000-0000000000f1',
  cursoId: engCiv.id,
  localOfertaId: '01960000-0000-7000-0000-0000000000d1',
  unidadeOfertante: {
    origemId: '01960000-0000-7000-0000-0000000000e1',
    sigla: 'IGE',
    nome: 'Instituto de Geociências e Engenharias',
    tipo: 'Instituto',
  },
  programaDeOferta: 'REGULAR',
  regimeDeFuncionamento: 'EXTENSIVO',
  formatoPedagogico: 'PRESENCIAL',
  regimeDeTurno: 'REGULAR',
  turnos: ['MATUTINO'],
  eMecCodigo: '123456',
  codigoSga: null,
  vagasAnuaisAutorizadas: 40,
  baseLegal: null,
  atoAutorizacaoMec: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

export const problema = (status: number, corpo: object = {}) =>
  [
    JSON.stringify({ type: 'about:blank', title: 'Falha', status, ...corpo }),
    { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
  ] as const;

export const recusaDeCampo = (field: string, message: string) =>
  problema(422, {
    code: 'uniplus.validacao',
    errors: [{ field, code: 'uniplus.configuracao.curso.nome_tamanho', message }],
  });

export const sucesso = () => [null, { status: 204, statusText: 'No Content' }] as const;
export const criado = () => ['novo-id', { status: 201, statusText: 'Created' }] as const;

/** A página montada com a lista já carregada, e as ferramentas para conduzi-la como a pessoa faz. */
export async function montarPagina(itens: readonly CursoDto[] = [engCiv]) {
  TestBed.configureTestingModule({
    imports: [CursosPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
    ],
  });
  const fixture: ComponentFixture<CursosPage> = TestBed.createComponent(CursosPage);
  const http = TestBed.inject(HttpTestingController);
  const app = TestBed.inject(ApplicationRef);
  const injetor = fixture.debugElement.injector;
  const edicao = injetor.get(EdicaoDosCursos);
  const store = injetor.get(CursosStore);
  const ofertas = injetor.get(OfertasDoCursoStore);
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
  const recarregarCom = async (lista: readonly CursoDto[]): Promise<void> => {
    await propagar();
    http.expectOne((r) => r.url === LISTA).flush(lista);
    await propagar();
  };
  const preencher = (nome: string, valor: string): void => {
    const campo = elemento<HTMLInputElement>(`[formcontrolname="${nome}"]`);
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  };

  fixture.detectChanges();
  http.expectOne((r) => r.url === LISTA).flush(itens);
  await propagar();

  return {
    fixture,
    http,
    edicao,
    store,
    ofertas,
    sucessos,
    erros,
    propagar,
    elemento,
    recarregarCom,
    preencher,
    /** Responde o vocabulário que a página pede ao iniciar e confere que nada mais ficou pendente. */
    encerrar(): void {
      http.match(GRUPOS).forEach((pedido) => pedido.flush([]));
      http.verify();
    },
    formulario: (): HTMLFormElement => elemento('#cfg-curso-form'),
    novo: (): HTMLButtonElement => elemento('#cfg-cursos-novo'),
    editar: (c: CursoDto = engCiv) => pelaEtiqueta(`Editar curso ${c.codigo}`),
    remover: (c: CursoDto = engCiv) => pelaEtiqueta(`Remover curso ${c.codigo}`),
    verOfertas: (c: CursoDto = engCiv) => pelaEtiqueta(`Ofertas de ${c.codigo}`),
    salvar: (): HTMLButtonElement => elemento('button[form="cfg-curso-form"]'),
    confirmar: (): HTMLButtonElement => elemento('[data-testid="confirm-dialog-confirm"]'),
    cancelarDaConfirmacao: (): HTMLButtonElement =>
      elemento('[data-testid="confirm-dialog-cancel"]'),
    campo: (nome: string): HTMLInputElement => elemento(`[formcontrolname="${nome}"]`),
    statusDaPagina: (): string =>
      elemento(':scope > span.sr-only[role="status"]').textContent ?? '',
    /** Clica de verdade em "Novo curso" e preenche o mínimo para enviar. */
    async abrirCadastro(): Promise<void> {
      const novo = elemento<HTMLButtonElement>('#cfg-cursos-novo');
      novo.focus();
      novo.click();
      await propagar();
      preencher('codigo', 'DIR');
      preencher('nome', 'Direito');
      preencher('grau', 'Bacharelado');
      preencher('nivelEnsino', 'Graduação');
    },
    async abrirEdicao(curso: CursoDto = engCiv): Promise<void> {
      const botao = pelaEtiqueta(`Editar curso ${curso.codigo}`);
      botao.focus();
      botao.click();
      await propagar();
    },
    /** Envia o formulário aberto, com o foco no botão de salvar, e devolve a requisição de escrita. */
    async enviar(url = ESCRITA) {
      const botao = elemento<HTMLButtonElement>('button[form="cfg-curso-form"]');
      botao.focus();
      botao.click();
      await propagar();
      return http.expectOne(url);
    },
    async confirmarRemocao(curso: CursoDto = engCiv) {
      const lixeira = pelaEtiqueta(`Remover curso ${curso.codigo}`);
      lixeira.focus();
      lixeira.click();
      await propagar();
      elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
      await propagar();
      return http.expectOne(`${ESCRITA}/${curso.id}`);
    },
  };
}

export type Pagina = Awaited<ReturnType<typeof montarPagina>>;
