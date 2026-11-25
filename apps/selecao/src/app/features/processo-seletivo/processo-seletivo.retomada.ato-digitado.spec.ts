import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { SituacaoDoProcessoSeletivoCodigo } from '@uniplus/shared-data/selecao';
import { okResult } from '@uniplus/shared-testing';
import { BehaviorSubject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AVISO_DE_ATO_DIGITADO,
  ConfirmacaoDeSaida,
  saidaComAtoDigitadoGuard,
} from './wizard/shared/saida-com-ato-digitado.guard';
import {
  type CenarioOpts,
  PROCESSO_ID,
  OUTRO_ID,
  MONTAGEM_LENTA,
  detalhe,
  montar,
  propagar,
} from './processo-seletivo.retomada.testing';

function fecharAJanela(): BeforeUnloadEvent {
  const evento = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
  globalThis.dispatchEvent(evento);
  return evento;
}

describe('ProcessoSeletivoPage — ato digitado na Revisão', MONTAGEM_LENTA, () => {
  beforeEach(() => TestBed.resetTestingModule());

  /** O ato digitado não é guardado com o processo: abrir um processo o começa vazio. */
  it('abre o processo com o ato vazio e sem nada a perder', async () => {
    const cenario = montar();
    await propagar();

    expect(cenario.store.draft().publicacao.numero).toBe('');
    expect(cenario.store.draft().publicacao.ato.orgao).toBe('');
    expect(cenario.componente.atoDigitadoPendente()).toBe(false);
  });

  it('o ato digitado conta como algo a perder, e esvaziá-lo desfaz a pendência', async () => {
    const cenario = montar();
    await propagar();

    cenario.store.projetarSecao('publicacao', { numero: '07/2027' });
    expect(cenario.componente.atoDigitadoPendente()).toBe(true);

    cenario.store.projetarSecao('publicacao', { numero: '' });
    expect(cenario.componente.atoDigitadoPendente()).toBe(false);
  });

  it('pede a confirmação do navegador ao fechar a janela enquanto há ato digitado', async () => {
    const cenario = montar();
    await propagar();

    cenario.store.projetarSecao('publicacao', { numero: '07/2027' });
    cenario.fixture.detectChanges();
    TestBed.tick();

    expect(fecharAJanela().defaultPrevented).toBe(true);
  });

  it('não interfere ao fechar a janela sem ato digitado', async () => {
    const cenario = montar();
    await propagar();
    cenario.fixture.detectChanges();
    TestBed.tick();

    expect(fecharAJanela().defaultPrevented).toBe(false);
  });

  it('deixa de pedir a confirmação do navegador quando a página é destruída', async () => {
    const cenario = montar();
    await propagar();
    cenario.store.projetarSecao('publicacao', { numero: '07/2027' });
    cenario.fixture.detectChanges();
    TestBed.tick();

    cenario.fixture.destroy();

    expect(fecharAJanela().defaultPrevented).toBe(false);
  });

  /**
   * Mudar só o `:id` reusa a rota: o componente nunca é desativado, e a guarda da rota não
   * roda. Sem perguntar no próprio editor, a promessa dela valia para sair da tela e não para
   * trocar de processo — e é a retomada quem apaga o ato digitado, logo em seguida.
   */
  it('pergunta antes de trocar de processo com ato digitado', async () => {
    const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
      get: () => PROCESSO_ID,
    });
    const cenario = montar({
      id: PROCESSO_ID,
      obter: vi.fn((id: string) => of(okResult(detalhe({ id })))),
      paramMap,
    });
    await propagar();

    cenario.store.projetarSecao('publicacao', { numero: '07/2027' });
    expect(cenario.componente.atoDigitadoPendente(), 'pré-condição: há o que perder').toBe(true);

    const confirmacao = TestBed.inject(ConfirmacaoDeSaida);
    const perguntar = vi.spyOn(confirmacao, 'confirmar').mockReturnValue(false);

    paramMap.next({ get: () => OUTRO_ID });
    await propagar();

    expect(perguntar).toHaveBeenCalled();
    expect(cenario.store.processoSeletivoId(), 'a troca foi recusada').toBe(PROCESSO_ID);
    expect(cenario.store.draft().publicacao.numero, 'o ato digitado ficou').toBe('07/2027');
    expect(cenario.navigate).toHaveBeenCalledWith(['/processo-seletivo', PROCESSO_ID], {
      replaceUrl: true,
    });
  });

  /**
   * Recusada a troca a partir do cadastro novo, não há processo aberto para onde voltar — o
   * endereço precisa voltar a `/novo`. Deixá-lo no `:id` recusado punha o cadastro em andamento
   * sob o endereço de outro processo, e a criação seguinte não corrigiria a URL: o efeito que a
   * ajusta desiste quando ela já traz um id.
   */
  it('devolve o endereço a /novo quando a troca é recusada sem processo aberto', async () => {
    const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
      get: () => null,
    });
    const cenario = montar({ id: null, paramMap });
    await propagar();

    cenario.store.projetarSecao('publicacao', { numero: '07/2027' });
    expect(cenario.componente.atoDigitadoPendente(), 'pré-condição: há o que perder').toBe(true);
    vi.spyOn(TestBed.inject(ConfirmacaoDeSaida), 'confirmar').mockReturnValue(false);

    paramMap.next({ get: () => PROCESSO_ID });
    await propagar();

    expect(cenario.navigate).toHaveBeenCalledWith(['/processo-seletivo', 'novo'], {
      replaceUrl: true,
    });
    expect(cenario.store.draft().publicacao.numero).toBe('07/2027');
  });

  /** Aceita a perda, a troca segue: quem confirmou sabe o que está deixando para trás. */
  it('troca de processo quando a perda do ato digitado é confirmada', async () => {
    const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
      get: () => PROCESSO_ID,
    });
    const cenario = montar({
      id: PROCESSO_ID,
      obter: vi.fn((id: string) => of(okResult(detalhe({ id })))),
      paramMap,
    });
    await propagar();

    cenario.store.projetarSecao('publicacao', { numero: '07/2027' });
    vi.spyOn(TestBed.inject(ConfirmacaoDeSaida), 'confirmar').mockReturnValue(true);

    paramMap.next({ get: () => OUTRO_ID });
    await propagar();
    await propagar();

    expect(cenario.store.processoSeletivoId()).toBe(OUTRO_ID);
  });

  /**
   * Depois de publicar o processo sai do rascunho, e o que sobra em tela é o ato que virou
   * publicação. Tratá-lo como digitado avisava de perda a quem acabou de publicar.
   */
  it('não avisa de ato digitado quando o servidor confirma o processo fora de rascunho', async () => {
    const cenario = montar();
    await propagar();
    cenario.store.projetarSecao('publicacao', { numero: '07/2027' });
    expect(cenario.componente.atoDigitadoPendente(), 'pré-condição: há ato a perder').toBe(true);

    cenario.store.remoteSnapshot.set(
      detalhe({
        situacao: { codigo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO, rotulo: 'Publicado' },
      }),
    );

    expect(cenario.componente.atoDigitadoPendente()).toBe(false);
  });

  /**
   * Sem resposta conclusiva da publicação, ou com a releitura que não a confirma, a edição fica
   * bloqueada mas o servidor pode ainda estar em rascunho: o ato em memória continua a perder.
   */
  describe('com a publicação sem confirmação', () => {
    async function comAtoEPublicacaoNaoConfirmada(opts: CenarioOpts = {}) {
      const cenario = montar(opts);
      await propagar();
      cenario.store.projetarSecao('publicacao', { numero: '07/2027' });
      cenario.store.publicacaoNaoConfirmada.set(true);
      return cenario;
    }

    it('segue avisando de ato digitado enquanto o resultado é desconhecido', async () => {
      const cenario = await comAtoEPublicacaoNaoConfirmada();

      expect(cenario.store.edicaoPermitida(), 'a edição está bloqueada').toBe(false);
      expect(cenario.componente.atoDigitadoPendente()).toBe(true);
    });

    it('só deixa de avisar quando a releitura confirma o processo fora de rascunho', async () => {
      const cenario = await comAtoEPublicacaoNaoConfirmada();

      cenario.store.hidratar(
        detalhe({
          situacao: { codigo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO, rotulo: 'Publicado' },
        }),
      );

      expect(cenario.componente.atoDigitadoPendente()).toBe(false);
    });

    it('pede a confirmação do navegador ao fechar a janela', async () => {
      const cenario = await comAtoEPublicacaoNaoConfirmada();
      cenario.fixture.detectChanges();
      TestBed.tick();

      expect(fecharAJanela().defaultPrevented).toBe(true);
    });

    it('a guarda da rota pergunta antes de sair', async () => {
      const cenario = await comAtoEPublicacaoNaoConfirmada();
      const perguntar = vi.spyOn(TestBed.inject(ConfirmacaoDeSaida), 'confirmar');
      perguntar.mockReturnValue(false);
      const estado = {} as RouterStateSnapshot;

      const permitida = TestBed.runInInjectionContext(() =>
        saidaComAtoDigitadoGuard(cenario.componente, {} as ActivatedRouteSnapshot, estado, estado),
      );

      expect(perguntar).toHaveBeenCalledWith(AVISO_DE_ATO_DIGITADO);
      expect(permitida).toBe(false);
    });

    it('pergunta antes de trocar de processo e mantém o ato se a troca é recusada', async () => {
      const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
        get: () => PROCESSO_ID,
      });
      const cenario = await comAtoEPublicacaoNaoConfirmada({ id: PROCESSO_ID, paramMap });
      const perguntar = vi.spyOn(TestBed.inject(ConfirmacaoDeSaida), 'confirmar');
      perguntar.mockReturnValue(false);

      paramMap.next({ get: () => OUTRO_ID });
      await propagar();

      expect(perguntar).toHaveBeenCalledWith(AVISO_DE_ATO_DIGITADO);
      expect(cenario.store.processoSeletivoId()).toBe(PROCESSO_ID);
      expect(cenario.store.draft().publicacao.numero).toBe('07/2027');
    });
  });
});
