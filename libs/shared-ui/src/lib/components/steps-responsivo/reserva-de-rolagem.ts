/** A altura visível do contêiner que rola, que a coluna lateral usa como teto. */
const ALTURA_DA_AREA = '--ui-steps-area-altura';

/** O ancestral que rola na vertical, ou o documento quando nenhum rola. */
function areaQueRola(elemento: HTMLElement): HTMLElement {
  for (let pai = elemento.parentElement; pai; pai = pai.parentElement) {
    const rolagem = getComputedStyle(pai).overflowY;
    if (rolagem === 'auto' || rolagem === 'scroll') return pai;
  }
  return elemento.ownerDocument.documentElement;
}

/**
 * Mede a barra fixa e reserva, na área que rola, o espaço que ela ocupa, para o campo focado por teclado
 * não ficar sob ela (WCAG 2.4.11) e para a coluna lateral não passar da altura visível. O que a reserva
 * alterou na área volta ao que era quando ela é largada.
 */
export class ReservaDeRolagem {
  private area: HTMLElement | null = null;
  private paddingAnterior = '';
  private alturaAnterior = '';
  private readonly observador = new ResizeObserver(() => this.aplicar());

  constructor(
    private readonly barra: HTMLElement,
    private readonly reservaPadding: boolean,
  ) {}

  /** Começa a acompanhar a barra e a janela; devolve a função que desfaz tudo. */
  iniciar(): () => void {
    const janela = this.barra.ownerDocument.defaultView;
    const aoRedimensionar = (): void => this.aplicar();
    janela?.addEventListener('resize', aoRedimensionar);
    this.aplicar();
    return () => {
      this.observador.disconnect();
      janela?.removeEventListener('resize', aoRedimensionar);
      this.largar();
    };
  }

  // O contêiner que rola muda com a largura da janela (o shell deixa de rolar em janela baixa), então
  // é achado de novo a cada medida, e o anterior volta ao que era.
  private aplicar(): void {
    const nova = areaQueRola(this.barra);
    if (nova !== this.area) this.trocarDeArea(nova);
    if (this.reservaPadding) {
      const altura = this.barra.offsetHeight;
      nova.style.scrollPaddingTop = altura > 0 ? `${altura}px` : this.paddingAnterior;
    }
    // A coluna lateral não passa da altura visível da área que rola.
    nova.style.setProperty(ALTURA_DA_AREA, `${nova.clientHeight}px`);
  }

  private trocarDeArea(nova: HTMLElement): void {
    this.largar();
    this.area = nova;
    this.paddingAnterior = nova.style.scrollPaddingTop;
    this.alturaAnterior = nova.style.getPropertyValue(ALTURA_DA_AREA);
    this.observador.disconnect();
    this.observador.observe(this.barra);
    this.observador.observe(nova);
  }

  private largar(): void {
    const area = this.area;
    if (!area) return;
    area.style.scrollPaddingTop = this.paddingAnterior;
    if (this.alturaAnterior === '') area.style.removeProperty(ALTURA_DA_AREA);
    else area.style.setProperty(ALTURA_DA_AREA, this.alturaAnterior);
    this.area = null;
  }
}
