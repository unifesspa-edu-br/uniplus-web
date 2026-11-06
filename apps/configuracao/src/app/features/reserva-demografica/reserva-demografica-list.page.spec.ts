import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  ReferenciaReservaDemograficaDto,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EdicaoDasReservasDemograficas } from './edicao-das-reservas-demograficas';
import { ReservaDemograficaListPage } from './reserva-demografica-list.page';
import { ReservaDemograficaStore } from './reserva-demografica.store';

const BASE = 'http://localhost:5000';
const LISTA = `${BASE}/api/configuracao/referencias-reserva-demografica`;
const ESCRITA = `${BASE}/api/configuracao/admin/referencias-reserva-demografica`;
const censo2022: ReferenciaReservaDemograficaDto = {
  id: '01960000-0000-7000-0000-0000000000e1',
  censoReferencia: '2022',
  ppiPercentual: 78.5,
  quilombolaPercentual: 1.2,
  pcdPercentual: 8.4,
  baseLegal: 'Lei 12.711/2012, art. 10, III',
  criadoEm: '2026-06-10T12:00:00Z',
};
const censo2010: ReferenciaReservaDemograficaDto = {
  ...censo2022,
  id: '2',
  censoReferencia: '2010',
};

describe('ReservaDemograficaListPage', () => {
  let fixture: ComponentFixture<ReservaDemograficaListPage>;
  let controller: HttpTestingController;
  let app: ApplicationRef;
  let store: ReservaDemograficaStore;
  let edicao: EdicaoDasReservasDemograficas;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ReservaDemograficaListPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(ReservaDemograficaListPage);
    controller = TestBed.inject(HttpTestingController);
    app = TestBed.inject(ApplicationRef);
    store = fixture.debugElement.injector.get(ReservaDemograficaStore);
    edicao = fixture.debugElement.injector.get(EdicaoDasReservasDemograficas);
    fixture.detectChanges();
  });
  afterEach(() => controller.verify());

  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    app.tick();
    fixture.detectChanges();
  };
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texto = (): string => raiz().textContent ?? '';
  const elemento = <T extends HTMLElement>(seletor: string): T => {
    const achado = raiz().querySelector<T>(seletor);
    expect(achado, seletor).not.toBeNull();
    return achado as T;
  };
  const listar = async (itens: readonly ReferenciaReservaDemograficaDto[]): Promise<void> => {
    const req = controller.expectOne((r) => r.url === LISTA);
    expect(req.request.params.get('limit')).toBe('100');
    req.flush(itens);
    await propagar();
  };
  const acao = (verbo: string): HTMLButtonElement =>
    elemento(`td.table-responsive__actions button[aria-label^="${verbo} reserva demográfica"]`);
  const campo = (nome: string): HTMLInputElement =>
    elemento(`[formcontrolname="${nome}"]`) as HTMLInputElement;

  it('sem referências, mostra o estado vazio', async () => {
    await listar([]);
    expect(texto()).toContain('Nenhuma referência cadastrada');
  });

  it('filtra pelo censo e, sem resultado, mostra o estado de busca', async () => {
    await listar([censo2022, censo2010]);
    store.termoBusca.set('2010');
    await propagar();
    expect(store.referenciasFiltradas()).toEqual([censo2010]);
    store.termoBusca.set('xyz');
    await propagar();
    expect(texto()).toContain('Nenhuma referência encontrada');
    expect(texto()).not.toContain('Nenhuma referência cadastrada');
    store.termoBusca.set('');
    await propagar();
    expect(store.referenciasFiltradas()).toHaveLength(2);
  });

  it('navega pelo cursor e preserva a página em caso de falha', async () => {
    controller
      .expectOne((r) => r.url === LISTA)
      .flush([censo2022], {
        headers: { Link: '</api/itens?cursor=abc&direction=next>; rel="next"' },
      });
    await propagar();
    store.proximaPagina();
    await propagar();
    const pagina = controller.expectOne((r) => r.url === LISTA);
    expect(pagina.request.params.get('cursor')).toBe('abc');
    expect(pagina.request.params.get('direction')).toBe('next');
    pagina.flush(null, { status: 500, statusText: 'Error' });
    await propagar();
    expect(store.referencias()).toEqual([censo2022]);
    expect(store.mensagemDeErro()).toBeTruthy();
  });

  it('depois de uma escrita volta à primeira página', async () => {
    controller
      .expectOne((r) => r.url === LISTA)
      .flush([censo2022], {
        headers: { Link: '</api/itens?cursor=abc&direction=next>; rel="next"' },
      });
    await propagar();
    store.proximaPagina();
    await propagar();
    controller.expectOne((r) => r.url === LISTA).flush([censo2010]);
    await propagar();
    store.recarregar();
    await propagar();
    const primeira = controller.expectOne((r) => r.url === LISTA);
    expect(primeira.request.params.has('cursor')).toBe(false);
    expect(primeira.request.params.get('limit')).toBe('100');
    primeira.flush([censo2022]);
    await propagar();
  });

  it('a falha de carga mostra o alerta e "Tentar novamente" refaz a carga uma única vez', async () => {
    controller
      .expectOne((r) => r.url === LISTA)
      .flush(null, { status: 500, statusText: 'Server Error' });
    await propagar();
    expect(texto()).toContain('Não foi possível carregar as referências');
    const tentar = elemento<HTMLButtonElement>('.list-state__retry button');
    tentar.click();
    tentar.click();
    await propagar();
    expect(tentar.getAttribute('aria-disabled')).toBe('true');
    await listar([censo2022]);
    expect(store.referencias()).toEqual([censo2022]);
    expect(texto()).not.toContain('Não foi possível carregar');
  });

  it('as ações da linha ficam indisponíveis durante a recarga da lista', async () => {
    await listar([censo2010]);
    expect(acao('Editar').matches(':disabled')).toBe(false);
    store.tentarNovamente();
    await propagar();
    expect(acao('Editar').matches(':disabled')).toBe(true);
    expect(acao('Remover').matches(':disabled')).toBe(true);
    acao('Editar').click();
    expect(edicao.aberto()).toBe(false);
    await listar([censo2010]);
  });

  it('abrir o cadastro leva ao formulário com a base legal padrão e abrir a edição trava o censo', async () => {
    await listar([censo2022]);
    elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
    await propagar();
    expect(edicao.titulo()).toBe('Novo censo');
    expect(campo('censoReferencia').matches(':disabled')).toBe(false);
    expect(campo('baseLegal').value).toBe('Lei 12.711/2012, art. 10, III');
    expect(campo('ppiPercentual').value).toBe('');
    edicao.fechar();
    acao('Editar').click();
    await propagar();
    expect(edicao.titulo()).toBe('Editar referência demográfica');
    expect(campo('censoReferencia').matches(':disabled')).toBe(true);
    expect(campo('censoReferencia').value).toBe('2022');
    expect(campo('ppiPercentual').matches(':disabled')).toBe(false);
    expect(campo('ppiPercentual').value).toBe('78.5');
    edicao.abrirCadastro();
    await propagar();
    expect(campo('censoReferencia').matches(':disabled')).toBe(false);
  });

  it('identifica os campos obrigatórios para tecnologias assistivas', async () => {
    await listar([]);
    edicao.abrirCadastro();
    await propagar();
    for (const nome of [
      'censoReferencia',
      'ppiPercentual',
      'quilombolaPercentual',
      'pcdPercentual',
      'baseLegal',
    ]) {
      expect(campo(nome).getAttribute('aria-required'), nome).toBe('true');
    }
  });

  it('ao sair do campo, o censo já cadastrado é recusado antes do envio', async () => {
    await listar([censo2022]);
    edicao.abrirCadastro();
    await propagar();
    campo('censoReferencia').value = '2022';
    campo('censoReferencia').dispatchEvent(new Event('input'));
    campo('censoReferencia').dispatchEvent(new Event('blur'));
    await propagar();
    expect(campo('censoReferencia').getAttribute('aria-invalid')).toBe('true');
    expect(elemento('#erro-censoReferencia').textContent).toContain(
      'Já existe uma referência ativa para este Censo.',
    );
    edicao.salvar();
    controller.expectNone(ESCRITA);
    campo('censoReferencia').value = '2023';
    campo('censoReferencia').dispatchEvent(new Event('input'));
    campo('censoReferencia').dispatchEvent(new Event('blur'));
    await propagar();
    expect(campo('censoReferencia').getAttribute('aria-invalid')).toBeNull();
  });

  it('na edição, o próprio censo não conta como duplicado', async () => {
    await listar([censo2022]);
    edicao.abrirEdicao(censo2022);
    edicao.verificarCensoDuplicado();
    expect(edicao.form.controls.censoReferencia.hasError('duplicado')).toBe(false);
  });

  it('cria com os percentuais, o censo e a base legal sem os brancos e com a chave de idempotência', async () => {
    await listar([]);
    edicao.abrirCadastro();
    edicao.form.setValue({
      censoReferencia: ' 2022 ',
      ppiPercentual: 78.5,
      quilombolaPercentual: 1.2,
      pcdPercentual: 8.4,
      baseLegal: '   ',
    });
    edicao.salvar();
    const post = controller.expectOne(ESCRITA);
    expect(post.request.method).toBe('POST');
    expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
    expect(post.request.body).toEqual({
      censoReferencia: '2022',
      ppiPercentual: 78.5,
      quilombolaPercentual: 1.2,
      pcdPercentual: 8.4,
      baseLegal: null,
    });
    post.flush('novo-id', { status: 201, statusText: 'Created' });
    await propagar();
    expect(edicao.aberto()).toBe(false);
    await listar([censo2022]);
  });

  it('atualiza pelo id da referência, mantendo o censo travado', async () => {
    await listar([censo2022]);
    edicao.abrirEdicao(censo2022);
    edicao.form.controls.ppiPercentual.setValue(80);
    edicao.salvar();
    const put = controller.expectOne(`${ESCRITA}/${censo2022.id}`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toMatchObject({
      id: censo2022.id,
      censoReferencia: '2022',
      ppiPercentual: 80,
    });
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    await listar([censo2022]);
  });
});
