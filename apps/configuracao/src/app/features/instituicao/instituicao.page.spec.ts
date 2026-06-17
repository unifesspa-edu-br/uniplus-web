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
import { InstituicaoDto, ORGANIZACAO_BASE_PATH, UnidadeDto } from '@uniplus/shared-data/organizacao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InstituicaoPage } from './instituicao.page';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-0000000000a1';
const REITORIA_ID = '01960000-0000-7000-0000-000000000001';

const reitoriasSeed: readonly UnidadeDto[] = [
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
];

const instituicaoSeed: InstituicaoDto = {
  id: ID,
  codigoEmec: '3990',
  nome: 'Universidade Federal do Sul e Sudeste do Pará',
  sigla: 'Unifesspa',
  organizacaoAcademica: 'Universidade',
  categoriaAdministrativa: 'Pública Federal',
  cnpj: null,
  mantenedora: null,
  codigoMantenedoraEmec: null,
  situacao: null,
  atoCredenciamento: null,
  atoRecredenciamento: null,
  conceitoInstitucional: null,
  igc: null,
  website: null,
  enderecoSede: null,
  municipioSede: null,
  unidadeRaizId: REITORIA_ID,
  criadoEm: '2026-06-10T12:00:00Z',
};

function problem(status: number, code: string, title: string): string {
  return JSON.stringify({
    type: `https://uniplus.unifesspa.edu.br/errors/${code}`,
    title,
    status,
    code,
    traceId: 'test-trace',
  });
}

describe('InstituicaoPage', () => {
  let fixture: ComponentFixture<InstituicaoPage>;
  let component: InstituicaoPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [InstituicaoPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
      ],
    });

    fixture = TestBed.createComponent(InstituicaoPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
  });

  afterEach(() => controller.verify());

  const propagate = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
  };

  function expectObter(): TestRequest {
    const req = controller.expectOne(`${BASE}/api/instituicao`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('instituicao', 1));
    return req;
  }

  function expectReitorias(): TestRequest {
    return controller.expectOne(
      (r: HttpRequest<unknown>) =>
        r.url === `${BASE}/api/unidades` && r.method === 'GET' && r.params.get('tipo') === '1',
    );
  }

  // Carga inicial. `obter()` dispara no construtor; reitorias no detectChanges.
  async function carregar(
    instituicao: InstituicaoDto | null,
    reitorias: readonly UnidadeDto[] = reitoriasSeed,
  ): Promise<void> {
    fixture.detectChanges();
    const obter = expectObter();
    if (instituicao) {
      obter.flush(instituicao);
    } else {
      obter.flush(null, { status: 404, statusText: 'Not Found' });
    }
    expectReitorias().flush(reitorias);
    await propagate();
  }

  function preencherObrigatorios(): void {
    component.form.patchValue({
      nome: 'Universidade Federal do Sul e Sudeste do Pará',
      sigla: 'Unifesspa',
      codigoEmec: '3990',
      organizacaoAcademica: 'Universidade',
      categoriaAdministrativa: 'Pública Federal',
    });
  }

  it('InstituicaoPage_ModoLeitura_Exibe7Secoes', async () => {
    await carregar(instituicaoSeed);

    const ficha = fixture.nativeElement.querySelector('.cfg-instituicao__ficha');
    expect(ficha).not.toBeNull();
    expect(ficha.querySelectorAll('h3.form-section__title')).toHaveLength(7);

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Registro único');
    expect(texto).toContain('Universidade Federal do Sul e Sudeste do Pará');
    expect(texto).not.toContain('Nenhuma instituição cadastrada');
  });

  it('InstituicaoPage_ModoCriacao_ExibeEmptyState', async () => {
    await carregar(null);

    expect(fixture.nativeElement.querySelector('.cfg-instituicao__ficha')).toBeNull();
    expect(fixture.nativeElement.querySelector('ui-empty-state')).not.toBeNull();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Registro único');
    expect(texto).toContain('Nenhuma instituição cadastrada');
  });

  it('InstituicaoPage_CampoOpcionalVazio_ExibeDash', async () => {
    await carregar(instituicaoSeed);

    const ficha = fixture.nativeElement.querySelector('.cfg-instituicao__ficha') as HTMLElement;
    // CNPJ é null no seed → exibe travessão.
    expect(ficha.textContent).toContain('—');
    // Unidade raiz resolve para o rótulo da reitoria carregada.
    expect(ficha.textContent).toContain('REITORIA — Reitoria');
  });

  it('InstituicaoForm_SelectReitoria_PopulaOptions', async () => {
    await carregar(null);
    expect(component.reitorias()).toHaveLength(1);
    expect(component.reitorias()[0]?.sigla).toBe('REITORIA');
  });

  it('InstituicaoForm_CamposObrigatorios_MarcaErros', async () => {
    await carregar(null);
    component.abrirCadastro();
    component.salvar();
    await propagate();

    // Nenhuma request de POST disparada (form inválido).
    controller.expectNone(`${BASE}/api/admin/instituicao`);
    expect(component.erroDoCampo('nome')).toBe('Campo obrigatório.');
    expect(component.erroDoCampo('codigoEmec')).toBe('Campo obrigatório.');
    expect(component.drawerAberto()).toBe(true);
  });

  it('InstituicaoForm_ErroSingleton_ExibeBanner', async () => {
    await carregar(null);
    component.abrirCadastro();
    preencherObrigatorios();
    component.salvar();
    await propagate();

    const req = controller.expectOne(`${BASE}/api/admin/instituicao`);
    expect(req.request.method).toBe('POST');
    req.flush(
      problem(409, 'uniplus.organizacao.instituicao.ja_existe', 'Já existe'),
      { status: 409, statusText: 'Conflict', headers: { 'content-type': 'application/problem+json' } },
    );
    await propagate();

    expect(component.submitError()).toContain('Já existe uma instituição cadastrada');
    expect(component.drawerAberto()).toBe(true);
  });

  it('InstituicaoForm_ErroUnidadeRaiz_MapeiaCampo', async () => {
    await carregar(instituicaoSeed);
    component.abrirEdicao();
    const chaveInicial = component.idempotencyKeyAtual();
    component.salvar();
    await propagate();

    const req = controller.expectOne(`${BASE}/api/admin/instituicao/${ID}`);
    expect(req.request.method).toBe('PUT');
    req.flush(
      problem(
        422,
        'uniplus.organizacao.instituicao.unidade_raiz_nao_eh_reitoria',
        'A unidade informada como raiz da instituição deve ser do tipo reitoria',
      ),
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();

    expect(component.erroDoCampo('unidadeRaizId')).toContain('reitoria');
    // Idempotency-Key é renovada após a falha (retry seguro com body corrigido).
    expect(component.idempotencyKeyAtual()).not.toBe(chaveInicial);
  });

  it('InstituicaoForm_Criar_RequisicaoCorreta', async () => {
    await carregar(null);
    component.abrirCadastro();
    preencherObrigatorios();
    const chave = component.idempotencyKeyAtual();
    component.salvar();
    await propagate();

    const req = controller.expectOne(`${BASE}/api/admin/instituicao`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe(chave);
    expect(req.request.body).toMatchObject({
      codigoEmec: '3990',
      nome: 'Universidade Federal do Sul e Sudeste do Pará',
      sigla: 'Unifesspa',
      organizacaoAcademica: 'Universidade',
      categoriaAdministrativa: 'Pública Federal',
      cnpj: null,
      unidadeRaizId: null,
    });
    req.flush(ID, { status: 201, statusText: 'Created' });
    await propagate();

    // Pós-sucesso: drawer fecha e recarrega o singleton (`obter()`); o resource
    // de reitorias não re-dispara (params inalterados, sem reload).
    expect(component.drawerAberto()).toBe(false);
    expectObter().flush(instituicaoSeed);
    await propagate();
    expect(component.instituicao()?.sigla).toBe('Unifesspa');
  });

  it('InstituicaoPage_Remocao_RetornaModoCriacao', async () => {
    await carregar(instituicaoSeed);
    component.abrirEdicao();
    component.pedirRemocao();
    expect(component.dialogRemover()).toBe(true);

    component.removerConfirmado();
    await propagate();

    const req = controller.expectOne(`${BASE}/api/admin/instituicao/${ID}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();

    expect(component.instituicao()).toBeNull();
    expect(component.drawerAberto()).toBe(false);
    expect(fixture.nativeElement.querySelector('ui-empty-state')).not.toBeNull();
  });
});
