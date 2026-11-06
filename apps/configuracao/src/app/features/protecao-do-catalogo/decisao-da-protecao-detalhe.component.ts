import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import {
  type AtoDaProtecaoDto,
  type DecisaoDaProtecaoDto,
} from '@uniplus/shared-data/configuracao';
import {
  AlertaNovaTentativaComponent,
  AlertComponent,
  DrawerComponent,
  type FaseDaNovaTentativa,
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
    AlertaNovaTentativaComponent,
    AtosDaProtecaoComponent,
    DetalheDaProtecaoComponent,
    DrawerComponent,
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
  readonly carregandoHistorico = input.required<boolean>();
  readonly erroDoHistorico = input.required<string | null>();
  readonly itemInexistente = input.required<boolean>();
  readonly faseDoHistorico = input.required<FaseDaNovaTentativa>();
  readonly recarregar = output<void>();
  protected readonly classificacoes = CLASSIFICACOES_DE_PROTECAO;
  protected readonly rotulo = rotuloDe;
  protected readonly rotuloDoAto = rotuloDoAto;
  protected readonly cadastro = nomeDoCadastro;
  protected readonly dataEHora = (instante: string): string => formatarDataBr(instante, 'datetime');
}
