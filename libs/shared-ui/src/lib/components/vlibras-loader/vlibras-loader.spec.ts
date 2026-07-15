import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VlibrasLoaderComponent } from './vlibras-loader';

type WindowWithVlibras = Window & {
  VLibras?: {
    Widget: ReturnType<typeof vi.fn>;
  };
};

describe('VlibrasLoaderComponent', () => {
  let fixture: ComponentFixture<VlibrasLoaderComponent>;

  afterEach(() => {
    fixture?.destroy();
    document.getElementById('uniplus-vlibras-script')?.remove();
    document.getElementById('uniplus-vlibras-stylesheet')?.remove();
    delete (window as WindowWithVlibras).VLibras;
    vi.restoreAllMocks();
  });

  it('renderiza a anatomia exigida pelo widget VLibras', () => {
    TestBed.configureTestingModule({ imports: [VlibrasLoaderComponent] });
    fixture = TestBed.createComponent(VlibrasLoaderComponent);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[vw].enabled')).not.toBeNull();
    expect(host.querySelector('[vw-access-button].active')).not.toBeNull();
    expect(host.querySelector('[vw-plugin-wrapper] .vw-plugin-top-wrapper')).not.toBeNull();
  });

  it('carrega o script self-hosted e inicializa o widget com o rootPath resolvido ao document.baseURI', async () => {
    const widget = vi.fn();
    (window as WindowWithVlibras).VLibras = { Widget: widget };
    TestBed.configureTestingModule({ imports: [VlibrasLoaderComponent] });
    fixture = TestBed.createComponent(VlibrasLoaderComponent);

    fixture.detectChanges();
    await fixture.whenStable();

    const script = document.getElementById('uniplus-vlibras-script') as HTMLScriptElement | null;
    const stylesheet = document.getElementById('uniplus-vlibras-stylesheet') as HTMLLinkElement | null;
    expect(script).not.toBeNull();
    expect(stylesheet).not.toBeNull();
    expect(stylesheet?.getAttribute('href')).toBe(
      new URL('assets/shared-ui/vlibras/vlibras.css', document.baseURI).toString(),
    );
    expect(stylesheet?.rel).toBe('stylesheet');
    expect(script?.getAttribute('src')).toBe(
      new URL('assets/shared-ui/vlibras/vlibras-plugin.js', document.baseURI).toString(),
    );

    script?.dispatchEvent(new Event('load'));

    expect(widget).toHaveBeenCalledWith(new URL('assets/shared-ui/vlibras', document.baseURI).toString());
  });

  it('executa o onload registrado pelo VLibras quando o script chega após o load da página', async () => {
    const pendingOnload = vi.fn();
    const widget = vi.fn(function Widget() {
      window.onload = pendingOnload;
    });
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
    (window as WindowWithVlibras).VLibras = { Widget: widget };
    TestBed.configureTestingModule({ imports: [VlibrasLoaderComponent] });
    fixture = TestBed.createComponent(VlibrasLoaderComponent);
    fixture.componentRef.setInput('scriptSrc', '/vlibras-plugin.js');

    fixture.detectChanges();
    await fixture.whenStable();
    document.getElementById('uniplus-vlibras-script')?.dispatchEvent(new Event('load'));
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(widget).toHaveBeenCalledWith(new URL('assets/shared-ui/vlibras', document.baseURI).toString());
    expect(pendingOnload).toHaveBeenCalledOnce();
  });

  it('reaponta imagens quebradas do VLibras para os assets self-hosted', () => {
    TestBed.configureTestingModule({ imports: [VlibrasLoaderComponent] });
    fixture = TestBed.createComponent(VlibrasLoaderComponent);
    fixture.detectChanges();

    const image = document.createElement('img');
    image.src = 'https://vlibras.gov.br/app//assets/brazil.png';
    document.body.appendChild(image);
    image.dispatchEvent(new Event('error'));

    expect(image.dataset['vwFixed']).toBe('1');
    expect(image.src).toBe(
      new URL('assets/shared-ui/vlibras/assets/brazil.png', document.baseURI).toString(),
    );
    image.remove();
  });

  describe('sob subpath (<base href> não-raiz, Feature #444)', () => {
    let base: HTMLBaseElement;

    beforeEach(() => {
      base = document.createElement('base');
      base.href = 'http://localhost:3000/portal/';
      document.head.appendChild(base);
    });

    afterEach(() => {
      base.remove();
    });

    it('resolve stylesheet, script e rootPath sob o mount point do subpath', async () => {
      expect(document.baseURI).toBe('http://localhost:3000/portal/');

      const widget = vi.fn();
      (window as WindowWithVlibras).VLibras = { Widget: widget };
      TestBed.configureTestingModule({ imports: [VlibrasLoaderComponent] });
      fixture = TestBed.createComponent(VlibrasLoaderComponent);

      fixture.detectChanges();
      await fixture.whenStable();

      const script = document.getElementById('uniplus-vlibras-script') as HTMLScriptElement | null;
      const stylesheet = document.getElementById('uniplus-vlibras-stylesheet') as HTMLLinkElement | null;
      expect(stylesheet?.getAttribute('href')).toBe(
        'http://localhost:3000/portal/assets/shared-ui/vlibras/vlibras.css',
      );
      expect(script?.getAttribute('src')).toBe(
        'http://localhost:3000/portal/assets/shared-ui/vlibras/vlibras-plugin.js',
      );

      script?.dispatchEvent(new Event('load'));

      expect(widget).toHaveBeenCalledWith('http://localhost:3000/portal/assets/shared-ui/vlibras');
    });
  });
});
