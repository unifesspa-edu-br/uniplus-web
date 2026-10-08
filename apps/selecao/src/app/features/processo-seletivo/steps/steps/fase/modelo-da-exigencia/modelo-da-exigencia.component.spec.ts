import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ModeloDaExigencia } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { ModeloDaExigenciaComponent } from './modelo-da-exigencia.component';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000005aa';
const MODELO_ID = '01960000-0000-7000-0000-00000000a0de';
const ROTA_MODELOS = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/modelos-de-documento`;
const URL_ASSINADA = 'http://localhost:9000/uniplus-selecao/modelos/pendente.docx?X-Amz-Signature=abc';
const URL_LEITURA = 'http://localhost:9000/uniplus-selecao/modelos/confirmado.docx?X-Amz-Signature=leitura';
const CONTENT_TYPE_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const HASH = 'ab'.repeat(32);

const VINCULADO: ModeloDaExigencia = {
  modeloId: MODELO_ID,
  nomeArquivo: 'autodeclaracao.docx',
  formato: 'DOCX',
  hashSha256: HASH,
};

function docx(nome = 'autodeclaracao.docx', bytes = 2048): File {
  return new File([new Uint8Array(bytes).fill(80)], nome, { type: CONTENT_TYPE_DOCX });
}

/** Cede o event loop para a cadeia de `await` do componente chegar à próxima requisição. */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function problema(status: number, code: string, title: string, detail?: string) {
  return {
    body: { type: 'about:blank', title, status, code, detail, traceId: 'trace-1' },
    opts: { status, statusText: title, headers: { 'Content-Type': 'application/problem+json' } },
  };
}

function iniciacao() {
  return {
    modeloDeDocumentoId: MODELO_ID,
    urlUpload: URL_ASSINADA,
    contentTypeExigido: CONTENT_TYPE_DOCX,
    expiraEm: new Date(Date.now() + 900_000).toISOString(),
  };
}

function confirmado() {
  return {
    id: MODELO_ID,
    processoSeletivoId: PROCESSO_ID,
    nomeArquivo: 'autodeclaracao.docx',
    formato: 'DOCX',
    status: 'Confirmado',
    criadoEm: '2026-10-04T12:00:00Z',
    expiraEm: '2026-10-04T12:15:00Z',
    tamanhoBytes: 2048,
    hashSha256: HASH,
    confirmadoEm: '2026-10-04T12:01:00Z',
  };
}

describe('ModeloDaExigenciaComponent', () => {
  let fixture: ComponentFixture<ModeloDaExigenciaComponent>;
  let componente: ModeloDaExigenciaComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let emitidos: (ModeloDaExigencia | null)[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModeloDaExigenciaComponent],
      providers: [
        ProcessoSeletivoStore,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ModeloDaExigenciaComponent);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('modelo', null);
    fixture.componentRef.setInput('idBase', 'doc-modelo-rg');
    fixture.componentRef.setInput('nomeDoDocumento', 'Autodeclaração étnico-racial');
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);
    store.processoSeletivoId.set(PROCESSO_ID);
    emitidos = [];
    componente.modeloChange.subscribe((modelo) => emitidos.push(modelo));
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  function escolher(arquivo: File): void {
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[type="file"]');
    if (input === null) throw new Error('campo de arquivo ausente');
    Object.defineProperty(input, 'files', { value: [arquivo], configurable: true });
    input.dispatchEvent(new Event('change'));
  }

  /** Iniciação e PUT bem-sucedidos; a confirmação fica para o teste responder. */
  async function enviarAteAConfirmacao(): Promise<void> {
    escolher(docx());
    await tick();
    controller.expectOne(ROTA_MODELOS).flush(iniciacao(), { status: 201, statusText: 'Created' });
    await tick();
    controller.expectOne(URL_ASSINADA).flush(null);
    await tick();
  }

  it('recusa arquivo que não é editável sem chamar a API', () => {
    escolher(new File(['%PDF'], 'autodeclaracao.pdf', { type: 'application/pdf' }));

    expect(componente.recusa()).toContain('DOCX ou ODT');
  });

  it('recusa modelo acima de 10 MB sem chamar a API', () => {
    escolher(docx('grande.docx', 10 * 1024 * 1024 + 1));

    expect(componente.recusa()).toContain('10 MB');
  });

  it('envia, confirma e vincula o modelo com nome, formato e hash', async () => {
    escolher(docx());
    await tick();
    const inicio = controller.expectOne(ROTA_MODELOS);
    expect(inicio.request.body).toEqual({ nomeArquivo: 'autodeclaracao.docx', formato: 'DOCX' });
    inicio.flush(iniciacao(), { status: 201, statusText: 'Created' });
    await tick();
    const put = controller.expectOne(URL_ASSINADA);
    expect(put.request.headers.get('Content-Type')).toBe(CONTENT_TYPE_DOCX);
    put.flush(null);
    await tick();

    controller.expectOne(`${ROTA_MODELOS}/${MODELO_ID}/confirmacao`).flush(confirmado());
    await tick();

    expect(emitidos).toEqual([VINCULADO]);
  });

  /** A macro, o formato que não é texto e o tamanho só o servidor confere no conteúdo. */
  it('exibe a recusa do conteúdo pela API e não vincula o modelo', async () => {
    await enviarAteAConfirmacao();

    const { body, opts } = problema(
      422,
      'uniplus.selecao.modelo_de_documento.contem_macro',
      'O modelo não pode conter macro',
      'O modelo não pode conter macro: ele é distribuído ao candidato.',
    );
    controller.expectOne(`${ROTA_MODELOS}/${MODELO_ID}/confirmacao`).flush(body, opts);
    await tick();

    expect(emitidos).toEqual([]);
    expect(componente.envio()?.erro).toBe('O modelo não pode conter macro: ele é distribuído ao candidato.');
    expect(componente.envio()?.retomavel).toBe(false);
  });

  /**
   * Sem resposta definitiva, o modelo pode já estar selado: a retentativa repete a MESMA
   * confirmação, com a mesma chave, em vez de enviar o arquivo de novo.
   */
  it('repete a confirmação inconclusiva com a mesma chave, sem novo envio', async () => {
    await enviarAteAConfirmacao();
    const primeira = controller.expectOne(`${ROTA_MODELOS}/${MODELO_ID}/confirmacao`);
    const chave = primeira.request.headers.get('Idempotency-Key');
    const { body, opts } = problema(503, 'uniplus.internal.indisponivel', 'Serviço indisponível');
    primeira.flush(body, opts);
    await tick();

    expect(componente.bloqueado()).toBe(true);
    void componente.retomar();
    await tick();

    const segunda = controller.expectOne(`${ROTA_MODELOS}/${MODELO_ID}/confirmacao`);
    expect(segunda.request.headers.get('Idempotency-Key')).toBe(chave);
    segunda.flush(confirmado());
    await tick();

    expect(emitidos).toEqual([VINCULADO]);
  });

  /** O editor sobrevive à troca de processo: a confirmação do anterior não vincula no atual. */
  it('não vincula a confirmação que chega depois da troca de processo', async () => {
    await enviarAteAConfirmacao();
    store.geracao.update((geracao) => geracao + 1);

    controller.expectOne(`${ROTA_MODELOS}/${MODELO_ID}/confirmacao`).flush(confirmado());
    await tick();

    expect(emitidos).toEqual([]);
  });

  it('confere o modelo vinculado pela URL temporária do acesso', async () => {
    fixture.componentRef.setInput('modelo', VINCULADO);
    const aba = { location: { href: '' }, opener: {} as unknown, close: vi.fn() };
    const abrir = vi.spyOn(window, 'open').mockReturnValue(aba as unknown as Window);

    const conferencia = componente.conferir();
    await tick();
    const acesso = controller.expectOne(`${ROTA_MODELOS}/${MODELO_ID}/acesso`);
    expect(acesso.request.headers.get('Accept')).toBe(
      'application/vnd.uniplus.acesso-modelo-de-documento.v1+json',
    );
    acesso.flush({ url: URL_LEITURA, expiraEm: '2026-10-04T12:05:00Z' });
    await conferencia;

    expect(aba.location.href).toBe(URL_LEITURA);
    expect((fixture.nativeElement as HTMLElement).innerHTML).not.toContain('X-Amz-Signature');
    abrir.mockRestore();
  });

  it('desvincula o modelo ao remover', () => {
    fixture.componentRef.setInput('modelo', VINCULADO);
    fixture.detectChanges();

    const remover = Array
      .from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((botao) => botao.textContent?.includes('Remover o modelo'),
    );
    remover?.click();

    expect(emitidos).toEqual([null]);
  });

  /** O aviso chega ao leitor de tela antes da escolha do arquivo, e não depois do envio. */
  it('liga ao campo de envio o aviso de publicação e de limpeza dos metadados', () => {
    const host = fixture.nativeElement as HTMLElement;
    const input = host.querySelector('input[type="file"]');
    const avisoId = input?.getAttribute('aria-describedby')?.split(' ')[0] ?? '';
    const aviso = host.querySelector(`[id="${avisoId}"]`)?.textContent ?? '';

    expect(aviso).toContain('público na publicação do edital');
    expect(aviso).toContain('autor, últimos editores');
  });
});
