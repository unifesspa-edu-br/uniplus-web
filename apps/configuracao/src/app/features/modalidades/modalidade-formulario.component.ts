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
import { RouterLink } from '@angular/router';
import { AlertComponent, SpinnerComponent } from '@uniplus/shared-ui/components';

import { focarPrimeiroCampoInvalido } from '../../shared/foco';
import type { ModalidadeForm } from './modalidade-form';

/**
 * O quadro do formulário da modalidade: o alerta de falha, o `<form>` que recebe as seções
 * projetadas, o resumo das escolhas e o rodapé com a ação de salvar.
 */
@Component({
  selector: 'cfg-modalidade-formulario',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AlertComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modalidade-formulario.component.html',
  styles: [':host { display: block; }'],
})
export class ModalidadeFormularioComponent {
  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly form = input.required<FormGroup<ModalidadeForm>>();
  readonly modoEdicao = input.required<boolean>();
  readonly salvando = input.required<boolean>();
  readonly erro = input.required<string | null>();
  readonly resumo = input.required<readonly string[]>();
  readonly conferencias = input.required<number>();

  readonly salvar = output<void>();

  constructor() {
    this.focarPrimeiroCampoInvalidoAposConferencia();
  }

  /**
   * Depois de cada conferência (envio barrado ou recusa do servidor), o foco vai ao primeiro campo
   * inválido. Só depois da renderização: antes dela o fieldset ainda está desabilitado e o campo
   * ainda não tem `aria-invalid`.
   */
  private focarPrimeiroCampoInvalidoAposConferencia(): void {
    effect(() => {
      if (this.conferencias() === 0) return;
      afterNextRender(() => focarPrimeiroCampoInvalido(this.raiz.nativeElement), {
        injector: this.injector,
      });
    });
  }

  /** Enquanto grava, o botão está indisponível: o clique (e Enter ou Espaço, que o geram) não envia. */
  protected aoClicarEmSalvar(evento: Event): void {
    if (this.salvando()) evento.preventDefault();
  }

  /** Sair da página destruiria a assinatura da gravação em curso: o link fica indisponível, mas focável. */
  protected aoClicarEmCancelar(evento: Event): void {
    if (this.salvando()) evento.preventDefault();
  }

  /** O envio do formulário (Enter num campo, por exemplo) também espera a gravação em curso. */
  protected aoEnviar(): void {
    if (!this.salvando()) this.salvar.emit();
  }
}
