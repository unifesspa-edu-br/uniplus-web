import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  COMPOSICOES_VAGAS,
  ModalidadeDto,
  NATUREZAS_LEGAIS,
  REGRAS_REMANEJAMENTO,
} from '@uniplus/shared-data/configuracao';
import {
  IconButtonComponent,
  TagComponent,
  type UiTagVariant,
} from '@uniplus/shared-ui/components';

function rotulo(roster: readonly { value: string; label: string }[], token: string): string {
  return roster.find((opcao) => opcao.value === token)?.label ?? token;
}

const NATUREZA_VARIANTE: Readonly<Record<string, UiTagVariant>> = {
  AMPLA: 'info',
  COTA_RESERVADA: 'success',
  ACAO_AFIRMATIVA: 'warning',
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

  protected naturezaLabel(token: string): string {
    return rotulo(NATUREZAS_LEGAIS, token);
  }
  protected naturezaVariante(token: string): UiTagVariant {
    return NATUREZA_VARIANTE[token] ?? 'neutral';
  }
  protected composicaoLabel(token: string): string {
    return rotulo(COMPOSICOES_VAGAS, token);
  }
  protected referenciadaPor(codigo: string): readonly ModalidadeDto[] {
    return this.referencias().get(codigo) ?? [];
  }
  protected remanejamentoResumo(m: ModalidadeDto): string {
    if (m.regraRemanejamento === null) return '—';
    const regra = rotulo(REGRAS_REMANEJAMENTO, m.regraRemanejamento);
    if (m.remanejamentoDestino) return `${regra} → ${m.remanejamentoDestino}`;
    if (m.remanejamentoPar || m.remanejamentoFallback) {
      return `${regra} (${m.remanejamentoPar ?? '—'} / ${m.remanejamentoFallback ?? '—'})`;
    }
    return regra;
  }
}
