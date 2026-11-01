import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AlertComponent } from '@uniplus/shared-ui/components';

/**
 * O aviso de que salvar a mudança de classificação, hipótese legal ou finalidade devolve o item a
 * pendente: a proteção de dados precisa aprová-lo de novo antes de ele ser usado num processo.
 * Quem hospeda decide quando mostrá-lo.
 */
@Component({
  selector: 'cfg-aviso-de-nova-aprovacao',
  standalone: true,
  imports: [AlertComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-alert variant="warning" heading="O item volta a pendente">
      Mudar a classificação, a hipótese legal ou a finalidade devolve o item a pendente. Até a
      proteção de dados aprová-lo de novo, ele não pode ser usado na configuração de um processo
      seletivo.
    </ui-alert>
  `,
})
export class AvisoDeNovaAprovacaoComponent {}
