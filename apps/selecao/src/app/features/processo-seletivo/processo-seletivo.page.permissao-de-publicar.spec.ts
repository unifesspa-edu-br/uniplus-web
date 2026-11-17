import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { ProcessoSeletivoPage } from './processo-seletivo.page';
import { concedeSoPublicar, configurarPagina } from './processo-seletivo.page.testing';

describe('ProcessoSeletivoPage — permissão de publicar', () => {
  const ID = '11111111-1111-4111-8111-111111111111';

  beforeEach(configurarPagina);

  function montarNoUltimoPasso(permissoes: (codigo: string) => boolean) {
    TestBed.overrideProvider(PermissoesService, { useValue: { tem: permissoes } });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ProcessoSeletivoPage);
    fixture.detectChanges();
    const { store } = fixture.componentInstance;
    store.processoSeletivoId.set(ID);
    store.goTo(store.totalDePassos - 1);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const textoDosBotoes = () =>
      Array.from(host.querySelectorAll('.wiz-footer button')).map(
        (botao) => botao.textContent?.trim() ?? '',
      );
    return { fixture, page: fixture.componentInstance, store, host, textoDosBotoes };
  }

  it('com a permissão de publicar, oferece publicar', () => {
    const { textoDosBotoes } = montarNoUltimoPasso(concedeSoPublicar);

    expect(textoDosBotoes()).toEqual(expect.arrayContaining(['Publicar']));
  });

  it('só com configurar, não oferece publicar, e o avanço não publica', async () => {
    const { fixture, page, store, textoDosBotoes } = montarNoUltimoPasso(
      (codigo) => codigo === 'selecao:processos:configurar',
    );

    expect(textoDosBotoes()).not.toContain('Publicar');

    await page.nextOrPublish();
    fixture.detectChanges();
    expect(store.erroDoPasso()).toBeNull();
  });
});
