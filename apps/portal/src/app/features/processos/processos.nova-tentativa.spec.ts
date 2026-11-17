import { TestBed } from '@angular/core/testing';
import { AnuncioDaConclusao } from '@uniplus/shared-ui/components';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CERTAMES_URL,
  CenarioDaVitrine,
  contadoresComProximaPagina,
  contadoresHeaders,
  sisu,
  tecnicoEnfermagem,
} from './processos.testing';

const ERRO_INTERNO = 'uniplus.infra.erro_interno';
const CURSOR_EXPIRADO = 'uniplus.cursor.expirado';

describe('ProcessosComponent — nova tentativa e página que falha', () => {
  let cenario: CenarioDaVitrine;

  beforeEach(() => {
    cenario = new CenarioDaVitrine();
  });

  afterEach(() => cenario.encerrar());

  async function falharNaSegundaPagina(status: number, codigo: string): Promise<void> {
    await cenario.responderLista([sisu], contadoresComProximaPagina);
    cenario.vitrine().proximaPagina();
    await cenario.propagar();
    await cenario.responderComProblema(status, codigo);
    cenario.fixture.detectChanges();
  }

  async function falharAoFiltrarPorSituacao(): Promise<void> {
    await cenario.responderLista([sisu], contadoresHeaders);
    cenario.vitrine().situacaoSelecionada.set('INSCRICOES_ABERTAS');
    await cenario.propagar();
    await cenario.responderComProblema(500, ERRO_INTERNO);
    cenario.fixture.detectChanges();
  }

  it('estado de erro (500) mostra mensagem e ação de tentar novamente', async () => {
    await cenario.responderComProblema(500, ERRO_INTERNO, 'Erro interno ao consultar certames');
    cenario.fixture.detectChanges();

    const alerta = cenario.host().querySelector('.alert--danger');
    expect(alerta?.textContent).toContain('Erro interno ao consultar certames');
    // Busca e chips continuam de pé: quando é o recorte que a API recusa,
    // desfazê-lo é a saída.
    expect(cenario.host().querySelector('ui-filter-bar')).toBeTruthy();
    expect(cenario.chip('Últimos dias')).toBeTruthy();

    const tentar = cenario.botao('Tentar novamente');
    expect(tentar).toBeTruthy();
    tentar?.click();
    await cenario.propagar();

    await cenario.responderLista([sisu], contadoresHeaders);
    expect(cenario.vitrine().erro()).toBeNull();
  });

  it('"Tentar novamente" com a consulta em curso mantém o foco e não parte outra requisição', async () => {
    await falharAoFiltrarPorSituacao();
    const tentar = cenario.botao('Tentar novamente');
    tentar?.focus();

    tentar?.click();
    await cenario.propagar();
    tentar?.click();
    await cenario.propagar();

    expect(document.activeElement).toBe(tentar);
    expect(tentar?.getAttribute('aria-disabled')).toBe('true');
    expect(tentar?.getAttribute('aria-busy')).toBe('true');
    await cenario.responderLista([sisu], contadoresHeaders);
  });

  it('"Tentar novamente" que dá certo leva o foco ao título, sem tê-lo movido ao clicar', async () => {
    await falharAoFiltrarPorSituacao();
    const titulo = cenario.host().querySelector('h1');
    const tentar = cenario.botao('Tentar novamente');
    tentar?.focus();

    tentar?.click();
    await cenario.propagar();
    cenario.fixture.detectChanges();
    expect(document.activeElement).toBe(tentar);
    expect(cenario.host().querySelector('ui-situacao-da-nova-tentativa')?.textContent).toBe(
      'Tentando novamente…',
    );

    await cenario.responderLista([sisu], contadoresHeaders);
    await cenario.passarOTempo(0);
    cenario.fixture.detectChanges();

    expect(document.activeElement).toBe(titulo);
  });

  it('"Tentar novamente" repete a página em que o erro aconteceu, sem voltar à primeira', async () => {
    await falharNaSegundaPagina(500, ERRO_INTERNO);

    cenario.botao('Tentar novamente')?.click();
    await cenario.propagar();

    const repetida = cenario.controller.expectOne((requisicao) => requisicao.url === CERTAMES_URL);
    expect(repetida.request.params.get('cursor')).toBe('p2');
    expect(repetida.request.params.get('direction')).toBe('next');
    repetida.flush([tecnicoEnfermagem], { headers: contadoresHeaders });
    await cenario.propagar();
    expect(cenario.vitrine().erro()).toBeNull();
  });

  it('cursor expirado (410) numa página navegada recarrega do início em silêncio', async () => {
    await cenario.responderLista([sisu], contadoresComProximaPagina);
    cenario.vitrine().proximaPagina();
    await cenario.propagar();
    await cenario.responderComProblema(410, CURSOR_EXPIRADO);

    const recarga = cenario.controller.expectOne((requisicao) => requisicao.url === CERTAMES_URL);
    expect(recarga.request.params.has('cursor')).toBe(false);
    recarga.flush([sisu], { headers: contadoresHeaders });
    await cenario.propagar();
    expect(cenario.vitrine().erro()).toBeNull();
  });

  it('"Tentar novamente" que recebe cursor expirado (410) segue "tentando" até a recarga do início e só então devolve o foco', async () => {
    await falharNaSegundaPagina(500, ERRO_INTERNO);
    const tentar = cenario.botao('Tentar novamente');
    tentar?.focus();
    const anunciar = vi.spyOn(TestBed.inject(AnuncioDaConclusao), 'anunciar');

    tentar?.click();
    await cenario.propagar();
    await cenario.responderComProblema(410, CURSOR_EXPIRADO);
    await cenario.passarOTempo(0);
    cenario.fixture.detectChanges();

    const recarga = cenario.controller.expectOne((requisicao) => requisicao.url === CERTAMES_URL);
    expect(cenario.host().querySelector('ui-situacao-da-nova-tentativa')?.textContent).toBe(
      'Tentando novamente…',
    );
    expect(document.activeElement).toBe(tentar);
    expect(anunciar).not.toHaveBeenCalled();

    recarga.flush([sisu], { headers: contadoresHeaders });
    await cenario.passarOTempo(0);
    cenario.fixture.detectChanges();

    expect(document.activeElement).toBe(cenario.host().querySelector('h1'));
    expect(anunciar).not.toHaveBeenCalled();
  });
});
