import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  AlertComponent,
  EmptyStateComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';

import { EnvioAoInepComponent } from './envio-ao-inep.component';
import { ImportacaoDeNotasComponent } from './importacao-de-notas.component';
import { NotasDoEnemDoProcesso } from './notas-do-enem-do-processo.service';

/**
 * Notas do ENEM do processo: o envio dos CPFs dos inscritos ao INEP e a importação do arquivo de
 * retorno, cada um num card com a própria edição do ENEM. A etapa é a única do processo que recebe
 * a nota do ENEM, então só a edição é escolhida.
 *
 * Só orquestra. O que vale para cada envio e cada importação é decidido pelo servidor, contra o
 * edital divulgado; a página lê o que ele devolve e mostra as recusas dele.
 */
@Component({
  selector: 'sel-notas-do-enem',
  standalone: true,
  imports: [
    RouterLink,
    AlertComponent,
    EmptyStateComponent,
    EnvioAoInepComponent,
    ImportacaoDeNotasComponent,
    PageHeaderComponent,
    SpinnerComponent,
  ],
  providers: [NotasDoEnemDoProcesso],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notas-do-enem.page.html',
  styleUrls: ['./compartilhado.css', './notas-do-enem.page.css'],
  host: { class: 'cfg-page' },
})
export class NotasDoEnemPage {
  private readonly rota = inject(ActivatedRoute);
  protected readonly notas = inject(NotasDoEnemDoProcesso);

  constructor() {
    this.rota.paramMap.pipe(takeUntilDestroyed()).subscribe((parametros) => {
      const id = parametros.get('id');
      if (id === null) return;
      void this.notas.abrir(id);
    });
  }
}
