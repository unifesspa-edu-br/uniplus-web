import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  Injector,
  input,
} from '@angular/core';

import { ExpansaoDoCronograma } from '../servicos/expansao-do-cronograma.service';
import {
  FormularioDoCronograma,
  type FaseNaLinhaDoTempo,
} from '../servicos/formulario-do-cronograma.service';
import { LeituraDaLinhaDoTempo } from '../servicos/leitura-da-linha-do-tempo.service';

@Component({
  selector: 'sel-cabecalho-da-fase',
  templateUrl: './cabecalho-da-fase.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CabecalhoDaFaseComponent {
  private readonly injector = inject(Injector);
  readonly fase = input.required<FaseNaLinhaDoTempo>();
  protected readonly expansao = inject(ExpansaoDoCronograma);
  protected readonly leitura = inject(LeituraDaLinhaDoTempo);
  protected readonly cronograma = inject(FormularioDoCronograma);
  protected readonly edicaoLiberada = this.cronograma.edicaoLiberada;
  protected readonly linhaDoTempo = this.cronograma.linhaDoTempo;
  protected subir(): void {
    this.mover(-1);
  }

  protected descer(): void {
    this.mover(1);
  }

  private mover(direcao: -1 | 1): void {
    const { indice, grupo } = this.fase();
    this.cronograma.sequencia.mover(indice, direcao);
    const destino = indice + direcao;
    if (destino !== 0 && destino !== this.linhaDoTempo().length - 1) return;
    afterNextRender(
      () => {
        const novaPosicao = this.linhaDoTempo().findIndex((item) => item.grupo === grupo);
        const acao = direcao === -1 ? 'descer' : 'subir';
        document.getElementById(`cr-fase-${acao}-${novaPosicao}`)?.focus();
      },
      { injector: this.injector },
    );
  }
}
