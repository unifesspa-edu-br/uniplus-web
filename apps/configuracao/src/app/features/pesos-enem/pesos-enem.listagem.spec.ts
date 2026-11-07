import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AREAS,
  ERRO_500,
  GRUPOS,
  PaginaDeTeste,
  RES_805,
  linhas805,
  problem,
} from './pesos-enem.testing';

describe('PesosEnemPage — falhas da listagem', () => {
  let t: PaginaDeTeste;

  beforeEach(() => {
    t = new PaginaDeTeste();
  });

  afterEach(() => t.verificar());

  it('PesosEnemPage_ErroCarga_ExibeAlertComRetry', async () => {
    t.fixture.detectChanges();
    t.expectAreas().flush([...AREAS]);
    t.expectGrupos().flush([...GRUPOS]);
    t.expectListagem().flush(problem(500, 'uniplus.internal.unexpected', 'Erro interno'), {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'application/problem+json' },
    });
    await t.propagate();

    expect(t.store.mensagemDeErro()).toBeTruthy();
    const botaoRetry = t.fixture.nativeElement.querySelector(
      '.list-state__retry button',
    ) as HTMLButtonElement;
    expect(botaoRetry).not.toBeNull();

    botaoRetry.click();
    await t.propagate();
    t.expectListagem().flush([...linhas805]);
    await t.propagate();

    expect(t.store.mensagemDeErro()).toBeNull();
    expect(t.store.resolucoes()).toEqual([RES_805]);
  });

  it('PesosEnemPage_ListagemFalhaComReferenciasCarregando_MostraSoOAlerta', async () => {
    t.fixture.detectChanges();
    t.expectListagem().flush(problem(500, 'uniplus.internal.unexpected', 'Erro interno'), ERRO_500);
    await t.propagate();

    const raiz = t.fixture.nativeElement as HTMLElement;
    try {
      expect(raiz.querySelector('#cfg-pesos-enem-registros-tentar')).not.toBeNull();
      expect(raiz.querySelector('ui-skeleton')).toBeNull();
    } finally {
      // Responde as referências mesmo com a asserção falha, para não vazar pedido pendente.
      t.expectAreas().flush([...AREAS]);
      t.expectGrupos().flush([...GRUPOS]);
      await t.propagate();
    }
  });

  it('PesosEnemPage_ListagemVoltaDepoisDoTentarDeNovo_FocoVaiAoTitulo', async () => {
    t.fixture.detectChanges();
    t.expectAreas().flush([...AREAS]);
    t.expectGrupos().flush([...GRUPOS]);
    t.expectListagem().flush(problem(500, 'uniplus.internal.unexpected', 'Erro interno'), ERRO_500);
    await t.propagate();
    t.fixture.detectChanges();

    const raiz = t.fixture.nativeElement as HTMLElement;
    const botao = raiz.querySelector<HTMLButtonElement>('#cfg-pesos-enem-registros-tentar');
    if (!botao) throw new Error('botão de tentar de novo ausente');
    botao.focus();
    botao.click();
    await t.propagate();
    t.fixture.detectChanges();
    expect(document.activeElement?.id).toBe('cfg-pesos-enem-registros-tentar');

    t.expectListagem().flush([...linhas805]);
    await t.propagate();
    t.fixture.detectChanges();
    await t.propagate();
    expect(raiz.querySelector('#cfg-pesos-enem-registros-tentar')).toBeNull();
    expect(document.activeElement?.id).toBe('cfg-pesos-enem-titulo');
  });

  it('PesosEnemPage_ListagemFalha_CabecalhoNaoOfereceCadastrar', async () => {
    t.fixture.detectChanges();
    t.expectAreas().flush([...AREAS]);
    t.expectGrupos().flush([...GRUPOS]);
    t.expectListagem().flush(problem(500, 'uniplus.internal.unexpected', 'Erro interno'), ERRO_500);
    await t.propagate();
    t.fixture.detectChanges();

    const raiz = t.fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('.page-header__actions')).toBeNull();
    expect(raiz.querySelector('ui-empty-state')).toBeNull();
  });

  it('PesosEnemPage_RecargaAutomaticaDaListagem_NaoContaNemMostraAlertaAntigo', async () => {
    t.fixture.detectChanges();
    t.expectAreas().flush([...AREAS]);
    t.expectGrupos().flush([...GRUPOS]);
    t.expectListagem().flush(problem(500, 'uniplus.internal.unexpected', 'Erro interno'), ERRO_500);
    await t.propagate();
    t.fixture.detectChanges();

    const raiz = t.fixture.nativeElement as HTMLElement;
    t.store.recarregar();
    await t.propagate();
    t.fixture.detectChanges();
    try {
      expect(raiz.querySelector('#cfg-pesos-enem-registros-tentar')).toBeNull();
    } finally {
      t.expectListagem().flush(
        problem(500, 'uniplus.internal.unexpected', 'Erro interno'),
        ERRO_500,
      );
      await t.propagate();
      t.fixture.detectChanges();
    }
    const alerta = raiz
      .querySelector('#cfg-pesos-enem-registros-tentar')
      ?.closest('ui-alerta-nova-tentativa');
    expect(alerta).not.toBeNull();
    expect((alerta as HTMLElement).textContent).not.toContain('também falhou');
  });

  it('PesosEnemPage_ListagemRecusadaSemTitulo_AlertaComTextoPadrao', async () => {
    t.fixture.detectChanges();
    t.expectAreas().flush([...AREAS]);
    t.expectGrupos().flush([...GRUPOS]);
    t.expectListagem().flush(problem(500, 'uniplus.teste.sem_titulo', '   '), ERRO_500);
    await t.propagate();
    t.fixture.detectChanges();

    const raiz = t.fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('ui-skeleton')).toBeNull();
    expect(
      raiz.querySelector('#cfg-pesos-enem-registros-tentar')?.closest('ui-alert')?.textContent,
    ).toContain('A lista de pesos do ENEM não foi carregada.');
  });
});
