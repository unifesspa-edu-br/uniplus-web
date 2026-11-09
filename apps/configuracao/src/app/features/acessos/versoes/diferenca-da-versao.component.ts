import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { PermissaoDoPerfilDto } from '@uniplus/shared-data/autorizacao';
import { TagComponent } from '@uniplus/shared-ui/components';
import { sensibilidade } from '../rotulos-de-acesso';

/** As permissões que uma versão acrescenta e retira em relação ao que está em vigor, destacadas. */
@Component({
  selector: 'cfg-diferenca-da-versao',
  standalone: true,
  imports: [TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './diferenca-da-versao.component.html',
})
export class DiferencaDaVersaoComponent {
  readonly acrescimo = input.required<readonly PermissaoDoPerfilDto[]>();
  readonly remocao = input.required<readonly PermissaoDoPerfilDto[]>();
  protected readonly sensibilidadeDe = sensibilidade;
}
