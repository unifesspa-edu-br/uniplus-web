import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { PerfilDto } from '@uniplus/shared-data/autorizacao';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { sensibilidade } from '../rotulos-de-acesso';

/** A composição que decide acesso hoje: a versão em vigor, o documento que a instituiu e as permissões. */
@Component({
  selector: 'cfg-versao-em-vigor',
  standalone: true,
  imports: [DateBrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './versao-em-vigor.component.html',
})
export class VersaoEmVigorComponent {
  readonly perfil = input.required<PerfilDto>();
  readonly abrirDocumento = output<string>();
  protected readonly composicao = computed(() => this.perfil().composicaoEmVigor);
  protected readonly sensibilidadeDe = sensibilidade;
}
