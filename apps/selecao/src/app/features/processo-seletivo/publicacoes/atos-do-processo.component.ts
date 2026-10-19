import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SituacaoDoRegistroDoAto, type AtoDoProcessoDto } from '@uniplus/shared-data/selecao';
import { EmptyStateComponent, TagComponent } from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';

import { nomeDoDocumento, rotuloDoAto } from './apresentacao-do-ato';

/**
 * Os atos publicados pelo processo — o edital, as retificações e os documentos avulsos —, cada um
 * com os documentos e a situação do registro. Só apresenta: abrir um documento e corrigir um ato
 * são pedidos à página.
 */
@Component({
  selector: 'sel-atos-do-processo',
  standalone: true,
  imports: [DateBrPipe, EmptyStateComponent, TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './atos-do-processo.component.html',
  styleUrl: './atos-do-processo.component.css',
})
export class AtosDoProcessoComponent {
  readonly atos = input.required<readonly AtoDoProcessoDto[]>();
  /** Os atos que a tela oferece para corrigir. */
  readonly corrigiveis = input<readonly AtoDoProcessoDto[]>([]);
  /** O documento cujo acesso está sendo pedido, para o botão anunciar a espera. */
  readonly abrindo = input<string | null>(null);

  readonly corrigir = output<AtoDoProcessoDto>();
  readonly abrir = output<string>();

  protected readonly rotuloDoAto = rotuloDoAto;
  protected readonly nomeDoDocumento = nomeDoDocumento;
  protected readonly registrado = SituacaoDoRegistroDoAto.registrado;

  private readonly idsCorrigiveis = computed(() => new Set(this.corrigiveis().map((ato) => ato.id)));
  private readonly porId = computed(() => new Map(this.atos().map((ato) => [ato.id, ato])));
  private readonly corretorDe = computed(
    () =>
      new Map(
        this.atos().flatMap((ato) => (ato.atoCorrigidoId === null ? [] : [[ato.atoCorrigidoId, ato] as const])),
      ),
  );

  protected admiteCorrecao(ato: AtoDoProcessoDto): boolean {
    return this.idsCorrigiveis().has(ato.id);
  }

  /** O ato que este corrige, para citar na linha. */
  protected corrigidoPor(ato: AtoDoProcessoDto): AtoDoProcessoDto | undefined {
    return ato.atoCorrigidoId === null ? undefined : this.porId().get(ato.atoCorrigidoId);
  }

  /** O ato que corrige este, quando há. */
  protected corretorDoAto(ato: AtoDoProcessoDto): AtoDoProcessoDto | undefined {
    return this.corretorDe().get(ato.id);
  }
}
