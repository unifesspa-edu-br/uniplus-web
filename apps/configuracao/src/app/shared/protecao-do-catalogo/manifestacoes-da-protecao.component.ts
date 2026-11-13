import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ManifestacaoDaProtecaoDto } from '@uniplus/shared-data/configuracao';
import { TagComponent } from '@uniplus/shared-ui/components';
import { formatarDataBr } from '@uniplus/shared-utils';
import { rotuloDaSituacaoDaManifestacao, rotuloDoParecer } from './manifestacoes';

/**
 * As manifestações técnicas sobre a proteção proposta: parecer, autor, instante, ciclo e texto. No
 * histórico, a situação de cada uma e a que ela substituiu.
 */
@Component({
  selector: 'cfg-manifestacoes-da-protecao',
  standalone: true,
  imports: [TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './atos-da-protecao.css',
  templateUrl: './manifestacoes-da-protecao.component.html',
})
export class ManifestacoesDaProtecaoComponent {
  readonly manifestacoes = input.required<readonly ManifestacaoDaProtecaoDto[]>();
  readonly ariaLabel = input('Manifestações técnicas');
  readonly textoVazio = input('Nenhuma manifestação técnica.');
  /** No histórico, cada manifestação mostra se vale, foi substituída ou é de ciclo encerrado. */
  readonly comSituacao = input(false);

  protected readonly parecer = rotuloDoParecer;
  protected readonly situacao = rotuloDaSituacaoDaManifestacao;
  protected readonly data = (instante: string): string => formatarDataBr(instante, 'datetime');
  private readonly porId = computed(
    () => new Map(this.manifestacoes().map((m) => [m.id, m] as const)),
  );

  /** O instante da manifestação que esta substituiu, quando ela está na lista. */
  protected substituida(id: string | null): string | null {
    const anterior = id === null ? undefined : this.porId().get(id);
    return anterior === undefined ? null : this.data(anterior.instante);
  }
}
