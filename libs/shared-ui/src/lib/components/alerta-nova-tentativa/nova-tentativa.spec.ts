import { ApplicationRef, afterNextRender, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnuncioDaConclusao } from './anuncio-da-conclusao';

import {
  acompanharNovaTentativa,
  textoDaNovaTentativa,
  type FaseDaNovaTentativa,
  type NovaTentativa,
} from './nova-tentativa';

const macrotarefa = (): Promise<void> => new Promise((resolver) => setTimeout(resolver));

describe('acompanharNovaTentativa', () => {
  const carregando = signal(false);
  const falhou = signal(true);
  let disparos: number;
  let tentativa: NovaTentativa;

  const assentar = (): void => TestBed.tick();
  const pedir = (): void => {
    tentativa.executar(() => {
      disparos += 1;
      carregando.set(true);
    });
    assentar();
  };
  const terminar = (comFalha: boolean): void => {
    falhou.set(comFalha);
    carregando.set(false);
    assentar();
  };

  beforeEach(() => {
    carregando.set(false);
    falhou.set(true);
    disparos = 0;
    tentativa = TestBed.runInInjectionContext(() =>
      acompanharNovaTentativa({ pendente: carregando, falhou, destino: () => null }),
    );
    assentar();
  });

  it('começa sem tentativa pedida', () => {
    expect(tentativa.fase()).toBe('inicial');
  });

  it('fica em andamento enquanto a leitura pedida corre', () => {
    pedir();

    expect(tentativa.fase()).toBe('tentando');
  });

  it('volta ao início quando a tentativa dá certo', () => {
    pedir();
    terminar(false);

    expect(tentativa.fase()).toBe('inicial');
  });

  it('mostra cada falha seguida passando pelo andamento, para o texto mudar a cada tentativa', () => {
    const fases: FaseDaNovaTentativa[] = [];
    for (let vez = 0; vez < 3; vez++) {
      pedir();
      fases.push(tentativa.fase());
      terminar(true);
      fases.push(tentativa.fase());
    }

    expect(fases).toEqual(['tentando', 'repetida', 'tentando', 'repetida', 'tentando', 'repetida']);
  });

  it('não muda a fase por uma leitura que a pessoa não pediu', () => {
    carregando.set(true);
    assentar();
    terminar(true);

    expect(tentativa.fase()).toBe('inicial');
  });

  it('recomeça no início quando a falha some e uma nova falha surge depois', () => {
    pedir();
    terminar(true);
    falhou.set(false);
    assentar();
    falhou.set(true);
    assentar();

    expect(tentativa.fase()).toBe('inicial');
  });

  it('na leitura que falha na hora, o andamento fica até a macrotarefa e só então vem a falha repetida', async () => {
    tentativa.executar(() => {
      disparos += 1;
    });
    assentar();
    const noMesmoQuadro = tentativa.fase();
    await macrotarefa();

    expect([noMesmoQuadro, tentativa.fase()]).toEqual(['tentando', 'repetida']);
  });

  it('duas falhas síncronas seguidas passam cada uma pelo andamento antes da falha repetida', async () => {
    const vistas: FaseDaNovaTentativa[] = [];
    for (let vez = 0; vez < 2; vez++) {
      tentativa.executar(() => {
        disparos += 1;
      });
      assentar();
      vistas.push(tentativa.fase());
      await macrotarefa();
      vistas.push(tentativa.fase());
    }

    expect(vistas).toEqual(['tentando', 'repetida', 'tentando', 'repetida']);
  });

  it('sem leitura iniciada, a fase volta ao que era e não vira falha repetida', async () => {
    tentativa.executar(() => false);
    assentar();
    await macrotarefa();

    expect(tentativa.fase()).toBe('inicial');
  });

  it('sem leitura iniciada depois de uma falha repetida, mantém a falha repetida', async () => {
    pedir();
    terminar(true);
    tentativa.executar(() => false);
    assentar();
    await macrotarefa();

    expect(tentativa.fase()).toBe('repetida');
  });

  it('uma leitura que começa sem ter sido pedida como nova tentativa apaga a falha repetida', () => {
    pedir();
    terminar(true);
    expect(tentativa.fase()).toBe('repetida');

    carregando.set(true);
    assentar();

    expect(tentativa.fase()).toBe('inicial');
  });

  it('um erro ao disparar devolve a fase e deixa a pessoa tentar de novo', () => {
    expect(() =>
      tentativa.executar(() => {
        throw new Error('falha ao disparar');
      }),
    ).toThrow('falha ao disparar');
    assentar();

    expect(tentativa.fase()).toBe('inicial');
    pedir();
    expect(disparos).toBe(1);
  });

  it('clique repetido durante a leitura não dispara de novo', () => {
    pedir();

    pedir();

    expect(disparos).toBe(1);
    expect(tentativa.fase()).toBe('tentando');
  });
});

describe('textoDaNovaTentativa', () => {
  it('não diz nada antes de a pessoa pedir a nova tentativa', () => {
    expect(textoDaNovaTentativa('inicial')).toBe('');
  });

  it('diz o que acontece e o que fazer, com o assunto quando há mais de uma leitura', () => {
    expect(textoDaNovaTentativa('tentando')).toBe('Tentando novamente…');
    expect(textoDaNovaTentativa('tentando', 'campi')).toBe('Recarregando campi…');
    expect(textoDaNovaTentativa('repetida')).toBe('A nova tentativa também falhou.');
    expect(textoDaNovaTentativa('repetida', 'campi')).toBe(
      'A nova tentativa de recarregar campi também falhou.',
    );
  });
});

describe('aviso de conclusão da nova tentativa', () => {
  const carregando = signal(false);
  const falhou = signal(true);
  const anunciar = vi.fn();
  let botao: HTMLButtonElement;
  let titulo: HTMLElement;
  let tentativa: NovaTentativa;
  let app: ApplicationRef;

  beforeEach(() => {
    carregando.set(false);
    falhou.set(true);
    anunciar.mockReset();
    botao = document.createElement('button');
    titulo = document.createElement('h1');
    titulo.tabIndex = -1;
    document.body.append(botao, titulo);
    TestBed.configureTestingModule({
      providers: [{ provide: AnuncioDaConclusao, useValue: { anunciar } }],
    });
    app = TestBed.inject(ApplicationRef);
    tentativa = TestBed.runInInjectionContext(() =>
      acompanharNovaTentativa({
        pendente: carregando,
        falhou,
        destino: () => titulo,
        assunto: 'campi',
      }),
    );
    app.tick();
  });

  afterEach(() => {
    botao.remove();
    titulo.remove();
  });

  const pedirEDarCerto = (): void => {
    tentativa.executar(() => carregando.set(true));
    app.tick();
    falhou.set(false);
    carregando.set(false);
    // O alerta sai na renderização que segue: o botão deixa a tela antes do foco ser conferido.
    afterNextRender({ earlyRead: () => botao.remove() }, { injector: app.injector });
    app.tick();
  };

  it('com o foco fora do botão, avisa que a leitura deu certo', () => {
    pedirEDarCerto();

    expect(anunciar).toHaveBeenCalledWith('Leitura concluída: campi.');
  });

  it('com o foco levado ao destino, não avisa: quem ouve o destino já sabe', () => {
    botao.focus();
    pedirEDarCerto();

    expect(document.activeElement).toBe(titulo);
    expect(anunciar).not.toHaveBeenCalled();
  });

  it('não avisa quando a tentativa falha de novo', () => {
    tentativa.executar(() => carregando.set(true));
    app.tick();
    carregando.set(false);
    app.tick();

    expect(anunciar).not.toHaveBeenCalled();
  });
});
