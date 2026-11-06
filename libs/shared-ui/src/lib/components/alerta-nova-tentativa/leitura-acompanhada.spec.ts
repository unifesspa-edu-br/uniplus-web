import { ApplicationRef, Signal, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnuncioDaConclusao } from './anuncio-da-conclusao';
import { acompanharLeitura, type LeituraAcompanhada } from './leitura-acompanhada';

const MENSAGEM = 'Não foi possível ler os dados.';

/** Uma atualização da tela: efeitos, `afterNextRender` e, em seguida, uma macrotarefa. */
async function atualizar(): Promise<void> {
  TestBed.inject(ApplicationRef).tick();
  await new Promise((resolver) => setTimeout(resolver));
  TestBed.inject(ApplicationRef).tick();
}

describe('acompanharLeitura com fonte que apaga a falha ao recomeçar', () => {
  const anunciar = vi.fn();
  let destino: HTMLButtonElement;
  let botao: HTMLButtonElement;

  beforeEach(() => {
    anunciar.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: AnuncioDaConclusao, useValue: { anunciar } }],
    });
    destino = document.createElement('button');
    botao = document.createElement('button');
    document.body.append(destino, botao);
  });

  afterEach(() => {
    destino.remove();
    botao.remove();
  });

  /** A leitura em falha, pronta para a pessoa pedir de novo com o foco no botão. */
  function emFalha(
    fonte: { falha: Signal<string | null>; pendente: Signal<boolean> },
    recarregar: () => void | boolean,
  ): LeituraAcompanhada {
    return TestBed.runInInjectionContext(() =>
      acompanharLeitura({ ...fonte, recarregar, destino: () => destino }),
    );
  }

  it('guarda a mensagem da falha ainda que ninguém a leia enquanto ela está na tela', async () => {
    const falha = signal<string | null>(MENSAGEM);
    const pendente = signal(false);
    const leitura = emFalha({ falha, pendente }, () => {
      falha.set(null);
      pendente.set(true);
    });
    await atualizar();

    leitura.tentar();
    await atualizar();

    expect(leitura.visivel()).toBe(true);
    expect(leitura.mensagem()).toBe(MENSAGEM);
  });

  describe('o fim da leitura e a nova falha', () => {
    it('a falha que sobe na mesma atualização em que a leitura cai é uma nova falha', async () => {
      const falha = signal<string | null>(MENSAGEM);
      const pendente = signal(false);
      const leitura = emFalha({ falha, pendente }, () => {
        falha.set(null);
        pendente.set(true);
      });
      await atualizar();
      botao.focus();

      leitura.tentar();
      await atualizar();
      pendente.set(false);
      falha.set(MENSAGEM);
      await atualizar();

      expect(anunciar).not.toHaveBeenCalled();
      expect(leitura.fase()).toBe('repetida');
      expect(document.activeElement).toBe(botao);
    });
  });
});

interface Estado {
  readonly de: 'lendo' | 'falha' | 'lido';
}

/** Um serviço com `async`/`await`, como `NotasDoEnemDoProcesso`: o estado muda depois da resposta. */
class ServicoAssincrono {
  readonly estado = signal<Estado>({ de: 'falha' });
  private resposta?: (deuCerto: boolean) => void;

  /** Como `recarregarProcesso`: passa a `lendo` antes do primeiro `await`. */
  async recarregarMarcandoLeitura(): Promise<void> {
    this.estado.set({ de: 'lendo' });
    await this.esperar();
  }

  responder(deuCerto: boolean): void {
    this.resposta?.(deuCerto);
  }

  private async esperar(): Promise<void> {
    const deuCerto = await new Promise<boolean>((resolver) => (this.resposta = resolver));
    this.estado.set({ de: deuCerto ? 'lido' : 'falha' });
  }
}

describe('acompanharLeitura sobre um serviço com await', () => {
  const anunciar = vi.fn();
  let destino: HTMLElement;
  let servico: ServicoAssincrono;

  const acompanhar = (recarregar: () => void): LeituraAcompanhada =>
    TestBed.runInInjectionContext(() =>
      acompanharLeitura({
        falha: computed(() => (servico.estado().de === 'falha' ? MENSAGEM : null)),
        pendente: computed(() => servico.estado().de === 'lendo'),
        recarregar,
        destino: () => destino,
      }),
    );

  beforeEach(() => {
    anunciar.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: AnuncioDaConclusao, useValue: { anunciar } }],
    });
    servico = new ServicoAssincrono();
    destino = document.createElement('h2');
    destino.tabIndex = -1;
    document.body.append(destino);
  });

  afterEach(() => {
    destino.remove();
  });

  it('o serviço que marca a leitura antes do await segue falha, tentativa e sucesso', async () => {
    const leitura = acompanhar(() => void servico.recarregarMarcandoLeitura());
    await atualizar();

    leitura.tentar();
    await atualizar();
    expect(leitura.fase()).toBe('tentando');
    expect(leitura.visivel()).toBe(true);

    servico.responder(true);
    await atualizar();

    expect(leitura.visivel()).toBe(false);
    expect(leitura.fase()).toBe('inicial');
  });

  it('o serviço que marca a leitura antes do await repete a falha só depois da resposta', async () => {
    const leitura = acompanhar(() => void servico.recarregarMarcandoLeitura());
    await atualizar();

    leitura.tentar();
    await atualizar();
    expect(leitura.fase()).toBe('tentando');
    servico.responder(false);
    await atualizar();

    expect(leitura.fase()).toBe('repetida');
    expect(leitura.mensagem()).toBe(MENSAGEM);
  });
});
