import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { type DecisaoDaProtecaoDto } from '@uniplus/shared-data/configuracao';
import {
  DEFAULT_PAGE_SIZE_OPTIONS,
  EmptyStateComponent,
  ListFooterComponent,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { formatarDataBr } from '@uniplus/shared-utils';
import {
  CLASSIFICACOES_DE_PROTECAO,
  nomeDoCadastro,
  rotuloDe,
  rotuloDoAto,
} from '../../shared/protecao-do-catalogo';

@Component({
  selector: 'cfg-decisoes-da-protecao-lista',
  standalone: true,
  imports: [EmptyStateComponent, ListFooterComponent, SpinnerComponent, TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './decisoes-da-protecao-lista.component.html',
})
export class DecisoesDaProtecaoListaComponent {
  readonly itens = input.required<readonly DecisaoDaProtecaoDto[]>();
  readonly carregando = input.required<boolean>();
  readonly mensagemDeErro = input.required<string | null>();
  readonly temFiltro = input.required<boolean>();
  readonly limite = input.required<number>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  readonly abrir = output<DecisaoDaProtecaoDto>();
  readonly limpar = output<void>();
  readonly trocarLimite = output<number | null>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();
  protected readonly classificacoes = CLASSIFICACOES_DE_PROTECAO;
  protected readonly opcoesDeLimite = DEFAULT_PAGE_SIZE_OPTIONS;
  protected readonly rotulo = rotuloDe;
  protected readonly rotuloDoAto = rotuloDoAto;
  protected readonly cadastro = nomeDoCadastro;
  protected readonly data = (instante: string): string => formatarDataBr(instante);
  protected readonly chaveDe = (decisao: DecisaoDaProtecaoDto): string =>
    `${decisao.cadastro}|${decisao.itemId}|${decisao.ato}|${decisao.instante}`;
}
