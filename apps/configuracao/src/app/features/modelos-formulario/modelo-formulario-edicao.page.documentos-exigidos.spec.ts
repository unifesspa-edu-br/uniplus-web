import { DADO_OPCAO, FONTE_MUNICIPIOS } from './vocabulario-do-modelo.testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture } from '@angular/core/testing';
import {
  OperadorCodigo,
  type FatoDoCatalogoDto,
  type ModeloFormularioView,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ModeloFormularioEdicaoPage } from './modelo-formulario-edicao.page';
import {
  FASES,
  MODELO,
  fato,
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

  function selecionar(tela: HTMLElement, id: string, valor: string): void {
    const campo = tela.querySelector<HTMLSelectElement>(`#${id}`) as HTMLSelectElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('change'));
  }

  it('mostra o conjunto padrão e grava a troca do tipo de documento, o incluído e sem o removido', async () => {
    const tela = await carregar();
    expect(tela.textContent).toContain('Documentos exigidos (padrão)');
    expect(tela.textContent).toContain('só para processos aos quais o modelo for aplicado depois');

    selecionar(tela, 'cfg-modelo-docs-doc-0-tipo', 'ATESTADO');
    await propagar();
    (tela.querySelector('#cfg-modelo-docs-doc-1-remover') as HTMLButtonElement).click();
    await propagar();
    (tela.querySelector('#cfg-modelo-docs-acrescentar') as HTMLButtonElement).click();
    await propagar();
    salvar(tela);

    const req = controller.expectOne((r) => r.method === 'PUT' && r.url === MODELO);
    const documentos = req.request.body.conteudo.documentosExigidos;
    expect(documentos).toHaveLength(2);
    expect(documentos[0]).toMatchObject({
      tipoDocumentoCodigo: 'ATESTADO',
      quando: modelo.conteudo.documentosExigidos[0].quando,
      basesLegais: modelo.conteudo.documentosExigidos[0].basesLegais,
    });
    expect(documentos[1]).toMatchObject({ faseCodigo: 'INSCRICAO', quando: null });
    req.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    controller.expectOne(MODELO).flush(modelo);
  });

  it('marca junto da condição o fato que o modelo não coleta, antes de enviar', async () => {
    const [laudo] = modelo.conteudo.documentosExigidos ?? [];
    const tela = await carregar({
      ...modelo,
      conteudo: {
        ...modelo.conteudo,
        documentosExigidos: [
          {
            ...laudo,
            quando: [[{ fato: 'GESTANTE', operador: OperadorCodigo.IGUAL, valor: true }]],
          },
        ],
      },
    });

    const documento = tela.querySelector(
      '[aria-labelledby="cfg-modelo-docs-doc-0-titulo"]',
    ) as HTMLElement;
    expect(documento.textContent).toContain('o modelo não coleta este fato');
  });

  it('mantém o mesmo campo ao editar o documento, para o foco do teclado não se perder', async () => {
    const tela = await carregar();
    const antes = tela.querySelector('#cfg-modelo-docs-doc-0-base-0-ref') as HTMLInputElement;

    antes.value = 'Lei 14.723/2023';
    antes.dispatchEvent(new Event('change'));
    await propagar();

    expect(tela.querySelector('#cfg-modelo-docs-doc-0-base-0-ref')).toBe(antes);
  });

  it('não oferece o reenvio em fase que não admite complementação', async () => {
    const tela = await carregar();

    selecionar(tela, 'cfg-modelo-docs-doc-0-fase', 'HOMOLOGACAO');
    await propagar();

    const valores = Array.from(
      (tela.querySelector('#cfg-modelo-docs-doc-0-consequencia') as HTMLSelectElement).options,
    ).map((opcao) => opcao.value);
    expect(valores).not.toContain('PENDENCIA_REENVIO');
  });

  it('tira o reenvio da consequência ao trocar para fase que não admite complementação', async () => {
    const tela = await carregar();
    selecionar(tela, 'cfg-modelo-docs-doc-1-fase', 'HOMOLOGACAO');
    await propagar();
    salvar(tela);

    const req = controller.expectOne((r) => r.method === 'PUT' && r.url === MODELO);
    const documento = req.request.body.conteudo.documentosExigidos[1];
    expect(documento).toMatchObject({ faseCodigo: 'HOMOLOGACAO' });
    expect(documento.consequenciaIndeferimento).not.toBe('PENDENCIA_REENVIO');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    controller.expectOne(MODELO).flush(modelo);
  });

  it('oferece o fato de município que a condição do documento cita', async () => {
    const [laudo] = modelo.conteudo.documentosExigidos ?? [];
    const tela = await carregar(
      {
        ...modelo,
        conteudo: {
          ...modelo.conteudo,
          documentosExigidos: [
            {
              ...laudo,
              quando: [
                [{ fato: 'MUNICIPIO', operador: OperadorCodigo.ALGUM_DE, valor: ['1500000'] }],
              ],
            },
          ],
        },
      },
      [
        {
          fato: { ...fato('MUNICIPIO').fato, dominio: DADO_OPCAO, fonteValores: FONTE_MUNICIPIOS },
          operadoresAdmitidos: [{ codigo: OperadorCodigo.ALGUM_DE, rotulo: 'é um de' }],
        },
      ],
    );

    const documento = tela.querySelector(
      '[aria-labelledby="cfg-modelo-docs-doc-0-titulo"]',
    ) as HTMLElement;
    expect(documento.textContent).not.toContain('fora do catálogo');
  });

  it('não oferece o reenvio enquanto a fase do documento não está resolvida', async () => {
    const tela = await carregar(modelo, [], []);

    const valores = Array.from(
      (tela.querySelector('#cfg-modelo-docs-doc-0-consequencia') as HTMLSelectElement).options,
    ).map((opcao) => opcao.value);
    expect(valores).not.toContain('PENDENCIA_REENVIO');
  });
});
