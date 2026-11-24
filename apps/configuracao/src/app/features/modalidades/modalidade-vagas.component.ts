import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { VocabulariosDaModalidade } from './vocabularios-da-modalidade';
import { ModalidadeSecao } from './modalidade-secao';
import type { OpcaoDeReferencia } from './opcao-de-referencia';

@Component({
  selector: 'cfg-modalidade-vagas',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modalidade-vagas.component.html',
  styleUrl: '../../shared/formulario/secao-do-formulario.css',
})
export class ModalidadeVagasComponent extends ModalidadeSecao {
  readonly mostraOrigem = input.required<boolean>();
  readonly opcoesReferencia = input.required<readonly OpcaoDeReferencia[]>();
  readonly naturezaMudou = output<void>();
  readonly composicaoMudou = output<void>();

  private readonly vocabularios = inject(VocabulariosDaModalidade);
  protected readonly naturezas = this.vocabularios.naturezas;
  protected readonly composicoes = this.vocabularios.composicoes;
}
