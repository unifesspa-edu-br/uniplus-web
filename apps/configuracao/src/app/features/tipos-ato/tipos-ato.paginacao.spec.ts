import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LISTA, Pagina, aviso, montarPagina, preliminar, problema } from './tipos-ato.testing';
import {
  TEXTO_TENTANDO,
  situacaoDoAlerta,
} from '../../shared/foco/situacao-da-nova-tentativa.testing';

describe('TiposAtoPage', () => {
  let p: Pagina;
  beforeEach(async () => {
    p = await montarPagina([preliminar, aviso]);
  });
  afterEach(() => p.http.verify());
  describe('paginação', () => {
    async function carregarComCursor(cursor: string, direction: 'next' | 'prev') {
      p.store.recarregar();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA)
        .flush(cursor === 'PROXIMA' ? [preliminar, aviso] : [preliminar], {
          headers: {
            Link: `<${LISTA}?cursor=${cursor}&direction=${direction}>; rel="${direction}"`,
          },
        });
      await p.propagar();
    }

    async function avancarParaCursor() {
      p.store.proximaPagina();
      await p.propagar();
    }

    async function verificarRetornoAoInicio() {
      p.store.recarregar();
      await p.propagar();
      const primeira = p.http.expectOne((r) => r.url === LISTA);
      expect(primeira.request.params.has('cursor')).toBe(false);
      primeira.flush([preliminar]);
      await p.propagar();
      expect(p.store.atos()).toEqual([preliminar]);
    }

    async function falharNaProximaPagina(status: number, code?: string) {
      await avancarParaCursor();
      p.http
        .expectOne((r) => r.params.get('cursor') === 'abc')
        .flush(...problema(status, code ? { code } : undefined));
      await p.propagar();
    }

    async function tentarNovamenteComCursorExpirado() {
      p.elemento<HTMLButtonElement>('ui-alerta-nova-tentativa button').click();
      await p.propagar();
      p.http
        .expectOne((r) => r.params.get('cursor') === 'abc')
        .flush(...problema(410, { code: 'uniplus.cursor.expirado' }));
      await Promise.resolve();
      expect(p.store.mensagemDeErro()).toBeNull();
      expect(p.store.carregando()).toBe(true);
      await p.propagar();
    }

    it('avisa quando a busca não alcança o catálogo inteiro', async () => {
      await carregarComCursor('PROXIMA', 'next');
      expect(p.fixture.nativeElement.textContent).not.toContain('a busca alcança só a que está');
      const busca = p.elemento<HTMLInputElement>('input[type="search"]');
      busca.value = 'inexistente';
      busca.dispatchEvent(new Event('input'));
      await p.propagar();
      expect(p.fixture.nativeElement.textContent).toContain(
        'a busca alcança só a que está carregada',
      );
      expect(p.fixture.nativeElement.textContent).toContain(
        'A busca alcança só a página carregada — ajuste o termo ou navegue pelas páginas.',
      );
    });

    it('segue pelo cursor e volta à primeira página ao recarregar', async () => {
      await carregarComCursor('abc', 'next');
      await avancarParaCursor();
      const proxima = p.http.expectOne((r) => r.params.get('cursor') === 'abc');
      expect(proxima.request.params.get('direction')).toBe('next');
      expect(proxima.request.params.get('vigentes')).toBe('false');
      proxima.flush([aviso]);
      await p.propagar();
      expect(p.store.atos()).toEqual([aviso]);

      await verificarRetornoAoInicio();
    });
    it.each([
      [400, 'uniplus.cursor.invalido', 'A paginação foi reiniciada porque a consulta mudou.'],
      [
        410,
        'uniplus.cursor.expirado',
        'A listagem ficou aberta tempo demais e a consulta expirou.',
      ],
    ] as const)(
      'cursor recusado (%s) recomeça do início, avisa e não mostra o alerta de falha',
      async (status, code, aviso) => {
        await carregarComCursor('abc', 'next');
        await falharNaProximaPagina(status, code);
        expect(p.store.mensagemDeErro()).toBeNull();
        expect(p.informacoes).toHaveBeenCalledWith(aviso, 'Recarregamos a listagem do começo.');
        const recarga = p.http.expectOne((r) => r.url === LISTA);
        expect(recarga.request.params.has('cursor')).toBe(false);
        recarga.flush([preliminar]);
        await p.propagar();
      },
    );

    it('a nova tentativa recusada por cursor expirado segue em andamento até a leitura do começo terminar', async () => {
      const TITULO = 'Não foi possível carregar os tipos de ato';
      await carregarComCursor('abc', 'next');
      await falharNaProximaPagina(500);
      await tentarNovamenteComCursorExpirado();
      expect(situacaoDoAlerta(p.fixture.nativeElement, TITULO)).toBe(TEXTO_TENTANDO);
      p.http.expectOne((r) => r.url === LISTA && !r.params.has('cursor')).flush([aviso]);
      await p.propagar();
      expect(p.fixture.nativeElement.querySelector('ui-alerta-nova-tentativa')).toBeNull();
    });

    it('volta à página anterior pelo cursor que a resposta indicou', async () => {
      await carregarComCursor('ant', 'prev');
      p.store.paginaAnterior();
      await p.propagar();
      const anterior = p.http.expectOne((r) => r.params.get('cursor') === 'ant');
      expect(anterior.request.params.get('direction')).toBe('prev');
      anterior.flush([aviso]);
      await p.propagar();
      expect(p.store.atos()).toEqual([aviso]);
    });
  });
});
