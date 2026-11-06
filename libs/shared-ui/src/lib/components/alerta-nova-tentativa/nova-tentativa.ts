import {
  Injector,
  Signal,
  WritableSignal,
  afterNextRender,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';

import { AnuncioDaConclusao } from './anuncio-da-conclusao';
import { FocoDaNovaTentativa } from './foco-da-nova-tentativa';

/**
 * Em que ponto está a nova tentativa pedida pela pessoa: ainda não houve (`inicial`), está em
 * curso (`tentando`) ou terminou em nova falha (`repetida`). Quando dá certo, o alerta sai.
 */
export type FaseDaNovaTentativa = 'inicial' | 'tentando' | 'repetida';

/** O "Tentar novamente" de uma leitura: guarda contra clique repetido, foco e fase visível. */
export interface NovaTentativa {
  /**
   * Dispara a nova tentativa pedida pela pessoa. Não faz nada enquanto a leitura corre — a mesma
   * condição do `aria-disabled` do botão, que não é `disabled` para não perder o foco.
   *
   * `disparar` devolve `false` quando nenhuma leitura começou (pediu uma confirmação, não havia
   * o que ler, a leitura estava recusada): a fase volta ao que era, e a falta de leitura não
   * vira "a nova tentativa também falhou".
   */
  executar(disparar: () => void | boolean): void;
  /** A fase da última tentativa pedida, para o alerta mostrar e anunciar o mesmo texto. */
  readonly fase: Signal<FaseDaNovaTentativa>;
}

export interface OpcoesDaNovaTentativa {
  /** `true` enquanto a leitura corre. */
  readonly pendente: Signal<boolean>;
  /** `true` enquanto o alerta da falha está na tela. */
  readonly falhou: Signal<boolean>;
  /** Elemento estável que recebe o foco quando a tentativa dá certo. */
  readonly destino: () => HTMLElement | null | undefined;
  /** O que é lido, quando a tela cuida de mais de uma leitura; entra no aviso de conclusão. */
  readonly assunto?: string;
}

/**
 * Uma tentativa pedida pela pessoa, do clique ao desfecho. Fase e foco terminam no mesmo ponto:
 * quando a leitura, vista pendente, deixa de correr ou, se nenhuma atualização a mostrou
 * pendente, numa macrotarefa depois da primeira atualização da tela que segue o disparo. Esperar
 * essa atualização, e não só um temporizador, garante que um `pendente` derivado de `input()`
 * já recebeu o estado que o pai gravou na hora; a macrotarefa seguinte dá ao navegador a chance
 * de desenhar o "tentando", sem que o desfecho dependa disso.
 */
class ControleDaNovaTentativa {
  private readonly atual: WritableSignal<FaseDaNovaTentativa> = signal('inicial');
  readonly fase: Signal<FaseDaNovaTentativa> = this.atual.asReadonly();
  private aguardando = false;
  private leituraVista = false;

  constructor(
    private readonly pendente: Signal<boolean>,
    private readonly falhou: Signal<boolean>,
    private readonly foco: FocoDaNovaTentativa,
    private readonly injector: Injector,
  ) {
    effect(
      () => {
        const emCurso = pendente();
        falhou();
        untracked(() => (emCurso ? this.leituraComecou() : this.leituraTerminou()));
      },
      { injector },
    );
  }

  /** Em curso: a leitura corre ou a pessoa acabou de pedi-la. */
  get emAndamento(): boolean {
    return untracked(this.pendente) || this.aguardando;
  }

  /** Sem leitura iniciada, ou com erro ao dispará-la, nada fica preso em `tentando`. */
  acompanhar(disparar: () => void | boolean): void {
    const anterior = this.iniciar();
    let comecou: boolean;
    try {
      comecou = disparar() !== false;
    } catch (erro) {
      this.desfazer(anterior);
      throw erro;
    }
    if (comecou) this.aposODisparo();
    else this.desfazer(anterior);
  }

  /** Passa a `tentando`, marca o foco e devolve a fase de antes, para `desfazer`. */
  private iniciar(): FaseDaNovaTentativa {
    const anterior = untracked(this.atual);
    this.foco.marcar();
    this.aguardando = true;
    this.atual.set('tentando');
    return anterior;
  }

  /** Sem leitura a acompanhar: fase e foco voltam ao que eram. */
  private desfazer(anterior: FaseDaNovaTentativa): void {
    this.aguardando = false;
    this.leituraVista = false;
    this.foco.descartar();
    this.atual.set(anterior);
  }

  /** `disparar` já rodou: se nenhuma atualização mostrou a leitura pendente, o desfecho espera. */
  private aposODisparo(): void {
    afterNextRender(() => this.conferirSeComecou(), { injector: this.injector });
  }

  /** Depois da atualização: sem leitura vista, o desfecho vem numa macrotarefa seguinte. */
  private conferirSeComecou(): void {
    if (!this.aguardando || this.leituraVista) return;
    setTimeout(() => {
      if (this.aguardando && !this.leituraVista && !untracked(this.pendente)) this.concluir();
    });
  }

  /** Uma leitura que ninguém pediu como nova tentativa apaga a falha repetida da anterior. */
  private leituraComecou(): void {
    if (this.aguardando) this.leituraVista = true;
    else if (this.atual() === 'repetida') this.atual.set('inicial');
  }

  private leituraTerminou(): void {
    if (!this.aguardando || this.leituraVista) this.concluir();
  }

  private concluir(): void {
    const comFalha = untracked(this.falhou);
    if (this.aguardando) {
      this.atual.set(comFalha ? 'repetida' : 'inicial');
      this.foco.concluir(comFalha);
    } else if (!comFalha) {
      this.atual.set('inicial');
    }
    this.aguardando = false;
    this.leituraVista = false;
  }
}

/**
 * Toda nova tentativa de uma leitura cujo alerta de falha fica na tela durante a espera. Como o
 * alerta tem o mesmo texto quando a tentativa falha de novo, a fase muda o que ele mostra a cada
 * etapa, e quem não enxerga ouve o mesmo texto. O foco volta ao `destino` quando a leitura dá
 * certo (ver `FocoDaNovaTentativa`). Só as tentativas pedidas pela pessoa mudam a fase.
 *
 * Chamar em contexto de injeção (inicializador de campo ou construtor).
 */
export function acompanharNovaTentativa(opcoes: OpcoesDaNovaTentativa): NovaTentativa {
  const { pendente, falhou, destino, assunto } = opcoes;
  const injector = inject(Injector);
  const anuncio = inject(AnuncioDaConclusao);
  const foco = new FocoDaNovaTentativa(
    destino,
    (focoLevado) => {
      if (!focoLevado) anuncio.anunciar(textoDaConclusao(assunto));
    },
    injector,
  );
  const controle = new ControleDaNovaTentativa(pendente, falhou, foco, injector);

  return {
    fase: controle.fase,
    executar: (disparar) => {
      if (controle.emAndamento) return;
      controle.acompanhar(disparar);
    },
  };
}

/**
 * O texto que o alerta mostra e que o leitor de tela anuncia, da mesma fonte.
 *
 * @param assunto O que é lido, quando o alerta cuida de mais de uma leitura ("campi").
 */
export function textoDaNovaTentativa(fase: FaseDaNovaTentativa, assunto?: string): string {
  if (fase === 'tentando') return assunto ? `Recarregando ${assunto}…` : 'Tentando novamente…';
  if (fase === 'repetida') {
    const tentativa = assunto ? `A nova tentativa de recarregar ${assunto}` : 'A nova tentativa';
    return `${tentativa} também falhou.`;
  }
  return '';
}

/** O aviso de que a leitura pedida deu certo, para quem não recebeu o foco no resultado. */
export function textoDaConclusao(assunto?: string): string {
  return assunto ? `Leitura concluída: ${assunto}.` : 'Dados carregados.';
}
