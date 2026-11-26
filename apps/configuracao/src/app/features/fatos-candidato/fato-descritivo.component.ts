import type { ItemDeVocabulario } from '@uniplus/shared-data/configuracao';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import type { DescritivoForm } from './fato-candidato-edicao-form';
import { ROTULO_DO_COMPONENTE_PADRAO } from './fato-candidato.regras';
import { bloquearEnvio } from './bloquear-envio';
import { comOpcaoAtual, lerVocabularioDoFato } from './vocabulario-do-fato';
import {
  FalhaDeLeituraDoCampoComponent,
  IndicadorDaLeituraDirective,
} from '@uniplus/shared-ui/components';

/** Nome, descrição e componente de exibição do fato: o que todo fato deixa alterar. */
@Component({
  selector: 'cfg-fato-descritivo',
  imports: [ReactiveFormsModule, FalhaDeLeituraDoCampoComponent, IndicadorDaLeituraDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fato-descritivo.component.html',
  styleUrl: './fato-edicao.css',
})
export class FatoDescritivoComponent {
  readonly form = input.required<DescritivoForm>();
  /** Há escrita em curso ou o fato recarregado ainda não chegou. */
  readonly bloqueado = input.required<boolean>();
  /** O componente já gravado no fato; segue visível se a lista de componentes não chegou. */
  readonly componenteAtual = input<ItemDeVocabulario | null>(null);
  readonly salvar = output<void>();
  protected readonly comOpcaoAtual = comOpcaoAtual;

  protected readonly componentes = lerVocabularioDoFato(
    'componentes-de-exibicao',
    'os componentes de exibição',
    'cfg-fato-ed-componente',
  );
  protected readonly rotuloDoPadrao = ROTULO_DO_COMPONENTE_PADRAO;

  protected erroDoCampo(campo: keyof DescritivoForm['controls']): string | null {
    return mensagemDeErroDoControle(this.form().controls[campo]);
  }

  protected aoClicarEmSalvar(evento: Event): void {
    bloquearEnvio(evento, this.bloqueado());
  }
}
