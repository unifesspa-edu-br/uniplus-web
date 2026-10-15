import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export type StepStatus = 'active' | 'done' | 'pending' | 'unvisited';

export interface StepItem {
  readonly rotulo: string;
  /** Identidade estável do passo: com ela, a lista reaproveita o DOM do passo mesmo quando a posição muda. */
  readonly chave?: string;
  readonly status: StepStatus;
  /** Passo concluído que também é o atual: `status` fica `active`, mas o nome acessível diz "concluída". */
  readonly concluido?: boolean;
  /**
   * Passo com resposta recusada: o nome acessível diz que há recusa em qualquer variante, mas o
   * destaque de erro (borda e cor) só tem apresentação na variante `chips`.
   */
  readonly comErro?: boolean;
}

/**
 * Apresentação dos passos:
 * - `lateral`: coluna com círculos e linhas conectoras. Em que largura ela aparece é do consumidor, que
 *   esconde o host `ui-steps`; ela também assume um contêiner de layout como o do assistente
 *   (flex, com altura própria para o `position: sticky`);
 * - `sobreposicao`: a mesma coluna ampliada, para fundo escuro (`--surface-inverse`) em tela cheia;
 * - `chips`: botões em linha, que quebram de linha em telas estreitas.
 */
export type StepsVariant = 'lateral' | 'sobreposicao' | 'chips';

/**
 * Lista de passos. Só apresenta e emite o índice escolhido; quem consome decide se a navegação
 * é permitida e atualiza o estado dos itens.
 */
@Component({
  selector: 'ui-steps',
  imports: [NgTemplateOutlet],
  templateUrl: './steps.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepsComponent {
  readonly items = input.required<readonly StepItem[]>();
  readonly variante = input<StepsVariant>('lateral');
  /** Com rótulo, a lista fica dentro de um `<nav>` com esse nome; sem, é um bloco comum. */
  readonly rotuloDaNavegacao = input<string | null>(null);
  readonly selecionado = output<number>();

  protected readonly classe = computed(() => `ui-steps ui-steps--${this.variante()}`);

  /**
   * Nas colunas o passo atual aparece como ativo, não como concluído; nos chips os dois estados
   * se somam (borda do concluído sobre o atual).
   */
  protected marcaConcluido(item: StepItem): boolean {
    return this.concluido(item) && (this.variante() === 'chips' || item.status !== 'active');
  }

  protected concluido(item: StepItem): boolean {
    return item.status === 'done' || item.concluido === true;
  }
}
