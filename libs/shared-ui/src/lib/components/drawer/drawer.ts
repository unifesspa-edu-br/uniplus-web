import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  OnDestroy,
  effect,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';

let drawerIdSeed = 0;
let openDrawerCount = 0;

@Component({
  selector: 'ui-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #drawer
      class="uni-drawer"
      [class.uni-drawer--right]="position() === 'right'"
      [id]="drawerId()"
      [attr.aria-label]="ariaLabel()"
      (cancel)="close($event)"
      (close)="onNativeClose()"
    >
      <div class="uni-drawer__panel">
        <div class="uni-drawer__header">
          <h2 #title class="uni-drawer__title" tabindex="-1">{{ heading() }}</h2>
          <button
            #closeButton
            type="button"
            class="btn btn--tertiary btn--icon-only btn--rect"
            aria-label="Fechar"
            [disabled]="!closable()"
            (click)="close()"
          >
            &times;
          </button>
        </div>
        <div class="uni-drawer__body">
          <ng-content />
        </div>
      </div>
    </dialog>
  `,
})
export class DrawerComponent implements OnDestroy {
  readonly visible = model<boolean>(false);
  readonly id = input<string | null>(null);
  readonly heading = input<string>('Detalhes');
  readonly ariaLabel = input<string>('Painel lateral');
  readonly position = input<'left' | 'right'>('right');
  /**
   * `false` recusa fechar pelo X, por Esc ou por um clique fora — usado por telas com uma
   * mutação em voo, onde fechar perderia o resultado dela (a resposta chegaria com o
   * formulário já desmontado). O consumidor ainda fecha programaticamente via `visible`.
   */
  readonly closable = input<boolean>(true);
  /**
   * Onde o foco cai ao abrir. `fechar` (padrão) serve ao formulário; `titulo` serve ao painel de
   * leitura, em que o leitor de tela começa pelo nome do que está sendo mostrado.
   */
  readonly focoInicial = input<'fechar' | 'titulo'>('fechar');
  readonly closed = output<void>();

  private readonly drawerRef = viewChild<ElementRef<HTMLDialogElement>>('drawer');
  private readonly closeButtonRef = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  private readonly titleRef = viewChild<ElementRef<HTMLElement>>('title');
  private lastFocusedElement: HTMLElement | null = null;
  private bodyScrollLocked = false;
  private readonly autoDrawerId = `ui-drawer-${++drawerIdSeed}`;
  protected readonly drawerId = computed(() => this.id() ?? this.autoDrawerId);

  constructor() {
    effect(() => {
      const drawer = this.drawerRef()?.nativeElement;
      if (!drawer) return;

      if (this.visible()) {
        this.openDrawer(drawer);
      } else {
        this.closeDrawer(drawer);
      }
    });
  }

  ngOnDestroy(): void {
    this.unlockBodyScroll();
  }

  protected close(event?: Event): void {
    event?.preventDefault();
    if (!this.closable()) {
      return;
    }
    this.visible.set(false);
  }

  protected onNativeClose(): void {
    if (this.visible()) {
      this.visible.set(false);
    }
    this.unlockBodyScroll();
    if (this.focoEstaLivre()) {
      this.lastFocusedElement?.focus();
    }
    this.lastFocusedElement = null;
    this.closed.emit();
  }

  /**
   * O foco só volta ao elemento de origem quando ninguém o tomou: no corpo da página ou ainda dentro
   * do drawer. Um fechamento que chega depois de a pessoa já ter seguido para outro controle não
   * pode arrancá-la de lá.
   */
  private focoEstaLivre(): boolean {
    const ativo = document.activeElement;
    const drawer = this.drawerRef()?.nativeElement;
    return ativo === null || ativo === document.body || (drawer?.contains(ativo) ?? false);
  }

  private openDrawer(drawer: HTMLDialogElement): void {
    if (drawer.open) return;
    this.lastFocusedElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    if (typeof drawer.showModal === 'function') {
      drawer.showModal();
    } else {
      drawer.setAttribute('open', '');
    }
    this.lockBodyScroll();
    queueMicrotask(() => {
      const alvo = this.focoInicial() === 'titulo' ? this.titleRef() : this.closeButtonRef();
      alvo?.nativeElement.focus();
    });
  }

  private closeDrawer(drawer: HTMLDialogElement): void {
    if (!drawer.open) return;
    if (typeof drawer.close === 'function') {
      drawer.close();
    } else {
      drawer.removeAttribute('open');
      this.onNativeClose();
    }
  }

  private lockBodyScroll(): void {
    if (this.bodyScrollLocked || typeof document === 'undefined') return;
    openDrawerCount += 1;
    document.body.classList.add('uni-drawer-open');
    this.bodyScrollLocked = true;
  }

  private unlockBodyScroll(): void {
    if (!this.bodyScrollLocked || typeof document === 'undefined') return;
    openDrawerCount = Math.max(0, openDrawerCount - 1);
    if (openDrawerCount === 0) {
      document.body.classList.remove('uni-drawer-open');
    }
    this.bodyScrollLocked = false;
  }
}
