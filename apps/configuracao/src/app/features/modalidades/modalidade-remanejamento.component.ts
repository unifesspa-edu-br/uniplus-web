import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import {
  NaturezaLegalToken,
  REGRAS_REMANEJAMENTO,
  RegraRemanejamentoToken,
} from '@uniplus/shared-data/configuracao';

import { dicaDaRegra, regraDesabilitada } from './modalidade-form';
import { ModalidadeSecao } from './modalidade-secao';
import type { OpcaoDeReferencia } from './opcao-de-referencia';

@Component({
  selector: 'cfg-modalidade-remanejamento',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modalidade-remanejamento.component.html',
  styleUrl: '../../shared/formulario/secao-do-formulario.css',
})
export class ModalidadeRemanejamentoComponent extends ModalidadeSecao {
  readonly natureza = input.required<NaturezaLegalToken>();
  readonly mostraDestino = input.required<boolean>();
  readonly mostraParFallback = input.required<boolean>();
  readonly opcoesReferencia = input.required<readonly OpcaoDeReferencia[]>();
  readonly regraMudou = output<void>();

  protected readonly regras = REGRAS_REMANEJAMENTO;

  protected dica(): string {
    return dicaDaRegra(this.natureza());
  }

  protected desabilitada(regra: RegraRemanejamentoToken): boolean {
    return regraDesabilitada(this.natureza(), regra);
  }
}
