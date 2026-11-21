import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture } from '@angular/core/testing';
import {
  type FatoDoCatalogoDto,
  type ModeloFormularioView,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ModeloFormularioEdicaoPage } from './modelo-formulario-edicao.page';
import {
  FASES,
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

  function digitarNoMaximoDoGrupo(tela: HTMLElement, texto: string): HTMLInputElement {
    const campo = tela.querySelector<HTMLInputElement>(
      'input[id$="-FAMILIA-maximo"]',
    ) as HTMLInputElement;
    campo.value = texto;
    campo.dispatchEvent(new Event('change'));
    return campo;
  }

  it('marca junto do campo o número inválido, leva o foco a ele e não grava', async () => {
    const tela = await carregar();
    const campo = digitarNoMaximoDoGrupo(tela, 'dez');
    await propagar();

    salvar(tela);
    await propagar();

    expect(campo.getAttribute('aria-invalid')).toBe('true');
    const erro = tela.ownerDocument.getElementById(
      (campo.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .find((id) => id.endsWith('-maximo-erro')) ?? '',
    );
    expect(erro?.textContent).toContain('O máximo é um número inteiro, a partir de um.');
    expect(tela.ownerDocument.activeElement).toBe(campo);
    controller.expectNone((r) => r.method === 'PUT');
  });

  it('abre a seção recolhida e leva o foco ao campo inválido ao tentar salvar', async () => {
    const tela = await carregar();
    const campo = digitarNoMaximoDoGrupo(tela, 'dez');
    await propagar();
    (tela.querySelector('#cfg-modelo-etapa-SECAO_1-nome button') as HTMLButtonElement).click();
    await propagar();
    expect((tela.querySelector('#cfg-modelo-etapa-SECAO_1-corpo') as HTMLElement).hidden).toBe(
      true,
    );

    salvar(tela);
    await propagar();
    await new Promise((resolve) => setTimeout(resolve));

    expect((tela.querySelector('#cfg-modelo-etapa-SECAO_1-corpo') as HTMLElement).hidden).toBe(
      false,
    );
    expect(tela.ownerDocument.activeElement).toBe(campo);
    controller.expectNone((r) => r.method === 'PUT');
  });

  it('tira a marca do campo quando o número é corrigido', async () => {
    const tela = await carregar();
    const campo = digitarNoMaximoDoGrupo(tela, 'dez');
    await propagar();

    digitarNoMaximoDoGrupo(tela, '3');
    await propagar();

    expect(campo.getAttribute('aria-invalid')).toBeNull();
    expect(campo.getAttribute('aria-describedby')).not.toContain('maximo-erro');
  });

  it('não grava com o nome em branco: marca o campo, anuncia o motivo e leva o foco a ele', async () => {
    const tela = await carregar();
    const nome = tela.querySelector<HTMLInputElement>(
      'input[formcontrolname="nome"]',
    ) as HTMLInputElement;
    nome.value = '';
    nome.dispatchEvent(new Event('input'));

    salvar(tela);
    const depois = await propagar();
    await propagar();

    controller.expectNone((r) => r.method === 'PUT');
    expect(nome.getAttribute('aria-invalid')).toBe('true');
    expect(depois.querySelector('#cfg-modelo-ed-nome-erro')?.textContent).toBe(
      'Campo obrigatório.',
    );
    expect(document.activeElement).toBe(nome);
  });
});
