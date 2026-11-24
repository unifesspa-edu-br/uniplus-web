import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CAMPI,
  CAMPUS_MARABA,
  LIMITE_MAXIMO_API,
  LOCAL_DE_TESTE,
  PaginaDeLocais,
  carregarLista,
  clicarEmNovoLocal,
  esperarLookup,
  montarPaginaIniciada,
} from './locais-oferta.pagina.testing';
import { LocalOfertaDto } from '@uniplus/shared-data/configuracao';

describe('LocaisOfertaPage — campi responsáveis', () => {
  let pagina: PaginaDeLocais;

  beforeEach(() => {
    pagina = montarPaginaIniciada();
  });

  afterEach(() => pagina.controller.verify());

  const comCampus = (campusResponsavelId: string): LocalOfertaDto => ({
    ...LOCAL_DE_TESTE,
    campusResponsavelId,
  });
  const opcoesDeCampi = (): string[] =>
    pagina.store.campi.opcoes().map((campus) => `${campus.sigla} — ${campus.nome}`);
  const celulaDoCampus = (): HTMLElement =>
    pagina.fixture.nativeElement.querySelector('td[data-label="Campus responsável"]');
  const avisoDeCampi = (): HTMLElement | null =>
    pagina.fixture.nativeElement.querySelector('.alert--warning');

  it('pede o máximo de uma página da API no lookup de campi responsáveis', async () => {
    await carregarLista(pagina, []);
    clicarEmNovoLocal(pagina);
    await pagina.propagar();
    const campi = esperarLookup(pagina, CAMPI);
    campi.flush([]);

    // O valor pedido é o teto da API, não um número escolhido à toa: acima
    // dele a resposta é 422 e o select fica sem opção.
    expect(campi.request.params.get('limit')).toBe(String(LIMITE_MAXIMO_API));
  });

  it('cancela o lookup de campi anterior ao clicar "Tentar novamente" antes da resposta chegar', async () => {
    await carregarLista(pagina, []);
    clicarEmNovoLocal(pagina);
    await pagina.propagar();

    const primeira = esperarLookup(pagina, CAMPI);

    pagina.store.campi.recarregar();
    await pagina.propagar();

    // A primeira travessia precisa ter sido cancelada de verdade (não só
    // ignorada) — senão ela ainda pode ganhar a corrida se responder por
    // último, sobrescrevendo o resultado da segunda com dado obsoleto.
    expect(primeira.cancelled).toBe(true);

    esperarLookup(pagina, CAMPI).flush([CAMPUS_MARABA]);
    await pagina.propagar();

    expect(pagina.store.campi.opcoes()).toHaveLength(1);

    // Se a primeira ainda estivesse "viva", flush aqui explodiria (request já
    // consumido) ou reabriria uma disputa — confirma que não sobra nada pendente.
    pagina.controller.verify();
  });

  it('I1: lista com local vinculado dispara o lookup de campi e exibe a sigla/nome', async () => {
    await carregarLista(pagina, [comCampus('cmp1')]);
    await pagina.propagar();
    esperarLookup(pagina, CAMPI).flush([CAMPUS_MARABA]);
    await pagina.propagar();
    expect(opcoesDeCampi()[0]).toBe('MAB — Campus de Marabá');
  });

  // A coluna resolvia o campus por lookup e, quando a busca falhava, trocava o
  // rótulo por "Vinculado" — texto de aparência normal que escondia a falha
  // Cada desfecho agora tem marcador próprio.
  it('lookup de campi recusado sinaliza a coluna e oferece recarregar', async () => {
    const { fixture, propagar } = pagina;
    await carregarLista(pagina, [comCampus('cmp1')]);
    await propagar();
    esperarLookup(pagina, CAMPI).flush({}, { status: 500, statusText: 'Server Error' });
    await propagar();
    fixture.detectChanges();

    expect(celulaDoCampus().querySelector('.lookup-label--failed')?.textContent?.trim()).toBe(
      'Não carregado',
    );
    expect(avisoDeCampi()?.textContent).toContain('Recarregar campi');

    const botaoRecarregar: HTMLButtonElement =
      fixture.nativeElement.querySelector('.alert--warning button');
    botaoRecarregar.focus();
    botaoRecarregar.click();
    await propagar();
    fixture.detectChanges();
    esperarLookup(pagina, CAMPI).flush([CAMPUS_MARABA]);
    await propagar();
    fixture.detectChanges();

    expect(avisoDeCampi()).toBeNull();
    expect(celulaDoCampus().textContent).toContain('MAB — Campus de Marabá');
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('#cfg-locais-list-title'),
    );
  });

  describe('"Recarregar campi" da lista com a lista ocupada', () => {
    const recarregarCampi = (): HTMLButtonElement =>
      pagina.fixture.nativeElement.querySelector('ui-lookup-alert button');

    async function comCampiEmFalha(): Promise<void> {
      await carregarLista(pagina, [comCampus('cmp1')]);
      await pagina.propagar();
      esperarLookup(pagina, CAMPI).flush({}, { status: 500, statusText: 'Server Error' });
      await pagina.propagar();
      pagina.fixture.detectChanges();
    }

    it('com a gravação e a recarga pendentes, fica indisponível e não pede os campi', async () => {
      const { controller, edicao, fixture, propagar } = pagina;
      await comCampiEmFalha();
      expect(recarregarCampi().getAttribute('aria-disabled')).toBeNull();

      edicao.pedirRemocao(LOCAL_DE_TESTE);
      edicao.removerConfirmado();
      await propagar();
      fixture.detectChanges();
      expect(edicao.gravando()).toBe(true);
      expect(recarregarCampi().getAttribute('aria-disabled')).toBe('true');
      recarregarCampi().click();
      controller.expectNone((r) => r.url === CAMPI);

      controller.expectOne((r) => r.method === 'DELETE').flush(null);
      await propagar();
      fixture.detectChanges();
      expect(recarregarCampi().getAttribute('aria-disabled')).toBe('true');
      recarregarCampi().click();
      controller.expectNone((r) => r.url === CAMPI);

      await carregarLista(pagina, [LOCAL_DE_TESTE]);
      fixture.detectChanges();
      expect(recarregarCampi().getAttribute('aria-disabled')).toBeNull();
    });

    it('com a lista em carga, fica indisponível e não pede os campi', async () => {
      await comCampiEmFalha();

      pagina.store.tentarNovamente();
      await pagina.propagar();
      pagina.fixture.detectChanges();
      expect(recarregarCampi().getAttribute('aria-disabled')).toBe('true');
      recarregarCampi().click();
      pagina.controller.expectNone((r) => r.url === CAMPI);

      await carregarLista(pagina, [LOCAL_DE_TESTE]);
      pagina.fixture.detectChanges();
      expect(recarregarCampi().getAttribute('aria-disabled')).toBeNull();
    });
  });

  it('campus fora do catálogo carregado é "não identificado", não "não carregado"', async () => {
    await carregarLista(pagina, [comCampus('cmp-removido')]);
    await pagina.propagar();
    // Catálogo íntegro, sem o id da linha: o vínculo é que está quebrado —
    // esperar ou tentar de novo não resolve, e o marcador precisa dizer isso.
    esperarLookup(pagina, CAMPI).flush([]);
    await pagina.propagar();
    pagina.fixture.detectChanges();

    expect(celulaDoCampus().querySelector('.lookup-label--missing')?.textContent?.trim()).toBe(
      'Não identificado',
    );
    expect(avisoDeCampi()).toBeNull();
  });

  it('local sem campus responsável mostra o traço, não marcador de lookup', async () => {
    await carregarLista(pagina, [{ ...LOCAL_DE_TESTE, campusResponsavelId: null }]);
    await pagina.propagar();
    pagina.fixture.detectChanges();

    expect(celulaDoCampus().textContent?.trim()).toBe('—');
    expect(celulaDoCampus().querySelector('.lookup-label')).toBeNull();
  });

  it('percorre todas as páginas do lookup de campi sem truncar', async () => {
    await carregarLista(pagina, []);
    clicarEmNovoLocal(pagina);
    await pagina.propagar();

    esperarLookup(pagina, CAMPI).flush([CAMPUS_MARABA], {
      headers: { Link: `<${CAMPI}?cursor=pagina-2&direction=next>; rel="next"` },
    });
    await pagina.propagar();

    // Segunda página vem só com o cursor — sem `limit`, por contrato do client
    // gerado — então não reaproveita `esperarLookup` (que exige `limit`).
    const pagina2 = pagina.controller.expectOne((r) => r.url === CAMPI);
    expect(pagina2.request.params.get('cursor')).toBe('pagina-2');
    expect(pagina2.request.params.get('direction')).toBe('next');
    pagina2.flush([{ ...CAMPUS_MARABA, id: 'cmp2', sigla: 'XIN', nome: 'Campus de Xinguara' }]);
    await pagina.propagar();

    expect(pagina.store.campi.opcoes()).toHaveLength(2);
    expect(opcoesDeCampi()[0]).toBe('MAB — Campus de Marabá');
    expect(opcoesDeCampi()[1]).toBe('XIN — Campus de Xinguara');
  });
});
