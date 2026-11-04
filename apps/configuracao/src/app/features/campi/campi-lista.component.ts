import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CampusDto } from '@uniplus/shared-data/configuracao';
import {
  EmptyStateComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';

/** O painel com a tabela de campi, o estado vazio e a paginação. */
@Component({
  selector: 'cfg-campi-lista',
  standalone: true,
  imports: [EmptyStateComponent, IconButtonComponent, PagerComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './campi-lista.component.html',
})
export class CampiListaComponent {
  readonly campi = input.required<readonly CampusDto[]>();
  readonly carregando = input.required<boolean>();
  readonly mensagemDeErro = input.required<string | null>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();

  readonly cadastrar = output<void>();
  readonly editar = output<CampusDto>();
  readonly remover = output<CampusDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  protected cidadeLabel(campus: CampusDto): string {
    const cidade = campus.endereco?.cidade ?? campus.cidade;
    return cidade ? `${cidade.nome} — ${cidade.uf}` : '—';
  }
}
