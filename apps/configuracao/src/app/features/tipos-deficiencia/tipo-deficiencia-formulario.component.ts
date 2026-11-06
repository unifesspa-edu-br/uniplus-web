import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AlertComponent, DrawerComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { TipoDeficienciaForm, mensagemDoCampo } from './tipo-deficiencia-form';

@Component({
  selector: 'cfg-tipo-deficiencia-formulario',
  imports: [ReactiveFormsModule, AlertComponent, DrawerComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipo-deficiencia-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class TipoDeficienciaFormularioComponent {
  readonly aberto = model.required<boolean>();
  readonly form = input.required<FormGroup<TipoDeficienciaForm>>();
  readonly titulo = input.required<string>();
  readonly erro = input.required<string | null>();
  readonly anuncio = input.required<string>();
  readonly modo = input.required<'criar' | 'editar'>();
  readonly salvando = input.required<boolean>();
  readonly salvar = output<void>();
  readonly cancelar = output<void>();
  protected readonly rotuloDoBotao = computed(() => {
    if (this.salvando()) return 'Salvando...';
    return this.modo() === 'criar' ? 'Criar tipo' : 'Salvar tipo';
  });
  private readonly foco = acompanharFocoDoEnvio({ salvando: this.salvando, aberto: this.aberto });

  protected erroDoCampo(nome: keyof TipoDeficienciaForm): string | null {
    return mensagemDoCampo(this.form().controls[nome], nome);
  }

  protected aoEnviar(): void {
    if (this.salvando()) return;
    this.salvar.emit();
    if (this.form().invalid) this.foco.focarPrimeiroInvalido();
  }
}
