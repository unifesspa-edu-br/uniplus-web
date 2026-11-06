import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, TipoDeficienciaDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EdicaoDosTiposDeficiencia } from './edicao-dos-tipos-deficiencia';
import { TiposDeficienciaListPage } from './tipos-deficiencia-list.page';
import { TiposDeficienciaStore } from './tipos-deficiencia.store';
import {
  TEXTO_TENTANDO,
  situacaoDoBotao,
} from '../../shared/foco/situacao-da-nova-tentativa.testing';

const BASE = 'http://localhost:5000';
const LISTA = `${BASE}/api/configuracao/tipos-deficiencia`;
const ESCRITA = `${BASE}/api/configuracao/admin/tipos-deficiencia`;
const visual: TipoDeficienciaDto = {
  id: '019f41cf-69fd-759a-ac6d-09acabc1b027',
  codigo: 'VISUAL',
  nome: 'Visual',
  descricao: 'Inclui baixa visão e cegueira.',
  permanente: true,
  criadoEm: '2026-07-07T13:23:42.707136+00:00',
};
const auditiva: TipoDeficienciaDto = {
  ...visual,
  id: '2',
  codigo: 'AUDITIVA',
  nome: 'Auditiva',
  descricao: 'Perda auditiva.',
  permanente: null,
};

describe('TiposDeficienciaListPage', () => {
  let fixture: ComponentFixture<TiposDeficienciaListPage>;
  let controller: HttpTestingController;
  let app: ApplicationRef;
  let store: TiposDeficienciaStore;
  let edicao: EdicaoDosTiposDeficiencia;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TiposDeficienciaListPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(TiposDeficienciaListPage);
    controller = TestBed.inject(HttpTestingController);
    app = TestBed.inject(ApplicationRef);
    store = fixture.debugElement.injector.get(TiposDeficienciaStore);
    edicao = fixture.debugElement.injector.get(EdicaoDosTiposDeficiencia);
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
  const listar = async (itens: readonly TipoDeficienciaDto[]): Promise<void> => {
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
    elemento(`td.table-responsive__actions button[aria-label^="${verbo} tipo de deficiência"]`);
  const linkProxima = {
    headers: { Link: '</api/itens?cursor=abc&direction=next>; rel="next"' },
  };

  it('sem tipos, mostra o estado vazio', async () => {
    await listar([]);
    expect(texto()).toContain('Nenhum tipo de deficiência carregado');
  });

  it('lista código, nome e descrição, e a busca encontra pelo código ou pelo nome', async () => {
    await listar([visual, auditiva]);
    expect(texto()).toContain('AUDITIVA');
    expect(texto()).toContain('Inclui baixa visão e cegueira.');
    store.termoBusca.set('audit');
    await propagar();
    expect(store.tiposDeficienciaFiltrados()).toEqual([auditiva]);
    store.termoBusca.set('visual');
    await propagar();
    expect(store.tiposDeficienciaFiltrados()).toEqual([visual]);
  });

  it('busca sem resultado mostra o estado de filtro, não o de lista vazia', async () => {
    await listar([visual]);
    store.termoBusca.set('inexistente');
    await propagar();
    expect(texto()).toContain('Nenhum tipo de deficiência encontrado');
    expect(texto()).toContain('Ajuste a busca para ver resultados.');
    expect(texto()).not.toContain('Nenhum tipo de deficiência carregado');
  });

  it('navega pelo cursor e, depois de uma escrita, volta à primeira página', async () => {
    controller.expectOne((r) => r.url === LISTA).flush([visual], linkProxima);
    await propagar();
    store.proximaPagina();
    await propagar();
    const pagina = controller.expectOne((r) => r.url === LISTA);
    expect(pagina.request.params.get('cursor')).toBe('abc');
    expect(pagina.request.params.get('direction')).toBe('next');
    pagina.flush([auditiva]);
    await propagar();
    store.recarregar();
    await propagar();
    const primeira = controller.expectOne((r) => r.url === LISTA);
    expect(primeira.request.params.has('cursor')).toBe(false);
    primeira.flush([visual]);
    await propagar();
  });

  it('a falha de carga mostra o alerta e "Tentar novamente" refaz a carga uma única vez', async () => {
    await falharLista();
    expect(texto()).toContain('Não foi possível carregar os tipos de deficiência');
    const tentar = elemento<HTMLButtonElement>('.list-state__retry button');
    tentar.click();
    tentar.click();
    await propagar();
    expect(tentar.getAttribute('aria-disabled')).toBe('true');
    expect(situacaoDoBotao(tentar)).toBe(TEXTO_TENTANDO);
    await listar([visual]);
    expect(store.tiposDeficiencia()).toEqual([visual]);
    expect(texto()).not.toContain('Não foi possível carregar');
  });

  it('as ações da linha ficam indisponíveis durante a recarga da lista', async () => {
    await listar([visual]);
    expect(acao('Editar').matches(':disabled')).toBe(false);
    store.tentarNovamente();
    await propagar();
    expect(acao('Editar').matches(':disabled')).toBe(true);
    expect(acao('Remover').matches(':disabled')).toBe(true);
    acao('Editar').click();
    expect(edicao.aberto()).toBe(false);
    await listar([visual]);
  });

  it('abrir o cadastro leva ao formulário em branco e abrir a edição traz os valores do tipo', async () => {
    await listar([visual]);
    elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
    await propagar();
    expect(edicao.modo()).toBe('criar');
    expect(edicao.titulo()).toBe('Novo tipo de deficiência');
    expect(edicao.form.getRawValue()).toEqual({ nome: '', codigo: '', descricao: '' });
    edicao.fechar();
    acao('Editar').click();
    await propagar();
    expect(edicao.modo()).toBe('editar');
    expect(edicao.titulo()).toBe('Editar tipo de deficiência');
    expect(edicao.form.controls.nome.value).toBe('Visual');
  });

  it('no cadastro, o código acompanha o nome em caixa alta e deixa de acompanhar depois de editado', async () => {
    await listar([]);
    edicao.abrirCadastro();
    edicao.form.controls.nome.setValue('Auditiva');
    expect(edicao.form.controls.codigo.value).toBe('AUDITIVA');
    edicao.form.controls.codigo.setValue('apoio');
    expect(edicao.form.controls.codigo.value).toBe('APOIO');
    edicao.form.controls.nome.setValue('Outro nome');
    expect(edicao.form.controls.codigo.value).toBe('APOIO');
  });

  it('na edição, o código vigente não acompanha o nome', async () => {
    await listar([visual]);
    edicao.abrirEdicao(visual);
    edicao.form.controls.nome.setValue('Visual e auditiva');
    expect(edicao.form.controls.codigo.value).toBe('VISUAL');
  });

  it('cria com o texto sem os brancos, o código em caixa alta e a chave de idempotência', async () => {
    await listar([]);
    edicao.abrirCadastro();
    edicao.form.setValue({ nome: ' Visual ', codigo: 'def_visual', descricao: ' Baixa visão ' });
    edicao.salvar();
    const post = controller.expectOne(ESCRITA);
    expect(post.request.method).toBe('POST');
    expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
    expect(post.request.body).toEqual({
      codigo: 'DEF_VISUAL',
      nome: 'Visual',
      descricao: 'Baixa visão',
    });
    post.flush('novo-id', { status: 201, statusText: 'Created' });
    await propagar();
    expect(edicao.aberto()).toBe(false);
    await listar([visual]);
  });

  it('descrição só com espaços barra o envio e a obrigatoriedade aparece no campo', async () => {
    await listar([]);
    edicao.abrirCadastro();
    edicao.form.setValue({ nome: 'Visual', codigo: 'VISUAL', descricao: '   ' });
    edicao.salvar();
    await propagar();
    controller.expectNone(ESCRITA);
    expect(elemento('[formcontrolname="descricao"]').getAttribute('aria-invalid')).toBe('true');
    expect(elemento('#cfg-td-descricao-erro').textContent).toContain('apenas espaços');
  });

  it('associa a dica e a mensagem de erro ao campo de código para leitor de tela', async () => {
    await listar([]);
    edicao.abrirCadastro();
    await propagar();
    const codigo = elemento<HTMLInputElement>('[formcontrolname="codigo"]');
    expect(codigo.getAttribute('aria-describedby')).toBe('cfg-td-codigo-dica');
    expect(codigo.getAttribute('aria-invalid')).toBeNull();
    edicao.form.setValue({ nome: 'Deficiência Visual', codigo: '1VISUAL', descricao: 'Texto' });
    edicao.salvar();
    await propagar();
    expect(codigo.getAttribute('aria-invalid')).toBe('true');
    expect(codigo.getAttribute('aria-describedby')).toBe('cfg-td-codigo-dica cfg-td-codigo-erro');
    expect(elemento('#cfg-td-codigo-erro').textContent?.trim()).not.toBe('');
  });

  it('a recusa acumulada do servidor ancora um erro em cada campo', async () => {
    await listar([]);
    edicao.abrirCadastro();
    edicao.form.setValue({ nome: 'Visual', codigo: 'VISUAL', descricao: 'Baixa visão' });
    edicao.salvar();
    controller.expectOne(ESCRITA).flush(
      JSON.stringify({
        type: 'about:blank',
        title: 'Dados inválidos',
        status: 422,
        code: 'uniplus.validacao',
        errors: [
          { field: 'codigo', code: 'x', message: 'Código recusado.' },
          { field: 'descricao', code: 'y', message: 'Descrição recusada.' },
        ],
      }),
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagar();
    expect(edicao.aberto()).toBe(true);
    expect(elemento('[formcontrolname="codigo"]').getAttribute('aria-invalid')).toBe('true');
    expect(elemento('[formcontrolname="descricao"]').getAttribute('aria-invalid')).toBe('true');
  });

  it('atualiza pelo id do tipo, inclusive o código trocado', async () => {
    await listar([visual]);
    edicao.abrirEdicao(visual);
    edicao.form.controls.codigo.setValue('VISUAL_V2');
    edicao.salvar();
    const put = controller.expectOne(`${ESCRITA}/${visual.id}`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toMatchObject({
      id: visual.id,
      codigo: 'VISUAL_V2',
      nome: 'Visual',
      permanente: true,
    });
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    await listar([visual]);
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
