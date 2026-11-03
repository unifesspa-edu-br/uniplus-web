import { ElementRef, Injectable, effect, inject } from '@angular/core';

import type { PassoDoWizard } from '../steps/passo-do-wizard';

/** Para onde vai o foco e a rolagem do editor: o título do passo, o aviso de pendências e o campo recusado. */
@Injectable()
export class FocoDoEditor {
  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** Título do passo — o destino de foco a cada troca. */
  focarTituloDoPasso(): void {
    // O passo novo abre no topo: com a rolagem do passo anterior mantida, ele aparecia rolado até
    // o meio, com o título fora da tela. O foco vai sem rolar para não brigar com esta rolagem.
    const scroller = this.raiz.closest<HTMLElement>('.page');
    try {
      scroller?.scrollTo({ top: 0, behavior: 'instant' });
    } catch {
      // jsdom não implementa scrollTo(options); o foco não pode ser bloqueado.
    }
    this.raiz.querySelector<HTMLElement>('.step-head h1')?.focus({ preventScroll: true });
  }

  /** Foca o título "Processo publicado" — só existe quando `persistir()` da Revisão confirmou o snapshot. */
  focarConfirmacaoDePublicacao(): void {
    // `setTimeout`, não `queueMicrotask`: o bloco só entra no DOM depois que o Angular processa
    // `snapshotConfirmado()`, o que acontece depois da fila de microtarefas.
    setTimeout(() => {
      this.raiz
        .querySelector<HTMLElement>('.revisao-publicado-titulo')
        ?.focus({ preventScroll: true });
    });
  }

  /**
   * Traz o aviso de pendências para a vista e o entrega ao leitor de tela. O resumo do último
   * passo rola em 320 px e com zoom alto: sem isto, quem publica a partir do rodapé com a lista
   * rolada não recebe retorno visível.
   */
  revelarErro(passoAtual: () => PassoDoWizard | undefined): void {
    // `setTimeout`, não `queueMicrotask`: o aviso só existe no DOM depois que o Angular processa a
    // mudança do signal, o que ocorre após a fila de microtarefas.
    setTimeout(async () => {
      const alerta = this.raiz.querySelector<HTMLElement>('.step-error');
      if (alerta === null) return;

      alerta.setAttribute('tabindex', '-1');

      // O passo em tela sabe abrir a aba ou a seção que guarda o campo recusado.
      if (await passoAtual()?.revelarCampoInvalido?.()) return;

      // Com campo inválido no passo em tela, o foco vai a ele e a rolagem o traz para a vista:
      // foco fora da tela não é foco visível. O aviso segue anunciado pela região aria-live.
      const campo = this.campoInvalidoParaFoco();
      if (campo !== null) {
        campo.scrollIntoView?.({ block: 'center' });
        campo.focus({ preventScroll: true });
        if (document.activeElement === campo) return;
      }

      // Sem campo inválido: quem rola é o `.page` do shell. O `scrollTo` ignora o `scroll-padding`,
      // então a reserva do topo (a barra de etapas do celular, que cobriria o aviso) entra à mão.
      const scroller = this.raiz.closest<HTMLElement>('.page');
      if (scroller) {
        try {
          const reservaTopo = parseFloat(getComputedStyle(scroller).scrollPaddingTop) || 0;
          const topoAlerta = alerta.getBoundingClientRect().top;
          const topoScroller = scroller.getBoundingClientRect().top;
          scroller.scrollTo({
            top: scroller.scrollTop + (topoAlerta - topoScroller) - reservaTopo,
            behavior: 'smooth',
          });
        } catch {
          // jsdom não implementa scrollTo(options); o foco não pode ser bloqueado.
        }
      }
      alerta.focus({ preventScroll: true });
    });
  }

  /**
   * O rodapé e a barra de etapas do celular ficam colados às bordas do `.page`, por cima do passo.
   * Ao rolar até o campo que recebe foco, o navegador só os desconta pelo `scroll-padding` do
   * `.page` (em `styles.css`), que recebe daqui a altura medida de cada um: ela muda com a largura,
   * com o modo de fonte e com os botões do passo. Chamar no construtor da página.
   */
  observarReservas(
    barra: () => HTMLElement | undefined,
    rodape: () => HTMLElement | undefined,
  ): void {
    effect((onCleanup) => {
      const elementoDaBarra = barra();
      const elementoDoRodape = rodape();
      const area = this.raiz.closest<HTMLElement>('.page');
      const documento = this.raiz.ownerDocument.documentElement;
      if (!elementoDaBarra || !elementoDoRodape || !area || typeof ResizeObserver === 'undefined') {
        return;
      }

      const observador = new ResizeObserver(() => {
        area.style.setProperty('--wiz-reserva-topo', `${elementoDaBarra.offsetHeight}px`);
        area.style.setProperty('--wiz-reserva-base', `${elementoDoRodape.offsetHeight}px`);
        // O "Voltar ao topo" é irmão do `.page` no shell, fora do alcance da variável acima.
        documento.style.setProperty('--wiz-reserva-base', `${elementoDoRodape.offsetHeight}px`);
      });
      observador.observe(elementoDaBarra);
      observador.observe(elementoDoRodape);
      onCleanup(() => {
        observador.disconnect();
        area.style.removeProperty('--wiz-reserva-topo');
        area.style.removeProperty('--wiz-reserva-base');
        documento.style.removeProperty('--wiz-reserva-base');
      });
    });
  }

  private campoInvalidoParaFoco(): HTMLElement | null {
    const visivel = (campo: HTMLElement): boolean => campo.closest('[hidden]') === null;
    const ativo = document.activeElement;
    if (
      ativo instanceof HTMLElement &&
      this.raiz.contains(ativo) &&
      ativo.getAttribute('aria-invalid') === 'true' &&
      visivel(ativo)
    ) {
      return ativo;
    }
    return (
      Array.from(
        this.raiz.querySelectorAll<HTMLElement>('.step-pane:not([hidden]) [aria-invalid="true"]'),
      ).find(visivel) ?? null
    );
  }
}
