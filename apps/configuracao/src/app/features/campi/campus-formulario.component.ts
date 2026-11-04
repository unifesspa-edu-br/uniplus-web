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
import {
  AlertComponent,
  DrawerComponent,
  EnderecoGeoComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import { CampusForm } from './campus-form';

/** O drawer com o formulário de cadastro e edição de campus. */
@Component({
  selector: 'cfg-campus-formulario',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    DrawerComponent,
    EnderecoGeoComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './campus-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class CampusFormularioComponent {
  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly aberto = model.required<boolean>();
  readonly form = input.required<FormGroup<CampusForm>>();
  readonly modo = input.required<'criar' | 'editar'>();
  readonly titulo = input.required<string>();
  readonly erro = input.required<string | null>();
  readonly erroDoEndereco = input.required<string | null>();
  readonly salvando = input.required<boolean>();

  readonly salvar = output<void>();
  readonly cancelar = output<void>();

  constructor() {
    this.focarPrimeiroCampoInvalidoAposRecusa();
  }

  /**
   * Depois de uma recusa (o envio terminou e o drawer continua aberto), o foco, que estava no
   * botão de salvar, vai ao primeiro campo recusado. Se a recusa não é de campo, fica onde estava.
   */
  private focarPrimeiroCampoInvalidoAposRecusa(): void {
    let estavaSalvando = false;
    effect(() => {
      const salvando = this.salvando();
      const terminou = estavaSalvando && !salvando;
      estavaSalvando = salvando;
      if (terminou) {
        afterNextRender(() => this.focarPrimeiroInvalido(), { injector: this.injector });
      }
    });
  }

  private focarPrimeiroInvalido(): void {
    if (!this.aberto()) {
      return;
    }
    const raiz = this.raiz.nativeElement;
    const invalido = raiz.querySelector<HTMLElement>(
      '.field.is-error :is(input, select, textarea), ui-endereco-geo [aria-invalid="true"]',
    );
    invalido?.focus();
  }

  protected erroDoCampo(nome: keyof CampusForm): string | null {
    return mensagemDeErroDoControle(this.form().controls[nome]);
  }
}
