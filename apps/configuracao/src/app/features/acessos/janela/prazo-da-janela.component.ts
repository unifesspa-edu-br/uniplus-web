import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import type { JanelaDeMigracaoDto } from '@uniplus/shared-data/autorizacao';
import { TagComponent } from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { tempoRestante } from './itens-da-janela';
import { formaDoEncerramento, situacaoDaJanela } from './rotulos-da-janela';

const UM_MINUTO = 60_000;

/** O prazo de 72 horas da janela, sempre à vista, com o que falta enquanto ela está aberta. */
@Component({
  selector: 'cfg-prazo-da-janela',
  standalone: true,
  imports: [TagComponent, DateBrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" aria-labelledby="cfg-prazo-titulo">
      <div class="panel-head">
        <h2 id="cfg-prazo-titulo" class="panel-head__title">Prazo da janela</h2>
        <ui-tag [variant]="situacao().variante">{{ situacao().texto }}</ui-tag>
      </div>
      <dl class="cfg-detail-list panel-body">
        <div>
          <dt>Prazo</dt>
          <dd>{{ janela().prazo | dateBr: 'datetime' }}</dd>
        </div>
        @if (janela().encerradaEm; as encerradaEm) {
          <div>
            <dt>Encerrada em</dt>
            <dd>{{ encerradaEm | dateBr: 'datetime' }}</dd>
          </div>
          <div>
            <dt>Motivo do fim</dt>
            <dd>{{ forma() }}</dd>
          </div>
        } @else if (restante(); as tempo) {
          <div>
            <dt>Tempo restante</dt>
            <dd>{{ tempo }}</dd>
          </div>
        }
        <div>
          <dt>Versões</dt>
          <dd>Da versão anterior para a versão {{ janela().versaoAlvo }}</dd>
        </div>
      </dl>
    </section>
  `,
})
export class PrazoDaJanelaComponent {
  readonly janela = input.required<JanelaDeMigracaoDto>();

  private readonly agora = signal(Date.now());
  protected readonly situacao = computed(() => situacaoDaJanela(this.janela().situacao));
  protected readonly forma = computed(() => formaDoEncerramento(this.janela().forma));
  protected readonly restante = computed(() =>
    this.janela().situacao === 'aberta' ? tempoRestante(this.janela().prazo, this.agora()) : null,
  );

  constructor() {
    const relogio = setInterval(() => this.agora.set(Date.now()), UM_MINUTO);
    inject(DestroyRef).onDestroy(() => clearInterval(relogio));
  }
}
