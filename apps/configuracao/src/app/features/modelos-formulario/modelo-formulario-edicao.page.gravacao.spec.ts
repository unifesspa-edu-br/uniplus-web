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
  MODELO,
  PROBLEMA,
  modelo,
  montarTelaDeEdicao,
  propagarAlteracoes,
  responderCarga,
  salvar,
  tituloDaTela,
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

  it('salva o conteúdo sem os dados básicos, que a API repõe, e com termos, grupos, restrições e impedimento intactos', async () => {
    const tela = await carregar();

    salvar(tela);
    const req = controller.expectOne((r) => r.method === 'PUT' && r.url === MODELO);
    const conteudo = req.request.body.conteudo;

    expect(conteudo.paginas.map((e: { codigo: string }) => e.codigo)).toEqual([
      'SECAO_1',
      'REVISAO_E_ACEITE',
    ]);
    expect(conteudo.itens.map((i: { fatoCodigo: string }) => i.fatoCodigo)).toEqual([
      'ESCOLA_PUBLICA',
    ]);
    expect(conteudo.itens[0].regras.restricoes).toEqual(modelo.conteudo.itens[1].regras.restricoes);
    expect(conteudo.itens[0].regras.impedimento).toEqual(
      modelo.conteudo.itens[1].regras.impedimento,
    );
    expect(conteudo.termos).toEqual(modelo.conteudo.termos);
    expect(conteudo.grupos).toEqual(modelo.conteudo.grupos);
    expect(req.request.headers.get('Idempotency-Key')).not.toBeNull();
    req.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    controller.expectOne(MODELO).flush(modelo);
  });

  it('durante a gravação o cabeçalho fica somente leitura e o valor se mantém', async () => {
    const tela = await carregar();
    salvar(tela);
    const requisicao = controller.expectOne((r) => r.method === 'PUT');
    await propagar();

    const nome = tela.querySelector<HTMLInputElement>('input[formcontrolname="nome"]');
    expect(nome?.matches(':disabled')).toBe(true);
    expect(nome?.value).toBe('Inscrição Medicina');

    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    controller.expectOne(MODELO).flush(modelo);
  });

  it('Enter no nome com a gravação pendente leva o foco ao botão de salvar', async () => {
    const tela = await carregar();
    const nome = tela.querySelector<HTMLInputElement>('input[formcontrolname="nome"]');
    nome?.focus();

    (tela.querySelector('#cfg-modelo-edicao') as HTMLFormElement).dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    const requisicao = controller.expectOne((r) => r.method === 'PUT');
    await propagar();
    await propagar();

    expect(nome?.matches(':disabled')).toBe(true);
    expect(document.activeElement).toBe(tela.querySelector('button[type="submit"]'));
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    controller.expectOne(MODELO).flush(modelo);
  });

  it('gravado o modelo, o formulário segue montado e somente leitura até a recarga chegar', async () => {
    const tela = await carregar();
    const nome = tela.querySelector<HTMLInputElement>(
      'input[formcontrolname="nome"]',
    ) as HTMLInputElement;
    nome.value = 'Inscrição revisada';
    nome.dispatchEvent(new Event('input'));
    nome.focus();
    (tela.querySelector('#cfg-modelo-edicao') as HTMLFormElement).dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    const gravacao = controller.expectOne((r) => r.method === 'PUT');
    await propagar();
    await propagar();

    gravacao.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    await propagar();
    const recarga = controller.expectOne(MODELO);

    const botao = tela.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(tela.querySelector('input[formcontrolname="nome"]')).toBe(nome);
    expect(tela.textContent).not.toContain('Carregando o modelo');
    expect(nome.matches(':disabled')).toBe(true);
    expect(nome.value).toBe('Inscrição revisada');
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(botao);

    recarga.flush({
      ...modelo,
      descritivo: { ...modelo.descritivo, nome: 'Inscrição gravada' },
    });
    await propagar();
    await propagar();

    expect(tela.querySelector('input[formcontrolname="nome"]')).toBe(nome);
    expect(nome.matches(':disabled')).toBe(false);
    expect(nome.value).toBe('Inscrição gravada');
    expect(botao.getAttribute('aria-disabled')).toBeNull();
    expect(document.activeElement).toBe(botao);
  });

  it('gravado o modelo e falha a releitura, o foco vai ao título, que a tela mantém', async () => {
    const tela = await carregar();
    const nome = tela.querySelector<HTMLInputElement>(
      'input[formcontrolname="nome"]',
    ) as HTMLInputElement;
    nome.focus();
    (tela.querySelector('#cfg-modelo-edicao') as HTMLFormElement).dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    const gravacao = controller.expectOne((r) => r.method === 'PUT');
    await propagar();
    await propagar();
    gravacao.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    await propagar();
    expect(document.activeElement).toBe(tela.querySelector('button[type="submit"]'));

    controller
      .expectOne(MODELO)
      .flush(FALHA_500, { status: 500, statusText: 'Erro', headers: PROBLEMA.headers });
    await propagar();
    await propagar();

    expect(tela.querySelector('form#cfg-modelo-edicao')).toBeNull();
    expect(tela.textContent).toContain('Não foi possível carregar o modelo');
    expect(document.activeElement).toBe(tituloDaTela());
  });

  it('gravado o modelo e falha a releitura, o foco que já foi a outro elemento fica onde está', async () => {
    const tela = await carregar();
    const fora = document.createElement('button');
    document.body.appendChild(fora);
    try {
      (tela.querySelector('#cfg-modelo-edicao') as HTMLFormElement).dispatchEvent(
        new Event('submit', { cancelable: true }),
      );
      const gravacao = controller.expectOne((r) => r.method === 'PUT');
      await propagar();
      gravacao.flush(null, { status: 204, statusText: 'No Content' });
      await propagar();
      await propagar();
      const recarga = controller.expectOne(MODELO);
      fora.focus();
      expect(document.activeElement).toBe(fora);

      recarga.flush(FALHA_500, { status: 500, statusText: 'Erro', headers: PROBLEMA.headers });
      await propagar();
      await propagar();

      expect(tela.querySelector('form#cfg-modelo-edicao')).toBeNull();
      expect(tela.textContent).toContain('Não foi possível carregar o modelo');
      expect(document.activeElement).toBe(fora);
    } finally {
      fora.remove();
    }
  });
});
