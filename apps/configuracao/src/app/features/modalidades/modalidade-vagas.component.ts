import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { COMPOSICOES_VAGAS, NATUREZAS_LEGAIS } from '@uniplus/shared-data/configuracao';

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

  protected readonly naturezas = NATUREZAS_LEGAIS;
  protected readonly composicoes = COMPOSICOES_VAGAS;
}
