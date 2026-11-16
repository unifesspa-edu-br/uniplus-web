import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LB_PPI, PaginaDaModalidade } from './modalidade-form.page.testing';
import { AC, URL } from './modalidades-de-teste.testing';
import { ModalidadeFormStore } from './modalidade-form.store';

describe('ModalidadeFormPage', () => {
  let pagina: PaginaDaModalidade;

  beforeEach(() => {
    pagina = new PaginaDaModalidade();
  });

  afterEach(() => {
    pagina.verificar();
  });

  it('percorre todas as páginas de modalidades vivas sem truncar', async () => {
    pagina.criar();

    TestBed.tick();
    const pagina1 = pagina.controller.expectOne(
      (r) => r.url === URL && r.params.get('limit') === '100',
    );
    pagina1.flush([AC], {
      headers: { Link: `<${URL}?cursor=pagina-2&direction=next>; rel="next"` },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    pagina.fixture.detectChanges();
    TestBed.tick();
    const pagina2 = pagina.controller.expectOne(
      (r) => r.url === URL && r.params.get('cursor') === 'pagina-2',
    );
    expect(pagina2.request.params.get('direction')).toBe('next');
    pagina2.flush([LB_PPI]);

    await new Promise((resolve) => setTimeout(resolve, 0));
    pagina.fixture.detectChanges();
    TestBed.tick();
    const store = pagina.fixture.debugElement.injector.get(ModalidadeFormStore);
    expect(store.opcoes()).toHaveLength(2);
    expect(store.opcoes().map((m) => m.codigo)).toEqual(['AC', 'LB_PPI']);
  });

  describe('opções de referência lidas por páginas', () => {
    const problema = (status: number, code: string) =>
      [
        { type: 'about:blank', title: 'Erro', status, code },
        { status, statusText: 'Erro', headers: { 'Content-Type': 'application/problem+json' } },
      ] as const;
    const comCursor = (r: { url: string; params: { get(n: string): string | null } }) =>
      r.url === URL && r.params.get('cursor') === 'pagina-2';
    const aviso = (): HTMLElement | null =>
      [...pagina.fixture.nativeElement.querySelectorAll('ui-falha-de-leitura')].find(
        (a: HTMLElement) => a.textContent?.includes('modalidades de referência'),
      ) ?? null;

    /** Primeira página lida, com continuação; a segunda responde com o desfecho dado. */
    async function naSegundaPagina(
      desfecho: ReturnType<typeof problema>,
    ): Promise<ModalidadeFormStore> {
      pagina.criar();
      TestBed.tick();
      pagina.controller
        .expectOne((r) => r.url === URL && r.params.get('limit') === '100')
        .flush([AC], { headers: { Link: `<${URL}?cursor=pagina-2&direction=next>; rel="next"` } });
      await pagina.atualizar();
      pagina.controller.expectOne(comCursor).flush(desfecho[0], desfecho[1]);
      await pagina.atualizar();
      return pagina.fixture.debugElement.injector.get(ModalidadeFormStore);
    }

    it('a falha na segunda página avisa o que falta nos campos, e a nova tentativa completa as opções', async () => {
      const store = await naSegundaPagina(problema(500, 'uniplus.erro'));

      expect(aviso()?.textContent).toContain('Os campos Origem, Destino, Par e Fallback');
      expect(store.opcoes()).toEqual([]);

      aviso()?.querySelector('button')?.click();
      await pagina.atualizar();
      pagina.controller.expectOne(comCursor).flush([LB_PPI]);
      await pagina.atualizar();

      expect(aviso()).toBeNull();
      expect(store.opcoes().map((m) => m.codigo)).toEqual(['AC', 'LB_PPI']);
    });

    it('o cursor expirado no meio do laço recomeça da primeira página sem duplicar opção', async () => {
      const store = await naSegundaPagina(problema(410, 'uniplus.cursor.expirado'));

      pagina.controller.expectOne((r) => r.url === URL && !r.params.has('cursor')).flush([AC]);
      await pagina.atualizar();

      expect(store.opcoes().map((m) => m.codigo)).toEqual(['AC']);
      expect(aviso()).toBeNull();
    });

    it('com a lista em falha nada é marcado sobre o código, e o repetido é acusado quando ela chega', async () => {
      await naSegundaPagina(problema(500, 'uniplus.erro'));
      const codigo = pagina.edicao.form.controls.codigo;
      codigo.setValue('AC');

      pagina.edicao.verificarCodigoDuplicado();
      expect(codigo.hasError('duplicado')).toBe(false);

      aviso()?.querySelector('button')?.click();
      await pagina.atualizar();
      pagina.controller.expectOne(comCursor).flush([LB_PPI]);
      await pagina.atualizar();
      pagina.edicao.verificarCodigoDuplicado();
      expect(codigo.hasError('duplicado')).toBe(true);
    });
  });
});
