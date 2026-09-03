import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, TipoProcessoDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TiposProcessoPage } from './tipos-processo.page';

const BASE = 'http://localhost:5000';

const tipoSeed: TipoProcessoDto = {
  id: '01960000-0000-7000-0000-000000000051',
  codigo: 'SISU',
  nome: 'SiSU',
  descricao: 'Sistema de Seleção Unificada.',
  ativo: true,
  criadoEm: '2026-08-11T12:00:00Z',
};

describe('TiposProcessoPage', () => {
  let fixture: ComponentFixture<TiposProcessoPage>;
  let component: TiposProcessoPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TiposProcessoPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(TiposProcessoPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const propagate = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
  };

  async function flushLista(itens: readonly TipoProcessoDto[]): Promise<void> {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-processo`);
    expect(req.request.params.get('limit')).toBe('50');
    req.flush(itens);
    await propagate();
  }

  it('renderiza a lista de tipos de processo', async () => {
    await flushLista([tipoSeed]);
    expect(component['tipos']()).toHaveLength(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('SiSU');
    expect(fixture.nativeElement.textContent).toContain('SISU');
  });

  it('banner de código imutável é visível mesmo com lista vazia', async () => {
    await flushLista([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Código imutável após criação');
  });

  it('CA-01: cria um tipo de processo com código, nome e descrição', async () => {
    await flushLista([]);
    component['abrirCadastro']();

    component['form'].setValue({
      codigo: 'ENEM',
      nome: 'ENEM',
      descricao: 'Ingresso via nota do ENEM.',
    });
    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-processo`);
    expect(post.request.method).toBe('POST');
    expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
    expect(post.request.body).toMatchObject({
      codigo: 'ENEM',
      nome: 'ENEM',
      descricao: 'Ingresso via nota do ENEM.',
    });
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([tipoSeed]);
    expect(component['formOpen']()).toBe(false);
  });

  it('CA-02: código é readonly na edição e o payload de atualização não inclui o campo codigo', async () => {
    await flushLista([tipoSeed]);
    component['abrirEdicao'](tipoSeed);

    expect(component['form'].controls.codigo.value).toBe('SISU');
    fixture.detectChanges();
    const codigoInput = fixture.nativeElement.querySelector(
      '[formcontrolname="codigo"]',
    ) as HTMLInputElement;
    expect(codigoInput.readOnly).toBe(true);

    component['form'].controls.nome.setValue('Sistema de Seleção Unificada');
    component['salvar']();

    const put = controller.expectOne(
      `${BASE}/api/configuracao/admin/tipos-processo/${tipoSeed.id}`,
    );
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).not.toHaveProperty('codigo');
    expect(put.request.body).toMatchObject({
      id: tipoSeed.id,
      nome: 'Sistema de Seleção Unificada',
    });
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([tipoSeed]);
  });

  it('CA-03: código duplicado (409) é rejeitado com erro no campo sem fechar o drawer', async () => {
    await flushLista([]);
    component['abrirCadastro']();

    component['form'].setValue({ codigo: 'SISU', nome: 'SiSU (dup)', descricao: '' });
    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-processo`);
    post.flush(
      {
        type: 'https://uniplus.dev/erros/uniplus.configuracao.tipo_processo.codigo_ja_existe',
        title: 'Código do tipo de processo seletivo já está reservado',
        status: 409,
        code: 'uniplus.configuracao.tipo_processo.codigo_ja_existe',
      },
      {
        status: 409,
        statusText: 'Conflict',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );
    await propagate();

    expect(component['formOpen']()).toBe(true);
    expect(component['erroDoCampo']('codigo')).toContain('já está reservado');
    expect(component['formError']()).toBeNull();
  });

  it('CA-04: inativa um tipo de processo após confirmação e recarrega a lista', async () => {
    await flushLista([tipoSeed]);
    component['pedirRemocao'](tipoSeed);
    component['removerConfirmado']();

    const req = controller.expectOne(
      `${BASE}/api/configuracao/admin/tipos-processo/${tipoSeed.id}`,
    );
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([]);
    expect(component['confirmOpen']()).toBe(false);
  });

  it('tipo já desativado (422) mantém o diálogo aberto com a mensagem da API', async () => {
    await flushLista([tipoSeed]);
    component['pedirRemocao'](tipoSeed);
    component['removerConfirmado']();

    const req = controller.expectOne(
      `${BASE}/api/configuracao/admin/tipos-processo/${tipoSeed.id}`,
    );
    req.flush(
      {
        type: 'https://uniplus.dev/erros/uniplus.configuracao.tipo_processo.ja_desativado',
        title: 'Tipo de processo seletivo já está desativado',
        status: 422,
        code: 'uniplus.configuracao.tipo_processo.ja_desativado',
      },
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );
    await propagate();

    expect(component['confirmOpen']()).toBe(true);
    expect(component['confirmMessage']()).toContain('já está desativado');
  });
});
