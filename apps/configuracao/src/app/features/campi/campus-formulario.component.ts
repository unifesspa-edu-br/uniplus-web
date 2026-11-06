import { ChangeDetectionStrategy, Component, input, model, output, viewChild } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  AlertComponent,
  DrawerComponent,
  EnderecoGeoComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
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

  private readonly foco = acompanharFocoDoEnvio({
    salvando: this.salvando,
    aberto: this.aberto,
    focarEndereco: () => this.endereco()?.focarErro(),
  });

  /** Enquanto envia, o botão está indisponível: o clique (e Enter ou Espaço, que o geram) não envia. */
  protected aoClicarEmSalvar(evento: Event): void {
    if (this.salvando()) {
      evento.preventDefault();
    }
  }

  /** O envio do formulário (Enter num campo, por exemplo) também espera o envio em curso. */
  protected aoEnviar(): void {
    if (this.salvando()) {
      return;
    }
    this.salvar.emit();
    if (this.form().invalid) {
      this.foco.focarPrimeiroInvalido();
    }
  }

  protected erroDoCampo(nome: keyof CampusForm): string | null {
    return mensagemDeErroDoControle(this.form().controls[nome]);
  }
}
