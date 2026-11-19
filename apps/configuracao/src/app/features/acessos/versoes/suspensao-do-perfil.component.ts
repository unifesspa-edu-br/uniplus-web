import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import type { SuspensaoDoPerfilDto } from '@uniplus/shared-data/autorizacao';
import { decisaoDaEtapa, porQuemDecide } from './rotulos-da-versao';

/** A suspensão em curso: desde quando, quem a determinou e o que falta decidir para retomar. */
@Component({
  selector: 'cfg-suspensao-do-perfil',
  standalone: true,
  imports: [AlertComponent, DateBrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-alert variant="danger" heading="Perfil suspenso" [dynamic]="false">
      Desde {{ suspensao().desde | dateBr: 'datetime' }}, por {{ decisao() }}, nenhuma concessão do
      perfil dá acesso. As concessões não foram revogadas e voltam a valer quando a suspensão for
      retomada.
      <ul class="cfg-lista">
        @for (item of etapas(); track item.etapa) {
          <li>
            Retomada {{ item.porQuem }}:
            <strong>{{ item.situacao }}</strong>
          </li>
        }
      </ul>
    </ui-alert>
  `,
})
export class SuspensaoDoPerfilComponent {
  readonly suspensao = input.required<SuspensaoDoPerfilDto>();
  protected readonly decisao = computed(() =>
    decisaoDaEtapa(this.suspensao().papelDeQuemSuspendeu),
  );
  /** As exigidas agora e, depois, as já decididas que a suspensão deixou de exigir. */
  protected readonly etapas = computed(() => {
    const { etapasExigidasAgora, etapasDecididas } = this.suspensao();
    const dispensadas = etapasDecididas.filter((codigo) => !etapasExigidasAgora.includes(codigo));
    return [
      ...etapasExigidasAgora.map((codigo) => ({
        codigo,
        situacao: etapasDecididas.includes(codigo) ? 'decidida' : 'aguarda a decisão',
      })),
      ...dispensadas.map((codigo) => ({ codigo, situacao: 'decidida; não é mais exigida' })),
    ].map(({ codigo, situacao }) => ({
      etapa: codigo,
      porQuem: porQuemDecide(codigo),
      situacao,
    }));
  });
}
