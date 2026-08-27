import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../cadastro-inicial.service';
import { AnexoEditalComponent } from './anexo-edital.component';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000005aa';
const DOCUMENTO_ID = '01960000-0000-7000-0000-0000000005dd';
const URL_ASSINADA = 'http://localhost:9000/uniplus-selecao/editais/edital.pdf?X-Amz-Signature=abc';

const ROTA_DOCUMENTOS = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/documentos-edital`;

/** Um PDF mínimo: a assinatura importa para a recusa client-side. */
function pdf(nome = 'edital.pdf', bytes = 2048): File {
  return new File([new Uint8Array(bytes).fill(37)], nome, { type: 'application/pdf' });
}

/**
 * Cede o event loop para que a cadeia de `await` do componente avance até a
 * próxima requisição. `Promise.resolve()` sozinho não basta: cada fase do fluxo
 * passa por `firstValueFrom` e por mais de um microtask.
 */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Recusa no formato que a API realmente emite. O `apiResultInterceptor` só
 * parseia o `code` quando o content type é `application/problem+json`.
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

function documentoConfirmado(id: string, hash: string, confirmadoEm: string) {
  return {
    id,
    processoSeletivoId: PROCESSO_ID,
    status: 'Confirmado',
    criadoEm: '2026-08-20T12:00:00Z',
    expiraEm: '2026-08-20T12:15:00Z',
    tamanhoBytes: 2048,
    hashSha256: hash,
    confirmadoEm,
  };
}

describe('AnexoEditalComponent', () => {
  let componente: AnexoEditalComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnexoEditalComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicialService,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AnexoEditalComponent);
    componente = fixture.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    // O anexo pressupõe o processo já criado — a rota do documento é
    // `/{id}/documentos-edital`. Quem o cria é a conclusão da identificação.
    store.processoSeletivoId.set(PROCESSO_ID);
  });

  afterEach(() => controller.verify());

  /** Percorre as três fases até o documento selado. */
  async function anexarComSucesso(arquivo = pdf()): Promise<void> {
    void componente['anexar'](arquivo);
    await tick();

    controller.expectOne(ROTA_DOCUMENTOS).flush(iniciacao(), {
      status: 201,
      statusText: 'Created',
    });
    await tick();

    controller.expectOne(URL_ASSINADA).flush(null);
    await tick();

    controller
      .expectOne(`${ROTA_DOCUMENTOS}/${DOCUMENTO_ID}/confirmacao`)
      .flush({ id: DOCUMENTO_ID }, { status: 200, statusText: 'OK' });
    await tick();
  }

  it('recusa arquivo que não é PDF sem chamar a API', () => {
    void componente['anexar'](new File(['x'], 'edital.docx', { type: 'application/msword' }));

    expect(componente.uploadError()).toContain('deve ser um arquivo PDF');
  });

  it('recusa PDF acima de 20 MB sem chamar a API', () => {
    void componente['anexar'](pdf('grande.pdf', 20 * 1024 * 1024 + 1));

    expect(componente.uploadError()).toContain('20 MB');
  });

  /** O anexo não cria o processo: sem id, não há rota para onde enviar. */
  it('recusa anexar antes de o processo existir', () => {
    store.processoSeletivoId.set(null);

    void componente['anexar'](pdf());

    expect(componente.uploadError()).toContain('cadastro do processo precisa estar concluído');
  });

  it('percorre iniciação, envio e confirmação até selar o documento', async () => {
    await anexarComSucesso();

    expect(componente.anexo()?.fase).toBe('confirmado');
    expect(componente.anexo()?.progress).toBe(100);
    expect(componente.anexo()?.documentoEditalId).toBe(DOCUMENTO_ID);
  });

  /**
   * A assinatura não volta a valer depois de recusada pelo storage: a
   * retentativa precisa pedir outra URL, não repetir a mesma.
   */
  it('descarta a iniciação quando o storage recusa a URL', async () => {
    void componente['anexar'](pdf());
    await tick();

    controller.expectOne(ROTA_DOCUMENTOS).flush(iniciacao(), {
      status: 201,
      statusText: 'Created',
    });
    await tick();

    controller.expectOne(URL_ASSINADA).flush('expired', { status: 403, statusText: 'Forbidden' });
    await tick();

    expect(componente.anexo()?.fase).toBe('erro');
    expect(componente.anexo()?.documentoEditalId).toBeUndefined();
  });

  /**
   * Uma segunda escolha durante o envio trocaria o arquivo sob os pés do fluxo:
   * o anexo exibiria o nome do primeiro e o storage receberia os bytes do
   * segundo — que o backend selaria como documento imutável.
   */
  it('ignora um segundo arquivo escolhido enquanto o envio corre', async () => {
    void componente['anexar'](pdf('primeiro.pdf'));
    await tick();

    void componente['anexar'](pdf('segundo.pdf'));

    expect(componente.uploadError()).toContain('envio de edital em andamento');
    expect(componente.anexo()?.name).toBe('primeiro.pdf');

    controller.expectOne(ROTA_DOCUMENTOS).flush(iniciacao(), {
      status: 201,
      statusText: 'Created',
    });
    await tick();
    controller.expectOne(URL_ASSINADA).flush(null);
    await tick();
    controller
      .expectOne(`${ROTA_DOCUMENTOS}/${DOCUMENTO_ID}/confirmacao`)
      .flush({ id: DOCUMENTO_ID });
    await tick();
  });

  /**
   * O arquivo já chegou ao storage: repetir o PUT seria desperdício e
   * esbarraria numa URL possivelmente expirada. Só a confirmação falta.
   */
  it('retoma direto da confirmação quando o arquivo já foi enviado', async () => {
    void componente['anexar'](pdf());
    await tick();

    controller.expectOne(ROTA_DOCUMENTOS).flush(iniciacao(), {
      status: 201,
      statusText: 'Created',
    });
    await tick();
    controller.expectOne(URL_ASSINADA).flush(null);
    await tick();

    const recusa = problema(503, 'uniplus.client.network_error', 'Serviço indisponível');
    controller
      .expectOne(`${ROTA_DOCUMENTOS}/${DOCUMENTO_ID}/confirmacao`)
      .flush(recusa.body, recusa.opts);
    await tick();

    expect(componente.anexo()?.fase).toBe('erro');
    expect(componente.anexo()?.enviado).toBe(true);

    void componente.retomarUpload();
    await tick();

    controller
      .expectOne(`${ROTA_DOCUMENTOS}/${DOCUMENTO_ID}/confirmacao`)
      .flush({ id: DOCUMENTO_ID });
    await tick();

    expect(componente.anexo()?.fase).toBe('confirmado');
  });

  it('registra o anexo em erro quando a iniciação falha', async () => {
    void componente['anexar'](pdf());
    await tick();

    const recusa = problema(503, 'uniplus.client.network_error', 'Serviço indisponível');
    controller.expectOne(ROTA_DOCUMENTOS).flush(recusa.body, recusa.opts);
    await tick();

    expect(componente.anexo()?.fase).toBe('erro');
    expect(componente.anexo()?.mensagemErro).toBeTruthy();
  });

  /** Cada anexo confirmado vira um documento imutável a mais no processo. */
  it('recusa substituir um edital já confirmado', async () => {
    await anexarComSucesso();

    void componente['anexar'](pdf('outro.pdf'));

    expect(componente.uploadError()).toContain('não pode ser substituído');
    expect(componente.anexo()?.name).toBe('edital.pdf');
  });

  it('não remove o anexo já confirmado', async () => {
    await anexarComSucesso();

    componente.removeUpload();

    expect(componente.anexo()).toBeDefined();
  });

  /**
   * A confirmação sem resposta pode ter sido registrada no servidor: trocar o
   * arquivo agora criaria um segundo edital selado.
   */
  it('não deixa trocar nem remover o anexo com confirmação indefinida', async () => {
    void componente['anexar'](pdf('primeiro.pdf'));
    await tick();

    controller.expectOne(ROTA_DOCUMENTOS).flush(iniciacao(), {
      status: 201,
      statusText: 'Created',
    });
    await tick();
    controller.expectOne(URL_ASSINADA).flush(null);
    await tick();

    const inconclusiva = problema(503, 'uniplus.client.network_error', 'Sem resposta');
    controller
      .expectOne(`${ROTA_DOCUMENTOS}/${DOCUMENTO_ID}/confirmacao`)
      .flush(inconclusiva.body, inconclusiva.opts);
    await tick();

    expect(componente.anexo()?.confirmacaoIndefinida).toBe(true);

    void componente['anexar'](pdf('segundo.pdf'));
    expect(componente.uploadError()).toContain('ficou sem resposta');

    componente.removeUpload();
    expect(componente.anexo()?.name).toBe('primeiro.pdf');
  });

  /** Enviar outro durante a escolha criaria um terceiro documento imutável. */
  it('bloqueia o anexo enquanto há escolha entre documentos confirmados', () => {
    store.documentosParaEscolha.set([
      documentoConfirmado(DOCUMENTO_ID, 'a'.repeat(64), '2026-08-20T12:05:00Z'),
      documentoConfirmado(
        '01960000-0000-7000-0000-0000000005de',
        'b'.repeat(64),
        '2026-08-20T12:12:00Z',
      ),
    ]);

    expect(componente.anexoBloqueado()).toBe(true);
  });

  /** Sem saber se já existe edital, anexar é apostar que não existe. */
  it('bloqueia o anexo enquanto o estado dos documentos é desconhecido', () => {
    store.avisoDocumentos.set('Não foi possível verificar se já há edital anexado.');

    expect(componente.anexoBloqueado()).toBe(true);
  });
});
