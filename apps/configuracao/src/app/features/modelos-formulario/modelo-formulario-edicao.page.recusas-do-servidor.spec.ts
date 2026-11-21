import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture } from '@angular/core/testing';
import {
  type FatoDoCatalogoDto,
  type ModeloFormularioView,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ModeloFormularioEdicaoPage } from './modelo-formulario-edicao.page';
import {
  FALHA_500,
  FASES,
  PROBLEMA,
  modelo,
  montarTelaDeEdicao,
  propagarAlteracoes,
  responderCarga,
  salvar,
} from './modelo-formulario-edicao.page.testing';

describe('ModeloFormularioEdicaoPage', () => {
  let fixture: ComponentFixture<ModeloFormularioEdicaoPage>;
  let controller: HttpTestingController;

  beforeEach(() => {
    ({ fixture, controller } = montarTelaDeEdicao());
  });

  afterEach(() => controller.verify());

  const propagar = (): Promise<HTMLElement> => propagarAlteracoes(fixture);

  async function carregar(
    doModelo: ModeloFormularioView = modelo,
    fatosExtras: readonly FatoDoCatalogoDto[] = [],
    fases: readonly object[] = FASES,
    falhando: readonly string[] = [],
  ): Promise<HTMLElement> {
    responderCarga(controller, { modelo: doModelo, fatosExtras, fases, falhando });
    return propagar();
  }

  it('leva a recusa com índice ao campo enviado, e a do grafo, sem índice, ao resumo', async () => {
    const tela = await carregar();

    salvar(tela);
    controller
      .expectOne((r) => r.method === 'PUT')
      .flush(
        JSON.stringify({
          status: 422,
          title: 'Requisição inválida',
          code: 'uniplus.configuracao.modelo_formulario.conteudo_invalido',
          errors: [
            {
              field: 'conteudo.itens[0].rotulo',
              code: 'x',
              message: 'O rótulo passou do tamanho.',
            },
            { field: 'conteudo', code: 'y', message: 'O item cita fato que vem depois dele.' },
          ],
        }),
        PROBLEMA,
      );
    const depois = await propagar();

    const item = depois.querySelector('[aria-labelledby="cfg-modelo-item-ESCOLA_PUBLICA-titulo"]');
    expect(item?.textContent).toContain('O rótulo passou do tamanho.');
    const resumo = depois.querySelector('.cfg-modelo-resumo');
    expect(resumo?.textContent).toContain('O item cita fato que vem depois dele.');
    expect(resumo?.textContent).not.toContain('O rótulo passou do tamanho.');
  });

  it('mostra a recusa da condição junto dela e mantém o restante do modelo editável', async () => {
    const tela = await carregar();

    salvar(tela);
    controller
      .expectOne((r) => r.method === 'PUT')
      .flush(
        JSON.stringify({
          status: 422,
          title: 'Requisição inválida',
          code: 'uniplus.configuracao.modelo_formulario.conteudo_invalido',
          errors: [
            {
              field: 'conteudo.documentosExigidos[0].quando',
              code: 'x',
              message: 'A condição cita fato que o modelo não coleta.',
            },
          ],
        }),
        PROBLEMA,
      );
    const depois = await propagar();

    const documento = depois.querySelector(
      '[aria-labelledby="cfg-modelo-docs-doc-0-titulo"]',
    ) as HTMLElement;
    expect(documento.textContent).toContain('A condição cita fato que o modelo não coleta.');
    expect(depois.querySelector('.cfg-modelo-resumo')?.textContent).not.toContain(
      'A condição cita fato',
    );
    expect(
      (depois.querySelector('#cfg-modelo-docs-doc-0-tipo') as HTMLSelectElement).disabled,
    ).toBe(false);
  });

  it('mostra a recusa do nome junto do campo e resume que há recusas abaixo', async () => {
    const tela = await carregar();
    salvar(tela);

    controller
      .expectOne((r) => r.method === 'PUT')
      .flush(
        JSON.stringify({
          status: 422,
          title: 'Requisição inválida',
          code: 'uniplus.validacao',
          errors: [{ field: 'Nome', code: 'x', message: 'Nome já usado por outro modelo.' }],
        }),
        PROBLEMA,
      );
    const depois = await propagar();

    expect(depois.querySelector('#cfg-modelo-ed-nome-erro')?.textContent).toBe(
      'Nome já usado por outro modelo.',
    );
    expect(depois.querySelector('.cfg-modelo-resumo')?.textContent).toContain(
      'Há recusas nos campos marcados abaixo.',
    );
  });

  async function recusar(tela: HTMLElement, errors: readonly object[]): Promise<HTMLElement> {
    salvar(tela);
    const gravacao = controller.expectOne((r) => r.method === 'PUT');
    await propagar();
    gravacao.flush(
      JSON.stringify({
        status: 422,
        title: 'Requisição inválida',
        code: 'uniplus.validacao',
        errors,
      }),
      PROBLEMA,
    );
    await propagar();
    return propagar();
  }

  it('salvar de novo sem editar o campo recusado volta a enviar o modelo à API', async () => {
    const tela = await carregar();
    const nomeJaUsado = [{ field: 'Nome', code: 'x', message: 'Nome já usado.' }];

    await recusar(tela, nomeJaUsado);
    await recusar(tela, nomeJaUsado);
  });

  it('a recusa que aponta o campo do cabeçalho leva o foco a ele, não ao resumo', async () => {
    const tela = await carregar();

    const depois = await recusar(tela, [{ field: 'Nome', code: 'x', message: 'Nome já usado.' }]);

    expect(document.activeElement).toBe(depois.querySelector('input[formcontrolname="nome"]'));
  });

  it('a recusa que não aponta campo leva o foco ao resumo', async () => {
    const tela = await carregar();

    const depois = await recusar(tela, [
      { field: 'conteudo', code: 'y', message: 'O item cita fato que vem depois dele.' },
    ]);

    expect(document.activeElement).toBe(depois.querySelector('#cfg-modelo-resumo'));
  });

  it('a recusa de um item do conteúdo, mostrada junto dele, leva o foco ao resumo', async () => {
    const tela = await carregar();

    const depois = await recusar(tela, [
      { field: 'conteudo.itens[0].rotulo', code: 'x', message: 'O rótulo passou do tamanho.' },
    ]);

    expect(document.activeElement).toBe(depois.querySelector('#cfg-modelo-resumo'));
  });

  it('numa falha 500, resume o motivo e mantém a gravação disponível', async () => {
    const tela = await carregar();
    salvar(tela);

    controller
      .expectOne((r) => r.method === 'PUT')
      .flush(FALHA_500, { status: 500, statusText: 'Erro', headers: PROBLEMA.headers });
    const depois = await propagar();

    expect(depois.querySelector('.cfg-modelo-resumo')?.textContent).toContain('Erro interno');
    expect(depois.querySelector<HTMLFieldSetElement>('fieldset.form-grid')?.disabled).toBe(false);
  });
});
