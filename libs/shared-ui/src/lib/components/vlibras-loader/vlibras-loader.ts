import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  inject,
  input,
} from '@angular/core';

const SCRIPT_ID = 'uniplus-vlibras-script';
const STYLESHEET_ID = 'uniplus-vlibras-stylesheet';

declare global {
  interface Window {
    VLibras?: { Widget: new (rootPath?: string) => unknown };
  }
}

/**
 * Resolve um asset self-hosted relativo ao `<base href>` do documento —
 * respeita subpath sem depender do `DOCUMENT` injetado do
 * componente, que só fica disponível depois dos campos de `input()` na
 * ordem de inicialização da classe.
 */
function resolveAssetPath(relativePath: string): string {
  return new URL(relativePath, document.baseURI).toString();
}

@Component({
  selector: 'ui-vlibras-loader',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'u-no-print' },
  template: `
    <div vw class="enabled">
      <div vw-access-button class="active"></div>
      <div vw-plugin-wrapper>
        <div class="vw-plugin-top-wrapper"></div>
      </div>
    </div>
  `,
})
export class VlibrasLoaderComponent {
  readonly stylesheetHref = input<string>(resolveAssetPath('assets/shared-ui/vlibras/vlibras.css'));
  readonly scriptSrc = input<string>(
    resolveAssetPath('assets/shared-ui/vlibras/vlibras-plugin.js'),
  );
  readonly rootPath = input<string | undefined>(resolveAssetPath('assets/shared-ui/vlibras'));
  readonly assetMirrorSrc = input<string>(resolveAssetPath('assets/shared-ui/vlibras/assets/'));
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private initialized = false;

  constructor() {
    const onAssetError = (event: Event) => this.redirectBrokenAsset(event);
    this.document.addEventListener('error', onAssetError, true);
    this.destroyRef.onDestroy(() => this.document.removeEventListener('error', onAssetError, true));
    afterNextRender(() => this.load());
  }

  private load(): void {
    this.ensureStylesheet();
    const existing = this.document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => this.initWidget(), { once: true });
      this.initWidget();
    } else {
      this.appendScript();
    }
  }

  private appendScript(): void {
    const script = this.document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = this.scriptSrc();
    script.async = true;
    script.onload = () => this.initWidget();
    this.document.body.appendChild(script);
  }

  private ensureStylesheet(): void {
    if (this.document.getElementById(STYLESHEET_ID)) {
      return;
    }

    const link = this.document.createElement('link');
    link.id = STYLESHEET_ID;
    link.rel = 'stylesheet';
    link.href = this.stylesheetHref();
    this.document.head.appendChild(link);
  }

  private initWidget(): void {
    if (this.initialized || typeof window === 'undefined' || !window.VLibras?.Widget) {
      return;
    }

    this.initialized = true;
    const previousOnload = window.onload;
    this.createWidget(window.VLibras.Widget);
    this.replayOnload(previousOnload);
  }

  private createWidget(Widget: NonNullable<Window['VLibras']>['Widget']): void {
    const rootPath = this.rootPath();
    if (rootPath) {
      new Widget(rootPath);
    } else {
      new Widget();
    }
  }

  /** O plugin registra um `onload` novo; com a página já carregada, ele precisa ser chamado à mão. */
  private replayOnload(previousOnload: Window['onload']): void {
    const pendingOnload = window.onload;
    const isNew = typeof pendingOnload === 'function' && pendingOnload !== previousOnload;
    if (this.document.readyState === 'complete' && isNew) {
      window.setTimeout(() => pendingOnload.call(window, new Event('load')), 0);
    }
  }

  private redirectBrokenAsset(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLImageElement) || target.dataset['vwFixed']) {
      return;
    }

    const match = target.src.match(/(?:www\.)?vlibras\.gov\.br\/app\/+assets\/(.+)$/);
    if (match?.[1]) {
      target.dataset['vwFixed'] = '1';
      target.src = this.assetMirrorSrc() + match[1];
    }
  }
}
