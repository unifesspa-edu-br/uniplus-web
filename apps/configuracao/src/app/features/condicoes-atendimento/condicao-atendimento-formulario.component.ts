import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AlertComponent, DrawerComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import {
  CODIGO_RESERVADO,
  CondicaoAtendimentoForm,
  mensagemDoCampo,
} from './condicao-atendimento-form';

@Component({
  selector: 'cfg-condicao-atendimento-formulario',
  standalone: true,
  imports: [ReactiveFormsModule, AlertComponent, DrawerComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './condicao-atendimento-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class CondicaoAtendimentoFormularioComponent {
  readonly aberto = model.required<boolean>();
  readonly form = input.required<FormGroup<CondicaoAtendimentoForm>>();
  readonly titulo = input.required<string>();
  readonly erro = input.required<string | null>();
  readonly anuncio = input.required<string>();
  readonly modo = input.required<'criar' | 'editar'>();
  readonly salvando = input.required<boolean>();
  readonly salvar = output<void>();
  readonly cancelar = output<void>();
  protected readonly codigoReservado = CODIGO_RESERVADO;
  protected readonly rotuloDoBotao = computed(() => {
    if (this.salvando()) return 'Salvando...';
    return this.modo() === 'criar' ? 'Criar condição' : 'Salvar condição';
  });
  private readonly foco = acompanharFocoDoEnvio({ salvando: this.salvando, aberto: this.aberto });

  protected erroDoCampo(nome: keyof CondicaoAtendimentoForm): string | null {
    return mensagemDoCampo(this.form().controls[nome]);
  }

  protected aoEnviar(): void {
    if (this.salvando()) return;
    this.salvar.emit();
    if (this.form().invalid) this.foco.focarPrimeiroInvalido();
  }
}
