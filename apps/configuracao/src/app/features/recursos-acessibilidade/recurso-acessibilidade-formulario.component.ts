import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AlertComponent, DrawerComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { RecursoAcessibilidadeForm } from './edicao-dos-recursos-acessibilidade';

@Component({
  selector: 'cfg-recurso-acessibilidade-formulario',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, AlertComponent, DrawerComponent, SpinnerComponent],
  templateUrl: './recurso-acessibilidade-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class RecursoAcessibilidadeFormularioComponent {
  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  readonly aberto = input.required<boolean>();
  readonly form = input.required<FormGroup<RecursoAcessibilidadeForm>>();
  readonly modo = input.required<'criar' | 'editar'>();
  readonly formHeading = input.required<string>();
  readonly formError = input.required<string | null>();
  readonly salvando = input.required<boolean>();
  readonly abertoChange = output<boolean>();
  readonly fechar = output<void>();
  readonly salvar = output<void>();
  constructor() {
    let estavaSalvando = false;
    effect(() => {
      const salvando = this.salvando();
      if (estavaSalvando && !salvando && this.aberto()) {
        afterNextRender(
          () =>
            this.raiz.nativeElement
              .querySelector<HTMLElement>('.field.is-error :is(input, textarea)')
              ?.focus(),
          { injector: this.injector },
        );
      }
      estavaSalvando = salvando;
    });
  }

  erroDoCampo(nome: keyof RecursoAcessibilidadeForm): string | null {
    const control = this.form().controls[nome];
    const shouldShowError = control.touched || control.dirty;
    if (!shouldShowError || control.errors === null) {
      return null;
    }
    if (control.errors['backend']) {
      const backend = control.errors['backend'] as { code: string; message: string };
      return backend.message;
    }
    if (control.errors['required']) return 'Campo obrigatório.';
    if (control.errors['minlength'])
      return `Informe ao menos ${control.errors['minlength']['requiredLength']} caracteres.`;
    if (control.errors['maxlength']) return 'Valor acima do tamanho permitido.';
    if (control.errors['pattern'])
      return 'Formato inválido. Use letras maiúsculas, números e sublinhado, iniciando por letra (ex.: LEDOR, SALA_DE_FACIL_ACESSO).';
    return 'Valor inválido.';
  }

  protected aoClicarEmSalvar(evento: Event): void {
    if (this.salvando()) evento.preventDefault();
  }
}
