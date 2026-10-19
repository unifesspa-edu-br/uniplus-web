import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { AnexosDoEditalComponent } from './anexos-do-edital.component';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000005aa';
const DOCUMENTO_A = '01960000-0000-7000-0000-0000000005d1';
const DOCUMENTO_B = '01960000-0000-7000-0000-0000000005d2';
const URL_A = 'http://localhost:9000/uniplus-selecao/anexos/a?X-Amz-Signature=a';
const URL_B = 'http://localhost:9000/uniplus-selecao/anexos/b?X-Amz-Signature=b';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const ATO_ID = '01960000-0000-7000-0000-0000000005e1';
const ROTA_ATOS = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/atos`;
const ROTA_DOCUMENTOS = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/documentos-a-publicar`;

function arquivo(nome: string): File {
  return new File([new Uint8Array(2048).fill(37)], nome);
}

/** Cede o event loop para a cadeia de `await` do componente avançar até a próxima requisição. */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Recusa no formato que a API emite; o interceptor só lê o `code` de `problem+json`. */
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

function iniciacao(documentoAPublicarId: string, urlUpload: string, contentTypeExigido: string) {
  return {
    documentoAPublicarId,
    urlUpload,
    contentTypeExigido,
    expiraEm: new Date(Date.now() + 900_000).toISOString(),
  };
}

describe('AnexosDoEditalComponent', () => {
  let fixture: ComponentFixture<AnexosDoEditalComponent>;
  let componente: AnexosDoEditalComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let host: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnexosDoEditalComponent],
      providers: [
        ProcessoSeletivoStore,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AnexosDoEditalComponent);
    componente = fixture.componentInstance;
    host = fixture.nativeElement as HTMLElement;
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);
    store.processoSeletivoId.set(PROCESSO_ID);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const anexos = () => store.draft().publicacao.anexos;

  /** O envio do primeiro anexo até o storage; devolve a confirmação a responder. */
  async function iniciarEEnviar(
    documentoId: string,
    url: string,
    tipo: string,
  ): Promise<{ confirmacao: string }> {
    controller
      .expectOne(ROTA_DOCUMENTOS)
      .flush(iniciacao(documentoId, url, tipo), { status: 201, statusText: 'Created' });
    await tick();
    controller.expectOne(url).flush(null);
    await tick();
    return { confirmacao: `${ROTA_DOCUMENTOS}/${documentoId}/confirmacao` };
  }

  it('envia dois anexos um de cada vez, com a finalidade e o tipo de mídia de cada um', async () => {
    componente.aoEscolherArquivos([arquivo('cronograma.pdf'), arquivo('modelo.docx')]);
    await tick();

    const inicioA = controller.expectOne(ROTA_DOCUMENTOS);
    expect(inicioA.request.body).toEqual({
      finalidade: 'anexoDoEdital',
      nomeArquivo: 'cronograma.pdf',
      tipoDeMidia: 'application/pdf',
    });
    inicioA.flush(iniciacao(DOCUMENTO_A, URL_A, 'application/pdf'), {
      status: 201,
      statusText: 'Created',
    });
    await tick();
    controller.expectOne(URL_A).flush(null);
    await tick();
    // O segundo só começa depois de o primeiro selado.
    controller.expectNone(ROTA_DOCUMENTOS);
    controller
      .expectOne(`${ROTA_DOCUMENTOS}/${DOCUMENTO_A}/confirmacao`)
      .flush({ id: DOCUMENTO_A });
    await tick();

    const inicioB = controller.expectOne(ROTA_DOCUMENTOS);
    expect(inicioB.request.body).toMatchObject({ nomeArquivo: 'modelo.docx', tipoDeMidia: DOCX });
    inicioB.flush(iniciacao(DOCUMENTO_B, URL_B, DOCX), { status: 201, statusText: 'Created' });
    await tick();
    controller.expectOne(URL_B).flush(null);
    await tick();
    controller
      .expectOne(`${ROTA_DOCUMENTOS}/${DOCUMENTO_B}/confirmacao`)
      .flush({ id: DOCUMENTO_B });
    await tick();

    expect(anexos().map((a) => [a.fase, a.documentoAPublicarId, a.nome])).toEqual([
      ['confirmado', DOCUMENTO_A, 'cronograma'],
      ['confirmado', DOCUMENTO_B, 'modelo'],
    ]);
  });

  // Uma segunda escolha durante o envio entra atrás do que corre: dois laços em paralelo
  // furariam a fila de um arquivo por vez.
  it('enfileira a segunda escolha atrás do envio em andamento', async () => {
    componente.aoEscolherArquivos([arquivo('a.pdf')]);
    await tick();
    componente.aoEscolherArquivos([arquivo('b.pdf')]);
    await tick();

    const abertas = controller.match(ROTA_DOCUMENTOS);
    expect(abertas).toHaveLength(1);
    expect(abertas[0].request.body).toMatchObject({ nomeArquivo: 'a.pdf' });
    abertas[0].flush(null, { status: 500, statusText: 'x' });
    await tick();

    controller.expectOne(ROTA_DOCUMENTOS).flush(null, { status: 500, statusText: 'x' });
    await tick();
  });

  it('põe a nova tentativa atrás do anexo que ainda está enviando', async () => {
    componente.aoEscolherArquivos([arquivo('a.pdf'), arquivo('b.pdf')]);
    await tick();
    controller.expectOne(ROTA_DOCUMENTOS).flush(null, { status: 500, statusText: 'x' });
    await tick();
    // O segundo começou: a nova tentativa do primeiro não pode correr junto com ele.
    const segundo = controller.expectOne(ROTA_DOCUMENTOS);
    void componente.retomar(anexos()[0].id);
    await tick();
    controller.expectNone(ROTA_DOCUMENTOS);

    segundo.flush(null, { status: 500, statusText: 'x' });
    await tick();
    controller.expectOne(ROTA_DOCUMENTOS).flush(null, { status: 500, statusText: 'x' });
    await tick();
  });

  it('mostra a recusa do catálogo no anexo que falhou e segue para o próximo', async () => {
    componente.aoEscolherArquivos([arquivo('a.pdf'), arquivo('b.pdf')]);
    await tick();

    const recusa = problema(
      422,
      'uniplus.selecao.documento_a_publicar.formato_recusado',
      'O formato do arquivo não é aceito para este documento.',
    );
    controller.expectOne(ROTA_DOCUMENTOS).flush(recusa.body, recusa.opts);
    await tick();
    fixture.detectChanges();

    expect(anexos()[0].fase).toBe('erro');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'O formato do arquivo não é aceito',
    );
    // O seguinte não espera: a falha de um não trava a fila.
    controller.expectOne(ROTA_DOCUMENTOS).flush(
      iniciacao(DOCUMENTO_B, URL_B, 'application/pdf'),
      { status: 201, statusText: 'Created' },
    );
    await tick();
    controller.expectOne(URL_B).flush(null);
    await tick();
    controller
      .expectOne(`${ROTA_DOCUMENTOS}/${DOCUMENTO_B}/confirmacao`)
      .flush({ id: DOCUMENTO_B });
    await tick();
    expect(anexos().map((a) => a.fase)).toEqual(['erro', 'confirmado']);
  });

  /**
   * O arquivo já chegou ao storage: repetir a iniciação criaria um segundo documento imutável, e
   * repetir o PUT esbarraria numa URL possivelmente vencida. Só a confirmação falta.
   */
  it('retoma da confirmação, sem novo documento, quando só ela falhou', async () => {
    componente.aoEscolherArquivos([arquivo('a.pdf')]);
    await tick();
    const { confirmacao } = await iniciarEEnviar(DOCUMENTO_A, URL_A, 'application/pdf');

    const queda = problema(503, 'uniplus.client.network_error', 'Serviço indisponível');
    controller.expectOne(confirmacao).flush(queda.body, queda.opts);
    await tick();
    expect(anexos()[0].fase).toBe('erro');
    expect(anexos()[0].confirmacaoIndefinida).toBe(true);

    void componente.retomar(anexos()[0].id);
    await tick();
    controller.expectNone(ROTA_DOCUMENTOS);
    controller.expectOne(confirmacao).flush({ id: DOCUMENTO_A });
    await tick();

    expect(anexos()[0].fase).toBe('confirmado');
  });

  it('não oferece retirar o anexo enquanto ele é enviado', async () => {
    componente.aoEscolherArquivos([arquivo('a.pdf')]);
    await tick();

    componente.retirar(anexos()[0].id);

    expect(anexos()).toHaveLength(1);
    expect(componente.itens()[0].podeRetirar).toBe(false);
    controller.expectOne(ROTA_DOCUMENTOS).flush(null, { status: 500, statusText: 'x' });
    await tick();
  });

  it('retira da lista o anexo que falhou', async () => {
    componente.aoEscolherArquivos([arquivo('a.pdf')]);
    await tick();
    controller.expectOne(ROTA_DOCUMENTOS).flush(null, { status: 500, statusText: 'x' });
    await tick();

    componente.retirar(anexos()[0].id);

    expect(anexos()).toEqual([]);
  });

  it('recusa anexar antes de o processo existir', () => {
    store.processoSeletivoId.set(null);

    componente.aoEscolherArquivos([arquivo('a.pdf')]);

    expect(componente.recusa()).toContain('cadastro do processo precisa estar concluído');
    expect(anexos()).toEqual([]);
  });

  /**
   * A página do editor sobrevive à troca de endereço: a resposta de um envio do processo anterior
   * não pode vincular o anexo ao processo que está em tela agora.
   */
  it('descarta a resposta de um envio de outro processo', async () => {
    componente.aoEscolherArquivos([arquivo('a.pdf')]);
    await tick();

    store.reset();
    store.processoSeletivoId.set('01960000-0000-7000-0000-0000000005bb');
    fixture.detectChanges();
    controller
      .expectOne(ROTA_DOCUMENTOS)
      .flush(iniciacao(DOCUMENTO_A, URL_A, 'application/pdf'), {
        status: 201,
        statusText: 'Created',
      });
    await tick();

    controller.expectNone(URL_A);
    expect(anexos()).toEqual([]);
  });

  // A leitura mais nova vale: a resposta velha, chegando por último, não pode sobrescrevê-la.
  it('fica com a resposta da leitura mais nova quando a antiga chega depois', async () => {
    fixture.componentRef.setInput('publicado', true);
    fixture.componentRef.setInput('atoId', ATO_ID);
    fixture.detectChanges();
    await tick();
    const primeira = controller.expectOne(ROTA_ATOS);

    componente.tentarLerPublicadosDeNovo();
    await tick();
    const segunda = controller.expectOne(ROTA_ATOS);

    segunda.flush([{ id: ATO_ID, anexos: [] }]);
    await tick();
    expect(componente.publicados()?.estado).toBe('lido');

    primeira.flush(null, { status: 500, statusText: 'x' });
    await tick();
    expect(componente.publicados()?.estado).toBe('lido');
  });

  describe('nome de exibição', () => {
    async function comAnexoConfirmado(): Promise<void> {
      componente.aoEscolherArquivos([arquivo('cronograma.pdf')]);
      await tick();
      const { confirmacao } = await iniciarEEnviar(DOCUMENTO_A, URL_A, 'application/pdf');
      controller.expectOne(confirmacao).flush({ id: DOCUMENTO_A });
      await tick();
      fixture.detectChanges();
    }

    function campo(): HTMLInputElement {
      return host.querySelector<HTMLInputElement>(`#anexo-nome-${anexos()[0].id}`) as HTMLInputElement;
    }

    function digitar(valor: string): void {
      const input = campo();
      input.value = valor;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    }

    it('começa pelo nome do arquivo sem a extensão e grava o que o operador digita', async () => {
      await comAnexoConfirmado();
      expect(campo().value).toBe('cronograma');

      digitar('Cronograma detalhado');

      expect(anexos()[0].nome).toBe('Cronograma detalhado');
      expect(host.textContent).toContain('Baixado como “Cronograma detalhado.pdf”');
    });

    it('mostra a extensão uma só vez quando o nome já vem com ela', async () => {
      await comAnexoConfirmado();

      digitar('Cronograma detalhado.pdf');

      expect(host.textContent).toContain('Baixado como “Cronograma detalhado.pdf”');
      expect(host.textContent).not.toContain('.pdf.pdf');
    });

    it('acusa o nome que o servidor recusaria, no campo e ligado a ele', async () => {
      await comAnexoConfirmado();

      digitar('pasta/cronograma');

      expect(campo().getAttribute('aria-invalid')).toBe('true');
      const erro = host.querySelector(`#anexo-nome-erro-${anexos()[0].id}`);
      expect(erro?.textContent).toContain('não pode ter');
      expect(campo().getAttribute('aria-describedby')).toContain(erro?.id ?? '?');
    });

    it('trava o campo enquanto uma gravação está em curso', async () => {
      await comAnexoConfirmado();

      store.salvando.set(true);
      fixture.detectChanges();

      expect(campo().disabled).toBe(true);
    });
  });
});
