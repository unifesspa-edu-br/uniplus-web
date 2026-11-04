import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { EnvioDoEdital } from '../envio-do-edital.service';
import { GravacaoDoProcesso } from '../gravacao/gravacao-do-processo';
import {
  BASE,
  DOCUMENTO_ID,
  PROCESSO_ID,
  ROTA_DOCUMENTOS,
  URL_ASSINADA,
  documentoConfirmado,
  iniciacao,
  pdf,
  percorrerOEnvio,
  problema,
  tick,
} from './anexo-edital.testing';
import { EtapasDoEnvioDoEdital } from './etapas-do-envio-do-edital';

describe('EtapasDoEnvioDoEdital', () => {
  let etapas: EtapasDoEnvioDoEdital;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProcessoSeletivoStore,
        EnvioDoEdital,
        GravacaoDoProcesso,
        EtapasDoEnvioDoEdital,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });

    etapas = TestBed.inject(EtapasDoEnvioDoEdital);
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);

    // O anexo pressupõe o processo já criado: a rota do documento é `/{id}/documentos-a-publicar`.
    store.processoSeletivoId.set(PROCESSO_ID);
  });

  afterEach(() => controller.verify());

  const anexarComSucesso = (arquivo = pdf()) => percorrerOEnvio(etapas, controller, arquivo);

  /** O anexo não cria o processo: sem id, não há rota para onde enviar. */
  it('recusa anexar antes de o processo existir', () => {
    store.processoSeletivoId.set(null);

    void etapas.anexar(pdf());

    expect(etapas.uploadError()).toContain('cadastro do processo precisa estar concluído');
  });

  it('percorre iniciação, envio e confirmação até selar o documento', async () => {
    await anexarComSucesso();

    expect(etapas.anexo()?.fase).toBe('confirmado');
    expect(etapas.anexo()?.progress).toBe(100);
    expect(etapas.anexo()?.documentoAPublicarId).toBe(DOCUMENTO_ID);
  });

  /**
   * A assinatura não volta a valer depois de recusada pelo storage: a
   * retentativa precisa pedir outra URL, não repetir a mesma.
   */
  it('descarta a iniciação quando o storage recusa a URL', async () => {
    void etapas.anexar(pdf());
    await tick();

    controller.expectOne(ROTA_DOCUMENTOS).flush(iniciacao(), {
      status: 201,
      statusText: 'Created',
    });
    await tick();

    controller.expectOne(URL_ASSINADA).flush('expired', { status: 403, statusText: 'Forbidden' });
    await tick();

    expect(etapas.anexo()?.fase).toBe('erro');
    expect(etapas.anexo()?.documentoAPublicarId).toBeUndefined();
  });

  /**
   * Uma segunda escolha durante o envio trocaria o arquivo sob os pés do fluxo:
   * o anexo exibiria o nome do primeiro e o storage receberia os bytes do
   * segundo — que o backend selaria como documento imutável.
   */
  it('ignora um segundo arquivo escolhido enquanto o envio corre', async () => {
    void etapas.anexar(pdf('primeiro.pdf'));
    await tick();

    void etapas.anexar(pdf('segundo.pdf'));

    expect(etapas.uploadError()).toContain('envio de edital em andamento');
    expect(etapas.anexo()?.name).toBe('primeiro.pdf');

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
    void etapas.anexar(pdf());
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

    expect(etapas.anexo()?.fase).toBe('erro');
    expect(etapas.anexo()?.enviado).toBe(true);

    void etapas.retomar();
    await tick();

    controller
      .expectOne(`${ROTA_DOCUMENTOS}/${DOCUMENTO_ID}/confirmacao`)
      .flush({ id: DOCUMENTO_ID });
    await tick();

    expect(etapas.anexo()?.fase).toBe('confirmado');
  });

  it('registra o anexo em erro quando a iniciação falha', async () => {
    void etapas.anexar(pdf());
    await tick();

    const recusa = problema(503, 'uniplus.client.network_error', 'Serviço indisponível');
    controller.expectOne(ROTA_DOCUMENTOS).flush(recusa.body, recusa.opts);
    await tick();

    expect(etapas.anexo()?.fase).toBe('erro');
    expect(etapas.anexo()?.mensagemErro).toBeTruthy();
  });

  const SO_FALTA_CONFIRMAR = {
    id: 'x',
    name: 'edital.pdf',
    extension: 'pdf' as const,
    progress: 100,
    fase: 'erro' as const,
    mensagemErro: 'Sem resposta.',
    enviado: true,
    documentoAPublicarId: DOCUMENTO_ID,
    confirmacaoIndefinida: true,
  };

  it('descarta a resposta da retomada quando o editor trocou de processo', async () => {
    store.patchObjectSection('identificacao', { uploads: [SO_FALTA_CONFIRMAR] });
    void etapas.retomar();
    await tick();

    store.geracao.update((geracao) => geracao + 1);
    controller
      .expectOne(`${ROTA_DOCUMENTOS}/${DOCUMENTO_ID}/confirmacao`)
      .flush({ id: DOCUMENTO_ID }, { status: 200, statusText: 'OK' });
    await tick();

    expect(etapas.anexo()?.fase).toBe('confirmando');
  });

  it('repete a chave do início após falha de rede e gira a chave quando o arquivo muda', async () => {
    const chaveDoInicio = (): string => {
      const requisicao = controller.expectOne(ROTA_DOCUMENTOS);
      const chave = requisicao.request.headers.get('Idempotency-Key') ?? '';
      requisicao.error(new ProgressEvent('error'));
      return chave;
    };

    void etapas.anexar(pdf('primeiro.pdf'));
    await tick();
    const primeira = chaveDoInicio();
    await tick();

    void etapas.retomar();
    await tick();
    const repetida = chaveDoInicio();
    await tick();

    void etapas.anexar(pdf('segundo.pdf'));
    await tick();
    const outroArquivo = chaveDoInicio();
    await tick();

    expect(primeira).not.toBe('');
    expect(repetida).toBe(primeira);
    expect(outroArquivo).not.toBe(primeira);
  });

  it('limpa a recusa anterior ao retomar o envio', async () => {
    void etapas.anexar(pdf());
    await tick();
    controller
      .expectOne(ROTA_DOCUMENTOS)
      .flush(
        problema(503, 'uniplus.client.network_error', 'Indisponível').body,
        problema(503, 'uniplus.client.network_error', 'Indisponível').opts,
      );
    await tick();
    etapas.uploadError.set('Recusa antiga.');

    void etapas.retomar();
    await tick();

    expect(etapas.uploadError()).toBeNull();
    controller.expectOne(ROTA_DOCUMENTOS);
  });

  it('limpa a recusa anterior ao remover o anexo', async () => {
    void etapas.anexar(pdf('primeiro.pdf'));
    await tick();
    controller
      .expectOne(ROTA_DOCUMENTOS)
      .flush(problema(500, 'x', 'Falhou').body, problema(500, 'x', 'Falhou').opts);
    await tick();
    etapas.uploadError.set('Recusa antiga.');

    etapas.remover();

    expect(etapas.uploadError()).toBeNull();
    expect(etapas.anexo()).toBeUndefined();
  });

  /** Cada anexo confirmado vira um documento imutável a mais no processo. */
  it('recusa substituir um edital já confirmado', async () => {
    await anexarComSucesso();

    void etapas.anexar(pdf('outro.pdf'));

    expect(etapas.uploadError()).toContain('não pode ser substituído');
    expect(etapas.anexo()?.name).toBe('edital.pdf');
  });

  it('não remove o anexo já confirmado', async () => {
    await anexarComSucesso();

    etapas.remover();

    expect(etapas.anexo()).toBeDefined();
  });

  /**
   * A confirmação sem resposta pode ter sido registrada no servidor: trocar o
   * arquivo agora criaria um segundo edital selado.
   */
  it('não deixa trocar nem remover o anexo com confirmação indefinida', async () => {
    void etapas.anexar(pdf('primeiro.pdf'));
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

    expect(etapas.anexo()?.confirmacaoIndefinida).toBe(true);

    void etapas.anexar(pdf('segundo.pdf'));
    expect(etapas.uploadError()).toContain('ficou sem resposta');

    etapas.remover();
    expect(etapas.anexo()?.name).toBe('primeiro.pdf');
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

    expect(etapas.anexoBloqueado()).toBe(true);
  });

  /**
   * Anexar é escrita, e o servidor recusa a de processo fora de rascunho. Um
   * rascunho cancelado, por exemplo, não tem edital confirmado, então nenhum
   * dos outros bloqueios pega — só o estado do processo.
   */
  it('bloqueia o anexo em processo fora de rascunho', () => {
    store.remoteSnapshot.set({ status: 'cancelado' } as never);

    expect(etapas.anexoBloqueado()).toBe(true);
  });

  /** Sem saber se já existe edital, anexar é apostar que não existe. */
  it('bloqueia o anexo enquanto o estado dos documentos é desconhecido', () => {
    store.avisoDocumentos.set('Não foi possível verificar se já há edital anexado.');

    expect(etapas.anexoBloqueado()).toBe(true);
  });
});
