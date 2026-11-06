import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AlertComponent, DialogComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import type { AlteracaoDoLocal } from './busca-de-municipios';
import {
  type DiaNaoUtilFormGroup,
  MUNICIPIO_BUSCA_VAZIA,
  type MunicipioBuscaState,
} from './calendario-dias-uteis.util';
import { DiaNaoUtilCamposComponent } from './dia-nao-util-campos.component';

/** O diálogo que acrescenta um dia não útil ao calendário aberto. */
@Component({
  selector: 'cfg-dia-nao-util-dialogo',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    DialogComponent,
    SpinnerComponent,
    DiaNaoUtilCamposComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dia-nao-util-dialogo.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class DiaNaoUtilDialogoComponent {
  readonly aberto = model.required<boolean>();
  readonly form = input.required<FormGroup<DiaNaoUtilFormGroup>>();
  readonly erro = input.required<string | null>();
  readonly anuncio = input.required<string>();
  readonly salvando = input.required<boolean>();
  readonly busca = input<MunicipioBuscaState>(MUNICIPIO_BUSCA_VAZIA);
  readonly salvar = output<void>();
  readonly cancelar = output<void>();
  readonly alteracao = output<AlteracaoDoLocal>();
  readonly fechado = output<void>();

  private readonly foco = acompanharFocoDoEnvio({ salvando: this.salvando, aberto: this.aberto });

  protected aoClicarEmSalvar(evento: Event): void {
    if (this.salvando()) evento.preventDefault();
  }

  protected aoEnviar(): void {
    if (this.salvando()) return;
    this.salvar.emit();
    if (this.form().invalid) this.foco.focarPrimeiroInvalido();
  }
}
