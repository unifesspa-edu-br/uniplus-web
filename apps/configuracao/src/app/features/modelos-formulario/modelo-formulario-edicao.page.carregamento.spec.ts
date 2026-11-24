import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture } from '@angular/core/testing';
import {
  type FatoDoCatalogoDto,
  type ModeloFormularioView,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ModeloFormularioEdicaoPage } from './modelo-formulario-edicao.page';
import {
  BASE,
  FASES,
  MODELO,
  fato,
  modelo,
  montarTelaDeEdicao,
  propagarAlteracoes,
  responderCarga,
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

  const botaoTentarNovamente = (tela: HTMLElement, titulo: string): HTMLButtonElement =>
    Array.from(tela.querySelectorAll('ui-alert'))
      .find((alerta) => alerta.textContent?.includes(titulo))
      ?.querySelector('button') as HTMLButtonElement;

  async function tentarNovamenteComFoco(tela: HTMLElement, alerta: string): Promise<void> {
    const botao = botaoTentarNovamente(tela, alerta);
    botao.focus();
    botao.click();
    await propagar();
  }

  async function concluirANovaTentativa(): Promise<void> {
    await propagar();
    await propagar();
    expect(document.activeElement).toBe(tituloDaTela());
  }

  it('falha ao carregar o modelo: mostra o motivo, a nova tentativa refaz a leitura e o foco vai ao título', async () => {
    const tela = await carregar(modelo, [], FASES, ['modelo']);

    expect(tela.textContent).toContain('Não foi possível carregar o modelo');
    await tentarNovamenteComFoco(tela, 'Não foi possível carregar o modelo');
    controller.expectOne(MODELO).flush(modelo);
    await concluirANovaTentativa();
    expect(tela.querySelector('ui-alert')).toBeNull();
  });

  it('o modelo que não existe mostra a recusa, sem nova tentativa, e mantém a volta à lista', async () => {
    const tela = await carregar(modelo, [], FASES, ['modelo-inexistente']);

    expect(tela.textContent).toContain('Modelo não encontrado');
    expect(tela.textContent).not.toContain('Tentar novamente');
    expect(tela.querySelector('a[href="/modelos-formulario"]')).not.toBeNull();
  });

  it('falha ao carregar os termos: avisa, a nova tentativa os pede de novo e o foco vai ao título', async () => {
    const tela = await carregar(modelo, [], FASES, ['termos']);

    expect(tela.textContent).toContain('Termos de consentimento não carregados');
    await tentarNovamenteComFoco(tela, 'Termos de consentimento não carregados');
    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/termos-consentimento`)
      .flush([]);
    await concluirANovaTentativa();

    expect(tela.textContent).not.toContain('Termos de consentimento não carregados');
  });

  it('falha ao carregar o catálogo de fatos: avisa, a nova tentativa o lê de novo e o foco vai ao título', async () => {
    const tela = await carregar(modelo, [], FASES, ['fatos']);

    expect(tela.textContent).toContain('Catálogo de fatos não carregado');
    await tentarNovamenteComFoco(tela, 'Catálogo de fatos não carregado');
    controller.expectOne(`${BASE}/api/configuracao/fatos-candidato`).flush([fato('NOME')]);
    await concluirANovaTentativa();

    expect(tela.textContent).not.toContain('Catálogo de fatos não carregado');
  });

  it('falha ao carregar os tipos de processo: avisa que o campo fica sem opções e a nova tentativa os lê de novo', async () => {
    const tela = await carregar(modelo, [], FASES, ['tipos-processo']);

    expect(tela.textContent).toContain('Tipos de processo não carregados');
    expect(tela.textContent).toContain('não lista as opções nem mostra o tipo do modelo');
    await tentarNovamenteComFoco(tela, 'Tipos de processo não carregados');
    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-processo`)
      .flush([{ id: '1', codigo: 'GRADUACAO', nome: 'Graduação' }]);
    await concluirANovaTentativa();

    expect(tela.textContent).not.toContain('Tipos de processo não carregados');
    expect(tela.querySelector('option[value="GRADUACAO"]')).not.toBeNull();
  });

  it('falha ao carregar o vocabulário dos documentos: a nova tentativa lê fases, tipos e consequências de novo e o foco vai ao título', async () => {
    const tela = await carregar(modelo, [], FASES, ['fases', 'tipos-documento']);

    await tentarNovamenteComFoco(tela, 'Fases, tipos de documento ou consequências não carregados');
    controller.expectOne((r) => r.url === `${BASE}/api/configuracao/fases-canonicas`).flush(FASES);
    controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-documento`).flush([]);
    controller
      .expectOne((r) => r.url === `${BASE}/api/selecao/vocabularios/consequencias-indeferimento`)
      .flush([]);
    await concluirANovaTentativa();

    expect(tela.textContent).not.toContain(
      'Fases, tipos de documento ou consequências não carregados',
    );
  });

  it('a primeira leitura falha: o foco não vai ao título, pois ninguém esperava a recarga', async () => {
    const tela = await carregar(modelo, [], FASES, ['modelo']);
    await propagar();

    expect(tela.textContent).toContain('Não foi possível carregar o modelo');
    expect(tela.querySelector('#cfg-modelo-titulo')).not.toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  describe('com os termos e o catálogo em falha', () => {
    const urlDosTermos = `${BASE}/api/configuracao/termos-consentimento`;
    const urlDoCatalogo = `${BASE}/api/configuracao/fatos-candidato`;
    const TERMOS = 'Termos de consentimento não carregados';
    const CATALOGO = 'Catálogo de fatos não carregado';

    async function comAsDuasFalhas(): Promise<HTMLElement> {
      return carregar(modelo, [], FASES, ['termos', 'fatos']);
    }

    it('o botão de um alerta fica disponível e funciona enquanto outro recurso carrega', async () => {
      const tela = await comAsDuasFalhas();
      botaoTentarNovamente(tela, TERMOS).click();
      await propagar();

      const doCatalogo = botaoTentarNovamente(tela, CATALOGO);
      expect(doCatalogo.getAttribute('aria-disabled')).toBeNull();
      expect(doCatalogo.getAttribute('aria-busy')).toBeNull();
      doCatalogo.click();
      await propagar();
      const lerCatalogo = controller.expectOne(urlDoCatalogo);
      controller.expectOne((r) => r.url === urlDosTermos).flush([]);
      lerCatalogo.flush([fato('NOME')]);
      await propagar();
    });
  });
});
