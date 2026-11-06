import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import { TemPermissaoDirective } from '@uniplus/shared-auth/components';
import { TipoDocumentoDto } from '@uniplus/shared-data/configuracao';
import {
  EmptyStateComponent,
  IconButtonComponent,
  LookupAlertComponent,
  LookupLabelComponent,
  PagerComponent,
  SpinnerComponent,
  TagComponent,
  type UiLookupFalho,
} from '@uniplus/shared-ui/components';
import {
  CLASSIFICACOES_DE_PROTECAO,
  SituacaoDaAprovacaoComponent,
  rotuloDe,
} from '../../shared/protecao-do-catalogo';
import type { LinhaDoTipoDocumento } from './tipos-documento.store';

@Component({
  selector: 'cfg-tipos-documento-lista',
  imports: [
    TemPermissaoDirective,
    EmptyStateComponent,
    IconButtonComponent,
    LookupAlertComponent,
    LookupLabelComponent,
    PagerComponent,
    SituacaoDaAprovacaoComponent,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipos-documento-lista.component.html',
})
export class TiposDocumentoListaComponent {
  readonly linhas = input.required<readonly LinhaDoTipoDocumento[]>();
  readonly carregando = input.required<boolean>();
  readonly gravando = input.required<boolean>();
  readonly removendo = input.required<boolean>();
  readonly erro = input.required<string | null>();
  readonly temFiltro = input.required<boolean>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  readonly podeSolicitar = input.required<boolean>();
  readonly lookupsComFalha = input.required<readonly UiLookupFalho[]>();
  readonly cadastrar = output<void>();
  readonly detalhar = output<TipoDocumentoDto>();
  readonly editar = output<TipoDocumentoDto>();
  readonly remover = output<TipoDocumentoDto>();
  readonly solicitar = output<void>();
  readonly limparFiltros = output<void>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  protected readonly permissaoDeManter = PERMISSAO.configuracao.tiposDocumentoManter;
  protected readonly indisponivel = computed(() => this.carregando() || this.gravando());
  protected readonly rotuloDaSensibilidade = (classificacao: string): string =>
    rotuloDe(CLASSIFICACOES_DE_PROTECAO, classificacao);

  protected acionarCadastro(): void {
    if (this.indisponivel()) return;
    this.cadastrar.emit();
  }
}
