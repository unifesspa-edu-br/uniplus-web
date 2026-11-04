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
import { AlertaNovaTentativaComponent } from '../../shared/alerta-nova-tentativa';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import { CursoForm } from './curso-form';
import type { GruposDoFormulario } from './edicao-dos-cursos';

/** O drawer com o formulário de cadastro e edição de curso. */
@Component({
  selector: 'cfg-curso-formulario',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    AlertaNovaTentativaComponent,
    DrawerComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './curso-formulario.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class CursoFormularioComponent {
  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly aberto = model.required<boolean>();
  readonly form = input.required<FormGroup<CursoForm>>();
  readonly modo = input.required<'criar' | 'editar'>();
  readonly titulo = input.required<string>();
  readonly erro = input.required<string | null>();
  readonly salvando = input.required<boolean>();
  /** Grupos de área do ENEM vindos da API: o select oferece os rótulos e grava o código. */
  readonly grupos = input.required<GruposDoFormulario>();

  readonly salvar = output<void>();
  readonly cancelar = output<void>();
  readonly tentarGrupos = output<void>();

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

  /** Enquanto envia, o botão está indisponível: o clique (e Enter ou Espaço, que o geram) não envia. */
  protected aoClicarEmSalvar(evento: Event): void {
    if (this.salvando()) {
      evento.preventDefault();
    }
  }

  /** O envio do formulário (Enter num campo, por exemplo) também espera o envio em curso. */
  protected aoEnviar(): void {
    if (!this.salvando()) {
      this.salvar.emit();
    }
  }

  protected erroDoCampo(nome: keyof CursoForm): string | null {
    return mensagemDeErroDoControle(this.form().controls[nome]);
  }

  /** O select do grupo é descrito pela falha da lista e pelo erro do campo, quando há. */
  protected descricaoDoGrupo(): string | null {
    const ids = [
      this.aberto() && this.grupos().falhou ? 'cfg-curso-grupos-falha' : null,
      this.erroDoCampo('grupoAreaEnem') ? 'cfg-curso-grupo-erro' : null,
    ].filter((id): id is string => id !== null);
    return ids.length > 0 ? ids.join(' ') : null;
  }
}
