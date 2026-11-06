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
  viewChild,
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
  private readonly endereco = viewChild(EnderecoGeoComponent);

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
    this.acompanharFocoDoEnvio();
  }

  /**
   * Ao começar o envio com o foco num campo (Enter, por exemplo), o fieldset desabilita o campo e
   * o foco iria ao `body`: leva-o ao botão de salvar. Ao terminar com o drawer aberto, o foco vai
   * ao primeiro campo recusado; se a recusa não é de campo, fica no botão de salvar.
   */
  private acompanharFocoDoEnvio(): void {
    let estavaSalvando = false;
    effect(() => {
      const salvando = this.salvando();
      const comecou = !estavaSalvando && salvando;
      const terminou = estavaSalvando && !salvando;
      estavaSalvando = salvando;
      if (comecou && this.focoEstaNosCampos()) {
        afterNextRender(() => this.focarBotaoDeSalvar(), { injector: this.injector });
      }
      if (terminou) {
        afterNextRender(() => this.focarPrimeiroInvalido(), { injector: this.injector });
      }
    });
  }

  private focoEstaNosCampos(): boolean {
    const campos = this.raiz.nativeElement.querySelector('fieldset');
    return campos?.contains(document.activeElement) ?? false;
  }

  private focarBotaoDeSalvar(): void {
    this.raiz.nativeElement.querySelector<HTMLElement>('button[type="submit"]')?.focus();
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
    if (this.erroDoEndereco() !== null) {
      this.endereco()?.focarErro();
    }
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
