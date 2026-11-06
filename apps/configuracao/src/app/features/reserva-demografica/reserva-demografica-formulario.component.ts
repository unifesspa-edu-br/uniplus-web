import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AlertComponent, DrawerComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { ReservaForm, mensagemDoCampo } from './reserva-demografica-form';

@Component({
  selector: 'cfg-reserva-demografica-formulario',
  standalone: true,
  imports: [ReactiveFormsModule, AlertComponent, DrawerComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reserva-demografica-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class ReservaDemograficaFormularioComponent {
  readonly aberto = model.required<boolean>();
  readonly form = input.required<FormGroup<ReservaForm>>();
  readonly titulo = input.required<string>();
  readonly erro = input.required<string | null>();
  readonly anuncio = input.required<string>();
  readonly modo = input.required<'criar' | 'editar'>();
  readonly salvando = input.required<boolean>();
  readonly salvar = output<void>();
  readonly cancelar = output<void>();
  readonly verificarCenso = output<void>();
  protected readonly rotuloDoBotao = computed(() => {
    if (this.salvando()) return 'Salvando...';
    return this.modo() === 'criar' ? 'Criar referência' : 'Salvar referência';
  });
  private readonly foco = acompanharFocoDoEnvio({ salvando: this.salvando, aberto: this.aberto });

  protected erroDoCampo(nome: keyof ReservaForm): string | null {
    return mensagemDoCampo(this.form().controls[nome]);
  }

  protected aoEnviar(): void {
    if (this.salvando()) return;
    this.salvar.emit();
    if (this.form().invalid) this.foco.focarPrimeiroInvalido();
  }
}
