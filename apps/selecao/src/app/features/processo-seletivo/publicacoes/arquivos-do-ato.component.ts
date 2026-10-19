import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { AtoDoProcessoDto } from '@uniplus/shared-data/selecao';

import { nomeDoDocumento, rotuloDoAto } from './apresentacao-do-ato';

/**
 * Os arquivos de um ato publicado — o documento principal e os anexos —, cada um como botão que
 * pede à página o acesso. Só apresenta: abrir o documento é pedido à página.
 */
@Component({
  selector: 'sel-arquivos-do-ato',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './arquivos-do-ato.component.html',
  styleUrl: './arquivos-do-ato.component.css',
})
export class ArquivosDoAtoComponent {
  readonly ato = input.required<AtoDoProcessoDto>();
  /** O documento cujo acesso está sendo pedido, para o botão anunciar a espera. */
  readonly abrindo = input<string | null>(null);

  readonly abrir = output<string>();

  protected readonly rotuloDoAto = rotuloDoAto;
  protected readonly nomeDoDocumento = nomeDoDocumento;
}
