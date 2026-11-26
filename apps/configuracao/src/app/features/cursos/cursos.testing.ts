import { valoresDaOferta } from '../ofertas-curso/valores-da-oferta.testing';
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
  codigo: 'ENG_CIV',
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
  codigo: 'ENG_CIVIL_MARABA',
  cursoId: engCiv.id,
  localOfertaId: '01960000-0000-7000-0000-0000000000d1',
  unidadeOfertante: {
    origemId: '01960000-0000-7000-0000-0000000000e1',
    sigla: 'IGE',
    nome: 'Instituto de Geociências e Engenharias',
    tipo: 'Instituto',
  },
  programaDeOferta: valoresDaOferta.programa,
  regimeDeFuncionamento: valoresDaOferta.funcionamento,
  formatoPedagogico: valoresDaOferta.formato,
  regimeDeTurno: valoresDaOferta.regime,
  turnos: [valoresDaOferta.turnos[0]],
  codigoEmec: '123456',
  codigoNoSistemaAcademico: null,
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

function configurarPagina(): void {
  TestBed.configureTestingModule({
    imports: [CursosPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
    ],
  });
}

export class Pagina {
  readonly fixture: ComponentFixture<CursosPage> = TestBed.createComponent(CursosPage);
  readonly http = TestBed.inject(HttpTestingController);
  readonly edicao = this.fixture.debugElement.injector.get(EdicaoDosCursos);
  readonly store = this.fixture.debugElement.injector.get(CursosStore);
  readonly ofertas = this.fixture.debugElement.injector.get(OfertasDoCursoStore);
  readonly sucessos = vi.spyOn(TestBed.inject(NotificationService), 'success');
  readonly erros = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');

  async propagar(): Promise<void> {
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();
    this.fixture.detectChanges();
  }

  elemento<T extends HTMLElement>(seletor: string): T {
    const encontrado = (this.fixture.nativeElement as HTMLElement).querySelector<T>(seletor);
    expect(encontrado, seletor).not.toBeNull();
    return encontrado as T;
  }

  private pelaEtiqueta(nome: string): HTMLButtonElement {
    return this.elemento(`button[aria-label="${nome}"]`);
  }

  async recarregarCom(lista: readonly CursoDto[]): Promise<void> {
    await this.propagar();
    this.http.expectOne((r) => r.url === LISTA).flush(lista);
    await this.propagar();
  }

  preencher(nome: string, valor: string): void {
    const campo = this.elemento<HTMLInputElement>(`[formcontrolname="${nome}"]`);
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  }

  encerrar(): void {
    this.http.match(GRUPOS).forEach((pedido) => pedido.flush([]));
    this.http.verify();
  }

  formulario = (): HTMLFormElement => this.elemento('#cfg-curso-form');
  novo = (): HTMLButtonElement => this.elemento('#cfg-cursos-novo');
  editar = (c: CursoDto = engCiv) => this.pelaEtiqueta(`Editar curso ${c.codigo}`);
  remover = (c: CursoDto = engCiv) => this.pelaEtiqueta(`Remover curso ${c.codigo}`);
  verOfertas = (c: CursoDto = engCiv) => this.pelaEtiqueta(`Ofertas de ${c.codigo}`);
  salvar = (): HTMLButtonElement => this.elemento('button[form="cfg-curso-form"]');
  confirmar = (): HTMLButtonElement => this.elemento('[data-testid="confirm-dialog-confirm"]');
  cancelarDaConfirmacao = (): HTMLButtonElement =>
    this.elemento('[data-testid="confirm-dialog-cancel"]');
  campo = (nome: string): HTMLInputElement => this.elemento(`[formcontrolname="${nome}"]`);
  statusDaPagina = (): string =>
    this.elemento(':scope > span.sr-only[role="status"]').textContent ?? '';

  async abrirCadastro(): Promise<void> {
    const novo = this.novo();
    novo.focus();
    novo.click();
    await this.propagar();
    this.preencher('codigo', 'DIR');
    this.preencher('nome', 'Direito');
    this.preencher('grau', 'Bacharelado');
    this.preencher('nivelEnsino', 'Graduação');
  }

  async abrirEdicao(curso: CursoDto = engCiv): Promise<void> {
    const botao = this.editar(curso);
    botao.focus();
    botao.click();
    await this.propagar();
  }

  async enviar(url = ESCRITA) {
    const botao = this.salvar();
    botao.focus();
    botao.click();
    await this.propagar();
    return this.http.expectOne(url);
  }

  async confirmarRemocao(curso: CursoDto = engCiv) {
    const lixeira = this.remover(curso);
    lixeira.focus();
    lixeira.click();
    await this.propagar();
    this.confirmar().click();
    await this.propagar();
    return this.http.expectOne(`${ESCRITA}/${curso.id}`);
  }
}

/** A página montada com a lista já carregada. */
export async function montarPagina(itens: readonly CursoDto[] = [engCiv]): Promise<Pagina> {
  configurarPagina();
  const pagina = new Pagina();
  pagina.fixture.detectChanges();
  pagina.http.expectOne((r) => r.url === LISTA).flush(itens);
  await pagina.propagar();
  return pagina;
}
