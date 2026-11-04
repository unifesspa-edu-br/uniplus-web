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

const PREFIXO_DO_ENDERECO = 'campus-endereco';
/** Id da mensagem de recusa que o `ui-endereco-geo` monta a partir do prefixo. */
const ID_DO_ERRO_DO_ENDERECO = `${PREFIXO_DO_ENDERECO}-erro`;

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

  protected readonly prefixoDoEndereco = PREFIXO_DO_ENDERECO;
  protected readonly idDoErroDoEndereco = ID_DO_ERRO_DO_ENDERECO;
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
    const campos = this.raiz.nativeElement.querySelectorAll<HTMLElement>(
      '.field.is-error :is(input, select, textarea)',
    );
    const invalido = [...campos].find((campo) => campo.closest('ui-endereco-geo') === null);
    if (invalido) {
      invalido.focus();
      return;
    }
    // Recusa só do endereço: com o endereço resolvido por CEP não há controle inválido, então o
    // foco vai à mensagem da recusa, que descreve o grupo. A mensagem não é focável por padrão.
    const mensagem = this.raiz.nativeElement.querySelector<HTMLElement>(
      `#${ID_DO_ERRO_DO_ENDERECO}`,
    );
    mensagem?.setAttribute('tabindex', '-1');
    mensagem?.focus();
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

  protected erroDoCampo(nome: keyof CampusForm): string | null {
    return mensagemDeErroDoControle(this.form().controls[nome]);
  }
}
