import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, CondicaoAtendimentoDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CondicoesAtendimentoPage } from './condicoes-atendimento.page';
import { CondicoesAtendimentoStore } from './condicoes-atendimento.store';
import { EdicaoDasCondicoesAtendimento } from './edicao-das-condicoes-atendimento';

const BASE = 'http://localhost:5000';
const LISTA = `${BASE}/api/configuracao/condicoes-atendimento`;
const ESCRITA = `${BASE}/api/configuracao/admin/condicoes-atendimento`;
const pcd: CondicaoAtendimentoDto = {
  id: '019f41cf-69fd-759a-ac6d-09acabc1b027',
  codigo: 'PCD',
  nome: 'Pcd',
  descricao: 'LBI (Lei 13.146/2015), art. 30',
  criadoEm: '2026-07-07T13:23:42.707136+00:00',
};
const dislexia: CondicaoAtendimentoDto = {
  ...pcd,
  id: '2',
  codigo: 'DISLEXIA',
  nome: 'Dislexia',
  descricao: null,
};

describe('CondicoesAtendimentoPage', () => {
  let fixture: ComponentFixture<CondicoesAtendimentoPage>;
  let controller: HttpTestingController;
  let app: ApplicationRef;
  let store: CondicoesAtendimentoStore;
  let edicao: EdicaoDasCondicoesAtendimento;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CondicoesAtendimentoPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(CondicoesAtendimentoPage);
    controller = TestBed.inject(HttpTestingController);
    app = TestBed.inject(ApplicationRef);
    store = fixture.debugElement.injector.get(CondicoesAtendimentoStore);
    edicao = fixture.debugElement.injector.get(EdicaoDasCondicoesAtendimento);
    fixture.detectChanges();
  });
  afterEach(() => controller.verify());

  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    app.tick();
    fixture.detectChanges();
  };
  const texto = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const elemento = <T extends HTMLElement>(seletor: string): T => {
    const achado = (fixture.nativeElement as HTMLElement).querySelector<T>(seletor);
    expect(achado, seletor).not.toBeNull();
    return achado as T;
  };
  const listar = async (itens: readonly CondicaoAtendimentoDto[]): Promise<void> => {
    const req = controller.expectOne((r) => r.url === LISTA);
    expect(req.request.params.get('limit')).toBe('50');
    req.flush(itens);
    await propagar();
  };
  const falharLista = async (): Promise<void> => {
    controller
      .expectOne((r) => r.url === LISTA)
      .flush(null, { status: 500, statusText: 'Server Error' });
    await propagar();
  };
  const acao = (verbo: string): HTMLButtonElement =>
    elemento(`td.table-responsive__actions button[aria-label^="${verbo} condição de atendimento"]`);

  it('sem condições, mostra o estado vazio', async () => {
    await listar([]);
    expect(texto()).toContain('Nenhuma condição de atendimento carregada');
  });

  it('lista código, nome e descrição, com legenda e sem coluna de situação', async () => {
    await listar([pcd]);
    expect(texto()).toContain('PCD');
    expect(texto()).toContain('LBI (Lei 13.146/2015), art. 30');
    expect(elemento('table > caption').classList.contains('sr-only')).toBe(true);
    const cabecalhos = [...(fixture.nativeElement as HTMLElement).querySelectorAll('thead th')];
    expect(cabecalhos.map((th) => th.textContent?.trim())).toEqual(['Código', 'Nome', 'Ações']);
  });

  it('filtra pelo código ou pelo nome e, sem resultado, mostra o estado de busca', async () => {
    await listar([pcd, dislexia]);
    store.termoBusca.set('dislex');
    await propagar();
    expect(store.condicoesFiltradas()).toEqual([dislexia]);
    store.termoBusca.set('xyz');
    await propagar();
    expect(texto()).toContain('Nenhuma condição de atendimento encontrada');
    expect(texto()).not.toContain('Nenhuma condição de atendimento carregada');
    store.termoBusca.set('');
    await propagar();
    expect(store.condicoesFiltradas()).toHaveLength(2);
  });

  it('navega pelo cursor e preserva a página em caso de falha', async () => {
    controller
      .expectOne((r) => r.url === LISTA)
      .flush([pcd], { headers: { Link: '</api/itens?cursor=abc&direction=next>; rel="next"' } });
    await propagar();
    store.proximaPagina();
    await propagar();
    const pagina = controller.expectOne((r) => r.url === LISTA);
    expect(pagina.request.params.get('cursor')).toBe('abc');
    expect(pagina.request.params.get('direction')).toBe('next');
    pagina.flush(null, { status: 500, statusText: 'Error' });
    await propagar();
    expect(store.condicoes()).toEqual([pcd]);
    expect(store.mensagemDeErro()).toBeTruthy();
  });

  it('depois de uma escrita volta à primeira página, e a página anterior usa o cursor de volta', async () => {
    controller
      .expectOne((r) => r.url === LISTA)
      .flush([pcd], { headers: { Link: '</api/itens?cursor=abc&direction=next>; rel="next"' } });
    await propagar();
    store.proximaPagina();
    await propagar();
    controller
      .expectOne((r) => r.url === LISTA)
      .flush([dislexia], {
        headers: { Link: '</api/itens?cursor=xyz&direction=prev>; rel="prev"' },
      });
    await propagar();
    store.paginaAnterior();
    await propagar();
    expect(controller.expectOne((r) => r.url === LISTA).request.params.get('direction')).toBe(
      'prev',
    );
    store.recarregar();
    await propagar();
    const primeira = controller.expectOne((r) => r.url === LISTA);
    expect(primeira.request.params.has('cursor')).toBe(false);
    expect(primeira.request.params.get('limit')).toBe('50');
    primeira.flush([pcd]);
    await propagar();
  });

  it('a falha de carga mostra o alerta e "Tentar novamente" refaz a carga uma única vez', async () => {
    await falharLista();
    expect(texto()).toContain('Não foi possível carregar as condições de atendimento');
    const tentar = elemento<HTMLButtonElement>('.list-state__retry button');
    tentar.click();
    tentar.click();
    await propagar();
    expect(tentar.getAttribute('aria-disabled')).toBe('true');
    await listar([pcd]);
    expect(store.condicoes()).toEqual([pcd]);
    expect(texto()).not.toContain('Não foi possível carregar');
  });

  it('as ações da linha ficam indisponíveis durante a recarga da lista', async () => {
    await listar([dislexia]);
    expect(acao('Editar').matches(':disabled')).toBe(false);
    store.tentarNovamente();
    await propagar();
    expect(acao('Editar').matches(':disabled')).toBe(true);
    expect(acao('Remover').matches(':disabled')).toBe(true);
    acao('Editar').click();
    expect(edicao.aberto()).toBe(false);
    await listar([dislexia]);
  });

  it('o código PCD não oferece remoção', async () => {
    await listar([pcd]);
    expect(acao('Remover').matches(':disabled')).toBe(true);
  });

  it('abrir o cadastro leva ao formulário em branco e abrir a edição do PCD trava o código', async () => {
    await listar([pcd]);
    elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
    await propagar();
    expect(edicao.modo()).toBe('criar');
    expect(edicao.titulo()).toBe('Nova condição de atendimento');
    expect(edicao.form.controls.codigo.enabled).toBe(true);
    edicao.fechar();
    acao('Editar').click();
    await propagar();
    expect(edicao.modo()).toBe('editar');
    expect(edicao.form.controls.codigo.disabled).toBe(true);
    expect(edicao.form.controls.nome.value).toBe('Pcd');
    edicao.abrirCadastro();
    expect(edicao.form.controls.codigo.enabled).toBe(true);
  });

  it('o código é digitado em caixa alta', async () => {
    await listar([]);
    edicao.abrirCadastro();
    edicao.form.controls.codigo.setValue('tdah');
    expect(edicao.form.controls.codigo.value).toBe('TDAH');
  });

  it('cria com o código, o nome e a descrição sem os brancos e com a chave de idempotência', async () => {
    await listar([]);
    edicao.abrirCadastro();
    edicao.form.setValue({ codigo: 'PCD', nome: ' Pcd ', descricao: ' ' });
    edicao.salvar();
    const post = controller.expectOne(ESCRITA);
    expect(post.request.method).toBe('POST');
    expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
    expect(post.request.body).toEqual({ codigo: 'PCD', nome: 'Pcd', descricao: null });
    post.flush('novo-id', { status: 201, statusText: 'Created' });
    await propagar();
    expect(edicao.aberto()).toBe(false);
    await listar([pcd]);
  });

  it('atualiza o nome e a descrição pelo id da condição', async () => {
    await listar([dislexia]);
    edicao.abrirEdicao(dislexia);
    edicao.form.controls.nome.setValue('Dislexia leve');
    edicao.salvar();
    const put = controller.expectOne(`${ESCRITA}/${dislexia.id}`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toMatchObject({ id: dislexia.id, nome: 'Dislexia leve' });
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    await listar([dislexia]);
  });
});
