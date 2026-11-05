import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { type ItemDaProtecaoDoCatalogoDto } from '@uniplus/shared-data/configuracao';
import { EmptyStateComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import {
  CLASSIFICACOES_DE_PROTECAO,
  nomeDoCadastro,
  rotuloDe,
} from '../../shared/protecao-do-catalogo';

@Component({
  selector: 'cfg-protecao-do-catalogo-lista',
  standalone: true,
  imports: [EmptyStateComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './protecao-do-catalogo-lista.component.html',
})
export class ProtecaoDoCatalogoListaComponent {
  readonly itens = input.required<readonly ItemDaProtecaoDoCatalogoDto[]>();
  readonly carregando = input.required<boolean>();
  readonly erroDeCarga = input.required<string | null>();
  readonly abrir = output<ItemDaProtecaoDoCatalogoDto>();
  protected readonly classificacoes = CLASSIFICACOES_DE_PROTECAO;
  protected readonly cadastro = nomeDoCadastro;
  protected readonly rotulo = rotuloDe;
}
