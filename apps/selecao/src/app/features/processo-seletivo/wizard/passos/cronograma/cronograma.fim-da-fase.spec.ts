import { By } from '@angular/platform-browser';
import { describe, expect, it } from 'vitest';

import { PublicacoesDaFaseComponent } from '../fase/secoes/publicacoes-da-fase.component';
import { FASE_SUMIDA, ID_RESULTADO, ROTA_FASES } from './cronograma.testing';
import { DEFINITIVO, PRELIMINAR } from './cronograma-do-certame.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import { AjudantesDeRecusasDasFases } from './cronograma-recusas-das-fases.testing';

const SEM_PERIODO = { inicio: null, fim: null };
const SEM_INICIO_COM_FIM = { inicio: null, fim: '2026-03-10T18:00:00-03:00' };
const FIM_SEM_DEFINITIVO = 'uniplus.selecao.processo_seletivo.fase_sem_definitivo_sem_data_final';
const INICIO_NA_EXECUCAO =
  'O início desta fase não consta do edital: a unidade responsável o define na execução.';
const DATA_NA_EXECUCAO =
  'A data desta fase não consta do edital: a unidade responsável a define na execução.';

describe('CronogramaPassoComponent: Fim da fase', () => {
  let componente: ContextoDoCronograma['componente'];
  let expansao: ContextoDoCronograma['expansao'];
  let elementoDaTela: ContextoDoCronograma['elementoDaTela'];
  let cronograma: ContextoDoCronograma['cronograma'];
  let controller: ContextoDoCronograma['controller'];
  let detectar: ContextoDoCronograma['detectar'];
  let nativo: ContextoDoCronograma['nativo'];
  let proximoPasso: ContextoDoCronograma['proximoPasso'];
  let gravouEtapas: ContextoDoCronograma['gravouEtapas'];
  let gravouExigencias: ContextoDoCronograma['gravouExigencias'];
  let comFaseAjustada: ContextoDoCronograma['comFaseAjustada'];
  let store: ContextoDoCronograma['store'];
  let recusarFases: AjudantesDeRecusasDasFases['recusarFases'];
  let bloco: AjudantesDeRecusasDasFases['bloco'];

  usarCronograma((tela) => {
    ({
      componente,
      expansao,
      elementoDaTela,
      cronograma,
      controller,
      detectar,
      nativo,
      proximoPasso,
      gravouEtapas,
      gravouExigencias,
      comFaseAjustada,
      store,
    } = tela);
    ({ recusarFases, bloco } = new AjudantesDeRecusasDasFases(tela));
  });

  const abrir = (ajuste: Parameters<ContextoDoCronograma['comFaseAjustada']>[1]): void => {
    comFaseAjustada(ID_RESULTADO, ajuste);
    expansao.abrirFases([0]);
    detectar();
  };

  const fim = () => nativo.querySelector<HTMLInputElement>('#cr-fim-0');
  const rotuloDoFim = () => nativo.querySelector('label[for="cr-fim-0"]')?.textContent?.trim();
  const texto = () => (nativo.textContent ?? '').replace(/\s+/g, ' ');

  describe('a fase não publica resultado definitivo', () => {
    it.each([
      ['sem nada declarado', []],
      ['só com resultado preliminar', [PRELIMINAR]],
    ])('indica "obrigatório para publicar" na fase %s', (_caso, produtos) => {
      abrir({ produtos, ...SEM_PERIODO });

      expect(rotuloDoFim()).toBe('Fim (obrigatório para publicar)');
      expect(fim()?.getAttribute('aria-required')).toBe('true');
      expect(fim()?.value).toBe('');
    });

    it('diz que o início é definido na execução quando só o Fim é indicado', () => {
      abrir({ produtos: [], ...SEM_PERIODO });

      expect(nativo.querySelector('#cr-inicio-0')).toBeNull();
      expect(nativo.querySelector('#cr-sem-inicio-0')?.textContent).toContain(INICIO_NA_EXECUCAO);
      expect(fim()?.getAttribute('aria-describedby')).toBe('cr-fuso-0 cr-sem-inicio-0');
    });

    it('não marca o Fim como inválido por estar vazio: ele só é indicado', () => {
      abrir({ produtos: [], ...SEM_PERIODO });

      expect(fim()?.getAttribute('aria-invalid')).toBeNull();
      expect(nativo.querySelector('#cr-fim-erro-0')).toBeNull();
    });

    it('grava o rascunho sem o Fim', async () => {
      abrir({ produtos: [], ...SEM_PERIODO });
      store.processoSeletivoId.set('01960000-0000-7000-0000-0000000007aa');

      const gravacao = componente.persistir();
      const requisicao = controller.expectOne(ROTA_FASES);
      expect(requisicao.request.body).toMatchObject([{ inicio: null, fim: null }]);
      requisicao.flush(null, { status: 204, statusText: 'No Content' });
      await proximoPasso();
      await gravouEtapas();
      await gravouExigencias();

      await expect(gravacao).resolves.toEqual({ valid: true });
    });
  });

  describe('a fase publica resultado definitivo', () => {
    it('não mostra o Fim quando a fase não o tem e o período não é obrigatório', () => {
      abrir({ produtos: [DEFINITIVO], ...SEM_PERIODO });

      expect(fim()).toBeNull();
      expect(nativo.querySelector('#cr-inicio-0')).toBeNull();
      expect(texto()).toContain(DATA_NA_EXECUCAO);
    });

    it('mostra o Fim que a fase já tem, sem indicar obrigatoriedade', () => {
      abrir({ produtos: [DEFINITIVO], ...SEM_INICIO_COM_FIM });

      expect(rotuloDoFim()).toBe('Fim');
      expect(fim()?.getAttribute('aria-required')).toBeNull();
      expect(fim()?.value).toBe('2026-03-10T18:00');
      expect(texto()).toContain(INICIO_NA_EXECUCAO);
    });

    it('mantém o campo enquanto a pessoa apaga o valor', () => {
      abrir({ produtos: [DEFINITIVO], ...SEM_INICIO_COM_FIM });

      cronograma.fases.at(0).controls.fim.setValue('');
      detectar();

      expect(fim()).not.toBeNull();
      expect(rotuloDoFim()).toBe('Fim');
    });

    it('mostra o Fim recusado pela API, com a mensagem, o código e a página', async () => {
      abrir({ produtos: [DEFINITIVO], ...SEM_PERIODO });

      await recusarFases([
        { field: 'fases[0].fim', code: 'uniplus.x', message: 'O fim é inválido.' },
      ]);

      expect(bloco('cr-fim-erro-0')).toContain('O fim é inválido.');
      expect(bloco('cr-fim-erro-0')).toContain('uniplus.x');
      expect(fim()?.getAttribute('aria-invalid')).toBe('true');
      expect(fim()?.getAttribute('aria-describedby')).toBe(
        'cr-fuso-0 cr-sem-inicio-0 cr-fim-erro-0',
      );
    });
  });

  describe('a indicação acompanha o que a fase publica', () => {
    const publicacoes = () =>
      elementoDaTela.query(By.directive(PublicacoesDaFaseComponent))
        .componentInstance as PublicacoesDaFaseComponent;

    it('tira a indicação ao declarar o definitivo e a devolve ao tirar o papel', () => {
      abrir({ produtos: [PRELIMINAR], ...SEM_PERIODO });
      expect(rotuloDoFim()).toBe('Fim (obrigatório para publicar)');

      publicacoes().escolherPapel(0, 'DEFINITIVO');
      detectar();
      expect(fim()).toBeNull();

      publicacoes().escolherPapel(0, '');
      detectar();
      expect(rotuloDoFim()).toBe('Fim (obrigatório para publicar)');
    });

    it('com mais de uma publicação, basta uma ser definitiva para dispensar a indicação', () => {
      abrir({ produtos: [PRELIMINAR, DEFINITIVO], ...SEM_PERIODO });

      expect(fim()).toBeNull();
    });

    it('guarda o Fim já preenchido quando o definitivo passa a ser declarado', () => {
      abrir({ produtos: [PRELIMINAR], ...SEM_INICIO_COM_FIM });

      publicacoes().escolherPapel(0, 'DEFINITIVO');
      detectar();

      expect(rotuloDoFim()).toBe('Fim');
      expect(fim()?.value).toBe('2026-03-10T18:00');
    });
  });

  describe('a fase que o catálogo e o processo não descrevem', () => {
    const SEM_ATRIBUTOS = { fim: '2026-03-10T18:00:00-03:00' };

    it('mostra o Fim já gravado, com o fuso, sem unidade nem início', () => {
      comFaseAjustada(FASE_SUMIDA, SEM_ATRIBUTOS);
      expansao.abrirFases([0]);
      detectar();

      expect(fim()?.value).toBe('2026-03-10T18:00');
      expect(rotuloDoFim()).toBe('Fim');
      expect(fim()?.getAttribute('aria-required')).toBeNull();
      expect(fim()?.getAttribute('aria-describedby')).toBe('cr-fuso-0');
      expect(nativo.querySelector('#cr-inicio-0')).toBeNull();
      expect(nativo.querySelector('#cr-unidade-0')).toBeNull();
      expect(nativo.querySelector('#cr-sem-inicio-0')).toBeNull();
    });

    it('mostra a recusa do Fim, com a mensagem e o código', async () => {
      comFaseAjustada(FASE_SUMIDA, { fim: null });
      expansao.abrirFases([0]);
      detectar();

      await recusarFases([
        { field: 'fases[0].fim', code: 'uniplus.x', message: 'O fim é inválido.' },
      ]);

      expect(bloco('cr-fim-erro-0')).toContain('O fim é inválido.');
      expect(fim()?.getAttribute('aria-invalid')).toBe('true');
      expect(fim()?.getAttribute('aria-describedby')).toBe('cr-fuso-0 cr-fim-erro-0');
    });

    it('não mostra o Fim quando a fase não o tem nem há recusa', () => {
      comFaseAjustada(FASE_SUMIDA, { fim: null });
      expansao.abrirFases([0]);
      detectar();

      expect(fim()).toBeNull();
    });
  });

  // A recusa real vem na publicação, com ponteiro no documento e identificadores. Este teste só
  // simula a recusa na resposta da gravação, e não exercita o fluxo da publicação.
  it('leva ao campo a recusa simulada na gravação por falta do Fim, sem pedir o definitivo', async () => {
    abrir({ produtos: [], ...SEM_PERIODO });

    await recusarFases([
      { field: 'fases[0].fim', code: FIM_SEM_DEFINITIVO, message: 'Declare a data final.' },
    ]);

    expect(bloco('cr-fim-erro-0')).toContain('Declare a data final.');
    expect(bloco('cr-fim-erro-0')).toContain(FIM_SEM_DEFINITIVO);
    expect(rotuloDoFim()).toBe('Fim (obrigatório para publicar)');
  });
});
