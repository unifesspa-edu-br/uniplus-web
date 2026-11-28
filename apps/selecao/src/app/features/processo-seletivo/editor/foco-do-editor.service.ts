import { ElementRef, Injectable, effect, inject } from '@angular/core';

import type { PassoDoWizard } from '../wizard/passo-do-wizard';

function campoRecusado(campo: HTMLElement): boolean {
  return (
    campo.getAttribute('aria-invalid') === 'true' ||
    (campo instanceof HTMLFieldSetElement && campo.hasAttribute('aria-describedby'))
  );
}

function aplicarReservas(barra: HTMLElement, rodape: HTMLElement, area: HTMLElement): void {
  area.style.setProperty('--wiz-reserva-topo', `${barra.offsetHeight}px`);
  area.style.setProperty('--wiz-reserva-base', `${rodape.offsetHeight}px`);
  area.ownerDocument.documentElement.style.setProperty(
    '--wiz-reserva-base',
    `${rodape.offsetHeight}px`,
  );
}

function limparReservas(area: HTMLElement): void {
  area.style.removeProperty('--wiz-reserva-topo');
  area.style.removeProperty('--wiz-reserva-base');
  area.ownerDocument.documentElement.style.removeProperty('--wiz-reserva-base');
}

/** Mede a barra e o rodapé a cada mudança de tamanho; devolve a função que para a medição e limpa as reservas. */
function acompanharReservas(
  barra: HTMLElement,
  rodape: HTMLElement,
  area: HTMLElement,
): () => void {
  const observador = new ResizeObserver(() => aplicarReservas(barra, rodape, area));
  observador.observe(barra);
  observador.observe(rodape);
  return () => {
    observador.disconnect();
    limparReservas(area);
  };
}

/** Para onde vai o foco e a rolagem do editor: o título do passo, o aviso de pendências e o campo recusado. */
@Injectable()
export class FocoDoEditor {
  private readonly elementoDoEditor = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** Título do passo — o destino de foco a cada troca. */
  focarTituloDoPasso(): void {
    // O passo novo abre no topo: com a rolagem do passo anterior mantida, ele aparecia rolado até
    // o meio, com o título fora da tela. O foco vai sem rolar para não brigar com esta rolagem.
    const scroller = this.elementoDoEditor.closest<HTMLElement>('.page');
    try {
      scroller?.scrollTo({ top: 0, behavior: 'instant' });
    } catch {
      // jsdom não implementa scrollTo(options); o foco não pode ser bloqueado.
    }
    this.elementoDoEditor
      .querySelector<HTMLElement>('.step-head h1')
      ?.focus({ preventScroll: true });
  }

  /** Foca o título "Processo publicado" — só existe quando `persistir()` da Revisão confirmou o snapshot. */
  focarConfirmacaoDePublicacao(): void {
    // `setTimeout`, não `queueMicrotask`: o bloco só entra no DOM depois que o Angular processa
    // `snapshotConfirmado()`, o que acontece depois da fila de microtarefas.
    setTimeout(() => {
      this.elementoDoEditor
        .querySelector<HTMLElement>('.revisao-publicado-titulo')
        ?.focus({ preventScroll: true });
    });
  }

  /**
   * Traz o aviso de pendências para a vista e o entrega ao leitor de tela. O resumo do último
   * passo rola em 320 px e com zoom alto: sem isto, quem publica a partir do rodapé com a lista
   * rolada não recebe retorno visível.
   *
   * Usa `setTimeout`, não `queueMicrotask`: o aviso só existe no DOM depois que o Angular processa a
   * mudança do signal, o que ocorre após a fila de microtarefas.
   */
  revelarErro(passoAtual: () => PassoDoWizard | undefined): void {
    setTimeout(() => this.levarAvisoAVista(passoAtual));
  }

  /** O passo em tela sabe abrir a aba ou a seção que guarda o campo recusado; sem ele, o foco vai ao campo ou ao aviso. */
  private async levarAvisoAVista(passoAtual: () => PassoDoWizard | undefined): Promise<void> {
    const alerta = this.elementoDoEditor.querySelector<HTMLElement>('.step-error');
    if (alerta === null) return;
    alerta.setAttribute('tabindex', '-1');
    if (await passoAtual()?.revelarCampoInvalido?.()) return;
    if (this.focarCampoInvalido()) return;
    this.rolarAteOAviso(alerta);
    alerta.focus({ preventScroll: true });
  }

  /** Com campo inválido no passo em tela, o foco vai a ele e a rolagem o traz para a vista: foco fora da tela não é foco visível. O aviso segue anunciado pelo `role="alert"` do resumo. */
  private focarCampoInvalido(): boolean {
    const campo = this.campoInvalidoParaFoco();
    if (campo === null) return false;
    campo.scrollIntoView?.({ block: 'center' });
    campo.focus({ preventScroll: true });
    return document.activeElement === campo;
  }

  /** Quem rola é o `.page` do shell. O `scrollTo` ignora o `scroll-padding`, então a reserva do topo (a barra de etapas do celular, que cobriria o aviso) entra à mão. */
  private rolarAteOAviso(alerta: HTMLElement): void {
    const scroller = this.elementoDoEditor.closest<HTMLElement>('.page');
    if (!scroller) return;
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

  /**
   * O rodapé e a barra de etapas do celular ficam colados às bordas do `.page`, por cima do passo.
   * Ao rolar até o campo que recebe foco, o navegador só os desconta pelo `scroll-padding` do
   * `.page` (em `styles.css`), que recebe daqui a altura medida de cada um: ela muda com a largura,
   * com o modo de fonte e com os botões do passo. O "Voltar ao topo" é irmão do `.page` no shell,
   * fora do alcance da variável dele, então a reserva da base também vai ao documento. Chamar no
   * construtor da página.
   */
  observarReservas(
    barra: () => HTMLElement | undefined,
    rodape: () => HTMLElement | undefined,
  ): void {
    effect((onCleanup) => {
      const elementoDaBarra = barra();
      const elementoDoRodape = rodape();
      const area = this.elementoDoEditor.closest<HTMLElement>('.page');
      if (!elementoDaBarra || !elementoDoRodape || !area || typeof ResizeObserver === 'undefined') {
        return;
      }
      onCleanup(acompanharReservas(elementoDaBarra, elementoDoRodape, area));
    });
  }

  private campoInvalidoParaFoco(): HTMLElement | null {
    const visivel = (campo: HTMLElement): boolean => campo.closest('[hidden]') === null;
    const ativo = document.activeElement;
    if (
      ativo instanceof HTMLElement &&
      this.elementoDoEditor.contains(ativo) &&
      campoRecusado(ativo) &&
      visivel(ativo)
    )
      return ativo;
    const campos = this.elementoDoEditor.querySelectorAll<HTMLElement>(
      '.step-pane:not([hidden]) [aria-invalid="true"]',
    );
    return [...campos].find(visivel) ?? null;
  }
}
