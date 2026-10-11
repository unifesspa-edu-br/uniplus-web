import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { deClausulasDoWire, fatosParaLeitura, resumoDaRegra } from '@uniplus/shared-ui/components';

import { CatalogosDoCronogramaService } from '../steps/cronograma/catalogos-do-cronograma.service';
import type { RegraDaModalidadeOfertada } from './regras-das-modalidades';

let proximoId = 0;

/**
 * Quem concorre em cada modalidade ofertada, pela regra que o processo congelou, só para leitura:
 * a regra se escreve no cadastro de modalidades, e o processo a copia ao gravar o quadro de vagas.
 */
@Component({
  selector: 'sel-regras-das-modalidades',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .regras-das-modalidades__lista {
      display: grid;
      gap: var(--space-2);
      margin: 0;
    }
    .regras-das-modalidades__lista dd {
      margin: 0;
    }
  `,
  template: `
    <section class="regras-das-modalidades" [attr.aria-labelledby]="tituloId">
      <h3 class="form-section__title" [id]="tituloId">Quem concorre em cada modalidade</h3>
      <p class="field__hint">
        A regra vem do cadastro de modalidades e fica congelada no processo quando o quadro de vagas
        é gravado.
      </p>
      <dl class="regras-das-modalidades__lista">
        @for (linha of linhas(); track linha.codigo) {
          <div>
            <dt>
              <strong>{{ linha.codigo }}</strong>
              @if (linha.descricao) {
                — {{ linha.descricao }}
              }
            </dt>
            <dd>{{ linha.quemConcorre }}</dd>
          </div>
        }
      </dl>
    </section>
  `,
})
export class RegrasDasModalidadesComponent {
  readonly modalidades = input.required<readonly RegraDaModalidadeOfertada[]>();

  private readonly catalogos = inject(CatalogosDoCronogramaService);

  protected readonly tituloId = `regras-das-modalidades-${proximoId++}`;

  constructor() {
    this.catalogos.carregar();
  }

  protected readonly linhas = computed(() => {
    // Sem o catálogo, as condições não se leem pelos nomes dos fatos.
    const semCatalogo = this.catalogos.carregando() || this.catalogos.erro() !== null;
    const fatos = semCatalogo ? null : fatosParaLeitura(this.catalogos.fatos());
    return this.modalidades().map((modalidade) => ({
      codigo: modalidade.codigo,
      descricao: modalidade.descricao,
      quemConcorre: resumoDaRegra(deClausulasDoWire(modalidade.regra), fatos),
    }));
  });
}
