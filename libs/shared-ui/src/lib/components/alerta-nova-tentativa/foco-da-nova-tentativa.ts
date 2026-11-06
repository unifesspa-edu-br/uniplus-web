import { Injector, afterNextRender } from '@angular/core';

import { focarEmAlgum } from './destino-do-foco';

/**
 * Quando a nova tentativa pedida pela pessoa dá certo, o alerta que anunciava a falha sai da tela
 * e leva junto o botão "Tentar novamente". O foco, que estava nele, cairia no `body`, fora do
 * contexto da pessoa (WCAG 2.4.3): aqui ele vai para `destino`, depois da renderização que
 * removeu o alerta.
 *
 * Só age se o foco estava no elemento acionado (o botão) no clique e continuava nele quando a
 * tentativa terminou. Uma recarga em segundo plano, um clique que não focou o botão (como no
 * Safari) ou um foco levado a outro lugar durante a espera não mexem no foco: mudar de contexto
 * sem ação da pessoa é o que a WCAG 3.2 proíbe.
 *
 * Quem decide quando a tentativa terminou é `acompanharNovaTentativa`, o mesmo momento que fecha
 * a fase do alerta.
 */
export class FocoDaNovaTentativa {
  /** Elemento com o foco no clique da tentativa que ainda não terminou. */
  private acionado: Element | null | undefined;

  /**
   * @param destino Elemento estável que recebe o foco (título, campo que o dado alimenta).
   * @param aoDarCerto Chamado quando a tentativa dá certo, com `true` se o foco foi levado ao
   *   destino. Quem não recebeu o foco precisa de outro aviso do resultado.
   */
  constructor(
    private readonly destino: () => HTMLElement | null | undefined,
    private readonly aoDarCerto: (focoLevado: boolean) => void,
    private readonly injector: Injector,
  ) {}

  /** Guarda quem tem o foco no clique, antes de a leitura ser disparada. */
  marcar(): void {
    const ativo = document.activeElement;
    this.acionado = ativo === document.body ? null : ativo;
  }

  /** Nenhuma leitura começou: não há o que acompanhar. */
  descartar(): void {
    this.acionado = undefined;
  }

  /** A tentativa terminou; com falha, o alerta e o botão ficam, e o foco também. */
  concluir(falhou: boolean): void {
    const seguiaNoBotao =
      this.acionado instanceof Element && document.activeElement === this.acionado;
    this.acionado = undefined;
    if (falhou) return;
    if (!seguiaNoBotao) {
      this.aoDarCerto(false);
      return;
    }
    afterNextRender(() => this.devolverSeSemDono(), { injector: this.injector });
  }

  /** Se o foco foi para outro lugar nesse meio-tempo, não o move. */
  private devolverSeSemDono(): void {
    const ativo = document.activeElement;
    const semDono = ativo === null || ativo === document.body;
    this.aoDarCerto(semDono && focarEmAlgum(this.destino()));
  }
}
