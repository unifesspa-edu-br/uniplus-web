import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import {
  OfertaCursoDto,
  PROGRAMAS_DE_OFERTA,
  REGIMES_DE_TURNO,
  TURNOS_OFERTA,
  ordenarTurnosCanonicamente,
} from '@uniplus/shared-data/configuracao';
import {
  AlertaNovaTentativaComponent,
  AlertComponent,
  DrawerComponent,
  EmptyStateComponent,
  type FaseDaNovaTentativa,
  ListFooterComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';

/** Rótulos dos tokens de programa, regime e turno da oferta (domínios fechados, ofertas-curso.api). */
const PROGRAMA_LABELS = new Map(PROGRAMAS_DE_OFERTA.map((opcao) => [opcao.value, opcao.label]));
const TURNO_LABELS = new Map(TURNOS_OFERTA.map((opcao) => [opcao.value, opcao.label]));
const REGIME_LABELS = new Map(REGIMES_DE_TURNO.map((opcao) => [opcao.value, opcao.label]));

/** O drawer com as ofertas vivas do curso, que bloqueiam a remoção dele enquanto existirem. */
@Component({
  selector: 'cfg-ofertas-do-curso',
  standalone: true,
  imports: [
    AlertComponent,
    DrawerComponent,
    EmptyStateComponent,
    ListFooterComponent,
    SpinnerComponent,
    AlertaNovaTentativaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ofertas-do-curso.component.html',
  styleUrls: ['../../shared/sobreposicao/sobreposicao.css', './ofertas-do-curso.component.css'],
})
export class OfertasDoCursoComponent {
  readonly aberto = model.required<boolean>();
  readonly titulo = input.required<string>();
  readonly bloqueio = input.required<string | null>();
  readonly mensagemDeErro = input.required<string | null>();
  readonly carregando = input.required<boolean>();
  readonly fase = input.required<FaseDaNovaTentativa>();
  readonly ofertas = input.required<readonly OfertaCursoDto[]>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();

  readonly fechado = output<void>();
  readonly recarregar = output<void>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  protected readonly descricaoSemOfertas = computed(() =>
    this.bloqueio()
      ? 'Nenhuma oferta ativa foi encontrada agora. Tente remover o curso de novo.'
      : 'Este curso não possui ofertas de curso vivas — a remoção não será bloqueada.',
  );

  protected programaLabel(token: OfertaCursoDto['programaDeOferta']): string {
    return PROGRAMA_LABELS.get(token) ?? token;
  }

  protected regimeLabel(token: OfertaCursoDto['regimeDeTurno']): string {
    return REGIME_LABELS.get(token) ?? token;
  }

  protected turnosLabel(tokens: readonly string[]): string {
    if (tokens.length === 0) {
      return '—';
    }
    return ordenarTurnosCanonicamente(tokens)
      .map((token) => TURNO_LABELS.get(token) ?? token)
      .join(' e ');
  }
}
