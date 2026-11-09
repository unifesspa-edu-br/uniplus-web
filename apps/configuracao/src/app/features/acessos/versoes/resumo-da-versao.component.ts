import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { VersaoPendenteDto } from '@uniplus/shared-data/autorizacao';
import { TagComponent } from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { situacaoDoAnexo } from '../rotulos-de-acesso';
import { DiferencaDaVersaoComponent } from './diferenca-da-versao.component';
import { etapaDaVersao, etapasExigidas, resultadoDaDecisao } from './rotulos-da-versao';

/** A versão pendente de aprovação: o que muda, onde está a aprovação e o documento que a institui. */
@Component({
  selector: 'cfg-resumo-da-versao',
  standalone: true,
  imports: [DateBrPipe, DiferencaDaVersaoComponent, TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resumo-da-versao.component.html',
})
export class ResumoDaVersaoComponent {
  readonly versao = input.required<VersaoPendenteDto>();
  readonly abrirDocumento = output<void>();
  protected readonly etapa = etapaDaVersao;
  protected readonly etapas = etapasExigidas;
  protected readonly resultado = resultadoDaDecisao;
  protected readonly situacaoDoDocumento = situacaoDoAnexo;
}
