import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import {
  type AtoDaProtecaoDto,
  type DecisaoDaProtecaoDto,
} from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  DrawerComponent,
  FalhaDeLeituraComponent,
  type LeituraAcompanhada,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { formatarDataBr } from '@uniplus/shared-utils';
import { DetalheDaProtecaoComponent } from '../../shared/detalhe-do-catalogo';
import {
  AtosDaProtecaoComponent,
  CLASSIFICACOES_DE_PROTECAO,
  nomeDoCadastro,
  rotuloDe,
  rotuloDoAto,
} from '../../shared/protecao-do-catalogo';

@Component({
  selector: 'cfg-decisao-da-protecao-detalhe',
  standalone: true,
  imports: [
    AlertComponent,
    AtosDaProtecaoComponent,
    DetalheDaProtecaoComponent,
    DrawerComponent,
    FalhaDeLeituraComponent,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './decisao-da-protecao-detalhe.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class DecisaoDaProtecaoDetalheComponent {
  readonly drawerAberto = model.required<boolean>();
  readonly selecionada = input.required<DecisaoDaProtecaoDto | null>();
  readonly historico = input.required<readonly AtoDaProtecaoDto[] | null>();
  readonly leitura = input.required<LeituraAcompanhada>();
  readonly erroDoHistorico = input.required<string | null>();
  readonly itemInexistente = input.required<boolean>();
  protected readonly classificacoes = CLASSIFICACOES_DE_PROTECAO;
  protected readonly rotulo = rotuloDe;
  protected readonly rotuloDoAto = rotuloDoAto;
  protected readonly cadastro = nomeDoCadastro;
  protected readonly dataEHora = (instante: string): string => formatarDataBr(instante, 'datetime');
}
