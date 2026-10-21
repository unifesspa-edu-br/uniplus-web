import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  type FatoCandidatoView,
  type ModeloFormularioView,
} from '@uniplus/shared-data/configuracao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ModeloFormularioEdicaoPage } from './modelo-formulario-edicao.page';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-0000000000a1';
const MODELO = `${BASE}/api/configuracao/admin/modelos-formulario/${ID}`;
const PROBLEMA = {
  status: 422,
  statusText: 'Recusa',
  headers: { 'content-type': 'application/problem+json' },
};

const fato = (codigo: string): FatoCandidatoView => ({
  id: codigo,
  codigo,
  nome: codigo,
  descricao: null,
  dominio: 'BOOLEANO',
  origem: 'DECLARADO',
  cardinalidade: 'ESCALAR',
  valoresDominio: null,
  pontoResolucao: 'INSCRICAO',
  binding: `CAMPO_FORMULARIO:${codigo}`,
  valoresDominioDeclarados: null,
  fonteValores: null,
  ativo: true,
  escopo: 'CANDIDATO',
});

/**
 * Um modelo de inscrição como a API o devolve: com a seção dos dados básicos, e com o que esta
 * tela ainda não edita — termo, grupo, restrição e impedimento.
 */
const modelo: ModeloFormularioView = {
  id: ID,
  codigo: 'INSCRICAO_MEDICINA',
  nome: 'Inscrição Medicina',
  descricao: null,
  finalidade: 'INSCRICAO',
  tipoProcessoCodigo: null,
  ativo: true,
  conteudo: {
    titulo: 'Inscrição',
    etapas: [
      {
        codigo: 'DADOS_BASICOS',
        ordem: 0,
        tipo: 'SECAO',
        bloco: null,
        titulo: 'Dados do candidato',
        descricao: null,
        aviso: null,
      },
      {
        codigo: 'SECAO_1',
        ordem: 1,
        tipo: 'SECAO',
        bloco: null,
        titulo: 'Escolaridade',
        descricao: null,
        aviso: null,
      },
      {
        codigo: 'REVISAO_E_ACEITE',
        ordem: 2,
        tipo: 'BLOCO',
        bloco: 'REVISAO_E_ACEITE',
        titulo: 'Revisão e aceite',
        descricao: null,
        aviso: null,
      },
    ],
    itens: [
      {
        fatoCodigo: 'NOME',
        ordem: 0,
        rotulo: 'Nome',
        tipoRenderizacao: 'TEXTO',
        obrigatoriedade: 'SEMPRE',
        precondicao: null,
        etapaCodigo: 'DADOS_BASICOS',
        pedirConfirmacao: false,
      },
      {
        fatoCodigo: 'ESCOLA_PUBLICA',
        ordem: 1,
        rotulo: 'Estudou em escola pública?',
        tipoRenderizacao: 'BOOLEANO',
        obrigatoriedade: 'SEMPRE',
        precondicao: null,
        etapaCodigo: 'SECAO_1',
        pedirConfirmacao: false,
        restricoes: [{ tipo: 'SUBCONJUNTO', entradas: [{ quando: null, valores: ['true'] }] }],
        impedimento: {
          quando: [[{ fato: 'ESCOLA_PUBLICA', operador: 'IGUAL', valor: false }]],
          mensagem: 'Só para egressos.',
        },
      },
    ],
    termos: [
      {
        codigo: 'LGPD',
        ordem: 0,
        termoId: 'T1',
        versaoId: 'V1',
        exibicao: null,
        obrigatoriedade: 'SEMPRE',
        predicadoObrigatoriedade: null,
      },
    ],
    pressupostos: [],
    grupos: [
      {
        codigo: 'FAMILIA',
        ordem: 2,
        rotulo: 'Composição familiar',
        etapaCodigo: 'SECAO_1',
        minimo: 1,
        maximo: null,
        exibicao: null,
        obrigatoriedade: 'SEMPRE',
        predicadoObrigatoriedade: null,
        subitens: [],
        incluiCandidato: true,
      },
    ],
    documentosExigidos: [
      {
        faseCodigo: 'INSCRICAO',
        tipoDocumentoCodigo: 'LAUDO_MEDICO',
        obrigatorio: true,
        quando: [[{ fato: 'ESCOLA_PUBLICA', operador: 'IGUAL', valor: true }]],
        consequenciaIndeferimento: 'ELIMINA',
        basesLegais: [
          {
            referencia: 'Lei 13.146/2015',
            abrangencia: 'FEDERAL',
            status: 'RESOLVIDO',
            observacao: null,
          },
        ],
      },
      {
        faseCodigo: 'INSCRICAO',
        tipoDocumentoCodigo: 'CERTIDAO_NASCIMENTO',
        obrigatorio: false,
        quando: null,
        consequenciaIndeferimento: 'PENDENCIA_REENVIO',
        basesLegais: [],
      },
    ],
  },
};

describe('ModeloFormularioEdicaoPage', () => {
  let fixture: ComponentFixture<ModeloFormularioEdicaoPage>;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ModeloFormularioEdicaoPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: GEO_BASE_PATH, useValue: BASE },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: ID }) } },
        },
      ],
    });
    fixture = TestBed.createComponent(ModeloFormularioEdicaoPage);
    controller = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  async function propagar(): Promise<HTMLElement> {
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  async function carregar(
    doModelo: ModeloFormularioView = modelo,
    fatosExtras: readonly FatoCandidatoView[] = [],
  ): Promise<HTMLElement> {
    controller.expectOne(MODELO).flush(doModelo);
    controller
      .expectOne(`${BASE}/api/configuracao/fatos-candidato`)
      .flush([fato('NOME'), fato('ESCOLA_PUBLICA'), fato('GESTANTE'), ...fatosExtras]);
    controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-processo`).flush([]);
    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/termos-consentimento`)
      .flush([]);
    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/fases-canonicas`)
      .flush([
        { id: '1', codigo: 'INSCRICAO', nome: 'Inscrição', permiteComplementacao: true },
        { id: '2', codigo: 'HOMOLOGACAO', nome: 'Homologação', permiteComplementacao: false },
      ]);
    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-documento`)
      .flush([
        { id: '1', codigo: 'LAUDO_MEDICO', nome: 'Laudo médico' },
        { id: '2', codigo: 'CERTIDAO_NASCIMENTO', nome: 'Certidão de nascimento' },
        { id: '3', codigo: 'ATESTADO', nome: 'Atestado' },
      ]);
    return propagar();
  }

  function selecionar(tela: HTMLElement, id: string, valor: string): void {
    const campo = tela.querySelector<HTMLSelectElement>(`#${id}`) as HTMLSelectElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('change'));
  }

  function salvar(tela: HTMLElement): void {
    const botao = Array.from(
      tela.querySelectorAll('button[type="submit"]') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent?.includes('Salvar modelo'));
    (botao as HTMLButtonElement).click();
  }

  it('salva o conteúdo sem os dados básicos, que a API repõe, e com termos, grupos, restrições e impedimento intactos', async () => {
    const tela = await carregar();

    salvar(tela);
    const req = controller.expectOne((r) => r.method === 'PUT' && r.url === MODELO);
    const conteudo = req.request.body.conteudo;

    expect(conteudo.etapas.map((e: { codigo: string }) => e.codigo)).toEqual([
      'SECAO_1',
      'REVISAO_E_ACEITE',
    ]);
    expect(conteudo.itens.map((i: { fatoCodigo: string }) => i.fatoCodigo)).toEqual([
      'ESCOLA_PUBLICA',
    ]);
    expect(conteudo.itens[0].restricoes).toEqual(modelo.conteudo.itens?.[1].restricoes);
    expect(conteudo.itens[0].impedimento).toEqual(modelo.conteudo.itens?.[1].impedimento);
    expect(conteudo.termos).toEqual(modelo.conteudo.termos);
    expect(conteudo.grupos).toEqual(modelo.conteudo.grupos);
    expect(req.request.headers.get('Idempotency-Key')).not.toBeNull();
    req.flush(null, { status: 204, statusText: 'No Content' });
    controller.expectOne(MODELO).flush(modelo);
  });

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
      quando: modelo.conteudo.documentosExigidos?.[0].quando,
      basesLegais: modelo.conteudo.documentosExigidos?.[0].basesLegais,
    });
    expect(documentos[1]).toMatchObject({ faseCodigo: 'INSCRICAO', quando: null });
    req.flush(null, { status: 204, statusText: 'No Content' });
    controller.expectOne(MODELO).flush(modelo);
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

  it('marca junto da condição o fato que o modelo não coleta, antes de enviar', async () => {
    const [laudo] = modelo.conteudo.documentosExigidos ?? [];
    const tela = await carregar({
      ...modelo,
      conteudo: {
        ...modelo.conteudo,
        documentosExigidos: [
          { ...laudo, quando: [[{ fato: 'GESTANTE', operador: 'IGUAL', valor: true }]] },
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
            { ...laudo, quando: [[{ fato: 'MUNICIPIO', operador: 'EM', valor: ['1500000'] }]] },
          ],
        },
      },
      [{ ...fato('MUNICIPIO'), dominio: 'CATEGORICO', fonteValores: 'GEO_MUNICIPIO' }],
    );

    const documento = tela.querySelector(
      '[aria-labelledby="cfg-modelo-docs-doc-0-titulo"]',
    ) as HTMLElement;
    expect(documento.textContent).not.toContain('fora do catálogo');
  });
});
