import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { SecaoDaInscricaoDto } from '@uniplus/shared-data/selecao';

import type { RevelacaoDoCampo } from './detalhe-da-inscricao.service';
import {
  RespostasDaInscricaoComponent,
  type PedidoDeRevelacao,
} from './respostas-da-inscricao.component';

/**
 * As respostas do formulário, seção por seção. O título da seção é o cabeçalho; os grupos repetíveis
 * ficam um nível abaixo dele e, sem título de seção, sobem um nível. Seção sem item nem grupo não
 * aparece.
 */
@Component({
  selector: 'sel-secoes-da-inscricao',
  standalone: true,
  imports: [RespostasDaInscricaoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './secoes-da-inscricao.component.html',
  styleUrl: './secoes-da-inscricao.component.css',
})
export class SecoesDaInscricaoComponent {
  readonly secoes = input.required<readonly SecaoDaInscricaoDto[]>();
  readonly revelacoes = input.required<ReadonlyMap<string, RevelacaoDoCampo>>();

  readonly revelar = output<PedidoDeRevelacao>();
  readonly ocultar = output<PedidoDeRevelacao>();
}
