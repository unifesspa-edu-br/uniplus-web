import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import type { ConcessaoDto } from '@uniplus/shared-data/autorizacao';
import { AlertComponent, DialogComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { LIMITE_DO_MOTIVO } from './motivo-dialog.component';
import { autorDoEvento } from './trilha-de-acesso.component';

/** O que a pessoa digitou para confirmar a revogação. */
export interface ConfirmacaoDaRevogacao {
  readonly motivo: string;
  readonly confirmacaoEmail: string;
}

/**
 * Diálogo da revogação: mostra a concessão que será retirada e pede o e-mail do beneficiário e o motivo.
 * O botão só se habilita com o e-mail preenchido; a API confere se ele é o do beneficiário.
 */
@Component({
  selector: 'cfg-revogar-concessao-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, AlertComponent, DialogComponent, SpinnerComponent, DateBrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-dialog [(visible)]="visible" heading="Revogar a concessão" [dismissible]="!enviando()">
      <div class="cfg-dialog-form">
        @if (erro()) {
          <ui-alert variant="danger" heading="Não foi possível concluir">{{ erro() }}</ui-alert>
        }
        @if (concessao(); as c) {
          <dl class="cfg-detail-list" aria-label="Concessão a revogar">
            <div>
              <dt>Beneficiário</dt>
              <dd>{{ pessoa(c) }}</dd>
            </div>
            <div>
              <dt>Perfil</dt>
              <dd>{{ c.perfil.nome }}</dd>
            </div>
            <div>
              <dt>Escopo</dt>
              <dd>{{ escopoDaConcessao() }}</dd>
            </div>
            <div>
              <dt>Concedida em</dt>
              <dd>{{ c.concedidaEm | dateBr: 'datetime' }}</dd>
            </div>
            <div>
              <dt>Válida até</dt>
              <dd>{{ c.validaAte ? (c.validaAte | dateBr: 'datetime') : 'Sem prazo' }}</dd>
            </div>
          </dl>
        }
        <label class="field" [class.is-error]="erroDoEmail() !== null">
          <span class="field__label is-required">E-mail do beneficiário</span>
          <input
            class="input"
            type="email"
            autocomplete="off"
            [formControl]="email"
            [attr.aria-invalid]="erroDoEmail() !== null ? 'true' : null"
            aria-describedby="cfg-revogar-email-ajuda"
          />
          <span id="cfg-revogar-email-ajuda" class="field__hint"
            >Digite o e-mail institucional do beneficiário para confirmar a revogação.</span
          >
          @if (erroDoEmail(); as mensagem) {
            <span class="field__error">{{ mensagem }}</span>
          }
        </label>
        <label class="field" [class.is-error]="tentou() && motivo.invalid">
          <span class="field__label is-required">Motivo</span>
          <textarea
            class="textarea"
            [formControl]="motivo"
            [attr.maxlength]="limite"
            [attr.aria-invalid]="tentou() && motivo.invalid ? 'true' : null"
            aria-describedby="cfg-revogar-motivo-ajuda"
          ></textarea>
          <span id="cfg-revogar-motivo-ajuda" class="field__hint"
            >A revogação vale na hora, não precisa de aprovação e o motivo fica na trilha.</span
          >
          @if (tentou() && motivo.invalid) {
            <span class="field__error">Informe o motivo, em até {{ limite }} caracteres.</span>
          }
        </label>
      </div>
      <ng-container uiDialogFooter>
        <button type="button" class="btn btn--tertiary btn--rect" (click)="visible.set(false)">
          Cancelar
        </button>
        <button
          type="button"
          class="btn btn--danger"
          [disabled]="enviando() || !emailPreenchido()"
          (click)="confirmar()"
        >
          @if (enviando()) {
            <ui-spinner size="sm" />
          }
          Revogar concessão
        </button>
      </ng-container>
    </ui-dialog>
  `,
})
export class RevogarConcessaoDialogComponent {
  readonly visible = model(false);
  readonly concessao = input<ConcessaoDto | null>(null);
  /** Nome do escopo (sigla da unidade ou Instituição), que quem hospeda sabe resolver. */
  readonly escopoDaConcessao = input('');
  readonly erro = input<string | null>(null);
  /** A recusa da API ao e-mail informado, mostrada no próprio campo. */
  readonly erroDoEmail = input<string | null>(null);
  readonly enviando = input(false);
  readonly confirmado = output<ConfirmacaoDaRevogacao>();

  protected readonly limite = LIMITE_DO_MOTIVO;
  protected readonly tentou = signal(false);
  protected readonly emailPreenchido = signal(false);
  protected readonly email = new FormControl('', { nonNullable: true });
  protected readonly motivo = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(LIMITE_DO_MOTIVO)],
  });

  constructor() {
    this.email.valueChanges.subscribe((valor) => this.emailPreenchido.set(valor.trim() !== ''));
    // O diálogo mantém o conteúdo entre aberturas: cada abertura começa sem o que a anterior digitou.
    effect(() => {
      if (!this.visible()) return;
      untracked(() => {
        this.email.reset('');
        this.motivo.reset('');
        this.tentou.set(false);
      });
    });
  }

  protected pessoa(concessao: ConcessaoDto): string {
    return autorDoEvento(concessao.beneficiario);
  }

  protected confirmar(): void {
    this.tentou.set(true);
    const motivo = this.motivo.value.trim();
    const confirmacaoEmail = this.email.value.trim();
    if (motivo === '' || confirmacaoEmail === '' || this.enviando()) {
      this.motivo.setErrors(motivo === '' ? { required: true } : null);
      return;
    }
    this.confirmado.emit({ motivo, confirmacaoEmail });
  }
}
