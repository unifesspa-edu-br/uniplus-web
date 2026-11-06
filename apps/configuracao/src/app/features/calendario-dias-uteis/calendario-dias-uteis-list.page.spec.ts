import { afterEach, describe, expect, it } from 'vitest';
import {
  CALENDARIO_ANTERIOR,
  CALENDARIO_VIGENTE,
  ESCRITA,
  LISTA,
  PaginaDaLista,
  TITULO_DA_LISTA,
  montarLista,
  problema,
  semConteudo,
} from './calendarios.testing';

describe('CalendarioDiasUteisListPage', () => {
  let p: PaginaDaLista;
  afterEach(() => p.http.verify());

  describe('leitura', () => {
    it('pede a primeira página com o limite da janela', async () => {
      p = await montarLista([]);
      p.store.recarregar();
      await p.propagar();
      const req = p.http.expectOne((r) => r.url === LISTA && r.method === 'GET');
      expect(req.request.params.get('limit')).toBe('50');
      req.flush([]);
      await p.propagar();
    });

    it('exibe o estado vazio com o convite a cadastrar o primeiro calendário', async () => {
      p = await montarLista([]);
      const texto = p.fixture.nativeElement.textContent as string;
      expect(texto).toContain('Nenhum calendário encontrado');
      expect(texto).toContain('Cadastre o primeiro calendário de dias úteis.');
    });

    it('exibe cada calendário com a versão, a vigência e a contagem de carregados', async () => {
      p = await montarLista();
      const linhas = p.fixture.nativeElement.querySelectorAll('tbody tr');
      expect(linhas).toHaveLength(2);
      expect(linhas[0].textContent).toContain('2026.1');
      expect(linhas[0].textContent).toContain('Vigente');
      expect(linhas[1].textContent).toContain('2025.2');
      expect(p.elemento('.list-count').textContent?.trim()).toBe('2');
      expect(p.store.calendarios()).toHaveLength(2);
    });

    it('expõe legenda acessível descrevendo a tabela', async () => {
      p = await montarLista([CALENDARIO_ANTERIOR]);
      const caption = p.elemento('table > caption');
      expect(caption.classList.contains('sr-only')).toBe(true);
      expect(caption.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Calendários de dias úteis, com versão, período de vigência e data de criação',
      );
    });

    it('navega para a próxima página pelo cursor do cabeçalho Link', async () => {
      p = await montarLista([]);
      p.store.recarregar();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA && r.method === 'GET')
        .flush([CALENDARIO_ANTERIOR], {
          headers: { Link: `<${LISTA}?cursor=pagina-2&direction=next>; rel="next"` },
        });
      await p.propagar();

      p.elemento<HTMLButtonElement>('[data-pager="next"]').click();
      await p.propagar();

      const req = p.http.expectOne((r) => r.url === LISTA && r.method === 'GET');
      expect(req.request.params.get('cursor')).toBe('pagina-2');
      expect(req.request.params.get('direction')).toBe('next');
      req.flush([]);
      await p.propagar();
    });
  });

  describe('recarga', () => {
    it('volta à primeira página, para a lista refletir o que foi gravado', async () => {
      p = await montarLista([]);
      p.store.recarregar();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA && r.method === 'GET')
        .flush([CALENDARIO_ANTERIOR], {
          headers: { Link: `<${LISTA}?cursor=pagina-2&direction=next>; rel="next"` },
        });
      await p.propagar();
      p.store.proximaPagina();
      await p.propagar();
      p.http.expectOne((r) => r.params.get('cursor') === 'pagina-2').flush([CALENDARIO_VIGENTE]);
      await p.propagar();

      p.store.recarregar();
      await p.propagar();

      const req = p.http.expectOne((r) => r.url === LISTA && r.method === 'GET');
      expect(req.request.params.has('cursor')).toBe(false);
      expect(req.request.params.get('limit')).toBe('50');
      req.flush([CALENDARIO_ANTERIOR]);
      await p.propagar();
    });

    it('"Tentar novamente" não repete a leitura enquanto ela corre', async () => {
      p = await montarLista([]);
      p.store.recarregar();
      await p.propagar();
      expect(p.store.carregando()).toBe(true);

      p.store.tentarNovamente();
      await p.propagar();

      p.http.expectOne((r) => r.url === LISTA && r.method === 'GET').flush([]);
      await p.propagar();
    });
  });

  describe('falha de leitura', () => {
    it('mostra o alerta, avisa por toast só a falha do servidor e permite tentar novamente', async () => {
      p = await montarLista([]);
      p.store.recarregar();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA && r.method === 'GET')
        .flush(...problema(503, { code: 'uniplus.internal.unexpected', title: 'Indisponível' }));
      await p.propagar();

      expect(p.elemento('ui-alert').textContent).toContain('Indisponível');
      expect(p.erros).toHaveBeenCalledTimes(1);
      const tentar = p.elemento<HTMLButtonElement>('ui-alert .list-state__retry button');
      await p.acionar(tentar);
      await p.recarregarCom([CALENDARIO_ANTERIOR]);
      expect(p.store.mensagemDeErro()).toBeNull();
      expect(document.querySelector('ui-alert')).toBeNull();
    });

    it('a recusa 4xx de leitura aparece no alerta, sem toast', async () => {
      p = await montarLista([]);
      p.store.recarregar();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA && r.method === 'GET')
        .flush(...problema(403, { code: 'uniplus.acesso_negado', title: 'Acesso negado' }));
      await p.propagar();

      expect(p.elemento('ui-alert').textContent).toContain('Acesso negado');
      expect(p.erros).not.toHaveBeenCalled();
    });
  });

  describe('ações da linha', () => {
    it('o calendário vigente não oferece marcar vigente nem remover, e diz por quê', async () => {
      p = await montarLista();
      expect(p.marcarVigente(CALENDARIO_VIGENTE).matches(':disabled')).toBe(true);
      expect(p.remover(CALENDARIO_VIGENTE).matches(':disabled')).toBe(true);
      const linha = p.elemento('tbody tr:first-child');
      expect(linha.textContent).toContain('Marque outro dataset como vigente');
      expect(linha.textContent).toContain(
        'Marque outro dataset como vigente antes de remover este',
      );
    });

    it('o calendário que não é vigente oferece marcar vigente e remover', async () => {
      p = await montarLista();
      expect(p.marcarVigente().matches(':disabled')).toBe(false);
      expect(p.remover().matches(':disabled')).toBe(false);
    });

    it('visualizar leva ao detalhe do calendário', async () => {
      p = await montarLista();
      expect(p.visualizar().getAttribute('href')).toBe(`/${CALENDARIO_ANTERIOR.id}`);
    });
  });

  describe('marcar vigente', () => {
    it('pede confirmação, envia sem corpo, avisa e recarrega a lista', async () => {
      p = await montarLista();
      const post = await p.confirmarVigencia();

      expect(post.request.method).toBe('POST');
      expect(post.request.body).toBeNull();
      post.flush(...semConteudo());
      await p.propagar();
      expect(p.sucessos).toHaveBeenCalledWith('Vigência de calendário atualizada');
      expect(p.edicao.confirmandoVigencia()).toBe(false);
      await p.recarregarCom([
        { ...CALENDARIO_VIGENTE, vigente: false },
        { ...CALENDARIO_ANTERIOR, vigente: true },
      ]);
      expect(p.edicao.gravando()).toBe(false);
      expect(p.statusDaPagina()).toBe('Calendário 2025.2 marcado como vigente.');
    });

    it('nomeia o calendário na confirmação e deixa cancelar sem enviar', async () => {
      p = await montarLista();
      await p.acionar(p.marcarVigente());

      expect(p.confirmacao('vigencia').textContent).toContain('2025.2');
      p.cancelarDaConfirmacao('vigencia').click();
      await p.propagar();
      expect(p.edicao.confirmandoVigencia()).toBe(false);
      p.http.expectNone(`${ESCRITA}/${CALENDARIO_ANTERIOR.id}/vigente`);
    });

    it('a confirmação em primário não se confunde com a remoção, que é em perigo', async () => {
      p = await montarLista();
      expect(p.confirmar('vigencia').classList.contains('btn--primary')).toBe(true);
      expect(p.confirmar('remocao').classList.contains('btn--danger')).toBe(true);
    });
  });

  describe('remover', () => {
    it('nomeia o calendário, envia a remoção, avisa e recarrega a lista', async () => {
      p = await montarLista();
      await p.acionar(p.remover());
      expect(p.confirmacao('remocao').textContent).toContain(
        'Você está prestes a remover o calendário',
      );
      expect(p.confirmacao('remocao').textContent).toContain('2025.2');
      p.confirmar().click();
      await p.propagar();

      const del = p.http.expectOne(`${ESCRITA}/${CALENDARIO_ANTERIOR.id}`);
      expect(del.request.method).toBe('DELETE');
      del.flush(...semConteudo());
      await p.propagar();
      expect(p.sucessos).toHaveBeenCalledWith('Calendário removido');
      expect(p.edicao.confirmandoRemocao()).toBe(false);
      await p.recarregarCom([CALENDARIO_VIGENTE]);
      expect(p.statusDaPagina()).toBe('Calendário 2025.2 removido.');
      expect(p.fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(1);
    });

    it('Cancelar fecha a confirmação sem remover', async () => {
      p = await montarLista();
      await p.acionar(p.remover());
      p.cancelarDaConfirmacao().click();
      await p.propagar();

      expect(p.edicao.confirmandoRemocao()).toBe(false);
      p.http.expectNone(`${ESCRITA}/${CALENDARIO_ANTERIOR.id}`);
    });
  });

  it('o título da lista é destino de foco programático', async () => {
    p = await montarLista();
    expect(p.elemento(TITULO_DA_LISTA).getAttribute('tabindex')).toBe('-1');
  });
});
