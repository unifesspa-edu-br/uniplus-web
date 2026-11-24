import { StatusProcessoCodigo } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CenarioDaListaDeProcessos,
  URL_LISTA,
  concedidas,
  processo,
} from './processos-seletivos-lista.page.testing';

describe('ProcessosSeletivosListaPage', () => {
  let cenario: CenarioDaListaDeProcessos;

  beforeEach(() => {
    cenario = CenarioDaListaDeProcessos.preparar();
  });

  afterEach(() => cenario.controller.verify());

  /**
   * Sem esta ação a rota de retomada só seria alcançável digitando o endereço
   * à mão — o operador não teria caminho pela interface.
   */
  it('oferece o caminho para retomar cada processo da lista', async () => {
    await cenario.responderLista([processo()]);

    const abrir = cenario
      .tela()
      .querySelector<HTMLAnchorElement>('tbody tr [data-label="Ações"] a');

    expect(abrir?.getAttribute('href')).toBe(
      '/processo-seletivo/019f41cf-69fd-759a-ac6d-09acabc1b027',
    );
    expect(abrir?.getAttribute('aria-label')).toBe('Abrir Vestibular 2026.1');
  });

  /**
   * Antes da publicação o processo não tem página pública, então não há o que publicar nem o que
   * listar: o atalho só aparece depois dela.
   */
  it('oferece as publicações e as notas do ENEM só do processo que já foi publicado', async () => {
    await cenario.responderLista([
      processo({
        id: 'rascunho',
        nome: 'Em cadastro',
        status: { codigo: StatusProcessoCodigo.rascunho, rotulo: 'Rascunho' },
      }),
      processo({
        id: 'publicado',
        nome: 'No ar',
        status: { codigo: StatusProcessoCodigo.publicado, rotulo: 'Publicado' },
      }),
    ]);

    const hrefs = Array.from(
      cenario.tela().querySelectorAll<HTMLAnchorElement>('tbody tr [data-label="Ações"] a'),
    ).map((a) => a.getAttribute('href'));

    expect(hrefs).toEqual([
      '/processo-seletivo/rascunho',
      '/processo-seletivo/publicado',
      '/processo-seletivo/publicado/publicacoes',
      '/processo-seletivo/publicado/notas-do-enem',
    ]);
  });

  it('oferece as inscrições do processo publicado só a quem pode consultá-las', async () => {
    const hrefs = (): (string | null)[] =>
      Array.from(
        cenario.tela().querySelectorAll<HTMLAnchorElement>('tbody tr [data-label="Ações"] a'),
      ).map((a) => a.getAttribute('href'));

    await cenario.responderLista([
      processo({
        id: 'publicado',
        status: { codigo: StatusProcessoCodigo.publicado, rotulo: 'Publicado' },
      }),
    ]);
    expect(hrefs()).not.toContain('/processo-seletivo/publicado/inscricoes');

    concedidas.set(['selecao:processos:configurar', 'selecao:inscricoes:consultar']);
    cenario.voltarAListagem();
    await cenario.responderLista([
      processo({
        id: 'publicado',
        status: { codigo: StatusProcessoCodigo.publicado, rotulo: 'Publicado' },
      }),
    ]);

    expect(hrefs()).toContain('/processo-seletivo/publicado/inscricoes');
  });

  it('mostra a quem só consulta inscrições apenas a ação das inscrições, nos publicados', async () => {
    cenario.controller.expectOne((r) => r.url === URL_LISTA).flush([]);
    concedidas.set(['selecao:inscricoes:consultar']);
    cenario.voltarAListagem();
    await cenario.responderLista([
      processo({
        id: 'rascunho',
        status: { codigo: StatusProcessoCodigo.rascunho, rotulo: 'Rascunho' },
      }),
      processo({
        id: 'publicado',
        status: { codigo: StatusProcessoCodigo.publicado, rotulo: 'Publicado' },
      }),
    ]);

    const hrefs = Array.from(
      cenario.tela().querySelectorAll<HTMLAnchorElement>('tbody tr [data-label="Ações"] a'),
    ).map((a) => a.getAttribute('href'));

    expect(hrefs).toEqual(['/processo-seletivo/publicado/inscricoes']);
    expect(cenario.tela().textContent).not.toContain('Novo Processo');

    const [rascunho, publicado] = Array.from(cenario.tela().querySelectorAll('tbody tr'));
    expect(rascunho.textContent).toContain('Inscrições disponíveis após a publicação');
    expect(publicado.textContent).not.toContain('Inscrições disponíveis após a publicação');
  });

  it('leva ao cadastro pelo atalho de novo processo', async () => {
    await cenario.responderLista([processo()]);

    const atalho = Array.from(
      cenario.tela().querySelectorAll('a') as NodeListOf<HTMLAnchorElement>,
    ).find((a) => a.textContent?.includes('Novo Processo'));

    expect(atalho?.getAttribute('href')).toBe('/processo-seletivo/novo');
  });

  /**
   * O cadastro do certame exige a permissão de configurar processo na rota e na API.
   * Oferecer o atalho a quem não a tem levaria direto ao acesso negado.
   */
  it('esconde o atalho de novo processo de quem não pode configurar processo', async () => {
    concedidas.set([]);
    await cenario.responderLista([processo()]);

    const atalho = Array.from(
      cenario.tela().querySelectorAll('a') as NodeListOf<HTMLAnchorElement>,
    ).find((a) => a.textContent?.includes('Novo Processo'));

    expect(atalho).toBeUndefined();
  });
});
