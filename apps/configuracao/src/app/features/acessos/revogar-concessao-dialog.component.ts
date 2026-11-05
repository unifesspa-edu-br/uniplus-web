import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { ConcessaoDto } from '@uniplus/shared-data/autorizacao';
import { AlertComponent, DialogComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { LIMITE_DO_MOTIVO } from './motivo-dialog.component';
import { mensagemDeErroDoControle } from '../../shared/formulario';
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
  styleUrl: './revogar-concessao-dialog.component.css',
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
        <fieldset
          role="none"
          [disabled]="enviando()"
          style="border: 0; margin: 0; padding: 0; min-width: 0; display: grid; gap: 1rem"
        >
          <label
            class="field"
            [class.is-error]="erroDoEmail() !== null || (tentou() && email().invalid)"
          >
            <span class="field__label is-required">E-mail do beneficiário</span>
            <input
              aria-required="true"
              class="input"
              type="email"
              autocomplete="off"
              [formControl]="email()"
              [attr.aria-invalid]="
                erroDoEmail() !== null || (tentou() && email().invalid) ? 'true' : null
              "
              aria-describedby="cfg-revogar-email-ajuda"
            />
            <span id="cfg-revogar-email-ajuda" class="field__hint"
              >Digite o e-mail institucional do beneficiário para confirmar a revogação.</span
            >
            @if (erroDoEmail() || mensagem(email()); as mensagem) {
              <span class="field__error">{{ mensagem }}</span>
            }
          </label>
          <label class="field" [class.is-error]="tentou() && motivo().invalid">
            <span class="field__label is-required">Motivo</span>
            <textarea
              aria-required="true"
              class="textarea"
              [formControl]="motivo()"
              [attr.maxlength]="limite"
              [attr.aria-invalid]="tentou() && motivo().invalid ? 'true' : null"
              aria-describedby="cfg-revogar-motivo-ajuda"
            ></textarea>
            <span id="cfg-revogar-motivo-ajuda" class="field__hint"
              >A revogação vale na hora, não precisa de aprovação e o motivo fica na trilha.</span
            >
            @if (tentou() && motivo().invalid) {
              <span class="field__error">{{
                mensagem(motivo()) || 'Informe o motivo, em até ' + limite + ' caracteres.'
              }}</span>
            }
          </label>
        </fieldset>
      </div>
      <p role="status" class="sr-only">{{ enviando() ? 'Revogando concessão…' : '' }}</p>
      <ng-container uiDialogFooter>
        <button
          type="button"
          class="btn btn--tertiary btn--rect"
          [disabled]="enviando()"
          (click)="visible.set(false)"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="btn btn--danger"
          [disabled]="!enviando() && !email().value.trim()"
          [attr.aria-disabled]="enviando() ? 'true' : null"
          [attr.aria-busy]="enviando()"
          (click)="confirmar($event)"
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
  readonly confirmado = output<void>();
  readonly email = input.required<FormControl<string>>();
  readonly motivo = input.required<FormControl<string>>();
  readonly tentou = input(false);

  protected readonly limite = LIMITE_DO_MOTIVO;
  protected readonly mensagem = mensagemDeErroDoControle;
  protected pessoa(concessao: ConcessaoDto): string {
    return autorDoEvento(concessao.beneficiario);
  }

  protected confirmar(evento: Event): void {
    if (this.enviando() || !this.email().value.trim()) {
      evento.preventDefault();
      return;
    }
    this.confirmado.emit();
  }
}
