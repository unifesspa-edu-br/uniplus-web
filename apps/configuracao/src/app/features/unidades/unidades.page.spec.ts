import { HttpRequest, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor, buildVendorMimeAccept } from '@uniplus/shared-core/http';
import { ORGANIZACAO_BASE_PATH, UnidadeDto } from '@uniplus/shared-data/organizacao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UnidadesPage } from './unidades.page';

const BASE = 'http://localhost:5000';
const REITORIA_ID = '01960000-0000-7000-0000-000000000001';
const INSTITUTO_ID = '01960000-0000-7000-0000-000000000002';

// Folga acima do debounce da busca (BUSCA_DEBOUNCE_MS = 300 na página).
const DEBOUNCE_FOLGA_MS = 360;

const unidadesSeed: readonly UnidadeDto[] = [
  {
    id: REITORIA_ID,
    nome: 'Reitoria',
    alias: null,
    slug: 'reitoria',
    sigla: 'REITORIA',
    codigo: 'REITORIA',
    unidadeSuperiorId: null,
    tipo: 'Reitoria',
    unidadeAcademica: false,
    vigenciaInicio: '2026-01-01',
    vigenciaFim: null,
    origem: 'CriadoNoUniPlus',
    criadoEm: '2026-06-10T12:00:00Z',
  },
  {
    id: INSTITUTO_ID,
    nome: 'Instituto de Estudos em Desenvolvimento Agrário e Regional',
    alias: 'IEDAR',
    slug: 'iedar',
    sigla: 'IEDAR',
    codigo: 'IEDAR',
    unidadeSuperiorId: REITORIA_ID,
    tipo: 'Instituto',
    unidadeAcademica: true,
    vigenciaInicio: '2026-01-01',
    vigenciaFim: null,
    origem: 'CriadoNoUniPlus',
    criadoEm: '2026-06-10T12:01:00Z',
  },
];

describe('UnidadesPage', () => {
  let fixture: ComponentFixture<UnidadesPage>;
  let component: UnidadesPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [UnidadesPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
      ],
    });

    fixture = TestBed.createComponent(UnidadesPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
  });

  afterEach(() => controller.verify());

  // Dreia o microtask queue + roda change detection para o `httpResource`
  // propagar valores aos signals do resource (mesmo padrão de editais-detail).
  const propagate = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
  };

  const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  function expectListGet(matcher?: (request: HttpRequest<unknown>) => boolean): TestRequest {
    const req = controller.expectOne(
      (request) =>
        request.url === `${BASE}/api/unidades` &&
        request.method === 'GET' &&
        (matcher ? matcher(request) : true),
    );
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('unidade', 1));
    return req;
  }

  // Carga inicial (sem filtros). Opcionalmente injeta header Link (rel="next").
  async function flushInicial(
    unidades: readonly UnidadeDto[] = unidadesSeed,
    headers?: Record<string, string>,
  ): Promise<void> {
    fixture.detectChanges();
    const request = expectListGet(
      (r) =>
        !r.params.has('q') &&
        !r.params.has('tipo') &&
        !r.params.has('cursor') &&
        r.params.get('limit') === '100',
    );
    request.flush(unidades, headers ? { headers } : undefined);
    await propagate();
  }

  // Abrir o formulário dispara o GET (sem filtro) das opções de "unidade
  // superior" — desacoplado do filtro da listagem. Flush logo após o abrir*.
  async function flushOpcoesSuperior(
    unidades: readonly UnidadeDto[] = unidadesSeed,
  ): Promise<void> {
    await propagate();
    expectListGet(
      (r) => !r.params.has('q') && !r.params.has('tipo') && !r.params.has('cursor'),
    ).flush(unidades);
    await propagate();
  }

  it('carrega unidades na inicialização com limit 100 e monta hierarquia', async () => {
    await flushInicial();

    expect(component['unidades']()).toHaveLength(2);
    expect(component['arvore']()).toHaveLength(1);
    expect(component['arvore']()[0].children).toHaveLength(1);
  });

  it('busca server-side: digitação em rajada dispara um único GET com q após debounce', async () => {
    await flushInicial();

    component['busca'].set('i');
    component['busca'].set('ie');
    component['busca'].set('iedar');
    appRef.tick();
    // Antes do debounce, nenhuma request com q (não dispara por tecla).
    controller.expectNone(
      (request) => request.url === `${BASE}/api/unidades` && request.params.has('q'),
    );

    await sleep(DEBOUNCE_FOLGA_MS);
    await propagate();

    const request = expectListGet(
      (r) => r.params.get('q') === 'iedar' && !r.params.has('cursor'),
    );
    request.flush([unidadesSeed[1]]);
    await propagate();

    expect(component['unidades']()).toHaveLength(1);
    expect(component['unidades']()[0].id).toBe(INSTITUTO_ID);
  });

  it('filtro de tipo dispara GET imediato com tipo numérico do roster', async () => {
    await flushInicial();

    component['tipoFiltro'].set('4'); // Instituto
    await propagate();

    const request = expectListGet(
      (r) => r.params.get('tipo') === '4' && !r.params.has('q'),
    );
    request.flush([unidadesSeed[1]]);
    await propagate();

    expect(component['unidades']()).toHaveLength(1);
    expect(component['unidades']()[0].tipo).toBe('Instituto');
  });

  it('Carregar mais acumula a próxima página (cursor forward-only)', async () => {
    await flushInicial([unidadesSeed[0]], {
      Link: `<${BASE}/api/unidades?cursor=pagina-2>; rel="next"`,
    });

    expect(component['unidades']()).toHaveLength(1);
    expect(component['nextCursor']()).not.toBeNull();

    component['carregarMais']();
    await propagate();

    const request = expectListGet((r) => r.params.get('cursor') === 'pagina-2');
    request.flush([unidadesSeed[1]]); // sem Link → última página
    await propagate();

    expect(component['unidades']()).toHaveLength(2);
    expect(component['unidades']().map((u) => u.id)).toEqual([REITORIA_ID, INSTITUTO_ID]);
    expect(component['nextCursor']()).toBeNull();
  });

  it('mudar o filtro reseta a paginação para a primeira página e substitui a lista', async () => {
    await flushInicial([unidadesSeed[0]], {
      Link: `<${BASE}/api/unidades?cursor=pagina-2>; rel="next"`,
    });
    component['carregarMais']();
    await propagate();
    expectListGet((r) => r.params.get('cursor') === 'pagina-2').flush([unidadesSeed[1]]);
    await propagate();
    expect(component['unidades']()).toHaveLength(2);

    // Aplicar tipo volta à primeira página (sem cursor) e substitui, não acumula.
    component['tipoFiltro'].set('1'); // Reitoria
    await propagate();
    const request = expectListGet(
      (r) => r.params.get('tipo') === '1' && !r.params.has('cursor'),
    );
    request.flush([unidadesSeed[0]]);
    await propagate();

    expect(component['unidades']()).toHaveLength(1);
    expect(component['unidades']()[0].id).toBe(REITORIA_ID);
  });

  it('cria unidade com Idempotency-Key e recarrega a lista após sucesso', async () => {
    await flushInicial();
    component['abrirCadastro']();
    await flushOpcoesSuperior();
    component['form'].setValue({
      nome: 'Faculdade de Computação',
      alias: '',
      slug: 'facom',
      sigla: 'FACOM',
      codigo: 'FACOM',
      unidadeSuperiorId: INSTITUTO_ID,
      tipo: '5',
      unidadeAcademica: true,
      vigenciaInicio: '2026-02-01',
      vigenciaFim: '',
      origem: '2',
      motivoMudancaIdentificador: '',
    });
    const key = component['idempotencyKeyAtual']();

    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/admin/unidades`);
    expect(post.request.method).toBe('POST');
    expect(post.request.headers.get('Idempotency-Key')).toBe(key);
    expect(post.request.body).toMatchObject({
      nome: 'Faculdade de Computação',
      alias: null,
      unidadeSuperiorId: INSTITUTO_ID,
      tipo: 5,
      origem: 2,
    });
    post.flush('01960000-0000-7000-0000-000000000099', { status: 201, statusText: 'Created' });
    expect(component['formOpen']()).toBe(false);

    await propagate();
    expectListGet().flush(unidadesSeed); // refetch pós-mutação
    await propagate();
  });

  it('submete regra de vigência ao backend e exibe erro 422 inline no campo correspondente', async () => {
    await flushInicial();
    component['abrirCadastro']();
    await flushOpcoesSuperior();
    component['form'].setValue({
      nome: 'Faculdade de Computação',
      alias: '',
      slug: 'facom',
      sigla: 'FACOM',
      codigo: 'FACOM',
      unidadeSuperiorId: INSTITUTO_ID,
      tipo: '5',
      unidadeAcademica: true,
      vigenciaInicio: '2026-06-10',
      vigenciaFim: '2026-06-02',
      origem: '2',
      motivoMudancaIdentificador: '',
    });

    const primeiraChave = component['idempotencyKeyAtual']();
    expect(component['form'].valid).toBe(true);

    component['salvar']();

    const req1 = controller.expectOne(`${BASE}/api/admin/unidades`);
    expect(req1.request.method).toBe('POST');
    expect(req1.request.headers.get('Idempotency-Key')).toBe(primeiraChave);
    expect(req1.request.body).toMatchObject({
      vigenciaInicio: '2026-06-10',
      vigenciaFim: '2026-06-02',
    });
    req1.flush(
      {
        type: 'https://uniplus.unifesspa.edu.br/errors/uniplus.validacao',
        title: 'Erro de validação',
        status: 422,
        code: 'uniplus.validacao',
        traceId: '1af15c7793883f87ce943219ab8fd845',
        errors: [
          {
            field: 'VigenciaFim',
            code: 'GreaterThanOrEqualValidator',
            message: 'Data de encerramento deve ser igual ou posterior à data de início.',
          },
        ],
      },
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );

    expect(component['saving']()).toBe(false);
    expect(component['formError']()).toBeNull();
    expect(component['form'].controls.vigenciaFim.errors).toEqual({
      backend: {
        code: 'GreaterThanOrEqualValidator',
        message: 'Data de encerramento deve ser igual ou posterior à data de início.',
      },
    });
    expect(component['erroDoCampo']('vigenciaFim')).toBe(
      'Data de encerramento deve ser igual ou posterior à data de início.',
    );

    const segundaChave = component['idempotencyKeyAtual']();
    expect(segundaChave).not.toBe(primeiraChave);

    component['form'].controls.vigenciaFim.setValue('2026-06-10');
    component['salvar']();

    const retry = controller.expectOne(`${BASE}/api/admin/unidades`);
    expect(retry.request.headers.get('Idempotency-Key')).toBe(segundaChave);
    expect(retry.request.body).toMatchObject({
      vigenciaInicio: '2026-06-10',
      vigenciaFim: '2026-06-10',
    });
    retry.flush('01960000-0000-7000-0000-000000000100', {
      status: 201,
      statusText: 'Created',
    });
    expect(component['formOpen']()).toBe(false);

    await propagate();
    expectListGet().flush(unidadesSeed);
    await propagate();
  });

  it('renova Idempotency-Key quando backend sinaliza body_mismatch', async () => {
    await flushInicial();
    component['abrirCadastro']();
    await flushOpcoesSuperior();
    component['form'].setValue({
      nome: 'Faculdade de Computação',
      alias: '',
      slug: 'facom',
      sigla: 'FACOM',
      codigo: 'FACOM',
      unidadeSuperiorId: INSTITUTO_ID,
      tipo: '5',
      unidadeAcademica: true,
      vigenciaInicio: '2026-06-10',
      vigenciaFim: '2026-06-10',
      origem: '2',
      motivoMudancaIdentificador: '',
    });

    const primeiraChave = component['idempotencyKeyAtual']();
    component['salvar']();

    controller.expectOne(`${BASE}/api/admin/unidades`).flush(
      {
        type: 'https://uniplus.unifesspa.edu.br/errors/uniplus.idempotency.body_mismatch',
        title: 'Mesma Idempotency-Key reusada com body diferente',
        status: 422,
        detail: 'Mesma Idempotency-Key reusada com body diferente.',
        instance: 'urn:uuid:019eb1f6-4dd7-75dd-9265-385cadfdec34',
        code: 'uniplus.idempotency.body_mismatch',
        traceId: '9777091664fee51f7b8d83c63dc271b7',
      },
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );

    expect(component['saving']()).toBe(false);
    expect(component['formError']()).toBe('Mesma Idempotency-Key reusada com body diferente');
    expect(component['idempotencyKeyAtual']()).not.toBe(primeiraChave);
  });

  it('renova Idempotency-Key em 409 Conflict para permitir reenvio após corrigir identificador duplicado', async () => {
    await flushInicial();
    component['abrirCadastro']();
    await flushOpcoesSuperior();
    component['form'].setValue({
      nome: 'Faculdade de Computação',
      alias: '',
      slug: 'facom',
      sigla: 'FACOM',
      codigo: 'FACOM',
      unidadeSuperiorId: INSTITUTO_ID,
      tipo: '5',
      unidadeAcademica: true,
      vigenciaInicio: '2026-06-10',
      vigenciaFim: '2026-06-10',
      origem: '2',
      motivoMudancaIdentificador: '',
    });

    const primeiraChave = component['idempotencyKeyAtual']();
    component['salvar']();

    controller.expectOne(`${BASE}/api/admin/unidades`).flush(
      {
        type: 'https://uniplus.unifesspa.edu.br/errors/uniplus.unidade.sigla_duplicada',
        title: 'Sigla já utilizada por outra unidade viva',
        status: 409,
        detail: 'A sigla FACOM já pertence a uma unidade vigente.',
        code: 'uniplus.unidade.sigla_duplicada',
        traceId: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
      },
      {
        status: 409,
        statusText: 'Conflict',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );

    expect(component['saving']()).toBe(false);
    expect(component['formError']()).toBe('Sigla já utilizada por outra unidade viva');
    // Sem a renovação, o reenvio com sigla corrigida (body diferente) reusaria a
    // chave e cairia em body_mismatch, forçando um terceiro submit.
    expect(component['idempotencyKeyAtual']()).not.toBe(primeiraChave);
  });

  it('atualiza unidade sem enviar vigenciaInicio no command de update', async () => {
    await flushInicial();
    component['abrirEdicao']({ ...unidadesSeed[1], origem: 'ImportadoSIORG' });
    await flushOpcoesSuperior();
    component['form'].controls.nome.setValue('Instituto Renomeado');
    const key = component['idempotencyKeyAtual']();

    expect(component['form'].controls.origem.disabled).toBe(true);
    expect(component['form'].controls.origem.value).toBe('3');
    expect(component['origemEmEdicaoLabel']()).toBe('Importado SIORG');

    component['salvar']();

    const put = controller.expectOne(`${BASE}/api/admin/unidades/${INSTITUTO_ID}`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.headers.get('Idempotency-Key')).toBe(key);
    expect(put.request.body).not.toHaveProperty('vigenciaInicio');
    expect(put.request.body).not.toHaveProperty('origem');
    expect(put.request.body).toMatchObject({
      id: INSTITUTO_ID,
      nome: 'Instituto Renomeado',
      tipo: 4,
    });
    put.flush(null, { status: 204, statusText: 'No Content' });
    expect(component['formOpen']()).toBe(false);

    await propagate();
    expectListGet().flush(unidadesSeed);
    await propagate();
  });

  it('preserva tipo Pro-Reitoria ao editar unidade', async () => {
    await flushInicial();
    component['abrirEdicao']({ ...unidadesSeed[1], tipo: 'Pro-Reitoria' });
    await flushOpcoesSuperior();
    component['form'].controls.nome.setValue('Pró-Reitoria Renomeada');

    expect(component['form'].controls.tipo.value).toBe('2');

    component['salvar']();

    const put = controller.expectOne(`${BASE}/api/admin/unidades/${INSTITUTO_ID}`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toMatchObject({
      id: INSTITUTO_ID,
      nome: 'Pró-Reitoria Renomeada',
      tipo: 2,
    });
    put.flush(null, { status: 204, statusText: 'No Content' });
    expect(component['formOpen']()).toBe(false);

    await propagate();
    expectListGet().flush(unidadesSeed);
    await propagate();
  });

  it('não coage tipo desconhecido para "Outro" ao editar — bloqueia o submit', async () => {
    await flushInicial();

    component['abrirEdicao']({ ...unidadesSeed[1], tipo: 'TipoInexistente' });
    await flushOpcoesSuperior();

    expect(component['form'].controls.tipo.value).toBe('');
    expect(component['tipoNaoReconhecido']()).toBe(true);
    expect(component['form'].controls.tipo.valid).toBe(false);

    // Escolher um tipo válido limpa o estado de "não reconhecido".
    component['form'].controls.tipo.setValue('5');
    expect(component['tipoNaoReconhecido']()).toBe(false);
    expect(component['form'].controls.tipo.valid).toBe(true);
  });

  it('preserva origem desconhecida ao editar e reabilita o campo ao criar', async () => {
    await flushInicial();

    component['abrirEdicao']({ ...unidadesSeed[1], origem: 'OrigemExterna' });
    await flushOpcoesSuperior();

    expect(component['form'].controls.origem.disabled).toBe(true);
    expect(component['form'].controls.origem.value).toBe('');
    expect(component['origemEmEdicaoLabel']()).toBe('OrigemExterna');

    component['abrirCadastro']();
    await flushOpcoesSuperior();

    expect(component['form'].controls.origem.enabled).toBe(true);
    expect(component['form'].controls.origem.value).toBe('2');
    expect(component['origemEmEdicaoLabel']()).toBe('');
  });

  it('remove unidade sem Idempotency-Key porque o endpoint DELETE não exige o header', async () => {
    await flushInicial();
    component['pedirRemocao'](unidadesSeed[1]);

    component['removerConfirmado']();

    const del = controller.expectOne(`${BASE}/api/admin/unidades/${INSTITUTO_ID}`);
    expect(del.request.method).toBe('DELETE');
    expect(del.request.headers.has('Idempotency-Key')).toBe(false);
    del.flush(null, { status: 204, statusText: 'No Content' });

    await propagate();
    expectListGet().flush([unidadesSeed[0]]);
    await propagate();

    expect(component['unidadeParaRemover']()).toBeNull();
  });

  it('busca de unidade superior consulta o backend com q e atualiza as opções (escala além de 1 página)', async () => {
    await flushInicial();
    component['abrirCadastro']();
    await flushOpcoesSuperior(); // GET inicial das opções (sem q)

    component['buscaPai'].set('inst');
    await sleep(DEBOUNCE_FOLGA_MS);
    await propagate();

    const request = expectListGet(
      (r) => r.params.get('q') === 'inst' && !r.params.has('cursor'),
    );
    request.flush([unidadesSeed[1]]);
    await propagate();

    expect(component['opcoesUnidadeSuperior']().map((u) => u.id)).toEqual([INSTITUTO_ID]);
  });

  it('permite tentar novamente quando uma página falha, sem perder o que já foi carregado', async () => {
    await flushInicial([unidadesSeed[0]], {
      Link: `<${BASE}/api/unidades?cursor=pagina-2>; rel="next"`,
    });
    expect(component['unidades']()).toHaveLength(1);

    component['carregarMais']();
    await propagate();
    expectListGet((r) => r.params.get('cursor') === 'pagina-2').flush(
      { type: 'about:blank', title: 'Erro interno', status: 500, code: 'uniplus.erro', traceId: 'x' },
      {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );
    await propagate();

    expect(component['unidades']()).toHaveLength(1); // mantém a página já carregada
    expect(component['errorMessage']()).not.toBeNull();

    component['tentarNovamente']();
    await propagate();
    const retry = expectListGet((r) => r.params.get('cursor') === 'pagina-2');
    retry.flush([unidadesSeed[1]]);
    await propagate();

    expect(component['unidades']()).toHaveLength(2); // acumulou após o retry
    expect(component['errorMessage']()).toBeNull();
  });

  it('limpa a lista quando o refetch pós-mutação falha, sem manter linhas desatualizadas', async () => {
    await flushInicial();
    expect(component['unidades']()).toHaveLength(2);

    component['pedirRemocao'](unidadesSeed[1]);
    component['removerConfirmado']();
    controller
      .expectOne(`${BASE}/api/admin/unidades/${INSTITUTO_ID}`)
      .flush(null, { status: 204, statusText: 'No Content' });

    await propagate();
    expectListGet().flush(
      { type: 'about:blank', title: 'Erro interno', status: 500, code: 'uniplus.erro', traceId: 'x' },
      {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );
    await propagate();

    expect(component['unidades']()).toHaveLength(0); // não mantém a linha removida
    expect(component['errorMessage']()).not.toBeNull();
  });

  it('sinaliza falha ao carregar as opções de unidade superior e permite retry', async () => {
    await flushInicial();
    component['abrirCadastro']();
    await propagate();
    expectListGet((r) => !r.params.has('q') && !r.params.has('cursor')).flush(
      { type: 'about:blank', title: 'Erro interno', status: 500, code: 'uniplus.erro', traceId: 'x' },
      {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );
    await propagate();

    expect(component['opcoesSuperiorComErro']()).toBe(true);
    expect(component['opcoesUnidadeSuperior']()).toHaveLength(0);

    component['recarregarOpcoesSuperior']();
    await propagate();
    expectListGet((r) => !r.params.has('q')).flush(unidadesSeed);
    await propagate();

    expect(component['opcoesSuperiorComErro']()).toBe(false);
    expect(component['opcoesUnidadeSuperior']()).toHaveLength(2);
  });

  it('marca a lista em recarga durante o refetch pós-mutação (ações de linha desabilitam)', async () => {
    await flushInicial();
    expect(component['recarregandoLista']()).toBe(false);

    component['pedirRemocao'](unidadesSeed[1]);
    component['removerConfirmado']();
    controller
      .expectOne(`${BASE}/api/admin/unidades/${INSTITUTO_ID}`)
      .flush(null, { status: 204, statusText: 'No Content' });

    await propagate();
    // Refetch pós-remoção pendente: a lista ainda mostra dados, mas em recarga.
    expect(component['recarregandoLista']()).toBe(true);

    expectListGet().flush([unidadesSeed[0]]);
    await propagate();

    expect(component['recarregandoLista']()).toBe(false);
    expect(component['unidades']()).toHaveLength(1);
  });

  it('resolve o rótulo do pai mesmo quando ele é filtrado para fora da página atual', async () => {
    await flushInicial(); // Reitoria + Instituto na carga inicial (alimenta o cache)

    component['tipoFiltro'].set('4'); // Instituto — o pai Reitoria sai da página
    await propagate();
    expectListGet((r) => r.params.get('tipo') === '4').flush([unidadesSeed[1]]);
    await propagate();

    expect(component['unidades']()).toHaveLength(1);
    expect(component['unidades']()[0].id).toBe(INSTITUTO_ID);
    // Reitoria não está na página filtrada, mas foi vista na carga inicial.
    expect(component['unidadeSuperiorLabel'](REITORIA_ID)).toBe('REITORIA — Reitoria');
  });
});
