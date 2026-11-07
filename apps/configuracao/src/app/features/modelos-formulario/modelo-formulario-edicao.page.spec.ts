import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
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
  descricao: 'Dado do candidato.',
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
  classificacaoProtecao: 'INTERNO',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  finalidadeTratamento: 'Aplicar a regra do certame.',
  protecaoAprovada: true,
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

const FASES = [
  { id: '1', codigo: 'INSCRICAO', nome: 'Inscrição', permiteComplementacao: true },
  { id: '2', codigo: 'HOMOLOGACAO', nome: 'Homologação', permiteComplementacao: false },
];

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

  const FALHA_500 = JSON.stringify({
    status: 500,
    title: 'Erro interno',
    code: 'uniplus.internal.unexpected',
  });

  const FALHA_404 = JSON.stringify({
    status: 404,
    title: 'Modelo não encontrado',
    code: 'uniplus.configuracao.modelo_formulario.nao_encontrado',
  });

  async function carregar(
    doModelo: ModeloFormularioView = modelo,
    fatosExtras: readonly FatoCandidatoView[] = [],
    fasesCanonicas: readonly object[] = FASES,
    falhando: readonly string[] = [],
  ): Promise<HTMLElement> {
    const responder = (req: TestRequest, recurso: string, dados: object): void => {
      if (recurso === 'modelo' && falhando.includes('modelo-inexistente')) {
        req.flush(FALHA_404, {
          status: 404,
          statusText: 'Não encontrado',
          headers: PROBLEMA.headers,
        });
      } else if (falhando.includes(recurso)) {
        req.flush(FALHA_500, { status: 500, statusText: 'Erro', headers: PROBLEMA.headers });
      } else {
        req.flush(dados);
      }
    };
    responder(controller.expectOne(MODELO), 'modelo', doModelo);
    responder(controller.expectOne(`${BASE}/api/configuracao/fatos-candidato`), 'fatos', [
      fato('NOME'),
      fato('ESCOLA_PUBLICA'),
      fato('GESTANTE'),
      ...fatosExtras,
    ]);
    responder(
      controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-processo`),
      'tipos-processo',
      [],
    );
    responder(
      controller.expectOne((r) => r.url === `${BASE}/api/configuracao/termos-consentimento`),
      'termos',
      [],
    );
    responder(
      controller.expectOne((r) => r.url === `${BASE}/api/configuracao/fases-canonicas`),
      'fases',
      fasesCanonicas,
    );
    responder(
      controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-documento`),
      'tipos-documento',
      [
        { id: '1', codigo: 'LAUDO_MEDICO', nome: 'Laudo médico' },
        { id: '2', codigo: 'CERTIDAO_NASCIMENTO', nome: 'Certidão de nascimento' },
        { id: '3', codigo: 'ATESTADO', nome: 'Atestado' },
      ],
    );
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
    await propagar();
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
    await propagar();
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

  it('não oferece o reenvio enquanto a fase do documento não está resolvida', async () => {
    const tela = await carregar(modelo, [], []);

    const valores = Array.from(
      (tela.querySelector('#cfg-modelo-docs-doc-0-consequencia') as HTMLSelectElement).options,
    ).map((opcao) => opcao.value);
    expect(valores).not.toContain('PENDENCIA_REENVIO');
  });

  const botaoTentarNovamente = (tela: HTMLElement, titulo: string): HTMLButtonElement =>
    Array.from(tela.querySelectorAll('ui-alert'))
      .find((alerta) => alerta.textContent?.includes(titulo))
      ?.querySelector('button') as HTMLButtonElement;

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

  const titulo = (): HTMLElement | null => document.getElementById('cfg-modelo-titulo');

  async function tentarNovamenteComFoco(tela: HTMLElement, alerta: string): Promise<void> {
    const botao = botaoTentarNovamente(tela, alerta);
    botao.focus();
    botao.click();
    await propagar();
  }

  async function concluirANovaTentativa(): Promise<void> {
    await propagar();
    await propagar();
    expect(document.activeElement).toBe(titulo());
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

  it('falha ao carregar o vocabulário dos documentos: a nova tentativa lê fases e tipos de novo e o foco vai ao título', async () => {
    const tela = await carregar(modelo, [], FASES, ['fases', 'tipos-documento']);

    await tentarNovamenteComFoco(tela, 'Fases ou tipos de documento não carregados');
    controller.expectOne((r) => r.url === `${BASE}/api/configuracao/fases-canonicas`).flush(FASES);
    controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-documento`).flush([]);
    await concluirANovaTentativa();

    expect(tela.textContent).not.toContain('Fases ou tipos de documento não carregados');
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

    recarga.flush({ ...modelo, nome: 'Inscrição gravada' });
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
    expect(document.activeElement).toBe(titulo());
  });

  it('a primeira leitura falha: o foco não vai ao título, pois ninguém esperava a recarga', async () => {
    const tela = await carregar(modelo, [], FASES, ['modelo']);
    await propagar();

    expect(tela.textContent).toContain('Não foi possível carregar o modelo');
    expect(tela.querySelector('#cfg-modelo-titulo')).not.toBeNull();
    expect(document.activeElement).toBe(document.body);
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
