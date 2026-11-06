import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DrawerComponent } from '@uniplus/shared-ui/components';
import { EdicaoDosFatos } from './edicao-dos-fatos';
import { FatoCriacaoComponent } from './fato-criacao.component';
import { FatoEdicaoComponent } from './fato-edicao.component';

/**
 * O drawer único do fato: a criação e, logo depois dela, a edição do fato criado. Um só drawer
 * mantém o foco devolvido ao botão que o abriu, e o derivado categórico recebe os valores e depois
 * as regras sem fechar nem reabrir.
 */
@Component({
  selector: 'cfg-fato-drawer',
  imports: [DrawerComponent, FatoCriacaoComponent, FatoEdicaoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fato-drawer.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class FatoDrawerComponent {
  protected readonly edicao = inject(EdicaoDosFatos);
  /** Fechar pelo X, por Esc ou fora do drawer fica recusado enquanto uma escrita está em curso. */
  protected readonly fechavel = computed(
    () => !this.edicao.criando() && !this.edicao.editor.bloqueado(),
  );
}
