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
import { TipoDeficienciaForm } from './edicao-dos-tipos-deficiencia';

@Component({
  selector: 'cfg-tipo-deficiencia-formulario',
  imports: [ReactiveFormsModule, AlertComponent, DrawerComponent, SpinnerComponent],
  templateUrl: './tipo-deficiencia-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TipoDeficienciaFormularioComponent {
  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  readonly aberto = model.required<boolean>();
  readonly form = input.required<FormGroup<TipoDeficienciaForm>>();
  readonly modo = input.required<'criar' | 'editar'>();
  readonly titulo = input.required<string>();
  readonly erro = input.required<string | null>();
  readonly salvando = input.required<boolean>();
  readonly anuncio = input.required<string>();
  readonly salvar = output<void>();
  constructor() {
    let estavaSalvando = false;
    effect(() => {
      const terminou = estavaSalvando && !this.salvando();
      estavaSalvando = this.salvando();
      if (terminou) afterNextRender(() => this.focarErro(), { injector: this.injector });
    });
  }
  private focarErro(): void {
    if (this.aberto())
      this.raiz.nativeElement
        .querySelector<HTMLElement>('.field.is-error :is(input, textarea)')
        ?.focus();
  }
  protected aoClicarEmSalvar(evento: Event): void {
    if (this.salvando()) evento.preventDefault();
  }
  protected erroDoCampo(nome: keyof TipoDeficienciaForm): string | null {
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
    // O `pattern` significa coisas diferentes por campo: formato fechado no código,
    // "não pode ser só espaços" na descrição.
    if (control.errors['pattern']) {
      return nome === 'codigo'
        ? 'Formato inválido. Use letras maiúsculas, números e sublinhado, iniciando por letra (ex.: VISUAL, DEFICIENCIA_VISUAL).'
        : 'Informe um texto — apenas espaços não valem.';
    }
    return 'Valor inválido.';
  }
}
