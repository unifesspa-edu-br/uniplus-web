import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { JanelaDoPerfilDto } from '@uniplus/shared-data/autorizacao';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';

/** O aviso de que o perfil está em janela de migração, com o prazo e o caminho para a tela do lote. */
@Component({
  selector: 'cfg-janela-aberta',
  standalone: true,
  imports: [RouterLink, AlertComponent, DateBrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-alert variant="warning" heading="Janela de migração aberta" [dynamic]="false">
      O prazo termina em {{ janela().prazo | dateBr: 'datetime' }}. Enquanto ela dura, o perfil não
      recebe pessoa nova nem versão nova pendente; a remoção de permissão continua valendo na hora.
      <a [routerLink]="['/acessos/perfis', perfilId(), 'janela']">Abrir a janela de migração</a>.
    </ui-alert>
  `,
})
export class JanelaAbertaComponent {
  readonly perfilId = input.required<string>();
  readonly janela = input.required<JanelaDoPerfilDto>();
}
