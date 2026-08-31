import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  type CategoriaDocumentoDto,
  TipoDocumentoDto,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TiposDocumentoListPage } from './tipos-documento-list.page';

const BASE = 'http://localhost:5000';
const URL_CATEGORIAS = `${BASE}/api/configuracao/categorias-documento`;

/** As dez categorias semeadas pelo cadastro (uniplus-api#1342). */
const CATEGORIAS: readonly CategoriaDocumentoDto[] = [
  ['IDENTIFICACAO', 'Identificação', 1],
  ['ESCOLARIDADE', 'Escolaridade', 2],
  ['TITULACAO_EXPERIENCIA', 'Titulação e experiência', 3],
  ['RENDA', 'Renda', 4],
  ['RESIDENCIA', 'Residência', 5],
  ['RACA_ETNIA', 'Raça/etnia', 6],
  ['SAUDE', 'Saúde', 7],
  ['DOCUMENTO_PROCESSUAL', 'Documento processual', 8],
  ['PRODUCAO_AVALIATIVA', 'Produção avaliativa', 9],
  ['OUTROS', 'Outros', 10],
].map(([codigo, nome, ordem]) => ({
  id: `ca7e0000-0000-7000-8000-${String(ordem).padStart(12, '0')}`,
  codigo: codigo as string,
  nome: nome as string,
  descricao: null,
  ordem: ordem as number,
  criadoEm: '2026-01-01T00:00:00Z',
}));

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

/** Tipo numa das três categorias que o roster escrito à mão não conhecia. */
const diplomaSeed: TipoDocumentoDto = {
  id: '01960000-0000-7000-0000-0000000000d3',
  codigo: 'DIPLOMA_GRADUACAO',
  nome: 'Diploma de graduação',
  descricao: null,
  categoria: 'TITULACAO_EXPERIENCIA',
  formatosAceitos: 'pdf',
  tamanhoMaximoMb: null,
  tipoEquivalente: null,
  criadoEm: '2026-08-30T12:00:00Z',
};

/** Tipo cuja categoria saiu do cadastro depois de já tê-lo classificado. */
const orfaoSeed: TipoDocumentoDto = {
  id: '01960000-0000-7000-0000-0000000000d4',
  codigo: 'CERTIDAO_MILITAR',
  nome: 'Certidão militar',
  descricao: null,
  categoria: 'DOCUMENTO_MILITAR',
  formatosAceitos: null,
  tamanhoMaximoMb: null,
  tipoEquivalente: null,
  criadoEm: '2026-08-30T13:00:00Z',
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

  /**
   * Atende o catálogo de categorias, se ainda estiver pendente. A página o
   * pede no construtor, então toda montagem tem esta requisição em voo; os
   * testes que precisam de outro desfecho a atendem antes de chamar
   * `flushLista`.
   */
  function flushCategorias(itens: readonly CategoriaDocumentoDto[] = CATEGORIAS): void {
    for (const req of controller.match(URL_CATEGORIAS)) {
      req.flush(itens);
    }
  }

  function recusarCategorias(): void {
    for (const req of controller.match(URL_CATEGORIAS)) {
      req.flush(
        { title: 'Serviço indisponível', status: 503 },
        { status: 503, statusText: 'Service Unavailable' },
      );
    }
  }

  async function flushLista(itens: readonly TipoDocumentoDto[]): Promise<void> {
    flushCategorias();
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
    expect(component['categoriaChips']().length).toBe(CATEGORIAS.length + 1);
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
  // ---------------------------------------------------------------------------
  // Cenários da issue #651 — o vocabulário de categoria passa a vir do cadastro
  // ---------------------------------------------------------------------------

  // Cenário: Formulário oferece as categorias vindas do cadastro
  it('CA-02: o select de Categoria oferece as categorias do cadastro, com o nome do cadastro', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    fixture.detectChanges();

    const opcoes: HTMLOptionElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('select[formControlName="categoria"] option'),
    );
    // As dez do cadastro mais o "Selecione…".
    expect(opcoes).toHaveLength(CATEGORIAS.length + 1);
    expect(opcoes.map((o) => o.value)).toContain('DOCUMENTO_PROCESSUAL');
    expect(opcoes.find((o) => o.value === 'TITULACAO_EXPERIENCIA')?.textContent?.trim()).toBe(
      'Titulação e experiência',
    );
  });

  // Cenário: Cadastro em categoria nova conclui
  it('CA-02: cadastro numa das categorias novas envia o código e conclui', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    component['form'].patchValue({
      codigo: 'RECURSO_ADMINISTRATIVO',
      nome: 'Recurso administrativo',
      categoria: 'DOCUMENTO_PROCESSUAL',
    });
    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-documento`);
    expect(post.request.body.categoria).toBe('DOCUMENTO_PROCESSUAL');
    post.flush('novo-id', { status: 201, statusText: 'Created' });
    await propagate();

    await flushLista([{ ...diplomaSeed, categoria: 'DOCUMENTO_PROCESSUAL' }]);
    fixture.detectChanges();
    expect(component['formOpen']()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Documento processual');
  });

  // Cenário: Listagem não exibe token cru
  it('CA-04: a coluna Categoria exibe o nome do cadastro, não o token em caixa alta', async () => {
    await flushLista([diplomaSeed]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Titulação e experiência');
    expect(fixture.nativeElement.textContent).not.toContain('TITULACAO_EXPERIENCIA');
  });

  // Cenário: Filtro cobre todos os tipos do catálogo
  it('CA-04: todo tipo carregado aparece em pelo menos um chip de categoria', async () => {
    await flushLista([rgSeed, laudoSeed, diplomaSeed, orfaoSeed]);
    fixture.detectChanges();

    const especificos = component['categoriaChips']().filter((chip) => chip.value !== '');
    for (const tipo of [rgSeed, laudoSeed, diplomaSeed, orfaoSeed]) {
      const cobre = especificos.filter((chip) => {
        component['filtroCategoria'].set(chip.value);
        return component['documentosFiltrados']().some((item) => item.id === tipo.id);
      });
      expect(cobre.length, `${tipo.codigo} ficou fora de todos os chips`).toBeGreaterThan(0);
    }
  });

  // Cenário: Categoria criada no cadastro aparece sem mudança de código
  it('CA-03: categoria criada no cadastro ganha opção e chip sem alteração de código', async () => {
    const comMilitar: readonly CategoriaDocumentoDto[] = [
      ...CATEGORIAS,
      {
        id: 'ca7e0000-0000-7000-8000-000000000011',
        codigo: 'DOCUMENTO_MILITAR',
        nome: 'Documento militar',
        descricao: null,
        ordem: 11,
        criadoEm: '2026-08-30T00:00:00Z',
      },
    ];
    flushCategorias(comMilitar);
    await flushLista([orfaoSeed]);
    component['abrirCadastro']();
    fixture.detectChanges();

    const valores: string[] = Array.from(
      fixture.nativeElement.querySelectorAll('select[formControlName="categoria"] option'),
    ).map((o) => (o as HTMLOptionElement).value);
    expect(valores).toContain('DOCUMENTO_MILITAR');
    expect(component['categoriaChips']().map((c) => c.label)).toContain('Documento militar');
    // Conhecida pelo cadastro, a categoria não é mais órfã.
    expect(component['categoriaChips']().map((c) => c.label)).not.toContain('Fora do cadastro');
  });

  // Cenário: Categoria removida não quebra a listagem
  it('CA-05: categoria fora do cadastro mantém a linha, sem token cru nem célula vazia', async () => {
    await flushLista([orfaoSeed]);
    fixture.detectChanges();

    expect(component['documentosFiltrados']()).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Certidão militar');
    expect(component['categoriaDoTipo']('DOCUMENTO_MILITAR').estado).toBe('ausente');

    const celula: HTMLElement = fixture.nativeElement.querySelector('td[data-label="Categoria"]');
    expect(celula.textContent?.trim()).toBe('Não identificado');

    // E continua alcançável pela navegação por categoria.
    const chipOrfaos = component['categoriaChips']().find((c) => c.label === 'Fora do cadastro');
    expect(chipOrfaos?.count).toBe(1);
    component['filtroCategoria'].set(chipOrfaos?.value ?? '');
    expect(component['documentosFiltrados']()).toHaveLength(1);
  });

  it('CA-05: editar um tipo de categoria removida preserva o código no select em vez de apagá-lo', async () => {
    await flushLista([orfaoSeed]);
    component['abrirEdicao'](orfaoSeed);
    fixture.detectChanges();

    expect(component['categoriaForaDasOpcoes']()).toBe('DOCUMENTO_MILITAR');
    const select: HTMLSelectElement = fixture.nativeElement.querySelector(
      'select[formControlName="categoria"]',
    );
    expect(select.value).toBe('DOCUMENTO_MILITAR');
    expect(component['dicaCategoria']()).toContain('não está mais no cadastro');
  });

  // Cenário: Falha ao carregar categorias é comunicada
  it('CA-06: recusa do catálogo é comunicada e a nova tentativa resolve sem recarregar a página', async () => {
    recusarCategorias();
    await flushLista([diplomaSeed]);
    fixture.detectChanges();

    expect(component['lookupsComFalha']()).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Rótulos não carregados');
    expect(component['categoriaDoTipo']('TITULACAO_EXPERIENCIA').estado).toBe('falhou');

    component['abrirCadastro']();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Categorias não carregadas');
    expect(component['dicaCategoria']()).toContain('não puderam ser carregadas');

    component['categorias'].recarregar();
    flushCategorias();
    fixture.detectChanges();

    expect(component['lookupsComFalha']()).toHaveLength(0);
    expect(component['categoriaDoTipo']('TITULACAO_EXPERIENCIA').rotulo).toBe(
      'Titulação e experiência',
    );
  });

  it('CA-06: enquanto o catálogo não chega, a coluna diz que está carregando', async () => {
    // A lista responde antes do catálogo — a ordem real quando o catálogo é o mais lento.
    const listaReq = controller.expectOne(
      (r) => r.url === `${BASE}/api/configuracao/tipos-documento`,
    );
    listaReq.flush([diplomaSeed]);
    await propagate();
    fixture.detectChanges();

    expect(component['categoriaDoTipo']('TITULACAO_EXPERIENCIA').estado).toBe('carregando');
    const celula: HTMLElement = fixture.nativeElement.querySelector('td[data-label="Categoria"]');
    expect(celula.textContent?.trim()).toBe('Carregando…');
    // Sem catálogo, nenhum registro é declarado órfão.
    expect(component['categoriaChips']().map((c) => c.label)).not.toContain('Fora do cadastro');

    flushCategorias();
  });

  /**
   * `aria-invalid` diz que há erro; sozinho, não diz **qual**. WCAG 2.1 AA
   * (3.3.1) pede a mensagem associada ao campo, e é o `aria-describedby` que
   * faz o leitor de tela lê-la ao focar — inclusive a dica que explica por que
   * o campo obrigatório está sem opções.
   */
  it('associa a dica e a mensagem de erro ao campo Categoria para leitor de tela', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    fixture.detectChanges();

    const select: HTMLSelectElement = fixture.nativeElement.querySelector(
      'select[formControlName="categoria"]',
    );
    expect(select.getAttribute('aria-describedby')).toBe('cfg-td-categoria-dica');
    expect(fixture.nativeElement.querySelector('#cfg-td-categoria-dica')).not.toBeNull();

    component['salvar']();
    fixture.detectChanges();

    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(select.getAttribute('aria-describedby')).toBe(
      'cfg-td-categoria-dica cfg-td-categoria-erro',
    );
    const erro: HTMLElement = fixture.nativeElement.querySelector('#cfg-td-categoria-erro');
    expect(erro.textContent?.trim()).not.toBe('');
  });

  it('limpa o chip selecionado quando a categoria correspondente sai do cadastro', async () => {
    await flushLista([rgSeed, laudoSeed]);
    component['filtroCategoria'].set('SAUDE');
    fixture.detectChanges();
    expect(component['documentosFiltrados']()).toHaveLength(1);

    component['categorias'].recarregar();
    flushCategorias(CATEGORIAS.filter((c) => c.codigo !== 'SAUDE'));
    fixture.detectChanges();

    // Sem chip que a explique, a lista não pode continuar filtrada por ela.
    expect(component['filtroCategoria']()).toBe('');
    expect(component['documentosFiltrados']()).toHaveLength(2);
  });
});
