import type { FormGroup } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import type { EtapaForm } from './cronograma-form';
import {
  PROCESSO_ID,
  ROTA_ETAPAS,
  ROTA_FASES,
  PROBLEM_JSON,
  ID_AVALIACAO,
  TIPO_ETAPA_NOTA_ENEM,
} from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';

describe('CronogramaPassoComponent: itens de avaliação e escala', () => {
  let componente: ContextoDoCronograma['componente'];
  let expansao: ContextoDoCronograma['expansao'];
  let edicao: ContextoDoCronograma['edicao'];
  let recusas: ContextoDoCronograma['recusas'];
  let cronograma: ContextoDoCronograma['cronograma'];
  let store: ContextoDoCronograma['store'];
  let controller: ContextoDoCronograma['controller'];
  let detectar: ContextoDoCronograma['detectar'];
  let nativo: ContextoDoCronograma['nativo'];
  let proximoPasso: ContextoDoCronograma['proximoPasso'];
  let comFases: ContextoDoCronograma['comFases'];
  let comEtapasEmFases: ContextoDoCronograma['comEtapasEmFases'];

  usarCronograma((tela) => {
    ({
      componente,
      expansao,
      edicao,
      recusas,
      cronograma,
      store,
      controller,
      detectar,
      nativo,
      proximoPasso,
      comFases,
      comEtapasEmFases,
    } = tela);
  });

  describe('itens de avaliação e escala de atendimento da etapa', () => {
    function etapaComNota(): FormGroup<EtapaForm> {
      comFases(ID_AVALIACAO);
      comEtapasEmFases(['AVALIACAO']);
      expansao.alternarFase(0);
      expansao.alternarEtapa(0);
      const etapa = cronograma.etapas.at(0);
      edicao.escolherCarater(etapa, 'classificatoria');
      etapa.controls.notaMaxima.setValue('10');
      detectar();
      return etapa;
    }

    function clicar(seletor: string): void {
      nativo.querySelector<HTMLElement>(seletor)?.click();
      detectar();
    }

    function digitar(seletor: string, valor: string): void {
      const campo = nativo.querySelector<HTMLInputElement>(seletor);
      if (campo === null) throw new Error(`campo ausente: ${seletor}`);
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
      detectar();
    }

    function corpoGravado(): Promise<Record<string, unknown>[]> {
      const gravacao = componente.persistir();
      controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
      return proximoPasso().then(() => {
        void gravacao;
        return controller.expectOne(ROTA_ETAPAS).request.body as Record<string, unknown>[];
      });
    }

    it('acrescenta e remove itens, mostra a soma contra a nota máxima e leva o foco ao item novo', async () => {
      etapaComNota();
      clicar('#cr-etapa-0-item-acrescentar');
      digitar('#cr-etapa-0-item-0-rotulo', 'Clareza');
      digitar('#cr-etapa-0-item-0-pontuacao', '4');

      expect(nativo.querySelector('#cr-etapa-0-soma')?.textContent).toContain(
        'Soma dos itens: 4 de 10',
      );
      expect(nativo.querySelector('#cr-etapa-0-soma')?.getAttribute('aria-live')).toBe('polite');
      expect(nativo.querySelector('#cr-etapa-0-soma-erro')).not.toBeNull();

      clicar('#cr-etapa-0-item-acrescentar');
      await proximoPasso();
      expect(document.activeElement?.id).toBe('cr-etapa-0-item-1-rotulo');
      digitar('#cr-etapa-0-item-1-rotulo', 'Método');
      digitar('#cr-etapa-0-item-1-pontuacao', '6');

      expect(nativo.querySelector('#cr-etapa-0-soma')?.textContent).toContain(
        'Soma dos itens: 10 de 10',
      );
      expect(nativo.querySelector('#cr-etapa-0-soma-erro')).toBeNull();
      expect(
        nativo.querySelectorAll('fieldset[data-teste="item-de-avaliacao"] legend')[1]?.textContent,
      ).toContain('Item 2');
      expect(nativo.querySelector('button[aria-label="Remover o item Método"]')).not.toBeNull();

      clicar('button[aria-label="Remover o item Método"]');
      expect(nativo.querySelectorAll('fieldset[data-teste="item-de-avaliacao"]')).toHaveLength(1);
    });

    it('atualiza o texto da soma quando só a nota máxima muda', () => {
      const etapa = etapaComNota();
      clicar('#cr-etapa-0-item-acrescentar');
      digitar('#cr-etapa-0-item-0-pontuacao', '4');
      expect(nativo.querySelector('#cr-etapa-0-soma')?.textContent).toContain('4 de 10');

      etapa.controls.notaMaxima.setValue('12');
      detectar();

      expect(nativo.querySelector('#cr-etapa-0-soma')?.textContent).toContain('4 de 12');
    });

    it('ignora a recusa do servidor que não aponta campo da etapa', async () => {
      store.processoSeletivoId.set(PROCESSO_ID);
      const etapa = etapaComNota();
      const gravacao = componente.persistir();
      controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
      await proximoPasso();
      controller.expectOne(ROTA_ETAPAS).flush(
        {
          type: 'about:blank',
          title: 'Validação',
          status: 422,
          code: 'uniplus.validacao',
          traceId: '00000000000000000000000000000011',
          errors: [
            {
              field: 'etapas[0]',
              code: 'uniplus.selecao.etapa_processo.escala_sem_itens',
              message: 'x',
            },
          ],
        },
        { status: 422, statusText: 'Unprocessable Content', headers: PROBLEM_JSON },
      );
      await gravacao;

      expect(recusas.recusasDaEtapa(etapa).size).toBe(0);
    });

    it('mantém o id do item que veio da API ao editar e o envia, e o item novo vai sem id', async () => {
      store.processoSeletivoId.set(PROCESSO_ID);
      const etapa = etapaComNota();
      const idDoItem = '01960000-0000-7000-0000-0000000000a1';
      etapa.controls.itensDeAvaliacao.setValue([
        { id: idDoItem, rotulo: 'Clareza', pontuacaoMaxima: '4' },
      ]);
      detectar();

      digitar('#cr-etapa-0-item-0-rotulo', 'Clareza e coesão');
      clicar('#cr-etapa-0-item-acrescentar');
      digitar('#cr-etapa-0-item-1-rotulo', 'Método');
      digitar('#cr-etapa-0-item-1-pontuacao', '6');

      const corpo = await corpoGravado();
      expect(corpo[0]['itensDeAvaliacao']).toEqual([
        { id: idDoItem, rotulo: 'Clareza e coesão', pontuacaoMaxima: 4 },
        { id: null, rotulo: 'Método', pontuacaoMaxima: 6 },
      ]);
    });

    it('oferece a escala só na forma humana e com itens, e com ela o passo some e vai nulo', async () => {
      store.processoSeletivoId.set(PROCESSO_ID);
      const etapa = etapaComNota();
      clicar('input[name="cr-etapa-forma-0"][value="HUMANA"]');
      etapa.controls.passoDoLancamento.setValue('0,5');
      detectar();
      expect(nativo.querySelector('#cr-etapa-0-nivel-acrescentar')).toBeNull();

      clicar('#cr-etapa-0-item-acrescentar');
      digitar('#cr-etapa-0-item-0-rotulo', 'Clareza');
      digitar('#cr-etapa-0-item-0-pontuacao', '10');
      expect(nativo.querySelector('#cr-etapa-passo-0')).not.toBeNull();

      clicar('#cr-etapa-0-nivel-acrescentar + button');
      expect(
        etapa.controls.escalaDeAtendimento.value.map((n) => `${n.rotulo} ${n.percentual}`),
      ).toEqual(['Atendeu 100', 'Atendeu parcialmente 50', 'Não atendeu 0']);
      expect(nativo.querySelector('#cr-etapa-passo-0')).toBeNull();
      expect(etapa.controls.passoDoLancamento.value).toBe('');

      const corpo = await corpoGravado();
      expect(corpo[0]).toMatchObject({
        passoDoLancamento: null,
        escalaDeAtendimento: [
          { rotulo: 'Atendeu', fracao: 1 },
          { rotulo: 'Atendeu parcialmente', fracao: 0.5 },
          { rotulo: 'Não atendeu', fracao: 0 },
        ],
      });
    });

    it('a forma objetiva apaga a escala e remover o último item também', () => {
      const etapa = etapaComNota();
      clicar('input[name="cr-etapa-forma-0"][value="HUMANA"]');
      clicar('#cr-etapa-0-item-acrescentar');
      digitar('#cr-etapa-0-item-0-rotulo', 'Clareza');
      clicar('#cr-etapa-0-nivel-acrescentar + button');

      clicar('input[name="cr-etapa-forma-0"][value="OBJETIVA"]');
      expect(etapa.controls.escalaDeAtendimento.value).toEqual([]);
      expect(etapa.controls.itensDeAvaliacao.value).toHaveLength(1);

      clicar('input[name="cr-etapa-forma-0"][value="HUMANA"]');
      clicar('#cr-etapa-0-nivel-acrescentar + button');
      clicar('button[aria-label="Remover o item Clareza"]');
      expect(etapa.controls.escalaDeAtendimento.value).toEqual([]);
    });

    it('a etapa sem nota ou do ENEM não leva itens nem escala', async () => {
      store.processoSeletivoId.set(PROCESSO_ID);
      const etapa = etapaComNota();
      clicar('#cr-etapa-0-item-acrescentar');
      digitar('#cr-etapa-0-item-0-rotulo', 'Clareza');
      digitar('#cr-etapa-0-item-0-pontuacao', '10');

      edicao.escolherTipoEtapa(etapa, TIPO_ETAPA_NOTA_ENEM);
      detectar();

      expect(nativo.querySelector('#cr-etapa-0-item-acrescentar')).toBeNull();
      expect(etapa.controls.itensDeAvaliacao.value).toEqual([]);
      const corpo = await corpoGravado();
      expect(corpo[0]).toMatchObject({ itensDeAvaliacao: [], escalaDeAtendimento: [] });
    });

    it('mostra a recusa do servidor sob o campo do item e a retira quando o item muda', async () => {
      store.processoSeletivoId.set(PROCESSO_ID);
      etapaComNota();
      clicar('input[name="cr-etapa-forma-0"][value="HUMANA"]');
      digitar('#cr-etapa-passo-0', '0,5');
      clicar('#cr-etapa-0-item-acrescentar');
      digitar('#cr-etapa-0-item-0-rotulo', 'Clareza');
      digitar('#cr-etapa-0-item-0-pontuacao', '10,3');

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
      await proximoPasso();
      controller.expectOne(ROTA_ETAPAS).flush(
        {
          type: 'about:blank',
          title: 'Validação',
          status: 422,
          code: 'uniplus.validacao',
          traceId: '00000000000000000000000000000010',
          errors: [
            {
              field: 'etapas[0].itensDeAvaliacao[0].pontuacaoMaxima',
              code: 'uniplus.selecao.item_de_avaliacao.pontuacao_fora_do_passo',
              message: 'x',
            },
          ],
        },
        { status: 422, statusText: 'Unprocessable Content', headers: PROBLEM_JSON },
      );
      await gravacao;
      detectar();

      const campo = nativo.querySelector('#cr-etapa-0-item-0-pontuacao');
      expect(nativo.querySelector('#cr-etapa-0-item-0-pontuacao-erro')?.textContent).toContain(
        'múltipla do passo',
      );
      expect(campo?.getAttribute('aria-invalid')).toBe('true');
      expect(campo?.getAttribute('aria-describedby')).toBe('cr-etapa-0-item-0-pontuacao-erro');

      digitar('#cr-etapa-0-item-0-pontuacao', '10,5');
      expect(nativo.querySelector('#cr-etapa-0-item-0-pontuacao-erro')).toBeNull();
    });
  });
});
