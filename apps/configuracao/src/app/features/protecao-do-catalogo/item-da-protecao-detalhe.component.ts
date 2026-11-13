import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatarDataBr } from '@uniplus/shared-utils';
import { type DetalheDaProtecaoDoCatalogoDto } from '@uniplus/shared-data/configuracao';
import { DetalheDaProtecaoComponent } from '../../shared/detalhe-do-catalogo';
import {
  SituacaoDaAprovacaoComponent,
  justificativaDaSituacao,
  nomeDoCadastro,
  rotuloDe,
} from '../../shared/protecao-do-catalogo';
import {
  CARDINALIDADES,
  COMPONENTES_DE_EXIBICAO,
  DOMINIOS,
  ROTULO_DO_COMPONENTE_PADRAO,
} from '../fatos-candidato/fato-candidato.regras';

@Component({
  selector: 'cfg-item-da-protecao-detalhe',
  standalone: true,
  imports: [DetalheDaProtecaoComponent, SituacaoDaAprovacaoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './item-da-protecao-detalhe.component.html',
  styleUrl: './item-da-protecao-detalhe.component.css',
})
export class ItemDaProtecaoDetalheComponent {
  readonly detalhe = input.required<DetalheDaProtecaoDoCatalogoDto>();
  readonly categorias = input.required<ReadonlyMap<string, { nome: string }>>();
  protected readonly cadastro = nomeDoCadastro;
  protected readonly rotulo = rotuloDe;
  protected readonly dominios = DOMINIOS;
  protected readonly cardinalidades = CARDINALIDADES;
  protected readonly componentes = COMPONENTES_DE_EXIBICAO;
  protected readonly rotuloDoPadrao = ROTULO_DO_COMPONENTE_PADRAO;
  protected readonly data = (instante: string): string => formatarDataBr(instante, 'datetime');
  protected readonly justificativa = computed(() =>
    justificativaDaSituacao(this.detalhe().aprovacao, this.detalhe().atos),
  );
}
