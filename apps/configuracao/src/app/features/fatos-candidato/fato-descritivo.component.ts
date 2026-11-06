import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import type { DescritivoForm } from './fato-candidato-edicao-form';
import { COMPONENTES_DE_EXIBICAO, ROTULO_DO_COMPONENTE_PADRAO } from './fato-candidato.regras';
import { bloquearEnvio } from './bloquear-envio';

/** Nome, descrição e componente de exibição do fato: o que todo fato deixa alterar. */
@Component({
  selector: 'cfg-fato-descritivo',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fato-descritivo.component.html',
  styleUrl: './fato-edicao.css',
})
export class FatoDescritivoComponent {
  readonly form = input.required<DescritivoForm>();
  /** Há escrita em curso ou o fato recarregado ainda não chegou. */
  readonly bloqueado = input.required<boolean>();
  readonly salvar = output<void>();

  protected readonly componentes = COMPONENTES_DE_EXIBICAO;
  protected readonly rotuloDoPadrao = ROTULO_DO_COMPONENTE_PADRAO;

  protected erroDoCampo(campo: keyof DescritivoForm['controls']): string | null {
    return mensagemDeErroDoControle(this.form().controls[campo]);
  }

  protected aoClicarEmSalvar(evento: Event): void {
    bloquearEnvio(evento, this.bloqueado());
  }
}
