import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AlertComponent, DrawerComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { TipoProcessoForm } from './tipo-processo-form';
import { mensagemDeErroDoControle } from '../../shared/formulario';

@Component({
  selector: 'cfg-tipo-processo-formulario',
  imports: [ReactiveFormsModule, AlertComponent, DrawerComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipo-processo-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class TipoProcessoFormularioComponent {
  readonly aberto = input.required<boolean>();
  readonly form = input.required<FormGroup<TipoProcessoForm>>();
  readonly modo = input.required<'criar' | 'editar'>();
  readonly titulo = input.required<string>();
  readonly erro = input.required<string | null>();
  readonly salvando = input.required<boolean>();
  readonly abertura = output<boolean>();
  readonly salvar = output<void>();
  protected erroDoCampo(nome: keyof TipoProcessoForm): string | null {
    return mensagemDeErroDoControle(this.form().controls[nome]);
  }
  protected alterarAbertura(aberto: boolean): void {
    if (!this.salvando()) this.abertura.emit(aberto);
  }
  protected enviar(): void {
    if (!this.salvando()) this.salvar.emit();
  }
  protected aoClicarEmSalvar(evento: Event): void {
    if (this.salvando()) evento.preventDefault();
  }
}
