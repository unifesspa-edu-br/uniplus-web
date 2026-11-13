import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { map } from 'rxjs';
import type { DetalheDaProtecaoDoCatalogoDto } from '@uniplus/shared-data/configuracao';
import { AlertComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { contarCaracteres } from '@uniplus/shared-utils';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import { ManifestacaoDoItem } from './manifestacao-do-item';
import { PARECERES } from './manifestacoes';

/** O formulário da manifestação técnica: parecer e texto, enviados no ciclo lido no detalhe. */
@Component({
  selector: 'cfg-manifestacao-do-item',
  standalone: true,
  imports: [ReactiveFormsModule, AlertComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './manifestacao-do-item.component.html',
})
export class ManifestacaoDoItemComponent {
  readonly detalhe = input.required<DetalheDaProtecaoDoCatalogoDto>();
  protected readonly manifestacao = inject(ManifestacaoDoItem);
  protected readonly pareceres = PARECERES;
  protected readonly form = this.manifestacao.form;
  protected readonly tamanho = toSignal(
    this.form.controls.texto.valueChanges.pipe(map(contarCaracteres)),
    { initialValue: 0 },
  );
  private readonly estado = toSignal(this.form.statusChanges, { initialValue: this.form.status });

  protected readonly erroDoParecer = computed(() => this.erroDe('parecer'));
  protected readonly erroDoTexto = computed(() => this.erroDe('texto'));

  private erroDe(campo: 'parecer' | 'texto'): string | null {
    this.estado();
    if (!this.manifestacao.tentou()) return null;
    const controle = this.form.controls[campo];
    if (controle.hasError('required')) {
      return campo === 'parecer'
        ? 'Escolha o parecer.'
        : 'Os pareceres recomenda ajuste e inadequada exigem o texto.';
    }
    return mensagemDeErroDoControle(controle);
  }
}
