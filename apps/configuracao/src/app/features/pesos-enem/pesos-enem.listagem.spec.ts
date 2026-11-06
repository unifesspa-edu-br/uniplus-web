import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PesosEnemApi } from '@uniplus/shared-data/configuracao';
import { config as rxjsConfig, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AREAS,
  ERRO_500,
  GRUPOS,
  PaginaDeTeste,
  RES_805,
  linhas805,
  problem,
} from './pesos-enem.testing';
import {
  TEXTO_REPETIDA,
  situacaoDaNovaTentativa,
} from '../../shared/foco/situacao-da-nova-tentativa.testing';

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

  it('PesosEnemPage_NovaFalhaDosRegistros_MantemOAlertaEAnunciaDeNovo', async () => {
    t.fixture.detectChanges();
    t.expectAreas().flush([...AREAS]);
    t.expectGrupos().flush([...GRUPOS]);
    t.expectListagem().flush(problem(500, 'uniplus.internal.unexpected', 'Erro interno'), ERRO_500);
    await t.propagate();

    const raiz = t.fixture.nativeElement as HTMLElement;
    const botao = (): HTMLButtonElement | null =>
      raiz.querySelector('#cfg-pesos-enem-registros-tentar') as HTMLButtonElement | null;
    const alerta = (): HTMLElement => botao()?.closest('ui-alerta-nova-tentativa') as HTMLElement;
    const textoAntes = alerta().textContent ?? '';

    botao()?.click();
    await t.propagate();
    try {
      expect(botao()).not.toBeNull();
      expect(botao()?.getAttribute('aria-disabled')).toBe('true');
    } finally {
      // Responde a nova tentativa mesmo com a asserção falha, para não vazar pedido pendente.
      t.expectListagem().flush(
        problem(500, 'uniplus.internal.unexpected', 'Erro interno'),
        ERRO_500,
      );
      await t.propagate();
    }

    expect(alerta().textContent).not.toBe(textoAntes);
    expect(situacaoDaNovaTentativa(alerta())).toBe(TEXTO_REPETIDA);
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

  it('PesosEnemPage_ListagemComErroForaDoEnvelope_AlertaENovaTentativaQueFalhaNaHora', async () => {
    t.fixture.detectChanges();
    t.expectAreas().flush([...AREAS]);
    t.expectGrupos().flush([...GRUPOS]);
    t.expectListagem().flush(problem(500, 'uniplus.internal.unexpected', 'Erro interno'), ERRO_500);
    await t.propagate();
    t.fixture.detectChanges();

    // As novas tentativas falham fora do ApiResult e de forma síncrona.
    const erro = new Error('falha fora do envelope');
    vi.spyOn(TestBed.inject(PesosEnemApi), 'listar').mockReturnValue(throwError(() => erro));
    const handleError = vi
      .spyOn(TestBed.inject(ErrorHandler), 'handleError')
      .mockImplementation(() => undefined);
    const raiz = t.fixture.nativeElement as HTMLElement;
    const tentar = async (): Promise<void> => {
      raiz.querySelector<HTMLButtonElement>('#cfg-pesos-enem-registros-tentar')?.click();
      await t.propagate();
      await new Promise((resolver) => setTimeout(resolver));
      t.fixture.detectChanges();
    };

    await tentar();
    expect(t.store.carregando()).toBe(false);
    const botao = raiz.querySelector('#cfg-pesos-enem-registros-tentar');
    expect(botao?.getAttribute('aria-disabled')).toBeNull();
    expect(situacaoDaNovaTentativa(botao?.closest('ui-alerta-nova-tentativa') as HTMLElement)).toBe(
      TEXTO_REPETIDA,
    );
    // O erro não some: vai ao ErrorHandler da aplicação.
    expect(handleError).toHaveBeenCalledWith(erro);

    await tentar();
    expect(
      situacaoDaNovaTentativa(
        raiz
          .querySelector('#cfg-pesos-enem-registros-tentar')
          ?.closest('ui-alerta-nova-tentativa') as HTMLElement,
      ),
    ).toBe(TEXTO_REPETIDA);
  });

  it('PesosEnemPage_ErrorHandlerQueLanca_NaoPrendeACarga', async () => {
    t.fixture.detectChanges();
    t.expectAreas().flush([...AREAS]);
    t.expectGrupos().flush([...GRUPOS]);
    t.expectListagem().flush(problem(500, 'uniplus.internal.unexpected', 'Erro interno'), ERRO_500);
    await t.propagate();
    t.fixture.detectChanges();

    vi.spyOn(TestBed.inject(PesosEnemApi), 'listar').mockReturnValue(
      throwError(() => new Error('fora do envelope')),
    );
    vi.spyOn(TestBed.inject(ErrorHandler), 'handleError').mockImplementation(() => {
      throw new Error('o registro de erro também falhou');
    });
    const raiz = t.fixture.nativeElement as HTMLElement;
    // O erro do registro sobe como erro não tratado do rxjs; aqui ele é recolhido para
    // o teste conferir só que a tela não fica presa.
    const naoTratados: unknown[] = [];
    const anterior = rxjsConfig.onUnhandledError;
    rxjsConfig.onUnhandledError = (erro) => naoTratados.push(erro);
    try {
      raiz.querySelector<HTMLButtonElement>('#cfg-pesos-enem-registros-tentar')?.click();
      await t.propagate();
      await new Promise((resolve) => setTimeout(resolve));
    } finally {
      rxjsConfig.onUnhandledError = anterior;
    }
    t.fixture.detectChanges();

    expect(naoTratados).toHaveLength(1);
    expect(t.store.carregando()).toBe(false);
    expect(
      raiz.querySelector('#cfg-pesos-enem-registros-tentar')?.getAttribute('aria-disabled'),
    ).toBeNull();
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
    expect(situacaoDaNovaTentativa(alerta as HTMLElement)).toBe('');
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
