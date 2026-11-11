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
  /** O nome e a descrição em vigor, quando a tela os conhece, para comparar com os propostos. */
  readonly nomeVigente = input<string | null>(null);
  readonly descricaoVigente = input<string | null>(null);
  readonly abrirDocumento = output<void>();
  protected readonly etapa = etapaDaVersao;
  protected readonly etapas = etapasExigidas;
  protected readonly resultado = resultadoDaDecisao;
  protected readonly situacaoDoDocumento = situacaoDoAnexo;

  protected mudou(proposto: string, vigente: string | null): boolean {
    return vigente !== null && proposto !== vigente;
  }
}
