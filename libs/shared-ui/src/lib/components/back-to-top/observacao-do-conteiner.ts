/**
 * Acompanha a rolagem e o tamanho de um contêiner e avisa quando algo muda.
 *
 * O alvo do evento de rolagem costuma ser o próprio contêiner. Quando ele é
 * `document.documentElement` (rolagem natural da página, como no shell público),
 * o evento nativo não dispara no elemento `<html>`, e sim em `window`. O alvo
 * real fica guardado para que `parar()` remova o listener de onde ele foi posto.
 */
export class ObservacaoDoConteiner {
  private alvoDoEvento: EventTarget | null = null;
  private observadorDeTamanho: ResizeObserver | null = null;

  constructor(private readonly aoMudar: () => void) {}

  /** Passa a acompanhar o contêiner, soltando o anterior. `null` só solta. */
  observar(conteiner: HTMLElement | null): void {
    this.parar();
    if (conteiner === null) return;
    this.alvoDoEvento = ehODocumento(conteiner) ? window : conteiner;
    this.alvoDoEvento.addEventListener('scroll', this.aoMudar, { passive: true });
    this.observarTamanho(conteiner);
  }

  /** Remove o listener de rolagem e o observador de tamanho. */
  parar(): void {
    this.alvoDoEvento?.removeEventListener('scroll', this.aoMudar);
    this.alvoDoEvento = null;
    this.observadorDeTamanho?.disconnect();
    this.observadorDeTamanho = null;
  }

  /**
   * O contêiner não muda de caixa quando o conteúdo interno cresce; observar os
   * filhos cobre a mudança relevante de dimensões.
   */
  private observarTamanho(conteiner: HTMLElement): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.observadorDeTamanho = new ResizeObserver(() => this.aoMudar());
    this.observadorDeTamanho.observe(conteiner);
    for (const filho of Array.from(conteiner.children)) this.observadorDeTamanho.observe(filho);
  }
}

function ehODocumento(conteiner: HTMLElement): boolean {
  return typeof document !== 'undefined' && conteiner === document.documentElement;
}
