import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AlertComponent, DrawerComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { TipoProcessoForm, mensagemDoCampo } from './tipo-processo-form';

@Component({
  selector: 'cfg-tipo-processo-formulario',
  imports: [ReactiveFormsModule, AlertComponent, DrawerComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipo-processo-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class TipoProcessoFormularioComponent {
  readonly aberto = model.required<boolean>();
  readonly form = input.required<FormGroup<TipoProcessoForm>>();
  readonly modo = input.required<'criar' | 'editar'>();
  readonly titulo = input.required<string>();
  readonly erro = input.required<string | null>();
  readonly anuncio = input.required<string>();
  readonly salvando = input.required<boolean>();
  readonly salvar = output<void>();
  readonly cancelar = output<void>();
  protected readonly rotuloDoBotao = computed(() => {
    if (this.salvando()) return 'Salvando...';
    return this.modo() === 'criar' ? 'Criar tipo de processo' : 'Salvar tipo de processo';
  });
  private readonly foco = acompanharFocoDoEnvio({ salvando: this.salvando, aberto: this.aberto });

  protected erroDoCampo(nome: keyof TipoProcessoForm): string | null {
    return mensagemDoCampo(this.form().controls[nome]);
  }

  protected aoClicarEmSalvar(evento: Event): void {
    if (this.salvando()) evento.preventDefault();
  }

  protected aoEnviar(): void {
    if (this.salvando()) return;
    this.salvar.emit();
    if (this.form().invalid) this.foco.focarPrimeiroInvalido();
  }
}
