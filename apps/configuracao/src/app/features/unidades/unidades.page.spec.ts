import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor, buildVendorMimeAccept } from '@uniplus/shared-core/http';
import { ORGANIZACAO_BASE_PATH, UnidadeDto } from '@uniplus/shared-data/organizacao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UnidadesPage } from './unidades.page';

const BASE = 'http://localhost:5000';
const REITORIA_ID = '01960000-0000-7000-0000-000000000001';
const INSTITUTO_ID = '01960000-0000-7000-0000-000000000002';

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
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  function flushList(unidades: readonly UnidadeDto[] = unidadesSeed): void {
    const req = controller.expectOne(
      (request) => request.url === `${BASE}/api/unidades` && request.params.get('limit') === '100',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('unidade', 1));
    req.flush(unidades);
  }

  it('carrega unidades na inicialização com limit 100 e monta hierarquia', () => {
    flushList();

    expect(component['unidades']()).toHaveLength(2);
    expect(component['arvore']()).toHaveLength(1);
    expect(component['arvore']()[0].children).toHaveLength(1);
  });

  it('filtra client-side por busca e tipo sem enviar query inexistente ao backend', () => {
    flushList();

    component['busca'].set('iedar');
    expect(component['unidadesFiltradas']()).toHaveLength(1);
    expect(component['unidadesFiltradas']()[0].id).toBe(INSTITUTO_ID);

    component['busca'].set('');
    component['tipoFiltro'].set('Instituto');
    expect(component['unidadesFiltradas']()).toHaveLength(1);
    expect(component['unidadesFiltradas']()[0].tipo).toBe('Instituto');
  });

  it('cria unidade com Idempotency-Key e recarrega a lista após sucesso', () => {
    flushList();
    component['abrirCadastro']();
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

    const req = controller.expectOne(`${BASE}/api/admin/unidades`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe(key);
    expect(req.request.body).toMatchObject({
      nome: 'Faculdade de Computação',
      alias: null,
      unidadeSuperiorId: INSTITUTO_ID,
      tipo: 5,
      origem: 2,
    });
    req.flush('01960000-0000-7000-0000-000000000099', { status: 201, statusText: 'Created' });

    flushList();
    expect(component['formOpen']()).toBe(false);
  });

  it('submete regra de vigência ao backend e exibe erro 422 inline no campo correspondente', () => {
    flushList();
    component['abrirCadastro']();
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

    const req = controller.expectOne(`${BASE}/api/admin/unidades`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe(primeiraChave);
    expect(req.request.body).toMatchObject({
      vigenciaInicio: '2026-06-10',
      vigenciaFim: '2026-06-02',
    });
    req.flush(
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

    flushList();
    expect(component['formOpen']()).toBe(false);
  });

  it('renova Idempotency-Key quando backend sinaliza body_mismatch', () => {
    flushList();
    component['abrirCadastro']();
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

  it('renova Idempotency-Key em 409 Conflict para permitir reenvio após corrigir identificador duplicado', () => {
    flushList();
    component['abrirCadastro']();
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

  it('atualiza unidade sem enviar vigenciaInicio no command de update', () => {
    flushList();
    component['abrirEdicao']({ ...unidadesSeed[1], origem: 'ImportadoSIORG' });
    component['form'].controls.nome.setValue('Instituto Renomeado');
    const key = component['idempotencyKeyAtual']();

    expect(component['form'].controls.origem.disabled).toBe(true);
    expect(component['form'].controls.origem.value).toBe('3');
    expect(component['origemEmEdicaoLabel']()).toBe('Importado SIORG');

    component['salvar']();

    const req = controller.expectOne(`${BASE}/api/admin/unidades/${INSTITUTO_ID}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('Idempotency-Key')).toBe(key);
    expect(req.request.body).not.toHaveProperty('vigenciaInicio');
    expect(req.request.body).not.toHaveProperty('origem');
    expect(req.request.body).toMatchObject({
      id: INSTITUTO_ID,
      nome: 'Instituto Renomeado',
      tipo: 4,
    });
    req.flush(null, { status: 204, statusText: 'No Content' });

    flushList();
    expect(component['formOpen']()).toBe(false);
  });

  it('preserva tipo Pro-Reitoria ao editar unidade', () => {
    flushList();
    component['abrirEdicao']({ ...unidadesSeed[1], tipo: 'Pro-Reitoria' });
    component['form'].controls.nome.setValue('Pró-Reitoria Renomeada');

    expect(component['form'].controls.tipo.value).toBe('2');

    component['salvar']();

    const req = controller.expectOne(`${BASE}/api/admin/unidades/${INSTITUTO_ID}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toMatchObject({
      id: INSTITUTO_ID,
      nome: 'Pró-Reitoria Renomeada',
      tipo: 2,
    });
    req.flush(null, { status: 204, statusText: 'No Content' });

    flushList();
    expect(component['formOpen']()).toBe(false);
  });

  it('não coage tipo desconhecido para "Outro" ao editar — bloqueia o submit', () => {
    flushList();

    component['abrirEdicao']({ ...unidadesSeed[1], tipo: 'TipoInexistente' });

    expect(component['form'].controls.tipo.value).toBe('');
    expect(component['tipoNaoReconhecido']()).toBe(true);
    expect(component['form'].controls.tipo.valid).toBe(false);

    // Escolher um tipo válido limpa o estado de "não reconhecido".
    component['form'].controls.tipo.setValue('5');
    expect(component['tipoNaoReconhecido']()).toBe(false);
    expect(component['form'].controls.tipo.valid).toBe(true);
  });

  it('preserva origem desconhecida ao editar e reabilita o campo ao criar', () => {
    flushList();

    component['abrirEdicao']({ ...unidadesSeed[1], origem: 'OrigemExterna' });

    expect(component['form'].controls.origem.disabled).toBe(true);
    expect(component['form'].controls.origem.value).toBe('');
    expect(component['origemEmEdicaoLabel']()).toBe('OrigemExterna');

    component['abrirCadastro']();

    expect(component['form'].controls.origem.enabled).toBe(true);
    expect(component['form'].controls.origem.value).toBe('2');
    expect(component['origemEmEdicaoLabel']()).toBe('');
  });

  it('remove unidade sem Idempotency-Key porque o endpoint DELETE não exige o header', () => {
    flushList();
    component['pedirRemocao'](unidadesSeed[1]);

    component['removerConfirmado']();

    const req = controller.expectOne(`${BASE}/api/admin/unidades/${INSTITUTO_ID}`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.headers.has('Idempotency-Key')).toBe(false);
    req.flush(null, { status: 204, statusText: 'No Content' });

    flushList([unidadesSeed[0]]);
    expect(component['unidadeParaRemover']()).toBeNull();
  });
});
