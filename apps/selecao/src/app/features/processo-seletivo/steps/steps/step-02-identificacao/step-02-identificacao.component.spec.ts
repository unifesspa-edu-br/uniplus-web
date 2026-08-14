import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { OrigemCandidatos } from '@uniplus/shared-data/selecao';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { ORGANIZACAO_BASE_PATH } from '@uniplus/shared-data/organizacao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { Step02IdentificacaoComponent } from './step-02-identificacao.component';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000005aa';
const TIPO_ID = '01960000-0000-7000-0000-0000000005bb';
const UNIDADE_ID = '01960000-0000-7000-0000-0000000005cc';
const DOCUMENTO_ID = '01960000-0000-7000-0000-0000000005dd';
const MARABA = { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' } as const;
const URL_ASSINADA = 'http://localhost:9000/uniplus-selecao/editais/edital.pdf?X-Amz-Signature=abc';

const unidadeSeed = {
  id: UNIDADE_ID,
  nome: 'Instituto de Ciências Exatas',
  alias: 'ICE',
  slug: 'ice',
  sigla: 'ICE',
  codigo: 'ICE',
  unidadeSuperiorId: null,
  tipo: 'Instituto',
  unidadeAcademica: true,
  vigenciaInicio: '2026-01-01',
  vigenciaFim: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

/** Um PDF mínimo: a assinatura importa para a recusa client-side. */
function pdf(nome = 'edital.pdf', bytes = 2048): File {
  return new File([new Uint8Array(bytes).fill(37)], nome, { type: 'application/pdf' });
}

/**
 * Cede o event loop para que a cadeia de `await` do componente avance até a
 * próxima requisição. `Promise.resolve()` sozinho não basta: cada fase do
 * fluxo passa por `firstValueFrom` e por mais de um microtask.
 */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Recusa no formato que a API realmente emite. O `apiResultInterceptor` só
 * parseia o `code` quando o content type é `application/problem+json` — sem o
 * header, tudo vira `unexpected_response` e a regra de rotação de chave não
 * chega a ser exercida.
 */
function problema(status: number, code: string, title: string) {
  return {
    body: { type: 'about:blank', title, status, code, traceId: 'trace-1' },
    opts: {
      status,
      statusText: title,
      headers: { 'Content-Type': 'application/problem+json' },
    },
  };
}

function iniciacao(expiraEmMs = Date.now() + 900_000) {
  return {
    documentoEditalId: DOCUMENTO_ID,
    urlUpload: URL_ASSINADA,
    contentTypeExigido: 'application/pdf',
    expiraEm: new Date(expiraEmMs).toISOString(),
  };
}

describe('Step02IdentificacaoComponent', () => {
  let componente: Step02IdentificacaoComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step02IdentificacaoComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicialService,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
        { provide: GEO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Step02IdentificacaoComponent);
    componente = fixture.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);

    // O componente carrega as unidades no construtor.
    controller.expectOne(`${BASE}/api/organizacao/unidades?limit=100`).flush([unidadeSeed]);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  function preencherCamposDoComando(): void {
    store.patchObjectSection('tipoProcesso', { selected: TIPO_ID });
    store.patchObjectSection('identificacao', {
      nome: 'Processo Seletivo 2027',
      unidadeAdministradoraId: UNIDADE_ID,
      origemCandidatos: OrigemCandidatos.inscricaoPropria,
      localidade: MARABA,
    });
  }

  /** Tudo que `validate()` exige, menos o anexo do edital. */
  function preencherPassoInteiro(): void {
    preencherCamposDoComando();
    store.patchObjectSection('identificacao', {
      numero: '12/2026',
      ano: 2026,
      data: '2026-09-01',
      orgao: 'CEPS',
      periodo: '1º semestre',
    });
  }

  it('carrega as unidades administradoras da API de Organização', () => {
    expect(componente.unidades()).toEqual([{ id: UNIDADE_ID, rotulo: 'ICE — Instituto de Ciências Exatas' }]);
    expect(componente.unidadesCarregando()).toBe(false);
  });

  it('exige unidade administradora e origem dos candidatos para avançar', () => {
    store.patchObjectSection('identificacao', {
      numero: '12/2026',
      ano: 2026,
      data: '2026-09-01',
      orgao: 'CEPS',
      periodo: '1º semestre',
      nome: 'Processo Seletivo 2027',
    });

    const resultado = componente.validate();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages).toContain('Selecione a unidade administradora.');
    expect(resultado.messages).toContain('Informe a origem dos candidatos.');
  });

  it('recusa arquivo que não é PDF sem chamar a API', () => {
    preencherCamposDoComando();

    componente['anexar'](new File(['x'], 'edital.docx', { type: 'application/msword' }));

    expect(componente.uploadError()).toContain('deve ser um arquivo PDF');
    expect(store.processoSeletivoId()).toBeNull();
  });

  it('recusa PDF acima de 20 MB sem chamar a API', () => {
    preencherCamposDoComando();

    componente['anexar'](pdf('grande.pdf', 20 * 1024 * 1024 + 1));

    expect(componente.uploadError()).toContain('20 MB');
    expect(store.processoSeletivoId()).toBeNull();
  });

  it('nomeia os campos que faltam antes de criar o cadastro', async () => {
    await componente['anexar'](pdf());

    expect(componente.uploadError()).toContain('tipo do processo (passo 1)');
    expect(componente.uploadError()).toContain('unidade administradora');
    expect(componente.uploadError()).toContain('origem dos candidatos');
    expect(store.processoSeletivoId()).toBeNull();
  });

  it('cria o processo, envia o arquivo e confirma o documento ao anexar', async () => {
    preencherPassoInteiro();
    const anexo = componente['anexar'](pdf());

    const criacao = controller.expectOne(`${BASE}/api/selecao/processos-seletivos`);
    expect(criacao.request.body).toEqual({
      nome: 'Processo Seletivo 2027',
      tipoProcessoOrigemId: TIPO_ID,
      origemCandidatos: OrigemCandidatos.inscricaoPropria,
      unidadeAdministradoraOrigemId: UNIDADE_ID,
      localidadeCodigoIbge: '1504208',
      localidadeNome: 'Marabá',
      localidadeUf: 'PA',
    });
    expect(criacao.request.headers.get('Idempotency-Key')).toBeTruthy();
    criacao.flush(PROCESSO_ID, { status: 201, statusText: 'Created' });
    await tick();

    const inicio = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/documentos-edital`,
    );
    inicio.flush(iniciacao(), { status: 201, statusText: 'Created' });
    await tick();

    controller.expectOne(URL_ASSINADA).flush(null);
    await tick();

    const confirmacao = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/documentos-edital/${DOCUMENTO_ID}/confirmacao`,
    );
    confirmacao.flush({
      id: DOCUMENTO_ID,
      processoSeletivoId: PROCESSO_ID,
      status: 'Confirmado',
      tamanhoBytes: 2048,
      hashSha256: 'a'.repeat(64),
      confirmadoEm: '2026-08-13T12:00:00Z',
    });
    await anexo;

    expect(store.processoSeletivoId()).toBe(PROCESSO_ID);
    expect(componente.anexo()?.fase).toBe('confirmado');
    expect(componente.anexo()?.progress).toBe(100);
    expect(componente.validate().valid).toBe(true);
  });

  it('congela os campos do comando depois de criar o processo', async () => {
    preencherCamposDoComando();
    const anexo = componente['anexar'](pdf());

    controller
      .expectOne(`${BASE}/api/selecao/processos-seletivos`)
      .flush(PROCESSO_ID, { status: 201, statusText: 'Created' });
    await tick();
    expect(componente.camposDoComandoBloqueados()).toBe(true);

    // Encerra o fluxo para não deixar requisições pendentes.
    const falha = problema(422, 'DocumentoEdital.Invalido', 'Documento recusado');
    controller
      .expectOne(`${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/documentos-edital`)
      .flush(falha.body, falha.opts);
    await anexo;
  });

  /**
   * O filtro de idempotência guarda a resposta de qualquer status abaixo de 500:
   * reenviar o comando corrigido com a mesma chave devolveria `body_mismatch`
   * em vez de criar o processo.
   */
  it('renova a Idempotency-Key após 422 de validação', async () => {
    preencherCamposDoComando();
    const primeira = componente['persistir']();

    const req1 = controller.expectOne(`${BASE}/api/selecao/processos-seletivos`);
    const chave1 = req1.request.headers.get('Idempotency-Key');
    const recusa = problema(422, 'ProcessoSeletivo.NomeDuplicado', 'Nome já utilizado');
    req1.flush(recusa.body, recusa.opts);
    expect((await primeira).valid).toBe(false);

    store.patchObjectSection('identificacao', { nome: 'Processo Seletivo 2027 — retificado' });
    const segunda = componente['persistir']();

    const req2 = controller.expectOne(`${BASE}/api/selecao/processos-seletivos`);
    const chave2 = req2.request.headers.get('Idempotency-Key');
    expect(chave2).not.toBe(chave1);
    req2.flush(PROCESSO_ID, { status: 201, statusText: 'Created' });
    expect((await segunda).valid).toBe(true);
  });

  /**
   * `processing_conflict` é o único 409 em que o backend pede retry com a mesma
   * chave — a execução anterior ainda pode concluir.
   */
  it('preserva a Idempotency-Key em processing_conflict', async () => {
    preencherCamposDoComando();
    const primeira = componente['persistir']();

    const req1 = controller.expectOne(`${BASE}/api/selecao/processos-seletivos`);
    const chave1 = req1.request.headers.get('Idempotency-Key');
    const conflito = problema(
      409,
      'uniplus.idempotency.processing_conflict',
      'Requisição concorrente em processamento',
    );
    req1.flush(conflito.body, conflito.opts);
    await primeira;

    const segunda = componente['persistir']();
    const req2 = controller.expectOne(`${BASE}/api/selecao/processos-seletivos`);
    expect(req2.request.headers.get('Idempotency-Key')).toBe(chave1);
    req2.flush(PROCESSO_ID, { status: 201, statusText: 'Created' });
    await segunda;
  });

  /**
   * A URL pré-assinada não volta a valer: repetir o mesmo PUT depois de um 403
   * do storage é inútil, então o retry precisa pedir outra iniciação.
   */
  it('descarta a iniciação quando o storage recusa a URL expirada', async () => {
    preencherCamposDoComando();
    store.processoSeletivoId.set(PROCESSO_ID);
    const anexo = componente['anexar'](pdf());
    await tick();

    controller
      .expectOne(`${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/documentos-edital`)
      .flush(iniciacao(), { status: 201, statusText: 'Created' });
    await tick();

    controller
      .expectOne(URL_ASSINADA)
      .flush('<Error><Code>AccessDenied</Code></Error>', { status: 403, statusText: 'Forbidden' });
    await anexo;

    expect(componente.anexo()?.fase).toBe('erro');
    expect(componente.anexo()?.mensagemErro).toContain('não é mais válido');
    expect(componente.anexo()?.documentoEditalId).toBeUndefined();
    expect(componente.anexo()?.enviado).toBeFalsy();

    const retomada = componente.retomarUpload();
    await tick();
    controller
      .expectOne(`${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/documentos-edital`)
      .flush(iniciacao(), { status: 201, statusText: 'Created' });
    await tick();
    controller.expectOne(URL_ASSINADA).flush(null);
    await tick();
    controller
      .expectOne(
        `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/documentos-edital/${DOCUMENTO_ID}/confirmacao`,
      )
      .flush({
        id: DOCUMENTO_ID,
        processoSeletivoId: PROCESSO_ID,
        status: 'Confirmado',
        tamanhoBytes: 2048,
        hashSha256: 'a'.repeat(64),
        confirmadoEm: '2026-08-13T12:00:00Z',
      });
    await retomada;

    expect(componente.anexo()?.fase).toBe('confirmado');
  });

  /**
   * A segunda escolha durante a criação trocaria o arquivo sob os pés do fluxo
   * em curso: o anexo exibiria o nome do primeiro e o storage receberia os
   * bytes do segundo — que o backend selaria como documento imutável.
   */
  it('ignora um segundo arquivo escolhido enquanto a operação está em curso', async () => {
    preencherPassoInteiro();
    const primeiro = componente['anexar'](pdf('primeiro.pdf'));
    await tick();

    await componente['anexar'](pdf('segundo.pdf'));

    const criacao = controller.expectOne(`${BASE}/api/selecao/processos-seletivos`);
    criacao.flush(PROCESSO_ID, { status: 201, statusText: 'Created' });
    await tick();

    expect(componente.anexo()?.name).toBe('primeiro.pdf');

    const falha = problema(422, 'DocumentoEdital.Invalido', 'Documento recusado');
    controller
      .expectOne(`${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/documentos-edital`)
      .flush(falha.body, falha.opts);
    await primeiro;
  });

  /**
   * Falha de rede na criação não diz se o servidor executou o comando. Repetir
   * com o mesmo corpo e a mesma chave devolve o replay; repetir com o rascunho
   * editado devolveria `body_mismatch` e a correção seguinte criaria um
   * segundo processo.
   */
  it('repete a criação inconclusiva com o mesmo corpo, ignorando edição posterior', async () => {
    preencherPassoInteiro();
    const primeira = componente['persistir']();

    const req1 = controller.expectOne(`${BASE}/api/selecao/processos-seletivos`);
    const chave1 = req1.request.headers.get('Idempotency-Key');
    const corpoOriginal = req1.request.body;
    req1.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await primeira;

    expect(componente.criacaoIndefinida()).toBe(true);
    store.patchObjectSection('identificacao', { nome: 'Nome editado depois da falha' });

    const segunda = componente['persistir']();
    const req2 = controller.expectOne(`${BASE}/api/selecao/processos-seletivos`);
    expect(req2.request.headers.get('Idempotency-Key')).toBe(chave1);
    expect(req2.request.body).toEqual(corpoOriginal);
    req2.flush(PROCESSO_ID, { status: 201, statusText: 'Created' });
    await segunda;

    expect(componente.criacaoIndefinida()).toBe(false);
  });

  /**
   * Se o arquivo já chegou ao storage, repetir o PUT é desperdício e pode
   * esbarrar numa URL expirada — só a confirmação falta.
   */
  it('retoma direto da confirmação quando o arquivo já foi enviado', async () => {
    preencherCamposDoComando();
    store.processoSeletivoId.set(PROCESSO_ID);
    const anexo = componente['anexar'](pdf());
    await tick();

    controller
      .expectOne(`${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/documentos-edital`)
      .flush(iniciacao(), { status: 201, statusText: 'Created' });
    await tick();
    controller.expectOne(URL_ASSINADA).flush(null);
    await tick();

    const falha = problema(422, 'DocumentoEdital.ObjetoNaoEncontrado', 'Objeto ausente');
    controller
      .expectOne(
        `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/documentos-edital/${DOCUMENTO_ID}/confirmacao`,
      )
      .flush(falha.body, falha.opts);
    await anexo;
    expect(componente.anexo()?.enviado).toBe(true);

    const retomada = componente.retomarUpload();
    await tick();

    // Nenhuma nova iniciação e nenhum novo PUT: só a confirmação.
    controller.expectNone(
      `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/documentos-edital`,
    );
    controller.expectNone(URL_ASSINADA);
    controller
      .expectOne(
        `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/documentos-edital/${DOCUMENTO_ID}/confirmacao`,
      )
      .flush({
        id: DOCUMENTO_ID,
        processoSeletivoId: PROCESSO_ID,
        status: 'Confirmado',
        tamanhoBytes: 2048,
        hashSha256: 'a'.repeat(64),
        confirmadoEm: '2026-08-13T12:00:00Z',
      });
    await retomada;

    expect(componente.anexo()?.fase).toBe('confirmado');
  });

  /**
   * O tipo é escolhido no passo 1 e entra no comando retido. Deixá-lo editável
   * durante a espera faria o rascunho exibir um tipo diferente do processo que
   * a retentativa vai confirmar no servidor.
   */
  it('congela também o passo 1 enquanto a criação está indefinida', async () => {
    preencherPassoInteiro();
    const primeira = componente['persistir']();

    controller
      .expectOne(`${BASE}/api/selecao/processos-seletivos`)
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await primeira;

    expect(store.cadastroInicialCongelado()).toBe(true);
  });

  /** Sem anexo registrado, a falha da criação não teria onde oferecer o retry. */
  it('registra o anexo em erro quando a criação falha, com retomada disponível', async () => {
    preencherPassoInteiro();
    const anexo = componente['anexar'](pdf());
    await tick();

    const recusa = problema(422, 'ProcessoSeletivo.NomeDuplicado', 'Nome já utilizado');
    controller.expectOne(`${BASE}/api/selecao/processos-seletivos`).flush(recusa.body, recusa.opts);
    await anexo;

    expect(componente.anexo()?.fase).toBe('erro');
    expect(componente.anexo()?.mensagemErro).toContain('Nome já utilizado');
  });

  /**
   * 413 é recusa definitiva do filtro de idempotência: manter a chave prenderia
   * a tela repetindo para sempre um comando que o servidor não aceita.
   */
  it('rotaciona a chave e libera os campos após 413', async () => {
    preencherPassoInteiro();
    const primeira = componente['persistir']();

    const req1 = controller.expectOne(`${BASE}/api/selecao/processos-seletivos`);
    const chave1 = req1.request.headers.get('Idempotency-Key');
    const grande = problema(413, 'uniplus.idempotency.body_muito_grande', 'Corpo muito grande');
    req1.flush(grande.body, grande.opts);
    await primeira;

    expect(componente.criacaoIndefinida()).toBe(false);

    const segunda = componente['persistir']();
    const req2 = controller.expectOne(`${BASE}/api/selecao/processos-seletivos`);
    expect(req2.request.headers.get('Idempotency-Key')).not.toBe(chave1);
    req2.flush(PROCESSO_ID, { status: 201, statusText: 'Created' });
    await segunda;
  });

  /**
   * O campo de arquivo continua alcançável pelo teclado mesmo com a zona de
   * upload marcada como indisponível — e cada anexo confirmado vira um
   * documento imutável a mais no processo.
   */
  it('recusa substituir um edital já confirmado', async () => {
    preencherPassoInteiro();
    store.processoSeletivoId.set(PROCESSO_ID);
    store.patchObjectSection('identificacao', {
      uploads: [
        { id: 'a', name: 'edital.pdf', extension: 'pdf', progress: 100, fase: 'confirmado' },
      ],
    });

    await componente['anexar'](pdf('outro.pdf'));

    expect(componente.uploadError()).toContain('não pode ser substituído');
    expect(componente.anexo()?.name).toBe('edital.pdf');
  });

  /**
   * Confirmação sem resposta pode ter selado o documento no servidor. Trocar o
   * arquivo aqui criaria um segundo edital imutável e perderia a referência do
   * primeiro — só a retentativa da mesma confirmação resolve.
   */
  it('não deixa trocar nem remover o anexo com confirmação indefinida', async () => {
    preencherCamposDoComando();
    store.processoSeletivoId.set(PROCESSO_ID);
    const anexo = componente['anexar'](pdf('primeiro.pdf'));
    await tick();

    controller
      .expectOne(`${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/documentos-edital`)
      .flush(iniciacao(), { status: 201, statusText: 'Created' });
    await tick();
    controller.expectOne(URL_ASSINADA).flush(null);
    await tick();

    // Confirmação sem resposta: erro de rede, sem status.
    controller
      .expectOne(
        `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/documentos-edital/${DOCUMENTO_ID}/confirmacao`,
      )
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await anexo;

    expect(componente.anexo()?.confirmacaoIndefinida).toBe(true);
    expect(componente.anexoBloqueado()).toBe(true);

    await componente['anexar'](pdf('segundo.pdf'));
    expect(componente.anexo()?.name).toBe('primeiro.pdf');
    expect(componente.uploadError()).toContain('sem resposta');

    componente.removeUpload();
    expect(componente.anexo()).toBeDefined();

    // A retentativa repete só a confirmação, com a mesma chave.
    const retomada = componente.retomarUpload();
    await tick();
    controller.expectNone(URL_ASSINADA);
    controller
      .expectOne(
        `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/documentos-edital/${DOCUMENTO_ID}/confirmacao`,
      )
      .flush({
        id: DOCUMENTO_ID,
        processoSeletivoId: PROCESSO_ID,
        status: 'Confirmado',
        tamanhoBytes: 2048,
        hashSha256: 'a'.repeat(64),
        confirmadoEm: '2026-08-13T12:00:00Z',
      });
    await retomada;

    expect(componente.anexo()?.fase).toBe('confirmado');
    expect(componente.anexo()?.confirmacaoIndefinida).toBe(false);
  });

  it('não remove o anexo já confirmado', async () => {
    preencherCamposDoComando();
    store.processoSeletivoId.set(PROCESSO_ID);
    store.patchObjectSection('identificacao', {
      uploads: [{ id: 'a', name: 'edital.pdf', extension: 'pdf', progress: 100, fase: 'confirmado' }],
    });

    componente.removeUpload();

    expect(componente.anexo()).toBeDefined();
  });
  it('exige a localidade para avançar', () => {
    store.patchObjectSection('identificacao', {
      numero: '12/2026',
      ano: 2026,
      data: '2026-09-01',
      orgao: 'CEPS',
      periodo: '1º semestre',
      nome: 'Processo Seletivo 2027',
      unidadeAdministradoraId: UNIDADE_ID,
      origemCandidatos: OrigemCandidatos.inscricaoPropria,
    });

    const resultado = componente.validate();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages).toContain(
      'Informe o município cujo calendário rege os prazos do processo.',
    );
  });

  it('barra o anexo antes da requisição quando falta a localidade', async () => {
    store.patchObjectSection('tipoProcesso', { selected: TIPO_ID });
    store.patchObjectSection('identificacao', {
      nome: 'Processo Seletivo 2027',
      unidadeAdministradoraId: UNIDADE_ID,
      origemCandidatos: OrigemCandidatos.inscricaoPropria,
    });

    await componente['anexar'](pdf());

    // controller.verify() no afterEach prova que nenhuma requisição saiu.
    expect(componente.uploadError()).toContain('município que rege os prazos');
  });

  it('envia o trio da localidade escolhida no cadastro inicial', async () => {
    preencherCamposDoComando();

    const anexo = componente['anexar'](pdf());
    await tick();

    const criacao = controller.expectOne(`${BASE}/api/selecao/processos-seletivos`);
    expect(criacao.request.body).toMatchObject({
      localidadeCodigoIbge: '1504208',
      localidadeNome: 'Marabá',
      localidadeUf: 'PA',
    });
    criacao.flush(PROCESSO_ID);
    await tick();
    controller.match(() => true).forEach((r) => r.flush({}, { status: 500, statusText: 'x' }));
    await anexo.catch(() => undefined);
  });

  it('busca municípios na Geo a partir de três letras e grava o trio da opção', async () => {
    componente.buscarMunicipios('ma');
    controller.expectNone(() => true);

    componente.buscarMunicipios('mar');
    const busca = controller.expectOne((r) => r.url.includes('/api/cidades'));
    expect(busca.request.params.get('q')).toBe('mar');
    busca.flush([{ id: 'x', codigoIbge: '1504208', nome: 'Marabá', uf: 'PA', ddd: '94' }]);
    await tick();

    expect(componente.municipios()).toHaveLength(1);

    componente.selecionarLocalidade({ codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' });

    expect(store.draft().identificacao.localidade).toEqual(MARABA);
    expect(componente.municipios()).toEqual([]);
  });

  it('limpar a localidade devolve o campo à busca', () => {
    store.patchObjectSection('identificacao', { localidade: MARABA });

    componente.limparLocalidade();

    expect(store.draft().identificacao.localidade).toBeNull();
  });
});
