import type { FormGroup } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import type { EtapaForm } from './cronograma-form';
import {
  PROCESSO_ID,
  ROTA_ETAPAS,
  ROTA_FASES,
  PROBLEM_JSON,
  ID_INSCRICAO,
  ID_AVALIACAO,
  TIPO_ETAPA,
  TIPO_ETAPA_NOTA_ENEM,
} from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';

describe('CronogramaPassoComponent: nota da etapa', () => {
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

  describe('etapa de nota do ENEM', () => {
    function comEtapaDoEnemAberta(): FormGroup<EtapaForm> {
      comFases(ID_AVALIACAO);
      comEtapasEmFases(['AVALIACAO']);
      const etapa = cronograma.etapas.at(0);
      edicao.escolherTipoEtapa(etapa, TIPO_ETAPA_NOTA_ENEM);
      expansao.alternarFase(0);
      expansao.alternarEtapa(0);
      detectar();
      return etapa;
    }

    it('não oferece o caráter puramente eliminatório', () => {
      const etapa = comEtapaDoEnemAberta();
      expect(edicao.caracteresPara(etapa).map((o) => o.valor)).toEqual([
        'classificatoria',
        'ambas',
      ]);
    });

    it('avisa que a nota é calculada e não oferece banca, publicação nem janela própria', () => {
      comEtapaDoEnemAberta();
      expect(nativo.querySelector('#cr-etapa-enem-0')?.textContent).toContain('calculada');
      expect(nativo.querySelector('#cr-etapa-ini-0')).toBeNull();
      expect(nativo.querySelector('#cr-etapa-fim-0')).toBeNull();
      expect(nativo.textContent).not.toContain('Quem julga esta etapa');
      expect(nativo.textContent).not.toContain('O que esta etapa publica');
      expect(nativo.querySelector('#cr-etapa-parecer-0')).not.toBeNull();
    });

    it('escolher o tipo descarta banca, publicação, janela e recurso contado de publicação', () => {
      comFases(ID_AVALIACAO);
      comEtapasEmFases(['AVALIACAO']);
      const etapa = cronograma.etapas.at(0);
      etapa.controls.bancas.setValue(['banca-1']);
      etapa.controls.produtos.setValue([{ atoCodigo: 'ATO', papel: null }]);
      etapa.controls.inicio.setValue('2027-01-10T08:00');
      edicao.acrescentarRecursoNaEtapa(etapa);
      edicao.alterarRecursoDaEtapa(etapa, 0, 'ancora', 'cienciaIndividual');
      edicao.acrescentarRecursoNaEtapa(etapa);
      expect(etapa.controls.recursos.value.map((r) => r.ancora)).toEqual([
        'cienciaIndividual',
        'atoPublicado',
      ]);

      edicao.escolherTipoEtapa(etapa, TIPO_ETAPA_NOTA_ENEM);

      expect(etapa.controls.bancas.value).toEqual([]);
      expect(etapa.controls.produtos.value).toEqual([]);
      expect(etapa.controls.inicio.value).toBe('');
      expect(etapa.controls.recursos.value).toEqual([]);
    });

    it('não aceita recurso próprio: a nota se contesta no recurso da fase que a divulga', () => {
      const etapa = comEtapaDoEnemAberta();
      edicao.acrescentarRecursoNaEtapa(etapa);
      expect(etapa.controls.recursos.value).toEqual([]);
    });

    it('na etapa gravada vale o que o processo congelou do tipo', () => {
      comFases(ID_AVALIACAO);
      comEtapasEmFases(['AVALIACAO']);
      const etapa = cronograma.etapas.at(0);
      etapa.controls.tipoCongelado.setValue({
        origemId: TIPO_ETAPA,
        nome: 'Prova objetiva',
        notaDeOrigemNoEnem: true,
      });
      expect(edicao.etapaDeNotaDoEnem(etapa)).toBe(true);
    });
  });

  describe('nota máxima da etapa', () => {
    function etapaAberta(): FormGroup<EtapaForm> {
      comFases(ID_AVALIACAO);
      comEtapasEmFases(['AVALIACAO']);
      expansao.alternarFase(0);
      expansao.alternarEtapa(0);
      detectar();
      return cronograma.etapas.at(0);
    }

    it('pede a nota máxima da etapa com nota e a omite na etapa sem nota', () => {
      const etapa = etapaAberta();
      expect(nativo.querySelector('#cr-etapa-nota-maxima-0')).not.toBeNull();

      edicao.escolherCarater(etapa, '');
      detectar();
      expect(nativo.querySelector('#cr-etapa-nota-maxima-0')).toBeNull();
    });

    it('não pede a nota máxima da etapa do ENEM e descarta a que já havia', () => {
      const etapa = etapaAberta();
      etapa.controls.notaMaxima.setValue('10');
      etapa.controls.passoDoLancamento.setValue('0,5');

      edicao.escolherTipoEtapa(etapa, TIPO_ETAPA_NOTA_ENEM);
      detectar();

      expect(nativo.querySelector('#cr-etapa-nota-maxima-0')).toBeNull();
      expect(etapa.controls.notaMaxima.value).toBe('');
      expect(etapa.controls.passoDoLancamento.value).toBe('');
    });

    async function recusarNotaMaximaDaEtapa(indice: number): Promise<void> {
      const gravacao = componente.persistir();
      controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
      await proximoPasso();
      controller.expectOne(ROTA_ETAPAS).flush(
        {
          type: 'about:blank',
          title: 'Validação',
          status: 422,
          code: 'uniplus.validacao',
          traceId: '00000000000000000000000000000008',
          errors: [
            {
              field: `etapas[${indice}].notaMaxima`,
              code: 'uniplus.selecao.etapa_processo.nota_maxima_invalida',
              message: 'x',
            },
          ],
        },
        { status: 422, statusText: 'Unprocessable Content', headers: PROBLEM_JSON },
      );
      await gravacao;
    }

    it('a recusa acompanha a etapa que a recebeu quando outra sai da lista', async () => {
      store.processoSeletivoId.set(PROCESSO_ID);
      comFases(ID_INSCRICAO, ID_AVALIACAO);
      comEtapasEmFases(['COLETA_INSCRICAO', 'AVALIACAO', 'AVALIACAO']);
      const [, segunda, terceira] = cronograma.etapas.controls;

      await recusarNotaMaximaDaEtapa(1);
      expect(recusas.recusaDoCampo(segunda, 'notaMaxima')).not.toBeNull();

      cronograma.removerFase(0);

      expect(cronograma.etapas.controls).toEqual([segunda, terceira]);
      expect(recusas.recusaDoCampo(segunda, 'notaMaxima')).not.toBeNull();
      expect(recusas.recusaDoCampo(terceira, 'notaMaxima')).toBeNull();
    });

    it('a recusa some quando a troca de caráter esvazia o campo', async () => {
      store.processoSeletivoId.set(PROCESSO_ID);
      const etapa = etapaAberta();
      etapa.controls.notaMaxima.setValue('10');

      await recusarNotaMaximaDaEtapa(0);
      expect(recusas.recusaDoCampo(etapa, 'notaMaxima')).not.toBeNull();

      edicao.escolherCarater(etapa, '');
      expect(recusas.recusaDoCampo(etapa, 'notaMaxima')).toBeNull();
    });

    it('não confere nem envia a escala herdada por etapa do ENEM', async () => {
      store.processoSeletivoId.set(PROCESSO_ID);
      const etapa = etapaAberta();
      etapa.controls.tipoCongelado.setValue({
        origemId: TIPO_ETAPA,
        nome: 'Prova objetiva',
        notaDeOrigemNoEnem: true,
      });
      etapa.controls.notaMaxima.setValue('0');
      etapa.controls.passoDoLancamento.setValue('0,5');

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
      await proximoPasso();
      const corpo = controller.expectOne(ROTA_ETAPAS).request.body as {
        notaMaxima: unknown;
        passoDoLancamento: unknown;
      }[];
      expect(corpo[0].notaMaxima).toBeNull();
      expect(corpo[0].passoDoLancamento).toBeNull();
      void gravacao;
    });

    it('mostra a recusa do servidor sob o campo e a retira quando o campo muda', async () => {
      store.processoSeletivoId.set(PROCESSO_ID);
      const etapa = etapaAberta();
      edicao.escolherCarater(etapa, 'ambas');
      etapa.controls.notaMaxima.setValue('10');
      detectar();

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
      await proximoPasso();
      controller.expectOne(ROTA_ETAPAS).flush(
        {
          type: 'about:blank',
          title: 'Validação',
          status: 422,
          code: 'uniplus.validacao',
          traceId: '00000000000000000000000000000006',
          errors: [
            {
              field: 'etapas[0].notaMinima',
              code: 'uniplus.selecao.etapa_processo.nota_minima_acima_da_nota_maxima',
              message: 'acima',
            },
            {
              field: 'etapas[0].notaMaxima',
              code: 'uniplus.selecao.etapa_processo.nota_maxima_fora_do_passo',
              message: 'fora',
            },
          ],
        },
        { status: 422, statusText: 'Unprocessable Content', headers: PROBLEM_JSON },
      );
      const resultado = await gravacao;
      detectar();

      expect(resultado.valid).toBe(false);
      const campo = nativo.querySelector('#cr-etapa-nota-maxima-0');
      const erro = nativo.querySelector('#cr-etapa-nota-maxima-erro-0');
      expect(erro?.textContent).toContain('múltipla do passo');
      expect(campo?.getAttribute('aria-invalid')).toBe('true');
      expect(campo?.getAttribute('aria-describedby')).toBe('cr-etapa-nota-maxima-erro-0');

      expect(nativo.querySelector('#cr-etapa-nota-erro-0')?.textContent).toContain(
        'não pode passar',
      );

      // A recusa da nota mínima se resolve mudando a máxima, e vice-versa: editar um limpa os dois.
      nativo.querySelector('#cr-etapa-nota-0')?.dispatchEvent(new Event('input'));
      detectar();
      expect(nativo.querySelector('#cr-etapa-nota-maxima-erro-0')).toBeNull();
      expect(nativo.querySelector('#cr-etapa-nota-erro-0')).toBeNull();
    });
  });

  describe('forma de avaliação da etapa', () => {
    function etapaComNota(): FormGroup<EtapaForm> {
      comFases(ID_AVALIACAO);
      comEtapasEmFases(['AVALIACAO']);
      expansao.alternarFase(0);
      expansao.alternarEtapa(0);
      const etapa = cronograma.etapas.at(0);
      edicao.escolherCarater(etapa, 'classificatoria');
      detectar();
      return etapa;
    }

    function escolher(seletor: string): void {
      const radio = nativo.querySelector<HTMLInputElement>(seletor);
      radio?.click();
      detectar();
    }

    it('oferece a forma só à etapa com nota e a regra e o passo só na forma humana', () => {
      const etapa = etapaComNota();
      expect(nativo.querySelectorAll('input[name="cr-etapa-forma-0"]')).toHaveLength(2);
      expect(nativo.querySelector('#cr-etapa-passo-0')).toBeNull();

      escolher('input[name="cr-etapa-forma-0"][value="HUMANA"]');

      expect(etapa.controls.formaDeAvaliacao.value).toBe('HUMANA');
      expect(nativo.querySelectorAll('input[name="cr-etapa-regra-0"]')).toHaveLength(2);
      expect(nativo.textContent).toContain('mais de um avaliador corrige');
      expect(nativo.querySelector('#cr-etapa-passo-0')).not.toBeNull();

      edicao.escolherCarater(etapa, '');
      detectar();
      expect(nativo.querySelector('input[name="cr-etapa-forma-0"]')).toBeNull();
      expect(etapa.controls.formaDeAvaliacao.value).toBe('');
    });

    it('a forma objetiva apaga a regra e o passo, e o comando os leva nulos', async () => {
      store.processoSeletivoId.set(PROCESSO_ID);
      const etapa = etapaComNota();
      escolher('input[name="cr-etapa-forma-0"][value="HUMANA"]');
      escolher('input[name="cr-etapa-regra-0"][value="CONSOLIDACAO-AVALIACAO-UNICA"]');
      etapa.controls.passoDoLancamento.setValue('0,5');
      expect(etapa.controls.regraConsolidacaoVersao.value).toBe('v1');

      escolher('input[name="cr-etapa-forma-0"][value="OBJETIVA"]');

      expect(etapa.controls.regraConsolidacaoCodigo.value).toBe('');
      expect(etapa.controls.passoDoLancamento.value).toBe('');
      const gravacao = componente.persistir();
      controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
      await proximoPasso();
      const corpo = controller.expectOne(ROTA_ETAPAS).request.body as Record<string, unknown>[];
      expect(corpo[0]).toMatchObject({
        formaDeAvaliacao: 'OBJETIVA',
        regraConsolidacaoCodigo: null,
        passoDoLancamento: null,
      });
      void gravacao;
    });

    it('mostra a recusa do passo sob o passo e a retira quando a forma muda', async () => {
      store.processoSeletivoId.set(PROCESSO_ID);
      const etapa = etapaComNota();
      escolher('input[name="cr-etapa-forma-0"][value="HUMANA"]');
      etapa.controls.passoDoLancamento.setValue('0,5');

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
      await proximoPasso();
      controller.expectOne(ROTA_ETAPAS).flush(
        {
          type: 'about:blank',
          title: 'Validação',
          status: 422,
          code: 'uniplus.validacao',
          traceId: '00000000000000000000000000000009',
          errors: [
            {
              field: 'etapas[0].passoDoLancamento',
              code: 'uniplus.selecao.etapa_processo.passo_do_lancamento_invalido',
              message: 'x',
            },
            {
              field: 'etapas[0].regraConsolidacao',
              code: 'uniplus.selecao.etapa_processo.regra_de_consolidacao_invalida',
              message: 'y',
            },
          ],
        },
        { status: 422, statusText: 'Unprocessable Content', headers: PROBLEM_JSON },
      );
      await gravacao;
      detectar();

      const passo = nativo.querySelector('#cr-etapa-passo-0');
      expect(nativo.querySelector('#cr-etapa-passo-erro-0')?.textContent).toContain(
        'maior que zero',
      );
      expect(passo?.getAttribute('aria-describedby')).toContain('cr-etapa-passo-erro-0');
      expect(nativo.querySelector('#cr-etapa-regra-erro-0')).not.toBeNull();

      escolher('input[name="cr-etapa-forma-0"][value="OBJETIVA"]');
      expect(nativo.querySelector('#cr-etapa-regra-erro-0')).toBeNull();
    });
  });
});
