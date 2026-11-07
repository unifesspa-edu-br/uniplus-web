import { afterEach, describe, expect, it } from 'vitest';
import { buildVendorMimeAccept } from '@uniplus/shared-core/http';
import {
  LISTA,
  Pagina,
  TIPOS_URL,
  TITULO_DA_LISTA,
  corpoDaFalha,
  decreto,
  montarPagina,
  portaria,
  problema,
} from './base-legal-bonus-regional.testing';

const LINK_PROXIMA =
  '</api/configuracao/base-legal-bonus-regional?cursor=abc&direction=next>; rel="next"';
const LINK_ANTERIOR =
  '</api/configuracao/base-legal-bonus-regional?cursor=xyz&direction=prev>; rel="prev"';

describe('BaseLegalBonusRegionalPage — leitura', () => {
  let p: Pagina;
  afterEach(() => p.http.verify());

  const linhas = (): HTMLElement[] => [...p.fixture.nativeElement.querySelectorAll('tbody tr')];
  const botaoDoPager = (nome: string): HTMLButtonElement =>
    [...p.fixture.nativeElement.querySelectorAll('ui-pager button')].find(
      (b: HTMLElement) => b.textContent?.trim() === nome,
    );
  const buscar = async (termo: string): Promise<void> => {
    const campo = p.elemento<HTMLInputElement>('input[type="search"]');
    campo.value = termo;
    campo.dispatchEvent(new Event('input'));
    await p.propagar();
  };

  describe('lista', () => {
    it('mostra o nome do tipo, a identificação e a quantidade de municípios de cada base', async () => {
      p = await montarPagina([portaria, decreto]);

      expect(linhas()).toHaveLength(2);
      const celulas = [...linhas()[0].querySelectorAll('td')].map((c) => c.textContent?.trim());
      expect(celulas.slice(0, 3)).toEqual(['Portaria', 'Portaria Unifesspa nº 2514/2023', '1']);
    });

    it('pede a primeira página com o limite da tela e os tipos de mídia versionados', async () => {
      p = await montarPagina([portaria]);
      p.store.recarregar();
      await p.propagar();
      const lista = p.http.expectOne((r) => r.url === LISTA);

      expect(lista.request.params.get('limit')).toBe('50');
      expect(lista.request.headers.get('Accept')).toBe(
        buildVendorMimeAccept('base-legal-bonus-regional', 1),
      );
      lista.flush([portaria]);
      await p.propagar();
    });

    it('expõe uma legenda acessível e oculta que descreve a tabela', async () => {
      p = await montarPagina([portaria]);

      const legenda = p.elemento('table > caption');
      expect(legenda.classList.contains('sr-only')).toBe(true);
      expect(legenda.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Bases legais do bônus regional, com tipo de instrumento, identificação e quantidade de municípios beneficiados',
      );
    });

    it('nomeia as ações pela identificação da base, nunca pelo identificador técnico', async () => {
      p = await montarPagina([portaria]);

      const acoes = [
        ...p.fixture.nativeElement.querySelectorAll('.table-responsive__actions button'),
      ];
      const nomes = acoes.map((b: HTMLElement) => b.getAttribute('aria-label'));
      expect(nomes).toEqual([
        'Editar base legal Portaria Unifesspa nº 2514/2023',
        'Remover base legal de bônus regional Portaria Unifesspa nº 2514/2023',
      ]);
      expect(acoes[1].getAttribute('data-tooltip')).toBe('Remover base legal de bônus regional');
      for (const nome of nomes) expect(nome).not.toContain(portaria.id);
    });

    it('sem bases cadastradas, convida a cadastrar a primeira', async () => {
      p = await montarPagina([]);

      expect(p.fixture.nativeElement.textContent).toContain('Nenhuma base legal cadastrada');
      p.elemento<HTMLButtonElement>('ui-empty-state button').click();
      await p.propagar();
      expect(p.edicao.aberto()).toBe(true);
    });
  });

  describe('busca', () => {
    it('recorta a página carregada pela identificação, sem pedir nada ao servidor', async () => {
      p = await montarPagina([portaria, decreto]);

      await buscar('lei estadual');

      expect(linhas()).toHaveLength(1);
      expect(linhas()[0].textContent).toContain(decreto.identificacao);
      p.http.expectNone((r) => r.url === LISTA);
    });

    it('sem resultado, avisa e "Limpar busca" devolve a lista', async () => {
      p = await montarPagina([portaria, decreto]);
      await buscar('nada disso');

      expect(p.fixture.nativeElement.textContent).toContain('Nenhuma base legal encontrada');
      const limpar = [...p.fixture.nativeElement.querySelectorAll('ui-empty-state button')].find(
        (b: HTMLElement) => b.textContent?.includes('Limpar busca'),
      ) as HTMLButtonElement;
      limpar.click();
      await p.propagar();
      expect(linhas()).toHaveLength(2);
    });
  });

  describe('paginação', () => {
    it('segue pelo cursor, volta pelo anterior e recomeça da primeira página ao recarregar', async () => {
      p = await montarPagina([portaria]);
      p.store.recarregar();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA)
        .flush([portaria], { headers: { Link: LINK_PROXIMA } });
      await p.propagar();

      botaoDoPager('Próximo').click();
      await p.propagar();
      const segunda = p.http.expectOne((r) => r.params.get('cursor') === 'abc');
      expect(segunda.request.params.get('direction')).toBe('next');
      segunda.flush([decreto], { headers: { Link: LINK_ANTERIOR } });
      await p.propagar();
      expect(p.store.bases()).toEqual([decreto]);

      botaoDoPager('Anterior').click();
      await p.propagar();
      const volta = p.http.expectOne((r) => r.params.get('cursor') === 'xyz');
      expect(volta.request.params.get('direction')).toBe('prev');
      volta.flush([portaria]);
      await p.propagar();
      expect(p.store.bases()).toEqual([portaria]);

      p.store.recarregar();
      await p.propagar();
      const primeira = p.http.expectOne((r) => r.url === LISTA);
      expect(primeira.request.params.has('cursor')).toBe(false);
      primeira.flush([portaria]);
      await p.propagar();
      expect(p.store.bases()).toEqual([portaria]);
    });

    it('um cursor recusado reinicia a listagem do começo, sem alerta, em vez de repetir a página quebrada', async () => {
      p = await montarPagina([portaria]);
      p.store.recarregar();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA)
        .flush([portaria], { headers: { Link: LINK_PROXIMA } });
      await p.propagar();
      p.store.proximaPagina();
      await p.propagar();
      p.http
        .expectOne((r) => r.params.get('cursor') === 'abc')
        .flush(...problema(410, { code: 'uniplus.cursor.expirado' }));
      await p.propagar();

      const reiniciada = p.http.expectOne((r) => r.url === LISTA);
      expect(reiniciada.request.params.has('cursor')).toBe(false);
      expect(p.store.carregando()).toBe(true);
      expect(
        p.fixture.nativeElement.querySelector('ui-alert .list-state__retry button'),
      ).toBeNull();
      reiniciada.flush([portaria]);
      await p.propagar();
    });
  });

  describe('falha de leitura da lista', () => {
    it('5xx avisa por toast e oferece "Tentar novamente", que devolve o foco ao título', async () => {
      p = await montarPagina([portaria]);
      p.store.recarregar();
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA).flush(...problema(503, corpoDaFalha(503)));
      await p.propagar();
      expect(p.erros).toHaveBeenCalledTimes(1);
      expect(p.fixture.nativeElement.textContent).not.toContain('Nenhuma base legal cadastrada');

      const tentar = p.elemento<HTMLButtonElement>('ui-alert .list-state__retry button');
      tentar.focus();
      tentar.click();
      await p.propagar();
      expect(tentar.getAttribute('aria-disabled')).toBe('true');
      expect(tentar.getAttribute('aria-busy')).toBe('true');
      await p.recarregarCom([portaria]);
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });

    it('4xx mostra o alerta sem toast', async () => {
      p = await montarPagina([portaria]);
      p.store.recarregar();
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA).flush(...problema(403, corpoDaFalha(403)));
      await p.propagar();

      expect(p.elemento('ui-alert .list-state__retry button')).toBeTruthy();
      expect(p.erros).not.toHaveBeenCalled();
    });

    it('falha sem resposta da API mostra a mensagem geral, e não a lista vazia', async () => {
      p = await montarPagina([portaria]);
      p.store.recarregar();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA)
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
      await p.propagar();

      expect(p.store.mensagemDeErro()).toBe('Não foi possível conectar ao servidor');
      expect(p.fixture.nativeElement.textContent).not.toContain('Nenhuma base legal cadastrada');
    });
  });

  describe('vocabulário de tipos de instrumento', () => {
    it('pede o vocabulário com o tipo de mídia versionado', async () => {
      p = await montarPagina([portaria], 'pendente');
      const pedido = p.http.expectOne((r) => r.url === TIPOS_URL);

      expect(pedido.request.headers.get('Accept')).toBe(
        buildVendorMimeAccept('codigo-tipo-instrumento-normativo', 1),
      );
      pedido.flush([]);
    });

    it('enquanto carrega, a lista diz "Carregando…" em vez de um rótulo falso', async () => {
      p = await montarPagina([portaria], 'pendente');

      expect(linhas()[0].querySelector('td')?.textContent).toContain('Carregando…');
      p.http
        .expectOne((r) => r.url === TIPOS_URL)
        .flush([{ codigo: 'PORTARIA', nome: 'Portaria' }]);
      await p.propagar();
      expect(linhas()[0].querySelector('td')?.textContent).toContain('Portaria');
    });

    it('um tipo que o vocabulário não conhece aparece como não identificado', async () => {
      p = await montarPagina([{ ...portaria, tipoInstrumento: 'PARECER_ANTIGO' }]);

      expect(linhas()[0].querySelector('td')?.textContent).toContain('Não identificado');
    });

    it('a falha avisa na página, marca a coluna e a nova tentativa devolve o foco ao título', async () => {
      p = await montarPagina([portaria], { falha: 503 });

      expect(linhas()[0].querySelector('td')?.textContent).toContain('Não carregado');
      expect(p.erros).toHaveBeenCalledTimes(1);
      const alerta = p.elemento('ui-alerta-nova-tentativa');
      expect(alerta.textContent).toContain('Tipos de instrumento não carregados');
      const tentar = alerta.querySelector('button') as HTMLButtonElement;
      tentar.focus();
      tentar.click();
      await p.propagar();
      expect(tentar.getAttribute('aria-disabled')).toBe('true');
      p.http
        .expectOne((r) => r.url === TIPOS_URL)
        .flush([{ codigo: 'PORTARIA', nome: 'Portaria' }]);
      await p.propagar();

      expect(p.fixture.nativeElement.querySelector('ui-alerta-nova-tentativa')).toBeNull();
      expect(linhas()[0].querySelector('td')?.textContent).toContain('Portaria');
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });

    it('a falha por falta de permissão não gera toast', async () => {
      p = await montarPagina([portaria], { falha: 403 });

      expect(p.elemento('ui-alerta-nova-tentativa')).toBeTruthy();
      expect(p.erros).not.toHaveBeenCalled();
    });
  });
});
