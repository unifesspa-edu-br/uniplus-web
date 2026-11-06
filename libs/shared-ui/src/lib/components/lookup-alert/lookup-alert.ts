import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { AlertComponent } from '../alert/alert';
import type { CatalogoAcompanhado } from '../alerta-nova-tentativa/leitura-acompanhada';
import { FaseDaNovaTentativa } from '../alerta-nova-tentativa/nova-tentativa';
import { NovaTentativaDoCampoComponent } from '../alerta-nova-tentativa/nova-tentativa-do-campo';

/** Catálogo cuja busca foi recusada, com o gatilho para tentar de novo. */
export interface UiLookupFalho {
  /** Nome do catálogo como aparece na frase de nova tentativa ("cursos"). */
  readonly nome: string;
  /**
   * A nova tentativa deste catálogo está em curso. Quem informa mantém o catálogo na lista
   * enquanto dura, para o botão que a pediu não sair da tela com o foco; o botão fica ocupado
   * (`aria-busy`) e indisponível, sem perdê-lo.
   */
  readonly pendente?: boolean;
  /** O botão não age agora por outro motivo (a lista está ocupada): só `aria-disabled`, sem `aria-busy`. */
  readonly indisponivel?: boolean;
  /** A fase da nova tentativa pedida; o alerta mostra e anuncia o mesmo texto (`acompanharNovaTentativa`). */
  readonly fase: FaseDaNovaTentativa;
  recarregar(): void;
}

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
          @for (falha of itens(); track falha.nome) {
            <ui-nova-tentativa-do-campo
              [rotulo]="'Recarregar ' + falha.nome"
              [assunto]="falha.nome"
              [fase]="falha.fase"
              [pendente]="falha.pendente ?? false"
              [indisponivel]="falha.indisponivel ?? false"
              (tentar)="falha.recarregar()"
            />
          }
        </span>
      </ui-alert>
    }
  `,
})
export class LookupAlertComponent {
  readonly falhas = input<readonly UiLookupFalho[]>([]);
  /** Leituras acompanhadas: cada uma entra no aviso enquanto está em falha ou em nova tentativa. */
  readonly leituras = input<readonly CatalogoAcompanhado[]>([]);

  protected readonly itens = computed<readonly UiLookupFalho[]>(() => [
    ...this.falhas(),
    ...this.leituras()
      .filter((leitura) => leitura.visivel())
      .map(comoFalho),
  ]);

  protected readonly mensagem = computed(() =>
    this.itens().length === 1
      ? 'A coluna afetada mostra “Não carregado” até a busca ser refeita.'
      : 'As colunas afetadas mostram “Não carregado” até a busca ser refeita.',
  );
}

function comoFalho(leitura: CatalogoAcompanhado): UiLookupFalho {
  return {
    nome: leitura.assunto,
    pendente: leitura.pendente(),
    indisponivel: leitura.indisponivel(),
    fase: leitura.fase(),
    recarregar: () => leitura.tentar(),
  };
}
