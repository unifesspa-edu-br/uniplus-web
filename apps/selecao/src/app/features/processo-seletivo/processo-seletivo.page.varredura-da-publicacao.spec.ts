import { ConducaoDoWizard } from './editor/conducao-do-wizard.service';
import { configurarPagina, montarPagina } from './processo-seletivo.page.testing';
import { ReleituraDoSnapshot } from './wizard/shared/releitura-do-snapshot.service';

describe('ProcessoSeletivoPage — publicação: varredura dos passos', () => {
  beforeEach(configurarPagina);

  it('sem pendência local, segue para gravarEAvancar em vez de travar no aviso genérico', () => {
    const { fixture, page, store } = montarPagina();
    const stub = { validar: () => ({ valid: true }) };

    vi.spyOn(fixture.debugElement.injector.get(ConducaoDoWizard), 'passoNo').mockReturnValue(stub);

    store.goTo(store.totalDePassos - 1);
    fixture.detectChanges();
    page.nextOrPublish();

    // O stub não declara persistir() nem confirmacaoDeGravacao(): o fluxo
    // completa como navegação simples, sem erro nem confirmação pendente.
    expect(store.erroDoPasso()).toBeNull();
    expect(store.salvando()).toBe(false);
    expect(page.confirmacaoPendente()).toBeNull();
  });

  /**
   * A navegação entre passos é livre: o operador pode voltar a um passo já
   * gravado pelo stepper, editá-lo, e pular direto para a Revisão sem passar
   * pelo "avançar" que dispara `persistir()` de novo. Sem `gravarPassosAn-
   * teriores()`, `validarRascunho()` aprovaria o rascunho local (está
   * bem-formado) e a publicação confirmaria sobre uma edição que nunca
   * chegou ao servidor.
   */
  it('grava de novo um passo anterior antes de publicar, mesmo sem editar via avançar', async () => {
    const { fixture, page, store } = montarPagina();
    const persistirDoPassoAnterior = vi.fn().mockResolvedValue({ valid: true });
    const stubSemPersistir = { validar: () => ({ valid: true }) };
    const stubComPersistir = {
      validar: () => ({ valid: true }),
      persistir: persistirDoPassoAnterior,
    };

    vi.spyOn(fixture.debugElement.injector.get(ConducaoDoWizard), 'passoNo').mockImplementation(
      (index: number) => (index === 2 ? stubComPersistir : stubSemPersistir),
    );

    store.goTo(store.totalDePassos - 1);
    fixture.detectChanges();
    await page.nextOrPublish();

    expect(persistirDoPassoAnterior).toHaveBeenCalledTimes(1);
    expect(store.erroDoPasso()).toBeNull();
  });

  it('um segundo clique durante a releitura inicial não começa outra varredura', async () => {
    const { fixture, page, store } = montarPagina();
    const releitura = fixture.debugElement.injector.get(ReleituraDoSnapshot);
    const releiturasPendentes: (() => void)[] = [];
    vi.spyOn(releitura, 'reler').mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          releiturasPendentes.push(() => {
            store.classificacao.registrarGravadaSemQuadro();
            resolve(true);
          });
        }),
    );
    const persistir = vi.fn().mockResolvedValue({ valid: true });
    const stubComPersistir = { validar: () => ({ valid: true }), persistir };
    // Com a classificação desconhecida o passo recusa, e a publicação relê antes de validar de novo.
    const stubQueAguarda = {
      validar: () =>
        store.classificacao.motivoDaReleitura() === 'desconhecida'
          ? { valid: false, messages: ['Classificação desconhecida.'] }
          : { valid: true },
    };
    vi.spyOn(fixture.debugElement.injector.get(ConducaoDoWizard), 'passoNo').mockImplementation(
      (index: number) => (index === 2 ? stubComPersistir : stubQueAguarda),
    );
    store.classificacao.marcarDesconhecida();
    store.goTo(store.totalDePassos - 1);
    fixture.detectChanges();

    const primeiro = page.nextOrPublish();
    const segundo = page.nextOrPublish();
    releiturasPendentes.forEach((terminar) => terminar());
    await Promise.all([primeiro, segundo]);

    expect(persistir).toHaveBeenCalledTimes(1);
  });

  it('recusa publicar e nomeia o passo quando a gravação de um passo anterior falha', async () => {
    const { fixture, page, store } = montarPagina();
    const stubSemPersistir = { validar: () => ({ valid: true }) };
    const stubComFalha = {
      validar: () => ({ valid: true }),
      persistir: vi
        .fn()
        .mockResolvedValue({ valid: false, messages: ['Falha ao gravar de novo.'] }),
    };

    vi.spyOn(fixture.debugElement.injector.get(ConducaoDoWizard), 'passoNo').mockImplementation(
      (index: number) => (index === 2 ? stubComFalha : stubSemPersistir),
    );

    store.goTo(store.totalDePassos - 1);
    fixture.detectChanges();
    await page.nextOrPublish();

    const erros = store.erroDoPasso() ?? [];
    expect(
      erros.some((erro) => erro.includes('Passo 3') && erro.includes('Falha ao gravar de novo.')),
    ).toBe(true);
  });

  /**
   * A Revisão fica de fora da primeira passada de `validarRascunho()`
   * porque seu checklist pode estar desatualizado — mas sem recarregá-lo
   * entre gravar de novo e a segunda passada, `validar()` recusaria com a
   * foto de antes da correção mesmo depois de ela já ter sido gravada.
   */
  it('recarrega o checklist da Revisão entre gravar de novo e validar, antes de publicar', async () => {
    const { fixture, page, store } = montarPagina();
    const stubSemPersistir = { validar: () => ({ valid: true }) };
    let checklistRecarregado = false;
    const recarregarChecklist = vi.fn().mockImplementation(async () => {
      checklistRecarregado = true;
    });
    const stubRevisao = {
      validar: () =>
        checklistRecarregado
          ? { valid: true }
          : { valid: false, messages: ['Checklist desatualizado.'] },
      recarregarChecklist,
    };

    vi.spyOn(fixture.debugElement.injector.get(ConducaoDoWizard), 'passoNo').mockImplementation(
      (index: number) => (index === store.totalDePassos - 1 ? stubRevisao : stubSemPersistir),
    );

    store.goTo(store.totalDePassos - 1);
    fixture.detectChanges();
    await page.nextOrPublish();

    expect(recarregarChecklist).toHaveBeenCalledTimes(1);
    expect(store.erroDoPasso()).toBeNull();
  });

  /**
   * Cada `persistir()` individual solta `store.salvando` no próprio
   * `finally` assim que a PRÓPRIA chamada termina — mas a orquestração de
   * `publicar()` (gravar os passos anteriores, recarregar o checklist,
   * validar de novo) ainda não acabou. Sem uma trava que cubra a
   * orquestração inteira, o intervalo entre um passo terminar e a recarga
   * do checklist começar liberava o stepper e os campos por um instante
   * real: o operador podia navegar e editar antes da recarga concluir.
   */
  it('mantém a edição e a navegação travadas durante toda a orquestração de publicar, não só em cada passo isolado', async () => {
    const { fixture, page, store } = montarPagina();
    const estadosDurante: boolean[] = [];
    const passoAtingidoDuranteATrava: number[] = [];
    const stubSemPersistir = { validar: () => ({ valid: true }) };
    const stubComPersistir = {
      validar: () => ({ valid: true }),
      // Não mexe em store.salvando — como o persistir() real de cada passo
      // já soltou o próprio no finally antes de retornar, chegar aqui com
      // operacaoEmAndamento() ainda true só é possível pela trava nova.
      persistir: vi.fn().mockResolvedValue({ valid: true }),
    };
    const recarregarChecklist = vi.fn().mockImplementation(async () => {
      estadosDurante.push(store.operacaoEmAndamento());
      store.goTo(0); // tentativa de navegar por baixo, durante a recarga
      passoAtingidoDuranteATrava.push(store.passoAtual());
    });
    const stubRevisao = { validar: () => ({ valid: true }), recarregarChecklist };

    vi.spyOn(fixture.debugElement.injector.get(ConducaoDoWizard), 'passoNo').mockImplementation(
      (index: number) => {
        if (index === store.totalDePassos - 1) return stubRevisao;
        if (index === 1) return stubComPersistir;
        return stubSemPersistir;
      },
    );

    store.goTo(store.totalDePassos - 1);
    fixture.detectChanges();
    await page.nextOrPublish();

    expect(estadosDurante).toEqual([true]);
    // goTo(0) foi barrado: o passo continuou sendo o último (Revisão).
    expect(passoAtingidoDuranteATrava).toEqual([store.totalDePassos - 1]);
    expect(store.operacaoEmAndamento()).toBe(false);
  });

  /**
   * `gravarPassosAnteriores()` grava vários passos em sequência — se o
   * operador trocar de processo em pleno voo (`geracao` muda), continuar a
   * varredura chamaria `persistir()` dos passos seguintes contra o
   * rascunho do processo NOVO, gravando lá por engano.
   */
  it('para a varredura sem gravar no processo errado quando geracao muda em pleno voo', async () => {
    const { fixture, page, store } = montarPagina();
    const persistirDoSegundoPasso = vi.fn().mockResolvedValue({ valid: true });
    const persistirDoPrimeiroPasso = vi.fn().mockImplementation(async () => {
      // Simula o operador trocando de processo enquanto este passo ainda
      // gravava — mesmo efeito de `store.hidratar()` mudar a geracao.
      store.reset();
      return { valid: true };
    });
    const stubSemPersistir = { validar: () => ({ valid: true }) };
    const stub1 = { validar: () => ({ valid: true }), persistir: persistirDoPrimeiroPasso };
    const stub2 = { validar: () => ({ valid: true }), persistir: persistirDoSegundoPasso };

    vi.spyOn(fixture.debugElement.injector.get(ConducaoDoWizard), 'passoNo').mockImplementation(
      (index: number) => {
        if (index === 1) return stub1;
        if (index === 2) return stub2;
        return stubSemPersistir;
      },
    );

    store.goTo(store.totalDePassos - 1);
    fixture.detectChanges();
    await page.nextOrPublish();

    expect(persistirDoPrimeiroPasso).toHaveBeenCalledTimes(1);
    expect(persistirDoSegundoPasso).not.toHaveBeenCalled();
  });
});
