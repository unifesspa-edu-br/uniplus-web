import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ModalidadeDto, NaturezaLegalCodigo } from '@uniplus/shared-data/configuracao';
import {
  IconButtonComponent,
  TagComponent,
  type UiTagVariant,
} from '@uniplus/shared-ui/components';

const NATUREZA_VARIANTE: Readonly<Record<NaturezaLegalCodigo, UiTagVariant>> = {
  [NaturezaLegalCodigo.AMPLA]: 'info',
  [NaturezaLegalCodigo.COTA_RESERVADA]: 'success',
  [NaturezaLegalCodigo.ACAO_AFIRMATIVA]: 'warning',
};

/** A tabela das modalidades, com as ações de editar e remover de cada linha. */
@Component({
  selector: 'cfg-modalidades-tabela',
  standalone: true,
  imports: [IconButtonComponent, TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modalidades-tabela.component.html',
  styles: [':host { display: block; }'],
})
export class ModalidadesTabelaComponent {
  readonly modalidades = input.required<readonly ModalidadeDto[]>();
  readonly quemConcorre = input.required<ReadonlyMap<string, string>>();
  readonly referencias = input.required<ReadonlyMap<string, ModalidadeDto[]>>();
  /** A lista carrega ou uma remoção corre: as ações das linhas ficam indisponíveis. */
  readonly indisponivel = input.required<boolean>();
  /** A modalidade cuja remoção está em curso, que a linha sinaliza. */
  readonly removendoId = input.required<string | null>();
  readonly remover = output<ModalidadeDto>();

  protected naturezaVariante(codigo: NaturezaLegalCodigo): UiTagVariant {
    return NATUREZA_VARIANTE[codigo];
  }
  protected referenciadaPor(codigo: string): readonly ModalidadeDto[] {
    return this.referencias().get(codigo) ?? [];
  }
  protected remanejamentoResumo(m: ModalidadeDto): string {
    const remanejamento = m.remanejamento;
    if (remanejamento === null) return '—';
    const regra = remanejamento.regra.rotulo;
    if (remanejamento.destino) return `${regra} → ${remanejamento.destino}`;
    if (remanejamento.par || remanejamento.fallback) {
      return `${regra} (${remanejamento.par ?? '—'} / ${remanejamento.fallback ?? '—'})`;
    }
    return regra;
  }
}
