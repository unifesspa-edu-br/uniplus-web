import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { type StepItem, StepsComponent } from '../steps/steps.component';
import { OverlayScrollService } from './overlay-scroll.service';

let proximoId = 0;

/**
 * A apresentação padrão dos passos: a coluna `lateral` do `ui-steps` em tela larga e, abaixo de 768 px,
 * a barra do passo atual que abre a lista como diálogo modal (`sobreposicao`). O host não gera caixa:
 * a coluna e a barra entram direto no layout de quem consome, que a põe ao lado do conteúdo.
 *
 * O diálogo leva o foco ao botão de fechar ao abrir e o devolve à barra ao fechar. Quando a lista fecha
 * por uma escolha, o foco é de quem consome, que o leva ao título do passo.
 */
@Component({
  selector: 'ui-steps-responsivo',
  imports: [StepsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      #barra
      type="button"
      class="step-bar"
      aria-haspopup="dialog"
      [attr.aria-expanded]="aberto()"
      [attr.aria-controls]="idDoDialogo"
      [style.--ui-steps-progresso]="progresso() === null ? null : progresso() + '%'"
      (click)="abrir()"
    >
      <!-- A ação nomeia o botão por texto dentro dele, e não por \`aria-label\`: o rótulo que
           reescreve o conteúdo visível deixa quem usa comando de voz dizendo o que lê na tela sem
           ativar nada (WCAG 2.1, SC 2.5.3). -->
      <span class="sr-only">Abrir lista de {{ nomeDaLista() }}.</span>
      <span class="step-bar__info">
        <span class="step-bar__heading">{{ titulo() }}</span>
        <span class="step-bar__meta">{{ meta() }}</span>
      </span>
      <svg
        class="step-bar__chevron"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        aria-hidden="true"
      >
        <path d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    <dialog
      #dialogo
      class="steps-overlay"
      [id]="idDoDialogo"
      [attr.aria-label]="rotuloDaNavegacao()"
      (cancel)="aoCancelar($event)"
      (close)="aoFechar()"
    >
      <div class="steps-overlay__header">
        <button
          #fecharBotao
          type="button"
          class="steps-overlay__close"
          [attr.aria-label]="'Fechar lista de ' + nomeDaLista()"
          (click)="fechar()"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            aria-hidden="true"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <ui-steps
        variante="sobreposicao"
        [items]="items()"
        (selecionado)="escolherNoDialogo($event)"
      />
    </dialog>
    <ui-steps
      class="ui-steps-responsivo__coluna"
      variante="lateral"
      [rotuloDaNavegacao]="rotuloDaNavegacao()"
      [items]="items()"
      (selecionado)="selecionado.emit($event)"
    />
  `,
})
export class StepsResponsivoComponent {
  readonly items = input.required<readonly StepItem[]>();
  /** O nome da navegação em tela larga e do diálogo em tela estreita. */
  readonly rotuloDaNavegacao = input.required<string>();
  /** O que a lista reúne, no plural, para os rótulos de abrir e fechar. */
  readonly nomeDaLista = input('etapas');
  /** O que a barra diz do passo atual: o título e a posição. */
  readonly titulo = input.required<string>();
  readonly meta = input.required<string>();
  /** A proporção concluída, de 0 a 100, que a barra desenha; sem ela, a barra não a mostra. */
  readonly progresso = input<number | null>(null);
  /**
   * Se a barra reserva o espaço dela no `scroll-padding-top` do contêiner que rola: sem a reserva, o
   * campo que recebe foco por teclado fica sob a barra fixa (WCAG 2.4.11). Quem já mede a reserva, como
   * o assistente, desliga.
   */
  readonly reservarRolagem = input(true);

  /** O passo escolhido, na coluna ou no diálogo; o diálogo já fechou quando a escolha sai dele. */
  readonly selecionado = output<number>();

  readonly aberto = signal(false);
  private readonly rolagem = inject(OverlayScrollService);

  constructor() {
    effect((aoLimpar) => {
      const barra = this.barra()?.nativeElement;
      if (!barra || !this.reservarRolagem() || typeof ResizeObserver === 'undefined') return;
      const area = areaQueRola(barra);
      const anterior = area.style.scrollPaddingTop;
      const medir = (): void => {
        area.style.scrollPaddingTop = barra.offsetHeight > 0 ? `${barra.offsetHeight}px` : anterior;
      };
      const observador = new ResizeObserver(medir);
      observador.observe(barra);
      medir();
      aoLimpar(() => {
        observador.disconnect();
        area.style.scrollPaddingTop = anterior;
      });
    });

    // Com a lista aberta o fundo não rola; a limpeza também libera a rolagem se a peça for destruída
    // aberta, para a rota seguinte não ficar travada.
    effect((aoLimpar) => {
      if (!this.aberto()) return;
      this.rolagem.lock();
      aoLimpar(() => this.rolagem.unlock());
    });
  }
  /** A barra, para quem precisa medir a faixa que ela ocupa. */
  readonly barra = viewChild<ElementRef<HTMLButtonElement>>('barra');
  private readonly dialogo = viewChild<ElementRef<HTMLDialogElement>>('dialogo');
  private readonly fecharBotao = viewChild<ElementRef<HTMLButtonElement>>('fecharBotao');

  protected readonly idDoDialogo = `ui-steps-dialogo-${proximoId++}`;
  /** O fechamento por escolha deixa o foco com quem consome; os demais o devolvem à barra. */
  private focoComQuemConsome = false;

  /**
   * Abre a lista como diálogo modal: `showModal()` põe o elemento no top layer e o navegador contém o
   * foco nele, sem o Tab escapar para o resto da página.
   */
  abrir(): void {
    const dialogo = this.dialogo()?.nativeElement;
    if (!dialogo || this.aberto()) return;
    dialogo.showModal();
    this.aberto.set(true);
    queueMicrotask(() => this.fecharBotao()?.nativeElement.focus());
  }

  fechar(): void {
    if (this.aberto()) this.dialogo()?.nativeElement.close();
  }

  /** O Esc deixa o elemento fechar; o estado acompanha pelo evento `close`. */
  protected aoCancelar(evento: Event): void {
    evento.preventDefault();
    this.fechar();
  }

  protected aoFechar(): void {
    if (!this.aberto()) return;
    this.aberto.set(false);
    if (this.focoComQuemConsome) this.focoComQuemConsome = false;
    else queueMicrotask(() => this.barra()?.nativeElement.focus());
  }

  protected escolherNoDialogo(indice: number): void {
    this.focoComQuemConsome = true;
    this.fechar();
    this.selecionado.emit(indice);
  }
}

/** O ancestral que rola na vertical, ou o documento quando nenhum rola. */
function areaQueRola(elemento: HTMLElement): HTMLElement {
  for (let pai = elemento.parentElement; pai; pai = pai.parentElement) {
    const rolagem = getComputedStyle(pai).overflowY;
    if (rolagem === 'auto' || rolagem === 'scroll') return pai;
  }
  return elemento.ownerDocument.documentElement;
}
