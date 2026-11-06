import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  RecursoAcessibilidadeDto,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EdicaoDosRecursosAcessibilidade } from './edicao-dos-recursos-acessibilidade';
import { RecursosAcessibilidadeListPage } from './recursos-acessibilidade-list.page';
import { RecursosAcessibilidadeStore } from './recursos-acessibilidade.store';
import {
  TEXTO_TENTANDO,
  situacaoDoBotao,
} from '../../shared/foco/situacao-da-nova-tentativa.testing';

const BASE = 'http://localhost:5000';
const LISTA = `${BASE}/api/configuracao/recursos-acessibilidade`;
const ESCRITA = `${BASE}/api/configuracao/admin/recursos-acessibilidade`;
const ledor: RecursoAcessibilidadeDto = {
  id: '019f41cf-69fd-759a-ac6d-09acabc1b027',
  codigo: 'LEDOR',
  nome: 'Ledor',
  descricao: 'Leitura da prova em voz alta por fiscal designado.',
  criadoEm: '2026-07-07T13:23:42.707136+00:00',
};
const sala: RecursoAcessibilidadeDto = {
  ...ledor,
  id: '2',
  codigo: 'SALA_DE_FACIL_ACESSO',
  nome: 'Sala de fácil acesso',
  descricao: null,
};

describe('RecursosAcessibilidadeListPage', () => {
  let fixture: ComponentFixture<RecursosAcessibilidadeListPage>;
  let controller: HttpTestingController;
  let app: ApplicationRef;
  let store: RecursosAcessibilidadeStore;
  let edicao: EdicaoDosRecursosAcessibilidade;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RecursosAcessibilidadeListPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(RecursosAcessibilidadeListPage);
    controller = TestBed.inject(HttpTestingController);
    app = TestBed.inject(ApplicationRef);
    store = fixture.debugElement.injector.get(RecursosAcessibilidadeStore);
    edicao = fixture.debugElement.injector.get(EdicaoDosRecursosAcessibilidade);
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
  const listar = async (itens: readonly RecursoAcessibilidadeDto[]): Promise<void> => {
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
    elemento(
      `td.table-responsive__actions button[aria-label^="${verbo} recurso de acessibilidade"]`,
    );
  const linkProxima = {
    headers: { Link: '</api/itens?cursor=abc&direction=next>; rel="next"' },
  };

  it('sem recursos, mostra o estado vazio', async () => {
    await listar([]);
    expect(texto()).toContain('Nenhum recurso de acessibilidade carregado');
  });

  it('lista código, nome e descrição, e a busca encontra pelo código ou pelo nome', async () => {
    await listar([ledor, sala]);
    expect(texto()).toContain('SALA_DE_FACIL_ACESSO');
    expect(texto()).toContain('Leitura da prova em voz alta por fiscal designado.');
    store.termoBusca.set('sala_de');
    await propagar();
    expect(store.recursosFiltrados()).toEqual([sala]);
    store.termoBusca.set('ledor');
    await propagar();
    expect(store.recursosFiltrados()).toEqual([ledor]);
  });

  it('busca sem resultado mostra o estado de filtro, não o de lista vazia', async () => {
    await listar([ledor]);
    store.termoBusca.set('inexistente');
    await propagar();
    expect(texto()).toContain('Nenhum recurso de acessibilidade encontrado');
    expect(texto()).toContain('Ajuste a busca para ver resultados.');
    expect(texto()).not.toContain('Nenhum recurso de acessibilidade carregado');
  });

  it('navega pelo cursor e, depois de uma escrita, volta à primeira página', async () => {
    controller.expectOne((r) => r.url === LISTA).flush([ledor], linkProxima);
    await propagar();
    store.proximaPagina();
    await propagar();
    const pagina = controller.expectOne((r) => r.url === LISTA);
    expect(pagina.request.params.get('cursor')).toBe('abc');
    expect(pagina.request.params.get('direction')).toBe('next');
    pagina.flush([sala]);
    await propagar();
    store.recarregar();
    await propagar();
    const primeira = controller.expectOne((r) => r.url === LISTA);
    expect(primeira.request.params.has('cursor')).toBe(false);
    primeira.flush([ledor]);
    await propagar();
  });

  it('a falha de carga mostra o alerta e "Tentar novamente" refaz a carga uma única vez', async () => {
    await falharLista();
    expect(texto()).toContain('Não foi possível carregar os recursos de acessibilidade');
    const tentar = elemento<HTMLButtonElement>('.list-state__retry button');
    tentar.click();
    tentar.click();
    await propagar();
    expect(tentar.getAttribute('aria-disabled')).toBe('true');
    expect(situacaoDoBotao(tentar)).toBe(TEXTO_TENTANDO);
    await listar([ledor]);
    expect(store.recursos()).toEqual([ledor]);
    expect(texto()).not.toContain('Não foi possível carregar');
  });

  it('as ações da linha ficam indisponíveis durante a recarga da lista', async () => {
    await listar([ledor]);
    expect(acao('Editar').matches(':disabled')).toBe(false);
    store.tentarNovamente();
    await propagar();
    expect(acao('Editar').matches(':disabled')).toBe(true);
    expect(acao('Remover').matches(':disabled')).toBe(true);
    acao('Editar').click();
    expect(edicao.aberto()).toBe(false);
    await listar([ledor]);
  });

  it('abrir o cadastro leva ao formulário em branco e abrir a edição traz os valores do recurso', async () => {
    await listar([ledor]);
    elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
    await propagar();
    expect(edicao.modo()).toBe('criar');
    expect(edicao.titulo()).toBe('Novo recurso de acessibilidade');
    expect(edicao.form.getRawValue()).toEqual({ nome: '', codigo: '', descricao: '' });
    edicao.fechar();
    acao('Editar').click();
    await propagar();
    expect(edicao.modo()).toBe('editar');
    expect(edicao.titulo()).toBe('Editar recurso de acessibilidade');
    expect(edicao.form.controls.nome.value).toBe('Ledor');
  });

  it('no cadastro, o código acompanha o nome em caixa alta e deixa de acompanhar depois de editado', async () => {
    await listar([]);
    edicao.abrirCadastro();
    edicao.form.controls.nome.setValue('Sala de apoio');
    expect(edicao.form.controls.codigo.value).toBe('SALA_DE_APOIO');
    edicao.form.controls.codigo.setValue('apoio');
    expect(edicao.form.controls.codigo.value).toBe('APOIO');
    edicao.form.controls.nome.setValue('Outro nome');
    expect(edicao.form.controls.codigo.value).toBe('APOIO');
  });

  it('na edição, o código vigente não acompanha o nome', async () => {
    await listar([ledor]);
    edicao.abrirEdicao(ledor);
    edicao.form.controls.nome.setValue('Ledor de provas');
    expect(edicao.form.controls.codigo.value).toBe('LEDOR');
  });

  it('cria com o texto sem os brancos, nulo no que ficou só com espaços, e a chave de idempotência', async () => {
    await listar([]);
    edicao.abrirCadastro();
    edicao.form.setValue({ nome: ' Ledor ', codigo: 'LEDOR', descricao: '  ' });
    edicao.salvar();
    const post = controller.expectOne(ESCRITA);
    expect(post.request.method).toBe('POST');
    expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
    expect(post.request.body).toEqual({ codigo: 'LEDOR', nome: 'Ledor', descricao: null });
    post.flush('novo-id', { status: 201, statusText: 'Created' });
    await propagar();
    expect(edicao.aberto()).toBe(false);
    await listar([ledor]);
  });

  it('envia nome nulo quando o campo obrigatório tem só espaços, para a API responder sobre a ausência', async () => {
    await listar([]);
    edicao.abrirCadastro();
    edicao.form.setValue({ nome: '   ', codigo: 'LEDOR', descricao: '' });
    edicao.salvar();
    const post = controller.expectOne(ESCRITA);
    expect(post.request.body).toMatchObject({ codigo: 'LEDOR', nome: null });
    post.flush('novo-id', { status: 201, statusText: 'Created' });
    await propagar();
    await listar([ledor]);
  });

  it('atualiza pelo id do recurso, inclusive o código trocado', async () => {
    await listar([ledor]);
    edicao.abrirEdicao(ledor);
    edicao.form.controls.codigo.setValue('LEDOR_V2');
    edicao.salvar();
    const put = controller.expectOne(`${ESCRITA}/${ledor.id}`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toMatchObject({ id: ledor.id, codigo: 'LEDOR_V2', nome: 'Ledor' });
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    await listar([ledor]);
  });

  it('o envio com campo inválido não chama a API e marca os campos', async () => {
    await listar([]);
    edicao.abrirCadastro();
    edicao.salvar();
    controller.expectNone(ESCRITA);
    expect(edicao.form.controls.nome.touched).toBe(true);
    expect(edicao.form.controls.codigo.touched).toBe(true);
  });
});
