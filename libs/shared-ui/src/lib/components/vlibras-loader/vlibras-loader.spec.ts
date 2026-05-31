import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('carrega o script e inicializa o widget com o rootPath oficial', async () => {
    const widget = vi.fn();
    (window as WindowWithVlibras).VLibras = { Widget: widget };
    TestBed.configureTestingModule({ imports: [VlibrasLoaderComponent] });
    fixture = TestBed.createComponent(VlibrasLoaderComponent);
    fixture.componentRef.setInput('scriptSrc', '/vlibras-plugin.js');
    fixture.componentRef.setInput('rootPath', 'https://vlibras.gov.br/app');

    fixture.detectChanges();
    await fixture.whenStable();

    const script = document.getElementById('uniplus-vlibras-script') as HTMLScriptElement | null;
    expect(script).not.toBeNull();
    expect(script?.getAttribute('src')).toBe('/vlibras-plugin.js');

    script?.dispatchEvent(new Event('load'));

    expect(widget).toHaveBeenCalledWith('https://vlibras.gov.br/app');
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

    expect(widget).toHaveBeenCalledWith();
    expect(pendingOnload).toHaveBeenCalledOnce();
  });

  it('reaponta imagens quebradas do VLibras para o mirror documentado pelo DS', () => {
    TestBed.configureTestingModule({ imports: [VlibrasLoaderComponent] });
    fixture = TestBed.createComponent(VlibrasLoaderComponent);
    fixture.detectChanges();

    const image = document.createElement('img');
    image.src = 'https://vlibras.gov.br/app//assets/brazil.png';
    document.body.appendChild(image);
    image.dispatchEvent(new Event('error'));

    expect(image.dataset['vwFixed']).toBe('1');
    expect(image.src).toBe('https://cdn.jsdelivr.net/gh/spbgovbr-vlibras/vlibras-portal@master/app/assets/brazil.png');
    image.remove();
  });
});
