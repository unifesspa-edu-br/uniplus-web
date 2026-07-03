import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, TipoDocumentoDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TiposDocumentoListPage } from './tipos-documento-list.page';

const BASE = 'http://localhost:5000';

const rgSeed: TipoDocumentoDto = {
  id: '01960000-0000-7000-0000-0000000000d1',
  codigo: 'RG',
  nome: 'Registro Geral',
  descricao: 'Documento de identificação civil.',
  categoria: 'IDENTIFICACAO',
  formatosAceitos: 'pdf,jpg',
  tamanhoMaximoMb: 10,
  tipoEquivalente: 'CIN',
  criadoEm: '2026-06-10T12:00:00Z',
};

const laudoSeed: TipoDocumentoDto = {
  id: '01960000-0000-7000-0000-0000000000d2',
  codigo: 'LAUDO_MEDICO',
  nome: 'Laudo médico — PcD',
  descricao: null,
  categoria: 'SAUDE',
  formatosAceitos: null,
  tamanhoMaximoMb: null,
  tipoEquivalente: null,
  criadoEm: '2026-06-11T12:00:00Z',
};

describe('TiposDocumentoListPage', () => {
  let fixture: ComponentFixture<TiposDocumentoListPage>;
  let component: TiposDocumentoListPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TiposDocumentoListPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(TiposDocumentoListPage);
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

  async function flushLista(itens: readonly TipoDocumentoDto[]): Promise<void> {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-documento`);
    req.flush(itens);
    await propagate();
  }

  // TiposDocumentoListPage_Renderizacao
  it('renderiza a lista com colunas, chips de categoria e paginador', async () => {
    await flushLista([rgSeed, laudoSeed]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('RG');
    expect(fixture.nativeElement.textContent).toContain('Registro Geral');
    expect(fixture.nativeElement.textContent).toContain('Equiv.:');
    expect(fixture.nativeElement.textContent).toContain('CIN');
    expect(component['categoriaChips']().length).toBe(8);
  });

  // TiposDocumentoListPage_FiltroPorCategoria
  it('CA-01: chip de categoria filtra a lista e reflete o contador do conjunto atual', async () => {
    await flushLista([rgSeed, laudoSeed]);

    expect(component['documentosFiltrados']()).toHaveLength(2);
    component['filtroCategoria'].set('SAUDE');
    fixture.detectChanges();

    expect(component['documentosFiltrados']()).toHaveLength(1);
    expect(component['documentosFiltrados']()[0].codigo).toBe('LAUDO_MEDICO');
    const chipSaude = component['categoriaChips']().find((c) => c.value === 'SAUDE');
    expect(chipSaude?.count).toBe(1);
  });

  // TiposDocumentoListPage_BuscaPorTexto
  it('busca por texto filtra registros por código e nome', async () => {
    await flushLista([rgSeed, laudoSeed]);

    component['termoBusca'].set('LAUDO');
    fixture.detectChanges();

    expect(component['documentosFiltrados']()).toHaveLength(1);
    expect(component['documentosFiltrados']()[0].nome).toBe('Laudo médico — PcD');
  });

  // TiposDocumentoListPage_EmptyState
  it('exibe empty-state quando a busca não retorna resultados', async () => {
    await flushLista([rgSeed]);

    component['termoBusca'].set('XYZNOTFOUND');
    fixture.detectChanges();

    expect(component['documentosFiltrados']()).toHaveLength(0);
    expect(component['temFiltro']()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Nenhum tipo de documento encontrado');
    expect(fixture.nativeElement.textContent).toContain('Limpar filtros');
  });

  it('exibe empty-state de cadastro inicial quando não há filtro ativo', async () => {
    await flushLista([]);
    fixture.detectChanges();

    expect(component['temFiltro']()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Nenhum tipo de documento cadastrado');
  });

  // TipoDocumentoForm_CamposObrigatorios
  it('bloqueia salvar com campos obrigatórios vazios', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    fixture.detectChanges();

    component['salvar']();

    controller.expectNone(`${BASE}/api/configuracao/admin/tipos-documento`);
    expect(component['form'].controls.codigo.errors?.['required']).toBeTruthy();
    expect(component['form'].controls.nome.errors?.['required']).toBeTruthy();
    expect(component['form'].controls.categoria.errors?.['required']).toBeTruthy();
  });

  // TipoDocumentoForm_CodigoDuplicado_422MapeaCampo (via TiposDocumentoListPage_Erro422_MapeaCampo)
  it('CA-03: código duplicado (409) é mapeado ao campo Código sem fechar o drawer', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    component['form'].patchValue({ codigo: 'RG', nome: 'Registro Geral (dup)', categoria: 'IDENTIFICACAO' });
    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-documento`);
    post.flush(
      JSON.stringify({
        type: 'https://uniplus.dev/erros/uniplus.configuracao.tipo_documento.codigo_ja_existe',
        title: 'Já existe um tipo de documento ativo com este código',
        status: 409,
        code: 'uniplus.configuracao.tipo_documento.codigo_ja_existe',
        traceId: 'test-trace',
      }),
      {
        status: 409,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();

    expect(component['formOpen']()).toBe(true);
    expect(component['form'].controls.codigo.errors?.['backend']).toBeTruthy();
  });

  // TipoDocumentoForm_TipoEquivalenteIgualCodigo_MarcaErro
  it('CA-05: tipo equivalente igual ao código é rejeitado no cliente sem chamar o backend', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    component['form'].patchValue({ codigo: 'RG', tipoEquivalente: 'RG' });
    fixture.detectChanges();

    expect(component['tipoEquivalenteIgualCodigo']()).toBe(true);
    expect(component['erroDoCampo']('tipoEquivalente')).toBe(
      'O tipo equivalente não pode ser igual ao próprio código.',
    );

    component['salvar']();
    controller.expectNone(`${BASE}/api/configuracao/admin/tipos-documento`);
  });

  it('tipo equivalente diferente do código não gera erro e permite salvar', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    component['form'].patchValue({ codigo: 'RG', tipoEquivalente: 'CIN' });
    fixture.detectChanges();

    expect(component['tipoEquivalenteIgualCodigo']()).toBe(false);
    expect(component['erroDoCampo']('tipoEquivalente')).toBeNull();
  });

  // TipoDocumentoForm_TamanhoMaximoNaoPositivo_Invalido
  it('CA-06: tamanho máximo zero ou negativo é inválido; valor positivo é aceito', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    component['form'].controls.tamanhoMaximoMb.setValue(0);
    component['form'].controls.tamanhoMaximoMb.markAsTouched();
    expect(component['form'].controls.tamanhoMaximoMb.invalid).toBe(true);

    component['form'].controls.tamanhoMaximoMb.setValue(-5);
    expect(component['form'].controls.tamanhoMaximoMb.invalid).toBe(true);

    component['form'].controls.tamanhoMaximoMb.setValue(10);
    expect(component['form'].controls.tamanhoMaximoMb.invalid).toBe(false);

    component['form'].controls.tamanhoMaximoMb.setValue(null);
    expect(component['form'].controls.tamanhoMaximoMb.invalid).toBe(false);
  });

  // TipoDocumentoForm_SerializaFormatosParaString
  it('serializa checkboxes de formato marcados para a string "pdf,jpg,png"', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    component['form'].patchValue({
      codigo: 'DECL',
      nome: 'Declaração',
      categoria: 'OUTROS',
      formatoPdf: true,
      formatoJpeg: true,
      formatoPng: true,
      formatoTiff: false,
    });
    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-documento`);
    expect(post.request.body.formatosAceitos).toBe('pdf,jpg,png');
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([]);
  });

  it('nenhum formato marcado serializa para null', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    component['form'].patchValue({ codigo: 'DECL2', nome: 'Declaração 2', categoria: 'OUTROS' });
    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-documento`);
    expect(post.request.body.formatosAceitos).toBeNull();
    post.flush('new-id-2', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([]);
  });

  // TipoDocumentoForm_DesserializaStringParaCheckboxes
  it('desserializa a string "pdf,jpg,png" para os checkboxes marcados ao abrir edição', async () => {
    await flushLista([rgSeed]);
    component['abrirEdicao'](rgSeed);
    fixture.detectChanges();

    expect(component['form'].controls.formatoPdf.value).toBe(true);
    expect(component['form'].controls.formatoJpeg.value).toBe(true);
    expect(component['form'].controls.formatoPng.value).toBe(false);
    expect(component['form'].controls.formatoTiff.value).toBe(false);
  });

  // TiposDocumentoListPage_IdempotencyKeyFormScoped
  it('abertura do drawer define nova idempotencyKey; fechar sem salvar não reseta a chave', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    const chaveInicial = component['idempotencyKeyAtual']();
    expect(chaveInicial).toBeTruthy();

    component['formOpen'].set(false);
    expect(component['idempotencyKeyAtual']()).toBe(chaveInicial);
  });

  // TiposDocumentoListPage_CriarSucesso_FechaDrawerRecarregaLista
  it('CA-02: sucesso no criar fecha o drawer e recarrega a lista', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    component['form'].patchValue({
      codigo: 'DECL_LIDERANCA',
      nome: 'Declaração de liderança',
      categoria: 'OUTROS',
    });
    const key = component['idempotencyKeyAtual']();

    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-documento`);
    expect(post.request.method).toBe('POST');
    expect(post.request.headers.get('Idempotency-Key')).toBe(key);
    expect(post.request.body).toMatchObject({
      codigo: 'DECL_LIDERANCA',
      nome: 'Declaração de liderança',
      categoria: 'OUTROS',
    });
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();

    await flushLista([rgSeed]);
    expect(component['formOpen']()).toBe(false);
  });

  // TiposDocumentoListPage_Erro422_MapeaCampo
  it('erro 422 com errors[] é mapeado ao FormControl correto', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    component['form'].patchValue({ codigo: 'RG', nome: 'Registro Geral', categoria: 'IDENTIFICACAO' });
    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-documento`);
    post.flush(
      JSON.stringify({
        type: 'https://uniplus.dev/erros/uniplus.validacao',
        title: 'Erro de validação',
        status: 422,
        code: 'uniplus.validacao',
        traceId: 'test-trace',
        errors: [{ field: 'Nome', code: 'MaximumLengthValidator', message: 'Nome muito longo.' }],
      }),
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();

    expect(component['form'].controls.nome.errors?.['backend']).toMatchObject({
      message: 'Nome muito longo.',
    });
  });

  // TiposDocumentoListPage_Erro5xx_BannerGeral
  it('erro 5xx exibe banner de alerta geral e notificação com traceId', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    component['form'].patchValue({ codigo: 'RG', nome: 'Registro Geral', categoria: 'IDENTIFICACAO' });
    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-documento`);
    post.flush(
      JSON.stringify({
        type: 'https://uniplus.dev/erros/uniplus.erro_interno',
        title: 'Erro interno inesperado',
        status: 500,
        code: 'uniplus.erro_interno',
        traceId: 'trace-500',
      }),
      {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();
    fixture.detectChanges();

    expect(component['formError']()).toBe('Erro interno inesperado');
    expect(fixture.nativeElement.textContent).toContain('Erro interno inesperado');
  });

  // TiposDocumentoListPage_ModalInativacao_ExibeNomeENota
  it('CA-07: modal de inativação exibe o nome do tipo e a nota de imunidade RN08', async () => {
    await flushLista([rgSeed]);
    component['pedirInativacao'](rgSeed);
    fixture.detectChanges();

    expect(component['confirmInativarMensagem']()).toContain('Registro Geral');
    expect(component['confirmInativarMensagem']()).toContain('RG');
    expect(component['confirmInativarMensagem']()).toContain(
      'Editais já publicados que o referenciam não são afetados',
    );
    expect(component['confirmInativarMensagem']()).toContain('RN08');
  });

  // TiposDocumentoListPage_ModalInativacao_ConfirmaRemove
  it('CA-07/CA-08: confirmação no modal dispara remover sem checagem prévia e atualiza a lista', async () => {
    await flushLista([rgSeed]);
    component['pedirInativacao'](rgSeed);
    component['confirmarInativacao']();

    const req = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-documento/${rgSeed.id}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();

    await flushLista([]);
    expect(component['confirmInativarAberto']()).toBe(false);
  });
});
