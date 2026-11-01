import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  type CategoriaDocumentoDto,
  type ItemDaProtecaoDoCatalogoDto,
  TipoDocumentoDto,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TiposDocumentoListPage } from './tipos-documento-list.page';

const BASE = 'http://localhost:5000';
const URL_CATEGORIAS = `${BASE}/api/configuracao/categorias-documento`;
const URL_PROTECAO = `${BASE}/api/configuracao/admin/protecao-do-catalogo`;

/** A proteção de dados que o formulário exige, preenchida como Isabella faria. */
const PROTECAO_PREENCHIDA = {
  classificacaoProtecao: 'PESSOAL',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  finalidadeTratamento: 'Conferir o documento do candidato.',
};

const concedidas = signal<readonly string[]>([]);

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
  classificacaoProtecao: 'PESSOAL',
  finalidadeTratamento: 'Conferir o documento do candidato.',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  protecaoAprovada: true,
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
  classificacaoProtecao: 'PESSOAL',
  finalidadeTratamento: 'Conferir o documento do candidato.',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  protecaoAprovada: true,
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
  classificacaoProtecao: 'PESSOAL',
  finalidadeTratamento: 'Conferir o documento do candidato.',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  protecaoAprovada: true,
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
  classificacaoProtecao: 'PESSOAL',
  finalidadeTratamento: 'Conferir o documento do candidato.',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  protecaoAprovada: true,
  criadoEm: '2026-08-30T13:00:00Z',
};

describe('TiposDocumentoListPage', () => {
  let fixture: ComponentFixture<TiposDocumentoListPage>;
  let component: TiposDocumentoListPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    concedidas.set(['configuracao:tipos-documento:manter']);
    TestBed.configureTestingModule({
      imports: [TiposDocumentoListPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        {
          provide: PermissoesService,
          useValue: { tem: (codigo: string) => concedidas().includes(codigo) },
        },
      ],
    });
    fixture = TestBed.createComponent(TiposDocumentoListPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => {
    flushProtecao();
    // A recusa do aceite relê a lista; os testes que não a inspecionam a deixam vazia.
    for (const req of controller.match((r) => r.url === `${BASE}/api/configuracao/tipos-documento`)) {
      if (!req.cancelled) req.flush([]);
    }
    controller.verify();
  });

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

  /** Atende a lista do que aguarda a proteção de dados; o que não está nela está aprovado. */
  function flushProtecao(itens: readonly ItemDaProtecaoDoCatalogoDto[] = []): void {
    for (const req of controller.match((r) => r.url === URL_PROTECAO).filter((p) => !p.cancelled)) {
      req.flush(itens);
    }
  }

  async function flushLista(
    itens: readonly TipoDocumentoDto[],
    aguardando: readonly ItemDaProtecaoDoCatalogoDto[] = [],
  ): Promise<void> {
    flushCategorias();
    flushProtecao(aguardando);
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

  it('CA-01: o código é sugerido a partir do nome ao criar, em UPPER_SNAKE sem acento', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    fixture.detectChanges();

    component['form'].controls.nome.setValue('Laudo médico');

    expect(component['form'].controls.codigo.value).toBe('LAUDO_MEDICO');
    expect(component['form'].controls.codigo.valid).toBe(true);
  });

  it('CA-02: edição manual do operador não é sobrescrita pela sugestão', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    fixture.detectChanges();

    component['form'].controls.nome.setValue('Laudo médico');
    component['form'].controls.codigo.setValue('LAUDO_MEDICO_PCD');
    component['form'].controls.nome.setValue('Laudo médico para PcD');

    expect(component['form'].controls.codigo.value).toBe('LAUDO_MEDICO_PCD');
  });

  it('CA-03: em edição, digitar o nome não altera o código já gravado', async () => {
    // O código deste cadastro vai congelado no snapshot do edital: mexer nele por
    // efeito colateral de digitação seria mudança silenciosa de identidade.
    await flushLista([rgSeed]);
    component['abrirEdicao'](rgSeed);
    fixture.detectChanges();

    component['form'].controls.nome.setValue('Registro Geral revisado');

    expect(component['form'].controls.codigo.value).toBe('RG');
  });

  it('CA-04: nome que não produz código válido não deixa sugestão no campo', async () => {
    // Sugerir '21_DE_ABRIL' — que começa com dígito — deixaria o campo em erro sem
    // o operador tê-lo tocado.
    await flushLista([]);
    component['abrirCadastro']();
    fixture.detectChanges();

    component['form'].controls.nome.setValue('21 de abril');

    expect(component['form'].controls.codigo.value).toBe('');
  });

  it('CA-04: código fora do formato fechado é recusado no cliente, sem chamar o backend', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    component['form'].patchValue({
      ...PROTECAO_PREENCHIDA, codigo: '01', nome: 'Certificado', categoria: 'ESCOLARIDADE' });
    fixture.detectChanges();

    component['salvar']();

    controller.expectNone(`${BASE}/api/configuracao/admin/tipos-documento`);
    expect(component['form'].controls.codigo.errors?.['pattern']).toBeTruthy();
  });

  it('associa a dica e a mensagem de erro ao campo Código para leitor de tela', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    component['form'].patchValue({ codigo: '01' });
    component['form'].controls.codigo.markAsTouched();
    fixture.detectChanges();

    const campo: HTMLInputElement = fixture.nativeElement.querySelector(
      '[formControlName="codigo"]',
    );
    expect(campo.getAttribute('aria-describedby')).toContain('cfg-tdoc-codigo-dica');
    expect(campo.getAttribute('aria-describedby')).toContain('cfg-tdoc-codigo-erro');
    expect(campo.getAttribute('aria-invalid')).toBe('true');
  });

  // TipoDocumentoForm_CodigoDuplicado_422MapeaCampo (via TiposDocumentoListPage_Erro422_MapeaCampo)
  it('CA-03: código duplicado (409) é mapeado ao campo Código sem fechar o drawer', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    component['form'].patchValue({
      ...PROTECAO_PREENCHIDA,
      codigo: 'RG',
      nome: 'Registro Geral (dup)',
      categoria: 'IDENTIFICACAO',
    });
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
      ...PROTECAO_PREENCHIDA,
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
    expect(post.request.body).toMatchObject(PROTECAO_PREENCHIDA);
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([]);
  });

  it('envia null no nome preenchido só com espaços', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    // `Validators.required` aceita espaços em branco: sem normalizar, o payload
    // levaria '' e o backend responderia sobre formato, não sobre ausência.
    component['form'].patchValue({
      ...PROTECAO_PREENCHIDA, codigo: 'DECL3', nome: '   ', categoria: 'OUTROS' });
    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-documento`);
    expect(post.request.body).toMatchObject({ codigo: 'DECL3', nome: null, categoria: 'OUTROS' });
    post.flush('new-id-3', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([]);
  });

  it('nenhum formato marcado serializa para null', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    component['form'].patchValue({
      ...PROTECAO_PREENCHIDA, codigo: 'DECL2', nome: 'Declaração 2', categoria: 'OUTROS' });
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
      ...PROTECAO_PREENCHIDA,
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
    component['form'].patchValue({
      ...PROTECAO_PREENCHIDA,
      codigo: 'RG',
      nome: 'Registro Geral',
      categoria: 'IDENTIFICACAO',
    });
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
    component['form'].patchValue({
      ...PROTECAO_PREENCHIDA,
      codigo: 'RG',
      nome: 'Registro Geral',
      categoria: 'IDENTIFICACAO',
    });
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

  // TiposDocumentoListPage_ModalRemocao_ExibeNomeENota
  it('CA-07: modal de remoção exibe o nome do tipo e a nota de congelamento dos parâmetros na publicação', async () => {
    await flushLista([rgSeed]);
    component['pedirRemocao'](rgSeed);
    fixture.detectChanges();

    expect(component['confirmRemoverMensagem']()).toContain('Registro Geral');
    expect(component['confirmRemoverMensagem']()).toContain('RG');
    expect(component['confirmRemoverMensagem']()).toContain(
      'Editais já publicados que o referenciam não são afetados',
    );
    expect(component['confirmRemoverMensagem']()).toContain(
      'parâmetros foram congelados na configuração do edital',
    );
  });

  // TiposDocumentoListPage_AcaoRemover_UsaVocabularioDeRemocao
  it('CA-04/CA-06: botão e diálogo falam em remover, não em inativar', async () => {
    await flushLista([rgSeed]);
    fixture.detectChanges();

    const botao = fixture.nativeElement.querySelector(
      'button[aria-label="Remover tipo de documento RG"]',
    ) as HTMLButtonElement | null;
    expect(botao?.getAttribute('data-tooltip')).toBe('Remover tipo de documento');

    component['pedirRemocao'](rgSeed);
    fixture.detectChanges();

    const titulos = Array.from(
      fixture.nativeElement.querySelectorAll('.uni-dialog__title'),
    ) as HTMLElement[];
    expect(titulos.map((t) => t.textContent?.trim())).toContain('Remover tipo de documento');
    expect(component['confirmRemoverMensagem']()).toMatch(/^Deseja remover /);
    expect(component['confirmRemoverMensagem']()).not.toMatch(/inativ/i);
  });

  // TiposDocumentoListPage_ModalRemocao_ConfirmaRemove
  it('CA-07/CA-08: confirmação no modal dispara remover sem checagem prévia e atualiza a lista', async () => {
    await flushLista([rgSeed]);
    component['pedirRemocao'](rgSeed);
    component['confirmarRemocao']();

    const req = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-documento/${rgSeed.id}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();

    // Remover o tipo muda o que aguarda a proteção de dados: as pendências são relidas.
    expect(controller.match((r) => r.url === URL_PROTECAO).filter((p) => !p.cancelled)).toHaveLength(1);
    await flushLista([]);
    expect(component['confirmRemoverAberto']()).toBe(false);
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
      ...PROTECAO_PREENCHIDA,
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
  it('expõe legenda acessível descrevendo a tabela', async () => {
    await flushLista([rgSeed]);
    fixture.detectChanges();

    const caption = fixture.nativeElement.querySelector('table > caption');
    expect(caption).not.toBeNull();
    expect(caption?.classList.contains('sr-only')).toBe(true);
    expect(caption?.textContent?.replace(/\s+/gu, ' ').trim()).toBe(
      'Tipos de documento, com categoria, formatos aceitos, sensibilidade e situação da aprovação. Use o nome para abrir o detalhe.',
    );
  });

  const item = (
    tipo: TipoDocumentoDto,
    aprovacao: Partial<ItemDaProtecaoDoCatalogoDto['aprovacao']>,
  ): ItemDaProtecaoDoCatalogoDto => ({
    tipo: 'TIPO_DOCUMENTO',
    id: tipo.id,
    codigo: tipo.codigo,
    nome: tipo.nome,
    classificacaoProtecao: tipo.classificacaoProtecao,
    finalidadeTratamento: tipo.finalidadeTratamento,
    hipoteseLegal: tipo.hipoteseLegal,
    aprovacao: {
      situacao: 'PENDENTE',
      solicitadaEm: null,
      decididaEm: null,
      classificacaoRecomendada: null,
      justificativa: null,
      aceitaEm: null,
      ...aprovacao,
    },
  });

  it('a tabela tem Sensibilidade e Situação em colunas próprias, sem Tam. máx. nem a célula combinada', async () => {
    await flushLista([rgSeed]);
    fixture.detectChanges();

    const colunas = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.panel thead th')).map((th) =>
      th.textContent?.trim(),
    );
    expect(colunas).toEqual([
      'Código', 'Nome', 'Categoria', 'Formatos aceitos', 'Sensibilidade', 'Situação', 'Ações',
    ]);
    const celulas = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.panel tbody td')).map((td) =>
      td.getAttribute('data-label'),
    );
    expect(celulas).not.toContain('Tam. máx.');
    expect(celulas).not.toContain('Proteção de dados');
    expect(fixture.nativeElement.querySelector('td[data-label="Sensibilidade"]').classList).toContain('u-nowrap-desktop');
    expect(fixture.nativeElement.querySelector('td[data-label="Situação"]').classList).toContain('u-nowrap-desktop');
  });

  describe('detalhe do tipo de documento', () => {
    const alvo = (): HTMLButtonElement => fixture.nativeElement.querySelector('tbody .table-responsive__alvo');
    const painel = (): string =>
      (fixture.nativeElement.querySelector('dialog[aria-label="Detalhe do tipo de documento"]')?.textContent ?? '').replace(
        /\s+/gu,
        ' ',
      );
    const rodape = (): string[] =>
      Array.from<HTMLElement>(
        fixture.nativeElement.querySelectorAll('dialog[aria-label="Detalhe do tipo de documento"] .cfg-form-footer button'),
      ).map((b) => b.textContent?.trim() ?? '');

    it('o nome da linha é um botão nativo com nome acessível, e não há clique na linha', async () => {
      await flushLista([rgSeed]);
      fixture.detectChanges();

      expect(alvo().tagName).toBe('BUTTON');
      expect(alvo().type).toBe('button');
      expect(alvo().tabIndex).toBeGreaterThanOrEqual(0);
      expect(alvo().getAttribute('aria-label')).toBe('Ver o detalhe de Registro Geral');
      expect(fixture.nativeElement.querySelector('tbody tr').hasAttribute('onclick')).toBe(false);
    });

    it('abre o drawer só de leitura com todos os campos que a consulta devolve', async () => {
      await flushLista([rgSeed], [item(rgSeed, { situacao: 'SOLICITADA' })]);
      fixture.detectChanges();

      alvo().click();
      fixture.detectChanges();

      expect(component['detalheAberto']()).toBe(true);
      expect(
        fixture.nativeElement.querySelector('dialog[aria-label="Detalhe do tipo de documento"] .uni-drawer__title').textContent.trim(),
      ).toBe('Registro Geral');
      const texto = painel();
      expect(texto).toContain('RG');
      expect(texto).toContain('Documento de identificação civil.');
      expect(texto).toContain('Identificação');
      expect(texto).toContain('CIN');
      expect(texto).toContain('pdf,jpg');
      expect(texto).toContain('10 MB');
      expect(texto).toContain('Pessoal');
      expect(texto).toContain('Execução de políticas públicas');
      expect(texto).toContain('Conferir o documento do candidato.');
      expect(texto).toContain('Em análise');
      expect(texto).toContain('Cadastrado em');
      expect(texto).toContain('10/06/2026');
      expect(
        fixture.nativeElement.querySelector('dialog[aria-label="Detalhe do tipo de documento"] input, dialog[aria-label="Detalhe do tipo de documento"] textarea'),
      ).toBeNull();
    });

    it('"Editar" fecha o detalhe e abre a edição do mesmo tipo', async () => {
      await flushLista([rgSeed], [item(rgSeed, { situacao: 'APROVADA' })]);
      fixture.detectChanges();
      alvo().click();
      fixture.detectChanges();
      expect(rodape()).toEqual(['Fechar', 'Editar']);

      Array.from<HTMLButtonElement>(
        fixture.nativeElement.querySelectorAll('dialog[aria-label="Detalhe do tipo de documento"] .cfg-form-footer button'),
      )
        .find((b) => b.textContent?.trim() === 'Editar')
        ?.click();
      fixture.detectChanges();

      expect(component['detalheAberto']()).toBe(false);
      expect(component['formOpen']()).toBe(true);
      expect(component['modo']()).toBe('editar');
      expect(component['form'].controls.codigo.value).toBe('RG');
    });

    it('oferece "Aceitar recomendação" só com a recomendação do tipo negado', async () => {
      await flushLista(
        [rgSeed, laudoSeed],
        [item(laudoSeed, { situacao: 'AJUSTE_RECOMENDADO', classificacaoRecomendada: 'SENSIVEL' })],
      );
      fixture.detectChanges();

      const alvos = fixture.nativeElement.querySelectorAll('tbody .table-responsive__alvo');
      alvos[0].click();
      fixture.detectChanges();
      expect(rodape()).toEqual(['Fechar', 'Editar']);
      component['detalheAberto'].set(false);
      fixture.detectChanges();

      alvos[1].click();
      fixture.detectChanges();
      expect(rodape()).toEqual(['Fechar', 'Aceitar recomendação', 'Editar']);
      expect(painel()).toContain('Classificação recomendada: Pessoal sensível');
      expect(painel()).toContain('Ajuste recomendado');
    });

    it('no tipo reprovado mostra a justificativa e oferece "Editar", sem "Aceitar recomendação"', async () => {
      await flushLista(
        [laudoSeed],
        [item(laudoSeed, { situacao: 'REPROVADA', justificativa: 'O laudo traz dado de saúde.' })],
      );
      fixture.detectChanges();

      alvo().click();
      fixture.detectChanges();

      expect(rodape()).toEqual(['Fechar', 'Editar']);
      expect(painel()).toContain('Reprovada');
      expect(painel()).toContain('Justificativa: O laudo traz dado de saúde.');
      expect(painel()).not.toContain('Classificação recomendada');
    });

    it('sem a permissão de manter, só consulta e fecha', async () => {
      concedidas.set([]);
      await flushLista([laudoSeed], [item(laudoSeed, { situacao: 'AJUSTE_RECOMENDADO', classificacaoRecomendada: 'SENSIVEL' })]);
      fixture.detectChanges();

      alvo().click();
      fixture.detectChanges();

      expect(rodape()).toEqual(['Fechar']);
    });
  });

  describe('aprovação da proteção de dados', () => {
    const texto = (): string => fixture.nativeElement.textContent.replace(/\s+/gu, ' ');
    /** Os botões da página, fora dos diálogos, que ficam no DOM mesmo fechados. */
    const botao = (rotulo: string): HTMLButtonElement | undefined =>
      Array.from<HTMLButtonElement>(
        fixture.nativeElement.querySelectorAll('.panel-head__actions button, .cfg-form-footer button'),
      ).find((b) => b.textContent?.includes(rotulo));

    it('diz a situação como texto, e a negativa traz a classificação recomendada', async () => {
      await flushLista(
        [rgSeed, laudoSeed, diplomaSeed],
        [
          item(laudoSeed, { situacao: 'AJUSTE_RECOMENDADO', classificacaoRecomendada: 'SENSIVEL' }),
          item(diplomaSeed, { situacao: 'SOLICITADA' }),
        ],
      );
      fixture.detectChanges();

      expect(texto()).toContain('Aprovada');
      expect(texto()).toContain('Ajuste recomendado');
      expect(texto()).not.toContain('Classificação recomendada');
      expect(texto()).toContain('Em análise');
    });

    it('oferece "Enviar solicitação" só com item pendente e permissão de manter', async () => {
      await flushLista([laudoSeed], [item(laudoSeed, { situacao: 'PENDENTE' })]);
      fixture.detectChanges();
      expect(botao('Enviar solicitação')).toBeDefined();
    });

    it('o diálogo de envio é largo e lista Item e Sensibilidade, sem o código técnico nem o cadastro repetido', async () => {
      await flushLista([laudoSeed], [item(laudoSeed, { situacao: 'PENDENTE' })]);
      fixture.detectChanges();
      botao('Enviar solicitação')?.click();
      fixture.detectChanges();

      const dialogo = fixture.nativeElement.querySelector('cfg-solicitacao-da-protecao-dialog dialog') as HTMLDialogElement;
      expect(dialogo.classList.contains('uni-dialog--largo')).toBe(true);
      expect(Array.from(dialogo.querySelectorAll('thead th')).map((th) => th.textContent?.trim())).toEqual([
        'Enviar',
        'Item',
        'Sensibilidade',
      ]);
      const texto = dialogo.textContent?.replace(/\s+/gu, ' ') ?? '';
      expect(texto).toContain('Laudo médico — PcD');
      expect(texto).not.toContain('LAUDO_MEDICO');
      expect(texto).not.toMatch(/aprova ou nega/u);
    });

    describe('envio por seleção', () => {
      const abrirDialogo = async (): Promise<HTMLDialogElement> => {
        await flushLista(
          [laudoSeed, diplomaSeed],
          [item(laudoSeed, { situacao: 'PENDENTE' }), item(diplomaSeed, { situacao: 'PENDENTE' })],
        );
        fixture.detectChanges();
        botao('Enviar solicitação')?.click();
        fixture.detectChanges();
        // A seleção inicial (todos marcados) é escrita por um efeito, que pede uma segunda passada.
        fixture.detectChanges();
        return fixture.nativeElement.querySelector('cfg-solicitacao-da-protecao-dialog dialog') as HTMLDialogElement;
      };
      const caixas = (dialogo: HTMLDialogElement): HTMLInputElement[] =>
        Array.from(dialogo.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]'));
      const todos = (dialogo: HTMLDialogElement): HTMLInputElement =>
        dialogo.querySelector<HTMLInputElement>('thead input[type="checkbox"]') as HTMLInputElement;
      const enviar = (dialogo: HTMLDialogElement): HTMLButtonElement =>
        Array.from(dialogo.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
          /^Enviar \d+ it/u.test(b.textContent?.trim() ?? ''),
        ) as HTMLButtonElement;

      it('abre com todos marcados, cada caixa com o nome do item, e o botão diz quantos vão', async () => {
        const dialogo = await abrirDialogo();

        expect(caixas(dialogo).map((c) => c.checked)).toEqual([true, true]);
        expect(caixas(dialogo).map((c) => c.getAttribute('aria-label'))).toEqual([
          `Enviar ${laudoSeed.nome}`,
          `Enviar ${diplomaSeed.nome}`,
        ]);
        expect(todos(dialogo).checked).toBe(true);
        expect(todos(dialogo).indeterminate).toBe(false);
        expect(enviar(dialogo).textContent?.trim()).toBe('Enviar 2 itens');
      });

      it('desmarcar um item deixa "marcar todos" em estado misto e envia só o marcado', async () => {
        const dialogo = await abrirDialogo();

        caixas(dialogo)[1].click();
        fixture.detectChanges();

        expect(todos(dialogo).indeterminate).toBe(true);
        expect(enviar(dialogo).textContent?.trim()).toBe('Enviar 1 item');
        enviar(dialogo).click();
        const post = controller.expectOne(`${URL_PROTECAO}/solicitacoes`);
        expect(post.request.body).toEqual({ itens: [{ cadastro: 'TIPO_DOCUMENTO', id: laudoSeed.id }] });
        post.flush({ tiposDeDocumento: 1, fatos: 0 });
        await propagate();
        flushProtecao([]);
        await propagate();
      });

      it('item recusado como não pendente fica sinalizado na linha, sai da marcação e a situação é relida', async () => {
        const dialogo = await abrirDialogo();
        enviar(dialogo).click();

        controller.expectOne(`${URL_PROTECAO}/solicitacoes`).flush(
          JSON.stringify({
            status: 422,
            code: 'uniplus.configuracao.protecao_do_catalogo.item_nao_pendente',
            title: 'O item da solicitação não existe ou não está pendente',
            errors: [
              {
                field: 'itens[1].id',
                code: 'uniplus.configuracao.protecao_do_catalogo.item_nao_pendente',
                message: 'O item da solicitação não existe ou não está pendente',
              },
            ],
          }),
          { status: 422, statusText: 'Recusa', headers: { 'content-type': 'application/problem+json' } },
        );
        await propagate();
        fixture.detectChanges();

        const recusado = caixas(dialogo)[1];
        expect(recusado.checked).toBe(false);
        expect(recusado.getAttribute('aria-invalid')).toBe('true');
        const mensagem = dialogo.querySelector(`[id="${recusado.getAttribute('aria-describedby')}"]`);
        expect(mensagem?.textContent).toContain('não existe ou não está pendente');
        expect(caixas(dialogo)[0].checked).toBe(true);
        expect(enviar(dialogo).textContent?.trim()).toBe('Enviar 1 item');
        // A situação é relida: o item recusado deixa de ser pendente.
        flushProtecao([item(laudoSeed, { situacao: 'PENDENTE' })]);
      });

      it('troca a Idempotency-Key quando a seleção muda depois de uma falha', async () => {
        const dialogo = await abrirDialogo();
        enviar(dialogo).click();
        const primeira = controller.expectOne(`${URL_PROTECAO}/solicitacoes`);
        const chave = primeira.request.headers.get('Idempotency-Key');
        primeira.flush({ title: 'Falha', status: 503 }, { status: 503, statusText: 'Falha' });
        await propagate();
        fixture.detectChanges();

        // Mesma seleção: repete a chave. Outra seleção: chave nova.
        enviar(dialogo).click();
        const repetida = controller.expectOne(`${URL_PROTECAO}/solicitacoes`);
        expect(repetida.request.headers.get('Idempotency-Key')).toBe(chave);
        repetida.flush({ title: 'Falha', status: 503 }, { status: 503, statusText: 'Falha' });
        await propagate();
        fixture.detectChanges();

        caixas(dialogo)[1].click();
        fixture.detectChanges();
        enviar(dialogo).click();
        const outra = controller.expectOne(`${URL_PROTECAO}/solicitacoes`);
        expect(outra.request.headers.get('Idempotency-Key')).not.toBe(chave);
        expect(outra.request.body.itens).toHaveLength(1);
        outra.flush({ tiposDeDocumento: 1, fatos: 0 });
        await propagate();
        flushProtecao([]);
        await propagate();
      });

      it('"marcar todos" desmarca tudo, desabilita o envio e volta a marcar tudo', async () => {
        const dialogo = await abrirDialogo();

        todos(dialogo).click();
        fixture.detectChanges();
        expect(caixas(dialogo).map((c) => c.checked)).toEqual([false, false]);
        expect(dialogo.querySelector('.uni-dialog__footer .btn--primary')?.hasAttribute('disabled')).toBe(true);

        todos(dialogo).click();
        fixture.detectChanges();
        expect(caixas(dialogo).map((c) => c.checked)).toEqual([true, true]);
      });
    });

    it('não oferece "Enviar solicitação" sem item pendente', async () => {
      await flushLista([laudoSeed], [item(laudoSeed, { situacao: 'SOLICITADA' })]);
      fixture.detectChanges();
      expect(botao('Enviar solicitação')).toBeUndefined();
    });

    it('não oferece "Enviar solicitação" nem "Aceitar recomendação" sem a permissão de manter', async () => {
      concedidas.set([]);
      await flushLista(
        [laudoSeed, diplomaSeed],
        [
          item(laudoSeed, { situacao: 'PENDENTE' }),
          item(diplomaSeed, { situacao: 'AJUSTE_RECOMENDADO', classificacaoRecomendada: 'SENSIVEL' }),
        ],
      );
      fixture.detectChanges();
      expect(botao('Enviar solicitação')).toBeUndefined();
      expect(botao('Aceitar recomendação')).toBeUndefined();
    });

    it('envia a solicitação de todos os pendentes e recarrega a situação', async () => {
      await flushLista([laudoSeed], [item(laudoSeed, { situacao: 'PENDENTE' })]);
      fixture.detectChanges();

      botao('Enviar solicitação')?.click();
      fixture.detectChanges();
      const noDialogo = Array.from<HTMLButtonElement>(
        fixture.nativeElement.querySelectorAll('cfg-solicitacao-da-protecao-dialog button'),
      );
      expect(texto()).toContain(laudoSeed.nome);
      noDialogo.find((b) => /^Enviar \d+ it/u.test(b.textContent?.trim() ?? ''))?.click();

      const post = controller.expectOne(`${URL_PROTECAO}/solicitacoes`);
      expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
      post.flush({ tiposDeDocumento: 1, fatos: 0 });
      await propagate();
      flushProtecao([item(laudoSeed, { situacao: 'SOLICITADA' })]);
      await propagate();
      fixture.detectChanges();

      expect(botao('Enviar solicitação')).toBeUndefined();
      expect(texto()).toContain('Em análise');
    });

    it('a solicitação sem quem a aprove fica no diálogo, com a mensagem da API, e não recarrega a lista', async () => {
      await flushLista([laudoSeed], [item(laudoSeed, { situacao: 'PENDENTE' })]);
      fixture.detectChanges();
      botao('Enviar solicitação')?.click();
      fixture.detectChanges();

      Array.from<HTMLButtonElement>(
        fixture.nativeElement.querySelectorAll('cfg-solicitacao-da-protecao-dialog button'),
      )
        .find((b) => /^Enviar \d+ it/u.test(b.textContent?.trim() ?? ''))
        ?.click();
      controller.expectOne(`${URL_PROTECAO}/solicitacoes`).flush(
        JSON.stringify({
          status: 422,
          code: 'uniplus.configuracao.protecao_do_catalogo.sem_quem_aprove',
          title: 'Ninguém tem a permissão de aprovar a proteção de dados do catálogo',
        }),
        { status: 422, statusText: 'Recusa', headers: { 'content-type': 'application/problem+json' } },
      );
      await propagate();
      fixture.detectChanges();

      expect(component['solicitacaoAberta']()).toBe(true);
      expect(texto()).toContain('Ninguém tem a permissão de aprovar a proteção de dados do catálogo');
      expect(botao('Enviar solicitação')).toBeDefined();
    });

    it('aceita a recomendação do tipo negado, e ele sai da lista de pendências', async () => {
      await flushLista(
        [laudoSeed],
        [item(laudoSeed, { situacao: 'AJUSTE_RECOMENDADO', classificacaoRecomendada: 'SENSIVEL' })],
      );
      fixture.detectChanges();

      (fixture.nativeElement.querySelector('tbody .table-responsive__alvo') as HTMLButtonElement).click();
      fixture.detectChanges();
      botao('Aceitar recomendação')?.click();
      fixture.detectChanges();
      expect(component['detalheAberto']()).toBe(false);
      expect(component['confirmAceiteMensagem']()).toContain('Pessoal sensível');
      component['confirmarAceite']();

      const post = controller.expectOne(
        `${BASE}/api/configuracao/admin/tipos-documento/${laudoSeed.id}/aceite-da-recomendacao`,
      );
      expect(post.request.method).toBe('POST');
      expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
      post.flush(null, { status: 204, statusText: 'No Content' });
      await propagate();
      // A classificação aceita muda o tipo: a lista é relida, senão a edição regravaria a antiga.
      controller
        .expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-documento`)
        .flush([{ ...laudoSeed, classificacaoProtecao: 'SENSIVEL' }]);
      flushProtecao([]);
      await propagate();
      fixture.detectChanges();

      expect(botao('Aceitar recomendação')).toBeUndefined();
      expect(texto()).toContain('Aprovada');
    });

    it('a recusa do aceite fica no diálogo, com a mensagem da API', async () => {
      await flushLista(
        [laudoSeed],
        [item(laudoSeed, { situacao: 'AJUSTE_RECOMENDADO', classificacaoRecomendada: 'PUBLICO' })],
      );
      component['pedirAceite'](laudoSeed);
      component['confirmarAceite']();

      controller
        .expectOne(
          `${BASE}/api/configuracao/admin/tipos-documento/${laudoSeed.id}/aceite-da-recomendacao`,
        )
        .flush(
          JSON.stringify({
            status: 422,
            code: 'uniplus.configuracao.protecao_do_catalogo.recomendacao_incompativel_com_a_hipotese_legal',
            title: 'A base legal do item não cabe na classificação recomendada',
          }),
          { status: 422, statusText: 'Recusa', headers: { 'content-type': 'application/problem+json' } },
        );
      await propagate();

      expect(component['confirmAceiteAberto']()).toBe(true);
      expect(component['confirmAceiteMensagem']()).toBe(
        'A base legal do item não cabe na classificação recomendada',
      );
    });

    it('quando a leitura da situação falha, não diz "Aprovada" e avisa que não leu', async () => {
      flushCategorias();
      for (const req of controller.match((r) => r.url === URL_PROTECAO)) {
        req.flush({ title: 'Indisponível', status: 503 }, { status: 503, statusText: 'Indisponível' });
      }
      controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-documento`).flush([rgSeed]);
      await propagate();
      fixture.detectChanges();

      expect(texto()).not.toContain('Aprovada');
      expect(texto()).toContain('Não foi possível ler a situação');
    });

    it('releitura que falha depois de uma boa não devolve "Aprovada" ao tipo que saiu da lista', async () => {
      await flushLista([laudoSeed], [item(laudoSeed, { situacao: 'SOLICITADA' })]);
      expect(texto()).toContain('Em análise');

      component['aprovacao'].carregar();
      for (const req of controller.match((r) => r.url === URL_PROTECAO)) {
        req.flush({ title: 'Indisponível', status: 503 }, { status: 503, statusText: 'Indisponível' });
      }
      await propagate();
      fixture.detectChanges();

      expect(texto()).not.toContain('Aprovada');
      expect(component['aprovacao'].aprovacaoDe(laudoSeed.id)).toBeNull();
      expect(component['aprovacao'].solicitaveis(), 'estado desconhecido não oferece o envio').toEqual([]);
    });

    it('o aceite que falha por erro do servidor repete a mesma Idempotency-Key; a recusa 4xx troca a chave', async () => {
      await flushLista(
        [laudoSeed],
        [item(laudoSeed, { situacao: 'AJUSTE_RECOMENDADO', classificacaoRecomendada: 'SENSIVEL' })],
      );
      const url = `${BASE}/api/configuracao/admin/tipos-documento/${laudoSeed.id}/aceite-da-recomendacao`;
      const falha = (status: number) =>
        [
          JSON.stringify({ status, title: 'Falha' }),
          { status, statusText: 'Falha', headers: { 'content-type': 'application/problem+json' } },
        ] as const;

      component['pedirAceite'](laudoSeed);
      component['confirmarAceite']();
      const primeira = controller.expectOne(url);
      const chave = primeira.request.headers.get('Idempotency-Key');
      primeira.flush(...falha(503));
      await propagate();

      component['confirmarAceite']();
      const segunda = controller.expectOne(url);
      expect(segunda.request.headers.get('Idempotency-Key')).toBe(chave);
      segunda.flush(...falha(422));
      await propagate();

      component['confirmarAceite']();
      const terceira = controller.expectOne(url);
      expect(terceira.request.headers.get('Idempotency-Key')).not.toBe(chave);
      terceira.flush(null, { status: 204, statusText: 'No Content' });
      await propagate();
      controller.match((r) => r.url === `${BASE}/api/configuracao/tipos-documento`).forEach((r) => r.flush([laudoSeed]));
    });

    it('avisa que o tipo aprovado volta a pendente ao mudar a classificação, e não ao mudar o nome', async () => {
      await flushLista([rgSeed]);
      component['abrirEdicao'](rgSeed);
      fixture.detectChanges();

      component['form'].controls.nome.setValue('Registro Geral revisado');
      expect(component['avisaNovaAprovacao']()).toBe(false);

      component['form'].controls.classificacaoProtecao.setValue('SENSIVEL');
      fixture.detectChanges();
      expect(component['avisaNovaAprovacao']()).toBe(true);
      expect(texto()).toContain('O item volta a pendente');
    });

    it('não avisa quando o tipo já está pendente', async () => {
      await flushLista([laudoSeed], [item(laudoSeed, { situacao: 'PENDENTE' })]);
      component['abrirEdicao'](laudoSeed);
      component['form'].controls.classificacaoProtecao.setValue('SENSIVEL');

      expect(component['avisaNovaAprovacao']()).toBe(false);
    });

    it('ao abrir a edição, mantém a hipótese que veio do servidor; só esvazia a que a pessoa tornou incompatível', async () => {
      const antigo = { ...rgSeed, classificacaoProtecao: 'SENSIVEL', hipoteseLegal: 'INTERESSE_LEGITIMO' };
      await flushLista([antigo]);
      component['abrirEdicao'](antigo);
      fixture.detectChanges();
      await propagate();
      expect(component['form'].controls.hipoteseLegal.value).toBe('INTERESSE_LEGITIMO');

      // A pessoa escolhe uma classificação e, depois, uma hipótese que ela não admite (prevenção à fraude é só do art. 11).
      component['form'].controls.classificacaoProtecao.setValue('PESSOAL');
      fixture.detectChanges();
      component['form'].controls.hipoteseLegal.setValue('PREVENCAO_A_FRAUDE');
      fixture.detectChanges();
      expect(component['form'].controls.hipoteseLegal.value).toBe('');
    });

    it('a recusa do aceite relê a situação e a lista, que podem ter mudado em outra sessão', async () => {
      await flushLista([laudoSeed], [item(laudoSeed, { situacao: 'AJUSTE_RECOMENDADO', classificacaoRecomendada: 'SENSIVEL' })]);
      component['pedirAceite'](laudoSeed);
      component['confirmarAceite']();
      controller
        .expectOne(`${BASE}/api/configuracao/admin/tipos-documento/${laudoSeed.id}/aceite-da-recomendacao`)
        .flush(JSON.stringify({ status: 409, title: 'Conflito' }), {
          status: 409,
          statusText: 'Conflito',
          headers: { 'content-type': 'application/problem+json' },
        });
      await propagate();

      expect(controller.match((r) => r.url === URL_PROTECAO)).toHaveLength(1);
      await flushLista([laudoSeed]);
    });

    it('esvazia a hipótese legal que não cabe na nova classificação', async () => {
      await flushLista([rgSeed]);
      component['abrirCadastro']();
      component['form'].patchValue({
        classificacaoProtecao: 'PESSOAL',
        hipoteseLegal: 'INTERESSE_LEGITIMO',
      });
      fixture.detectChanges();
      expect(component['form'].controls.hipoteseLegal.value).toBe('INTERESSE_LEGITIMO');

      component['form'].controls.classificacaoProtecao.setValue('SENSIVEL');
      fixture.detectChanges();

      expect(component['form'].controls.hipoteseLegal.value).toBe('');
    });
  });
});
