import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  viewChild,
} from '@angular/core';
import { DialogComponent } from '../dialog/dialog';

/**
 * O aviso de que a sessão terminou. Só apresenta: quem o usa decide para onde levar. Não se fecha sozinho nem por Esc, para que a pessoa o leia; as duas saídas são botões.
 */
@Component({
  selector: 'ui-aviso-de-sessao-encerrada',
  imports: [DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-dialog
      [visible]="aberto()"
      heading="Sua sessão foi encerrada"
      describedBy="aviso-de-sessao-encerrada-texto"
      [dismissible]="false"
    >
      <div id="aviso-de-sessao-encerrada-texto">
        <p>Por segurança, o acesso termina depois de um tempo.</p>
        <p>O que você preencheu e ainda não gravou se perdeu. Entre novamente para continuar.</p>
      </div>
      <ng-container uiDialogFooter>
        <button type="button" class="btn btn--tertiary" (click)="dispensar.emit()">
          Agora não
        </button>
        <button #entrarNovamente type="button" class="btn" (click)="entrar.emit()">
          Entrar novamente
        </button>
      </ng-container>
    </ui-dialog>
  `,
})
export class AvisoDeSessaoEncerradaComponent {
  /** Abre o aviso. */
  readonly aberto = input.required<boolean>();
  readonly entrar = output<void>();
  readonly dispensar = output<void>();

  private readonly injector = inject(Injector);
  private readonly botaoEntrar = viewChild<ElementRef<HTMLButtonElement>>('entrarNovamente');

  constructor() {
    effect(() => {
      if (this.aberto()) this.focarEntrarDepoisDeRenderizar();
    });
  }

  private focarEntrarDepoisDeRenderizar(): void {
    afterNextRender(() => this.botaoEntrar()?.nativeElement.focus(), { injector: this.injector });
  }
}
