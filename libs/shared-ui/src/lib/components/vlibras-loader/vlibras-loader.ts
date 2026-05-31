import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  inject,
  input,
} from '@angular/core';

declare global {
  interface Window {
    VLibras?: { Widget: new (rootPath?: string) => unknown };
  }
}

@Component({
  selector: 'ui-vlibras-loader',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div vw class="enabled">
      <div vw-access-button class="active"></div>
      <div vw-plugin-wrapper>
        <div class="vw-plugin-top-wrapper"></div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class VlibrasLoaderComponent {
  readonly scriptSrc = input<string>('https://vlibras.gov.br/app/vlibras-plugin.js');
  readonly rootPath = input<string | undefined>(undefined);
  readonly assetMirrorSrc = input<string>('https://cdn.jsdelivr.net/gh/spbgovbr-vlibras/vlibras-portal@master/app/assets/');
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
    const scriptId = 'uniplus-vlibras-script';
    const existing = this.document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => this.initWidget(), { once: true });
      this.initWidget();
      return;
    }

    const script = this.document.createElement('script');
    script.id = scriptId;
    script.src = this.scriptSrc();
    script.async = true;
    script.onload = () => this.initWidget();
    this.document.body.appendChild(script);
  }

  private initWidget(): void {
    if (this.initialized || typeof window === 'undefined' || !window.VLibras?.Widget) {
      return;
    }

    this.initialized = true;
    const previousOnload = window.onload;
    const rootPath = this.rootPath();
    if (rootPath) {
      new window.VLibras.Widget(rootPath);
    } else {
      new window.VLibras.Widget();
    }

    const pendingOnload = window.onload;
    if (this.document.readyState === 'complete' && typeof pendingOnload === 'function' && pendingOnload !== previousOnload) {
      window.setTimeout(() => pendingOnload.call(window, new Event('load')), 0);
    }
  }

  private redirectBrokenAsset(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLImageElement) || target.dataset['vwFixed']) {
      return;
    }

    const match = target.src.match(/vlibras\.gov\.br\/app\/+assets\/(.+)$/);
    if (match?.[1]) {
      target.dataset['vwFixed'] = '1';
      target.src = this.assetMirrorSrc() + match[1];
    }
  }
}
