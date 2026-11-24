import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { OfertaCursoDto } from '@uniplus/shared-data/configuracao';
import { rotuloDosTurnos } from '../ofertas-curso/rotulos-da-oferta';
import {
  AlertComponent,
  DrawerComponent,
  EmptyStateComponent,
  FalhaDeLeituraComponent,
  type LeituraAcompanhada,
  ListFooterComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';

/** O drawer com as ofertas vivas do curso, que bloqueiam a remoção dele enquanto existirem. */
@Component({
  selector: 'cfg-ofertas-do-curso',
  standalone: true,
  imports: [
    AlertComponent,
    DrawerComponent,
    EmptyStateComponent,
    ListFooterComponent,
    FalhaDeLeituraComponent,
    SpinnerComponent,
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
  readonly leitura = input.required<LeituraAcompanhada>();
  readonly ofertas = input.required<readonly OfertaCursoDto[]>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();

  readonly fechado = output<void>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  protected readonly descricaoSemOfertas = computed(() =>
    this.bloqueio()
      ? 'Nenhuma oferta ativa foi encontrada agora. Tente remover o curso de novo.'
      : 'Este curso não possui ofertas de curso vivas — a remoção não será bloqueada.',
  );

  protected programaLabel(token: OfertaCursoDto['programaDeOferta']): string {
    return token.rotulo;
  }

  protected regimeLabel(token: OfertaCursoDto['regimeDeTurno']): string {
    return token.rotulo;
  }

  protected readonly turnosLabel = rotuloDosTurnos;
}
