import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import type { UnidadeDto } from '@uniplus/shared-data/organizacao';
import { DrawerComponent } from '@uniplus/shared-ui/components';
import { cidadeDaUnidade, vigenciaDaUnidade } from './rotulos-da-unidade';

/** O drawer de leitura com a ficha da unidade e as ações de editar e remover. */
@Component({
  selector: 'cfg-unidade-detalhe',
  imports: [DrawerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './unidade-detalhe.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class UnidadeDetalheComponent {
  readonly aberto = model.required<boolean>();
  readonly unidade = input.required<UnidadeDto | null>();
  readonly rotuloDaSuperior = input.required<string>();
  /** A lista está sendo lida ou gravada: editar e remover não valem. */
  readonly indisponivel = input.required<boolean>();
  readonly editar = output<UnidadeDto>();
  readonly remover = output<UnidadeDto>();

  protected readonly cidade = cidadeDaUnidade;
  protected readonly vigencia = vigenciaDaUnidade;
}
