import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { AlertComponent } from '../alert/alert';
import type { CatalogoAcompanhado } from '../alerta-nova-tentativa/leitura-acompanhada';
import { NovaTentativaDoCampoComponent } from '../alerta-nova-tentativa/nova-tentativa-do-campo';

/**
 * Anuncia, uma vez por listagem, os catálogos de chave estrangeira que não
 * puderam ser carregados, e oferece a nova tentativa de cada um.
 *
 * O par natural de `ui-lookup-label`: a célula diz que aquele rótulo não
 * resolveu, e este alerta diz por quê e o que fazer. A ação vive aqui, e não
 * na célula, porque numa tabela ela se repetiria por linha — dezenas de
 * controles com o mesmo nome acessível para quem navega por leitor de tela.
 */
@Component({
  selector: 'ui-lookup-alert',
  standalone: true,
  imports: [AlertComponent, NovaTentativaDoCampoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'lookup-alert' },
  template: `
    @if (itens().length > 0) {
      <ui-alert variant="warning" heading="Rótulos não carregados">
        {{ mensagem() }}
        <span alertaAcoes class="lookup-alert__acoes">
          @for (leitura of itens(); track leitura.assunto) {
            <ui-nova-tentativa-do-campo
              [rotulo]="'Recarregar ' + leitura.assunto"
              [assunto]="leitura.assunto"
              [fase]="leitura.fase()"
              [pendente]="leitura.pendente()"
              [indisponivel]="leitura.indisponivel()"
              (tentar)="leitura.tentar()"
            />
          }
        </span>
      </ui-alert>
    }
  `,
})
export class LookupAlertComponent {
  /** Leituras acompanhadas: cada uma entra no aviso enquanto está em falha ou em nova tentativa. */
  readonly leituras = input<readonly CatalogoAcompanhado[]>([]);

  protected readonly itens = computed(() => this.leituras().filter((leitura) => leitura.visivel()));

  protected readonly mensagem = computed(() =>
    this.itens().length === 1
      ? 'A coluna afetada mostra “Não carregado” até a busca ser refeita.'
      : 'As colunas afetadas mostram “Não carregado” até a busca ser refeita.',
  );
}
