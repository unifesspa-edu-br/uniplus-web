import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import { TemPermissaoDirective } from '@uniplus/shared-auth/components';
import type { ResolucaoDeVinculo } from '@uniplus/shared-core/http';
import type { AprovacaoDaProtecaoDto, TipoDocumentoDto } from '@uniplus/shared-data/configuracao';
import { formatarDataBr } from '@uniplus/shared-utils';
import { DrawerComponent, LookupLabelComponent } from '@uniplus/shared-ui/components';
import { DetalheDaProtecaoComponent } from '../../shared/detalhe-do-catalogo';
import {
  HistoricoDaProtecaoComponent,
  SituacaoDaAprovacaoComponent,
} from '../../shared/protecao-do-catalogo';

/** O detalhe somente leitura de um tipo de documento, com a proteção de dados e o histórico. */
@Component({
  selector: 'cfg-tipo-documento-detalhe',
  imports: [
    TemPermissaoDirective,
    DetalheDaProtecaoComponent,
    DrawerComponent,
    HistoricoDaProtecaoComponent,
    LookupLabelComponent,
    SituacaoDaAprovacaoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipo-documento-detalhe.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class TipoDocumentoDetalheComponent {
  readonly aberto = model.required<boolean>();
  readonly tipo = input.required<TipoDocumentoDto | null>();
  readonly categoria = input.required<ResolucaoDeVinculo | null>();
  readonly situacao = input.required<AprovacaoDaProtecaoDto | null>();
  /** A lista está sendo lida ou gravada: editar e aceitar ficam indisponíveis. */
  readonly indisponivel = input.required<boolean>();
  readonly editar = output<TipoDocumentoDto>();
  readonly aceitar = output<TipoDocumentoDto>();

  protected readonly permissaoDeManter = PERMISSAO.configuracao.tiposDocumentoManter;
  protected readonly formatarData = formatarDataBr;

  protected tamanhoLabel(valor: number | null): string {
    return valor === null ? '—' : `${valor} MB`;
  }
}
