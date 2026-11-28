import { TestBed } from '@angular/core/testing';
import { ConducaoDoWizard } from './editor/conducao-do-wizard.service';
import { configurarPagina, montarPagina } from './processo-seletivo.page.testing';
import type { ValidacaoDoPasso } from './wizard/processo-seletivo.models';

const MENSAGEM_DE_ANDAMENTO =
  'Conferindo e gravando o processo antes de pedir a confirmação da publicação…';

const CONFIRMACAO = {
  titulo: 'Publicar o processo seletivo',
  aviso: 'Confirme a publicação.',
  itens: [],
  rotuloDeConfirmar: 'Publicar',
};

describe('ProcessoSeletivoPage — andamento da publicação', () => {
  beforeEach(configurarPagina);
  afterEach(() => TestBed.resetTestingModule());

  /**
   * Um passo anterior cuja gravação só termina quando o teste manda, e a Revisão como último
   * passo, com ou sem confirmação, para parar a publicação em cada desfecho.
   */
  function publicandoComGravacaoPendente(
    comConfirmacao: boolean,
    validacaoDaRevisao: ValidacaoDoPasso = { valid: true },
  ) {
    const { fixture, page, store } = montarPagina();
    let terminarGravacao: (resultado: ValidacaoDoPasso | Error) => void = () => undefined;
    const gravacao = new Promise<ValidacaoDoPasso>((resolve, reject) => {
      terminarGravacao = (resultado) =>
        resultado instanceof Error ? reject(resultado) : resolve(resultado);
    });
    const passoAnterior = { validar: () => ({ valid: true }), persistir: () => gravacao };
    const revisao = {
      validar: () => validacaoDaRevisao,
      confirmacaoDeGravacao: comConfirmacao ? () => CONFIRMACAO : undefined,
    };
    vi.spyOn(fixture.debugElement.injector.get(ConducaoDoWizard), 'passoNo').mockImplementation(
      (indiceDoPasso: number) =>
        indiceDoPasso === store.totalDePassos - 1 ? revisao : passoAnterior,
    );
    store.goTo(store.totalDePassos - 1);
    fixture.detectChanges();
    const elementoDaPagina = fixture.nativeElement as HTMLElement;
    const regiao = elementoDaPagina.querySelector<HTMLElement>('.wiz-footer [role="status"]');
    const botao = elementoDaPagina.querySelector<HTMLButtonElement>('.wiz-footer .btn--primary');
    return { fixture, page, store, terminarGravacao, regiao, botao };
  }

  async function publicarEEsperar(
    cenario: ReturnType<typeof publicandoComGravacaoPendente>,
    resultado: ValidacaoDoPasso | Error,
  ) {
    const execucao = cenario.page.nextOrPublish();
    cenario.fixture.detectChanges();
    expect(cenario.regiao?.textContent?.trim()).toBe(MENSAGEM_DE_ANDAMENTO);
    expect(cenario.botao?.disabled).toBe(true);
    cenario.terminarGravacao(resultado);
    await execucao;
    cenario.fixture.detectChanges();
  }

  it('começa com a região viva montada e vazia, antes do clique', () => {
    const { regiao, botao } = publicandoComGravacaoPendente(true);

    expect(regiao).not.toBeNull();
    expect(regiao?.getAttribute('aria-live')).toBe('polite');
    expect(regiao?.textContent?.trim()).toBe('');
    expect(botao?.disabled).toBe(false);
  });

  it('mostra o andamento até a confirmação abrir e então some, com a mesma região', async () => {
    const cenario = publicandoComGravacaoPendente(true);

    await publicarEEsperar(cenario, { valid: true });

    const elementoDaPagina = cenario.fixture.nativeElement as HTMLElement;
    expect(elementoDaPagina.querySelector('.wiz-footer [role="status"]')).toBe(cenario.regiao);
    expect(cenario.regiao?.textContent?.trim()).toBe('');
    expect(cenario.page.confirmacaoPendente()).not.toBeNull();
    expect(cenario.botao?.disabled).toBe(false);
  });

  it('mostra o andamento e o tira quando a conferência encontra pendência', async () => {
    const cenario = publicandoComGravacaoPendente(true);

    await publicarEEsperar(cenario, { valid: false, messages: ['Falta preencher o passo.'] });

    expect(cenario.regiao?.isConnected).toBe(true);
    expect(cenario.regiao?.textContent?.trim()).toBe('');
    expect(cenario.store.erroDoPasso()?.join(' ')).toContain('Falta preencher o passo.');
    expect(cenario.page.confirmacaoPendente()).toBeNull();
    expect(cenario.botao?.disabled).toBe(false);
  });

  it('não deixa o andamento à vista quando a conferência da Revisão acusa pendência', async () => {
    const cenario = publicandoComGravacaoPendente(true, {
      valid: false,
      messages: ['Falta preencher a Revisão.'],
    });

    const execucao = cenario.page.nextOrPublish();
    cenario.terminarGravacao({ valid: true });
    await execucao;
    cenario.fixture.detectChanges();

    expect(cenario.regiao?.textContent?.trim()).toBe('');
    expect(cenario.store.erroDoPasso()?.join(' ')).toContain('Falta preencher a Revisão.');
    expect(cenario.page.confirmacaoPendente()).toBeNull();
    expect(cenario.botao?.disabled).toBe(false);
  });

  it('mostra o andamento e o tira quando a gravação falha', async () => {
    const cenario = publicandoComGravacaoPendente(true);

    await publicarEEsperar(cenario, new Error('A gravação não foi concluída.'));

    expect(cenario.regiao?.isConnected).toBe(true);
    expect(cenario.regiao?.textContent?.trim()).toBe('');
    expect(cenario.store.erroDoPasso()?.length).toBeGreaterThan(0);
    expect(cenario.page.confirmacaoPendente()).toBeNull();
    expect(cenario.botao?.disabled).toBe(false);
  });
});
