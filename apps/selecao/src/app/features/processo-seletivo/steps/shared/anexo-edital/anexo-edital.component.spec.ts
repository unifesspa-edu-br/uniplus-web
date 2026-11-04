import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  ProcessoSeletivoDto,
  SELECAO_BASE_PATH,
  StatusProcesso,
} from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { EnvioDoEdital } from '../envio-do-edital.service';
import { GravacaoDoProcesso } from '../gravacao/gravacao-do-processo';
import { AnexoEditalComponent } from './anexo-edital.component';
import {
  BASE,
  DOCUMENTO_ID,
  PROCESSO_ID,
  ROTA_DOCUMENTOS,
  URL_LEITURA,
  documentoConfirmado,
  pdf,
  percorrerOEnvio,
  problema,
  tick,
} from './anexo-edital.testing';
import { EtapasDoEnvioDoEdital } from './etapas-do-envio-do-edital';

/** Aba nova o bastante para o teste: guarda o endereço recebido e o fechamento. */
function abaFalsa() {
  return {
    location: { href: '' },
    opener: {} as unknown,
    fechada: false,
    close(this: { fechada: boolean }) {
      this.fechada = true;
    },
  } as unknown as Window & { location: { href: string }; opener: unknown; fechada: boolean };
}

describe('AnexoEditalComponent', () => {
  let componente: AnexoEditalComponent;
  let etapas: EtapasDoEnvioDoEdital;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let host: HTMLElement;
  let detectar: () => void;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnexoEditalComponent],
      providers: [
        ProcessoSeletivoStore,
        EnvioDoEdital,
        GravacaoDoProcesso,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AnexoEditalComponent);
    componente = fixture.componentInstance;
    etapas = fixture.debugElement.injector.get(EtapasDoEnvioDoEdital);
    host = fixture.nativeElement as HTMLElement;
    detectar = () => fixture.detectChanges();
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    // O anexo pressupõe o processo já criado: a rota do documento é `/{id}/documentos-a-publicar`.
    store.processoSeletivoId.set(PROCESSO_ID);
  });

  afterEach(() => controller.verify());

  /** Escolhe o arquivo pelo campo, como o operador: quem recusa é o `ui-file-upload`. */
  function escolher(arquivo: File): void {
    const input = host.querySelector<HTMLInputElement>('input[type="file"]');
    if (input === null) throw new Error('campo de arquivo ausente');
    Object.defineProperty(input, 'files', { value: [arquivo], configurable: true });
    input.dispatchEvent(new Event('change'));
  }

  function alerta(): string {
    return host.querySelector('[role="alert"]')?.textContent ?? '';
  }

  const anexarComSucesso = (arquivo = pdf()) => percorrerOEnvio(etapas, controller, arquivo);

  it('recusa arquivo que não é PDF sem chamar a API', () => {
    escolher(new File(['x'], 'edital.docx', { type: 'application/msword' }));
    detectar();

    expect(alerta()).toContain('Tipo de arquivo não permitido');
  });

  it('recusa PDF acima de 20 MB sem chamar a API', () => {
    escolher(pdf('grande.pdf', 20 * 1024 * 1024 + 1));
    detectar();

    expect(alerta()).toContain('20MB');
  });

  it('não oferece nova tentativa para anexo em erro sem o arquivo na memória', () => {
    store.patchObjectSection('identificacao', {
      uploads: [
        {
          id: 'x',
          name: 'edital.pdf',
          extension: 'pdf',
          progress: 40,
          fase: 'erro',
          mensagemErro: 'Falhou.',
        },
      ],
    });
    detectar();

    expect(host.textContent).not.toContain('Tentar novamente');
  });

  it('oferece a nova tentativa sem o arquivo quando só falta confirmar', async () => {
    store.patchObjectSection('identificacao', {
      uploads: [
        {
          id: 'x',
          name: 'edital.pdf',
          extension: 'pdf',
          progress: 100,
          fase: 'erro',
          mensagemErro: 'Sem resposta.',
          enviado: true,
          documentoAPublicarId: DOCUMENTO_ID,
          confirmacaoIndefinida: true,
        },
      ],
    });
    detectar();
    expect(host.textContent).toContain('Tentar novamente');

    void etapas.retomar();
    await tick();

    controller
      .expectOne(`${ROTA_DOCUMENTOS}/${DOCUMENTO_ID}/confirmacao`)
      .flush({ id: DOCUMENTO_ID }, { status: 200, statusText: 'OK' });
    await tick();
    expect(etapas.anexo()?.fase).toBe('confirmado');
  });

  it('não oferece nem executa a retomada com o anexo travado por outro motivo', async () => {
    void etapas.anexar(pdf());
    await tick();
    const recusa = problema(503, 'uniplus.client.network_error', 'Serviço indisponível');
    controller.expectOne(ROTA_DOCUMENTOS).flush(recusa.body, recusa.opts);
    await tick();
    detectar();
    expect(host.textContent).toContain('Tentar novamente');

    store.avisoDocumentos.set('Não foi possível ler os documentos.');
    detectar();
    void etapas.retomar();
    await tick();

    expect(host.textContent).not.toContain('Tentar novamente');
    controller.expectNone(ROTA_DOCUMENTOS);
  });

  it('não reaproveita o arquivo escolhido em outro processo', async () => {
    void etapas.anexar(pdf());
    await tick();
    const recusa = problema(503, 'uniplus.client.network_error', 'Serviço indisponível');
    controller.expectOne(ROTA_DOCUMENTOS).flush(recusa.body, recusa.opts);
    await tick();

    store.geracao.update((geracao) => geracao + 1);
    detectar();

    expect(host.textContent).not.toContain('Tentar novamente');
    void etapas.retomar();
    await tick();
    controller.expectNone(ROTA_DOCUMENTOS);
  });

  /** Processo publicado só se lê: o nome do edital vira texto, e sobra a ação de abri-lo. */
  it('em consulta, lê o nome do edital inteiro, sem área de envio nem remoção', async () => {
    await anexarComSucesso(pdf('edital-de-abertura-do-processo-seletivo-de-medicina-2027.pdf'));

    store.remoteSnapshot.set({
      status: StatusProcesso.publicado,
    } as unknown as ProcessoSeletivoDto);
    detectar();

    expect(host.textContent).toContain(
      'edital-de-abertura-do-processo-seletivo-de-medicina-2027.pdf',
    );
    expect(host.querySelector('ui-file-upload, input, [role="progressbar"]')).toBeNull();
    expect(Array.from(host.querySelectorAll('button')).map((b) => b.textContent?.trim())).toEqual([
      'Abrir o edital',
    ]);
  });

  /**
   * A URL só existe entre a resposta e a abertura da aba. Guardá-la no store,
   * num campo do componente ou num `href` a manteria alcançável depois da
   * ação — e ela é credencial de acesso ao objeto, não um endereço público.
   */
  /**
   * A aba precisa nascer dentro do clique: aberta depois do `await`, o
   * navegador a trata como pop-up não solicitado e a bloqueia — falha que só
   * aparece no caminho feliz, sem erro de API para explicá-la.
   */
  it('abre a aba no clique e só depois a leva à URL assinada', async () => {
    await anexarComSucesso();
    const aba = abaFalsa();
    const abrir = vi.spyOn(window, 'open').mockReturnValue(aba);

    const promessa = componente.abrirDocumento(DOCUMENTO_ID);

    // Antes de qualquer resposta a aba já existe, e ainda em branco.
    // Sem `noopener` na chamada: com ele o retorno seria `null` e não haveria
    // referência para navegar a aba quando o endereço chegasse.
    expect(abrir).toHaveBeenCalledWith('', '_blank');
    expect(aba.location.href).toBe('');

    await tick();
    controller
      .expectOne(`${ROTA_DOCUMENTOS}/${DOCUMENTO_ID}/acesso`)
      .flush({ url: URL_LEITURA, expiraEm: '2026-08-27T12:05:00Z' });
    await promessa;

    expect(aba.location.href).toBe(URL_LEITURA);
    // O desacoplamento que o `noopener` daria, feito antes de navegar.
    expect(aba.opener).toBeNull();
    expect(JSON.stringify(store.draft())).not.toContain('X-Amz-Signature');
    expect(JSON.stringify(etapas.anexo() ?? {})).not.toContain('X-Amz-Signature');
    abrir.mockRestore();
  });

  /**
   * Bloqueio de pop-up recusa antes de pedir o acesso: a URL é emitida por
   * requisição, com o prazo correndo a partir dela, e pedir uma que não será
   * usada é o que o endpoint sob demanda existe para evitar.
   */
  it('avisa o bloqueio sem pedir a URL assinada', async () => {
    await anexarComSucesso();
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null);

    await componente.abrirDocumento(DOCUMENTO_ID);

    expect(componente.erroDeAbertura()).toContain('bloqueou a abertura');
    controller.expectNone(`${ROTA_DOCUMENTOS}/${DOCUMENTO_ID}/acesso`);
    abrir.mockRestore();
  });

  it('não pede acesso antes de o processo existir', async () => {
    store.processoSeletivoId.set(null);
    const aba = abaFalsa();
    const abrir = vi.spyOn(window, 'open').mockReturnValue(aba);

    await componente.abrirDocumento(DOCUMENTO_ID);

    expect(abrir).not.toHaveBeenCalled();
    controller.expectNone(`${ROTA_DOCUMENTOS}/${DOCUMENTO_ID}/acesso`);
    abrir.mockRestore();
  });

  /** Recusa do servidor precisa aparecer, não sumir com a aba que não abriu. */
  it('fecha a aba e exibe a recusa quando o acesso falha', async () => {
    await anexarComSucesso();
    const aba = abaFalsa();
    const abrir = vi.spyOn(window, 'open').mockReturnValue(aba);

    const promessa = componente.abrirDocumento(DOCUMENTO_ID);
    await tick();

    const recusa = problema(
      422,
      'uniplus.selecao.documento_a_publicar.nao_confirmado',
      'Documento não confirmado',
    );
    controller
      .expectOne(`${ROTA_DOCUMENTOS}/${DOCUMENTO_ID}/acesso`)
      .flush(recusa.body, recusa.opts);
    await promessa;

    // A aba já estava aberta quando a recusa chegou: deixá-la em branco na
    // barra do navegador faria parecer que algo abriu.
    expect(aba.location.href).toBe('');
    expect(aba.fechada).toBe(true);
    expect(componente.erroDeAbertura()).toBeTruthy();
    abrir.mockRestore();
  });

  /**
   * O editor pode ter passado a outro processo enquanto o acesso era pedido;
   * abrir então mostraria o edital de um processo que já saiu da tela.
   */
  it('descarta o acesso quando o editor trocou de processo', async () => {
    await anexarComSucesso();
    const aba = abaFalsa();
    const abrir = vi.spyOn(window, 'open').mockReturnValue(aba);

    const promessa = componente.abrirDocumento(DOCUMENTO_ID);
    await tick();

    store.geracao.update((g) => g + 1);
    controller
      .expectOne(`${ROTA_DOCUMENTOS}/${DOCUMENTO_ID}/acesso`)
      .flush({ url: URL_LEITURA, expiraEm: '2026-08-27T12:05:00Z' });
    await promessa;

    expect(aba.location.href).toBe('');
    expect(aba.fechada).toBe(true);
    abrir.mockRestore();
  });

  /**
   * Com mais de um confirmado não há vínculo, então o bloco do anexo
   * selecionado não existe — e é exatamente aí que a escolha aparece, com um
   * botão de abrir por documento. Uma recusa vinda desses botões precisa ter
   * onde ser lida.
   */
  it('exibe a recusa da abertura também na escolha entre confirmados', async () => {
    store.documentosParaEscolha.set([
      documentoConfirmado(DOCUMENTO_ID, 'a'.repeat(64), '2026-08-20T12:05:00Z'),
      documentoConfirmado(
        '01960000-0000-7000-0000-0000000005de',
        'b'.repeat(64),
        '2026-08-20T12:12:00Z',
      ),
    ]);
    detectar();

    expect(etapas.anexo()).toBeUndefined();

    const aba = abaFalsa();
    const abrir = vi.spyOn(window, 'open').mockReturnValue(aba);

    const promessa = componente.abrirDocumento(DOCUMENTO_ID);
    await tick();

    const recusa = problema(
      422,
      'uniplus.selecao.documento_a_publicar.nao_confirmado',
      'Documento não confirmado',
    );
    controller
      .expectOne(`${ROTA_DOCUMENTOS}/${DOCUMENTO_ID}/acesso`)
      .flush(recusa.body, recusa.opts);
    await promessa;
    detectar();

    expect(host.querySelector('.field__erro')?.textContent).toContain('não confirmado');
    abrir.mockRestore();
  });
});
