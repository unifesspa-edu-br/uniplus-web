import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, type Observable, of } from 'rxjs';
import { apiFailure, apiOk } from '@uniplus/shared-core/http';
import { OrigemCandidatosCodigo, ProcessosSeletivosApi } from '@uniplus/shared-data/selecao';
import { ProcessoSeletivoPage } from './processo-seletivo.page';
import { PAGE_PROVIDERS, listarFundamentos } from './processo-seletivo.page.testing';
import { ProcessoSeletivoStore } from './wizard/processo-seletivo.store';

const MARABA = { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' } as const;

/**
 * A página aberta no passo de identificação, com o cadastro inicial pronto para gravar e a criação
 * do processo respondida por `criar`. O store é provido pela própria página, então vem do injector
 * dela.
 */
function abrirComCriar(criar: () => Observable<unknown>) {
  TestBed.configureTestingModule({
    imports: [ProcessoSeletivoPage],
    providers: [
      ...PAGE_PROVIDERS,
      {
        provide: ProcessosSeletivosApi,
        useValue: { criar, listarFundamentosIsencao: listarFundamentos },
      },
    ],
  });
  const fixture = TestBed.createComponent(ProcessoSeletivoPage);
  const store = fixture.debugElement.injector.get(ProcessoSeletivoStore);
  fixture.detectChanges();
  preencherCadastroInicial(store);
  fixture.detectChanges();
  return { fixture, store, page: fixture.componentInstance };
}

function preencherCadastroInicial(store: ProcessoSeletivoStore): void {
  store.patchObjectSection('tipoProcesso', { selected: 'tipo-1', rotulo: 'Vestibular' });
  store.patchObjectSection('identificacao', {
    nome: 'Vestibular 2027',
    unidadeAdministradoraId: 'unidade-1',
    origemCandidatos: OrigemCandidatosCodigo.inscricaoPropria,
    localidade: MARABA,
    identificadorLegivel: 'vestibular-2027',
  });
  store.goTo(1);
}

describe('ProcessoSeletivoPage — confirmação antes de gravar', () => {
  /**
   * Um `criar` que registra a chamada. O ponto dos testes abaixo é que ele
   * **não** seja chamado enquanto o operador não confirma.
   */
  function cenario() {
    const criar = vi.fn(() => of(apiOk({ id: 'x' }, 201, new HttpHeaders())));
    return { ...abrirComCriar(criar), criar };
  }

  afterEach(() => TestBed.resetTestingModule());

  /**
   * O clique que grava precisa parar aqui: depois da criação, nenhum destes
   * campos volta atrás pelo contrato desta tela.
   */
  it('abre a confirmação sem enviar nada à API', async () => {
    const { page, criar, fixture } = cenario();

    await page.nextOrPublish();
    fixture.detectChanges();

    expect(page.confirmacaoPendente()).not.toBeNull();
    expect(criar).not.toHaveBeenCalled();
  });

  it('desiste sem requisição e mantém o operador no passo', () => {
    const { page, criar, store, fixture } = cenario();

    void page.nextOrPublish();
    fixture.detectChanges();
    page.cancelarGravacao();
    fixture.detectChanges();

    expect(page.confirmacaoPendente()).toBeNull();
    expect(criar).not.toHaveBeenCalled();
    expect(store.passoAtual()).toBe(1);
    expect(store.draft().identificacao.nome).toBe('Vestibular 2027');
  });

  it('exibe na tela os dados que serão gravados', async () => {
    const { page, fixture } = cenario();

    await page.nextOrPublish();
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Vestibular 2027');
    expect(texto).toContain('Vestibular');
    expect(texto).toContain('Marabá — PA');
    expect(texto).toContain('não poderão ser alterados');
  });

  /**
   * O aviso precisa se distinguir de uma mensagem informativa comum — a cor
   * sozinha não pode carregar essa distinção (WCAG 2.1 — 1.4.1), daí o rótulo
   * textual "Atenção!" ao lado da variante `alert--warning`.
   */
  it('destaca o aviso de irreversibilidade e o botão de desistência', async () => {
    const { page, fixture } = cenario();

    await page.nextOrPublish();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const aviso = host.querySelector('.alert--warning');
    expect(aviso).not.toBeNull();
    expect(aviso?.getAttribute('role')).toBe('status');
    expect(aviso?.querySelector('.alert__title')?.textContent).toContain('Atenção!');

    const botao = Array.from(host.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(
      (b) => /Voltar e corrigir/.test(b.textContent ?? ''),
    );
    expect(botao).toBeDefined();
  });

  it('anuncia no botão que o avanço grava', async () => {
    const { page, fixture } = cenario();
    fixture.detectChanges();

    expect(page.rotuloDeAvanco()).toBe('Gravar e avançar');
  });

  /**
   * O resumo vale para o passo que o produziu. A rota reusa esta página, então
   * sem descartá-lo ele sobreviveria a uma troca de processo e confirmar
   * aplicaria a decisão lida numa tela ao efeito de outra.
   */
  it('descarta o resumo quando o passo muda', async () => {
    const { page, store, fixture } = cenario();

    await page.nextOrPublish();
    fixture.detectChanges();
    expect(page.confirmacaoPendente()).not.toBeNull();

    store.goTo(4);
    fixture.detectChanges();

    expect(page.confirmacaoPendente()).toBeNull();
  });

  /**
   * O diálogo precisa continuar no DOM para fechar pelo caminho do componente:
   * destruí-lo pularia a devolução do foco ao botão que o abriu.
   */
  it('fecha o diálogo pela visibilidade, sem removê-lo do DOM', async () => {
    const { page, fixture } = cenario();
    const host = fixture.nativeElement as HTMLElement;

    await page.nextOrPublish();
    fixture.detectChanges();
    expect(host.querySelector('ui-dialog')).not.toBeNull();

    page.cancelarGravacao();
    fixture.detectChanges();

    expect(page.confirmacaoPendente()).toBeNull();
    expect(host.querySelector('ui-dialog')).not.toBeNull();
  });

  /**
   * `persistir()` desabilita o botão de avanço enquanto grava. Fechar o
   * diálogo no clique mandaria o foco de volta para esse botão desabilitado, e
   * o teclado ficaria fora dos controles da página por toda a requisição.
   */
  it('mantém o diálogo aberto enquanto a gravação corre', async () => {
    // A criação fica em voo: é o intervalo em que o botão que abriu o diálogo
    // está desabilitado e não pode receber o foco de volta.
    const emVoo = new Subject<never>();
    const { fixture, store, page } = abrirComCriar(() => emVoo);

    await page.nextOrPublish();
    fixture.detectChanges();
    expect(page.confirmacaoPendente()).not.toBeNull();

    void page.confirmarGravacao();
    await Promise.resolve();
    fixture.detectChanges();

    // Requisição ainda em voo: o resumo continua na tela.
    expect(store.salvando()).toBe(true);
    expect(page.confirmacaoPendente()).not.toBeNull();

    // Com fechar, cancelar e confirmar todos desabilitados, a janela ficaria
    // aberta sem destino de foco nem de Tab. O de confirmar permanece
    // operável pelo teclado, anunciado como ocupado.
    const host = fixture.nativeElement as HTMLElement;
    const confirmar = Array.from(
      host.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => /Gravando/.test(b.textContent ?? ''));
    expect(confirmar).toBeDefined();
    expect(confirmar?.disabled).toBe(false);
    expect(confirmar?.getAttribute('aria-busy')).toBe('true');
    expect(confirmar?.getAttribute('aria-disabled')).toBe('true');

    emVoo.complete();
  });

  /** Acionar de novo enquanto grava não pode disparar uma segunda criação. */
  it('ignora novo acionamento do confirmar enquanto grava', async () => {
    let chamadas = 0;
    const emVoo = new Subject<never>();
    const { fixture, page } = abrirComCriar(() => {
      chamadas += 1;
      return emVoo;
    });

    await page.nextOrPublish();
    fixture.detectChanges();

    void page.confirmarGravacao();
    await Promise.resolve();
    void page.confirmarGravacao();
    await Promise.resolve();

    expect(chamadas).toBe(1);
    emVoo.complete();
  });

  /**
   * O resumo do passo descreve a última conferência. Quando o operador corrige
   * o campo e a conferência passa, o erro antigo não pode continuar anunciado
   * atrás do diálogo em que ele decide gravar.
   */
  it('tira o erro já corrigido do resumo antes de abrir a confirmação', async () => {
    const { page, store, fixture } = cenario();

    store.patchObjectSection('identificacao', { identificadorLegivel: 'Vestibular 2027' });
    fixture.detectChanges();
    await page.nextOrPublish();
    fixture.detectChanges();
    expect(store.erroDoPasso()).not.toBeNull();
    expect(page.confirmacaoPendente()).toBeNull();

    store.patchObjectSection('identificacao', { identificadorLegivel: 'vestibular-2027' });
    fixture.detectChanges();
    await page.nextOrPublish();
    fixture.detectChanges();

    expect(page.confirmacaoPendente()).not.toBeNull();
    expect(store.erroDoPasso()).toBeNull();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.step-error')).toBeNull();
  });

  it('desistir da confirmação não traz o erro corrigido de volta', async () => {
    const { page, store, fixture } = cenario();

    store.definirErroDoPasso([
      'O identificador legível não pode ter a forma de um identificador técnico (Guid).',
    ]);
    fixture.detectChanges();
    await page.nextOrPublish();
    fixture.detectChanges();
    expect(page.confirmacaoPendente()).not.toBeNull();

    page.cancelarGravacao();
    fixture.detectChanges();

    expect(page.confirmacaoPendente()).toBeNull();
    expect(store.erroDoPasso()).toBeNull();
  });

  it('a recusa da gravação confirmada volta a preencher o resumo', async () => {
    const recusa = apiFailure(
      {
        type: 'about:blank',
        title: 'O identificador legível já é usado por outro processo seletivo',
        status: 409,
        code: 'uniplus.selecao.processo_seletivo.identificador_legivel_em_uso',
        traceId: 'teste',
      },
      409,
      new HttpHeaders(),
    );
    const { fixture, store, page } = abrirComCriar(() => of(recusa));

    await page.nextOrPublish();
    fixture.detectChanges();
    expect(store.erroDoPasso()).toBeNull();

    await page.confirmarGravacao();
    fixture.detectChanges();

    expect(store.erroDoPasso()?.join(' ')).toContain('já é usado por outro processo seletivo');
  });

  /** O comando já saiu: fechar aqui só tiraria da tela o aviso da gravação. */
  it('não desiste da confirmação com a gravação em curso', async () => {
    const { page, store, fixture } = cenario();

    await page.nextOrPublish();
    fixture.detectChanges();
    store.salvando.set(true);

    page.cancelarGravacao();
    fixture.detectChanges();

    expect(page.confirmacaoPendente()).not.toBeNull();
  });
});
