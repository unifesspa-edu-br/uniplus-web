import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AlertComponent, DrawerComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { CondicaoAtendimentoForm } from './edicao-das-condicoes-atendimento';

@Component({
  selector: 'cfg-condicao-atendimento-formulario',
  imports: [ReactiveFormsModule, AlertComponent, DrawerComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './condicao-atendimento-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class CondicaoAtendimentoFormularioComponent {
  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  readonly aberto = model.required<boolean>();
  readonly form = input.required<FormGroup<CondicaoAtendimentoForm>>();
  readonly titulo = input.required<string>();
  readonly erro = input.required<string | null>();
  readonly modo = input.required<'criar' | 'editar'>();
  readonly salvando = input.required<boolean>();
  readonly salvar = output<void>();
  readonly cancelar = output<void>();

  constructor() {
    let estavaSalvando = false;
    effect(() => {
      const salvando = this.salvando();
      const terminou = estavaSalvando && !salvando;
      estavaSalvando = salvando;
      if (terminou) afterNextRender(() => this.focarErro(), { injector: this.injector });
    });
  }
  private focarErro(): void {
    if (this.aberto())
      this.raiz.nativeElement
        .querySelector<HTMLElement>(
          '.field.is-error input:not(:disabled), .field.is-error textarea:not(:disabled)',
        )
        ?.focus();
  }
  protected aoClicarEmSalvar(evento: Event): void {
    if (this.salvando()) evento.preventDefault();
  }
  protected aoEnviar(): void {
    if (!this.salvando()) this.salvar.emit();
  }
  protected erroDoCampo(nome: keyof CondicaoAtendimentoForm): string | null {
    const control = this.form().controls[nome];
    if ((!control.touched && !control.dirty) || !control.errors) return null;
    if (control.errors['backend'])
      return (control.errors['backend'] as { message: string }).message;
    if (control.errors['required']) return 'Campo obrigatório.';
    if (control.errors['minlength'])
      return `Informe ao menos ${control.errors['minlength']['requiredLength']} caracteres.`;
    if (control.errors['maxlength']) return 'Valor acima do tamanho permitido.';
    if (control.errors['pattern'])
      return 'Formato inválido. Use letras maiúsculas, números e sublinhado, iniciando por letra (ex.: DISLEXIA, TDAH).';
    return 'Valor inválido.';
  }
}
