import { StatusProcessoCodigo } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CenarioDaListaDeProcessos,
  URL_LISTA,
  processo,
} from './processos-seletivos-lista.page.testing';

describe('ProcessosSeletivosListaPage', () => {
  let cenario: CenarioDaListaDeProcessos;

  beforeEach(() => {
    cenario = CenarioDaListaDeProcessos.preparar();
  });

  afterEach(() => cenario.controller.verify());

  it('pede a primeira página sem cursor e com a janela declarada', async () => {
    const req = cenario.controller.expectOne((r) => r.url === URL_LISTA);

    expect(req.request.params.get('limit')).toBe('50');
    expect(req.request.params.get('cursor')).toBeNull();
    expect(req.request.params.get('direction')).toBeNull();

    req.flush([processo()]);
    await cenario.propagar();
  });

  it('lê apenas uma vez a listagem ao montar', async () => {
    await cenario.responderLista([processo()]);

    cenario.controller.verify();
  });

  it('mostra os campos que o resumo devolve', async () => {
    await cenario.responderLista([processo()]);

    const linha = cenario.tela().querySelector('tbody tr');
    const celulaTipo = linha?.querySelector('[data-label="Tipo"]')?.textContent;
    expect(linha?.querySelector('[data-label="Processo"]')?.textContent).toContain(
      'Vestibular 2026.1',
    );
    // O código do tipo é identificador técnico: serve à integração, não ao operador.
    expect(celulaTipo).toContain('Vestibular');
    expect(celulaTipo).not.toContain('VESTIBULAR');
    expect(linha?.querySelector('[data-label="Data de criação"]')?.textContent?.trim()).toMatch(
      /^\d{2}\/\d{2}\/\d{4}/,
    );
  });

  /**
   * O token do wire e o rótulo exibido são coisas diferentes: a API emite
   * `rascunho` e a tela mostra `Rascunho`. A primeira
   * coluna é o que chega do servidor; a segunda, o que o operador lê. Casar a
   * grafia errada deixaria toda tag em `neutral` e apagaria a distinção visual
   * entre um rascunho e um certame publicado.
   */
  it.each([
    [StatusProcessoCodigo.rascunho, 'Em preparação', 'tag--warning'],
    [StatusProcessoCodigo.publicado, 'Publicado', 'tag--success'],
    [StatusProcessoCodigo.encerrado, 'Encerrado', ''],
    [StatusProcessoCodigo.cancelado, 'Cancelado', 'tag--danger'],
  ])('rotula e colore o status %s', async (status, rotulo, classe) => {
    await cenario.responderLista([processo({ status: { codigo: status, rotulo } })]);

    const tag = cenario.tela().querySelector('[data-label="Status"] .tag');

    expect(tag?.textContent?.trim()).toBe(rotulo);
    if (classe) {
      expect(tag?.classList.contains(classe)).toBe(true);
    }
  });

  /** Status vindo de um backend mais novo aparece cru, em vez de sumir. */
  it('exibe um status que esta versão não reconhece', async () => {
    await cenario.responderLista([
      processo({ status: { codigo: 'Suspenso' as StatusProcessoCodigo, rotulo: 'Suspenso' } }),
    ]);

    expect(cenario.tela().querySelector('[data-label="Status"] .tag')?.textContent?.trim()).toBe(
      'Suspenso',
    );
  });

  /**
   * O token vem do servidor. Num objeto literal, `constructor` resolveria para
   * o membro herdado de `Object.prototype` — uma função, que o `??` não trata
   * como ausência e que a interpolação renderizaria como código-fonte.
   */
  it.each(['constructor', 'toString', 'hasOwnProperty'])(
    'não confunde o status %s com membro herdado de Object',
    async (status) => {
      // Fora do enum de propósito: o que está sob prova é justamente o token que o
      // contrato não declara, e sem o cast não há como exprimi-lo.
      await cenario.responderLista([
        processo({ status: { codigo: status as StatusProcessoCodigo, rotulo: status } }),
      ]);

      const tag = cenario.tela().querySelector('[data-label="Status"] .tag');

      expect(tag?.textContent?.trim()).toBe(status);
      expect(tag?.textContent).not.toContain('native code');
      expect(tag?.classList.contains('tag--warning')).toBe(false);
      expect(tag?.classList.contains('tag--success')).toBe(false);
    },
  );

  it('anuncia o estado vazio quando a coleção não tem itens', async () => {
    await cenario.responderLista([]);

    expect(cenario.tela().querySelector('.empty-state')).not.toBeNull();
    expect(cenario.tela().querySelector('tbody tr')).toBeNull();
    expect(cenario.tela().querySelector('[data-pager="next"]')).toBeNull();
  });

  it('nomeia a seção de processos por um id existente', async () => {
    await cenario.responderLista([processo()]);

    const secao = cenario.tela().querySelector('section.panel[aria-labelledby]');
    const id = secao?.getAttribute('aria-labelledby');

    expect(id).toBeTruthy();
    expect(cenario.tela().querySelector(`#${id}`)).not.toBeNull();
  });

  it('rotula todas as células com o cabeçalho correspondente', async () => {
    await cenario.responderLista([processo()]);

    const cabecalhos = Array.from(
      cenario.tela().querySelectorAll('thead th') as NodeListOf<HTMLTableCellElement>,
    ).map((th) => th.textContent?.trim());
    const rotulos = Array.from(
      cenario.tela().querySelectorAll('tbody tr td') as NodeListOf<HTMLTableCellElement>,
    ).map((td) => td.getAttribute('data-label'));

    expect(rotulos).toEqual(cabecalhos);
  });

  it('expõe legenda acessível descrevendo a tabela', async () => {
    await cenario.responderLista([processo()]);

    const caption = cenario.tela().querySelector('table > caption');
    expect(caption).not.toBeNull();
    expect(caption?.classList.contains('sr-only')).toBe(true);
    expect(caption?.textContent?.replace(/\s+/gu, ' ').trim()).toBe(
      'Processos seletivos, com tipo, situação e data de criação',
    );
  });

  it('não expõe âncoras sem destino', async () => {
    await cenario.responderLista([processo()]);

    const vazias = Array.from(
      cenario.tela().querySelectorAll('a') as NodeListOf<HTMLAnchorElement>,
    ).filter((a) => a.getAttribute('href') === '#');

    expect(vazias).toHaveLength(0);
  });

  it('não injeta o total de processos como se fosse agregado da coleção', async () => {
    await cenario.responderLista([processo(), processo({ id: 'outro-id' })]);

    const contador = cenario.tela().querySelector('.list-count');

    expect(contador?.getAttribute('aria-label')).toBe('Processos seletivos nesta página');
    expect(contador?.textContent?.trim()).toBe('2');
    expect(cenario.component['processos']()).toHaveLength(2);
  });

  /**
   * O percurso a garantir: cadastrar e voltar à listagem
   * mostra o processo novo. Prova que a página relê da API ao ser montada, em
   * vez de servir o que trouxe da visita anterior — se ela guardasse a coleção,
   * o registro recém-criado não apareceria sem um refresh do navegador.
   */
  it('mostra o processo recém-criado ao voltar para a listagem', async () => {
    await cenario.responderLista([processo({ nome: 'Vestibular 2026.1' })]);
    expect(cenario.nomesNaTabela()).toEqual(['Vestibular 2026.1']);

    cenario.voltarAListagem();

    await cenario.responderLista([
      processo({ nome: 'Vestibular 2026.1' }),
      processo({ id: '019f41cf-69fd-759a-ac6d-09acabc1b099', nome: 'PSIQ 2026' }),
    ]);

    expect(cenario.nomesNaTabela()).toEqual(['Vestibular 2026.1', 'PSIQ 2026']);
  });
});
