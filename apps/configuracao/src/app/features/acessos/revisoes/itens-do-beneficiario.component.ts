import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { ItemDaRevisaoDto } from '@uniplus/shared-data/autorizacao';
import { TagComponent } from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import type { ItensDoBeneficiario } from './regras-da-revisao';
import { quemDecide, situacaoDoItem } from './rotulos-da-revisao';

/** Os itens de um beneficiário: quem decide cada um e, no decidido, a decisão gravada. */
@Component({
  selector: 'cfg-itens-do-beneficiario',
  standalone: true,
  imports: [DateBrPipe, TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './itens-do-beneficiario.component.html',
})
export class ItensDoBeneficiarioComponent {
  readonly grupo = input.required<ItensDoBeneficiario>();
  /** O item em que quem lê pode confirmar e revogar. */
  readonly decide = input.required<(item: ItemDaRevisaoDto) => boolean>();
  readonly nomeDoEscopo = input.required<(item: ItemDaRevisaoDto) => string>();
  readonly indisponivel = input(false);
  readonly confirmar = output<ItemDaRevisaoDto>();
  readonly revogar = output<ItemDaRevisaoDto>();

  protected readonly situacao = situacaoDoItem;
  protected readonly quemDecide = quemDecide;

  protected decidido(item: ItemDaRevisaoDto): boolean {
    return item.decididoEm !== null;
  }
}
