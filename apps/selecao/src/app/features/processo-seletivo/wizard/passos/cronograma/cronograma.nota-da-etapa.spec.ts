import type { FormGroup } from '@angular/forms';
import {
  PapelDaBancaCodigo,
  StatusProcessoCodigo,
  type ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';
import { umaBancaDeclarada } from '../../shared/bancas/banca-declarada.testing';
import type { EtapaForm } from './cronograma-form';
import {
  PROCESSO_ID,
  ROTA_ETAPAS,
  ROTA_FASES,
  ID_INSCRICAO,
  ID_AVALIACAO,
  TIPO_ETAPA,
  TIPO_ETAPA_NOTA_ENEM,
} from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import {
  AjudantesDeRecusasDasEtapas,
  type ErroDaEtapa,
} from './cronograma-recusas-das-etapas.testing';

const NOTA_MAXIMA_INVALIDA = (field: string): ErroDaEtapa => ({
  field,
  code: 'uniplus.selecao.etapa_processo.nota_maxima_invalida',
  message: 'A nota máxima precisa ser maior que zero.',
});

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
  let recusarEtapas: AjudantesDeRecusasDasEtapas['recusarEtapas'];
  let bloco: AjudantesDeRecusasDasEtapas['bloco'];

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
    ({ recusarEtapas, bloco } = new AjudantesDeRecusasDasEtapas(tela));
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
        'CLASSIFICATORIA',
        'AMBAS',
      ]);
    });

    it('avisa que a nota é calculada e não oferece publicação nem janela própria', () => {
      comEtapaDoEnemAberta();
      expect(nativo.querySelector('#cr-etapa-enem-0')?.textContent).toContain('calculada');
      expect(nativo.querySelector('#cr-etapa-ini-0')).toBeNull();
      expect(nativo.querySelector('#cr-etapa-fim-0')).toBeNull();
      expect(nativo.textContent).not.toContain('O que esta etapa publica');
      expect(nativo.querySelector('#cr-etapa-parecer-0')).not.toBeNull();
    });

    it('mostra a seção de bancas e não diz que a etapa não tem banca', () => {
      comEtapaDoEnemAberta();
      expect(nativo.querySelector('#cr-etapa-bancas-titulo-0')?.textContent).toContain(
        'Quem julga esta etapa',
      );
      expect(nativo.querySelector('#cr-etapa-enem-0')?.textContent).not.toContain('banca');
    });

    it('em consulta, lê quem julga a etapa e não lê o que ela publica', () => {
      const etapa = comEtapaDoEnemAberta();
      etapa.controls.bancas.setValue([
        umaBancaDeclarada({
          copiaDoTipo: {
            rotulo: 'Banca de entrevista',
            papel: { codigo: PapelDaBancaCodigo.AVALIA_O_MERITO, rotulo: 'Avalia candidato' },
            exigeDuasOuMaisBancas: false,
            encerraRecursoNaPrimeiraInstancia: false,
          },
        }),
      ]);
      store.remoteSnapshot.set({
        status: StatusProcessoCodigo.PUBLICADO,
      } as unknown as ProcessoSeletivoDto);
      detectar();

      const leitura = (nativo.textContent ?? '').replace(/\s+/g, ' ');
      expect(leitura).toContain('Quem julga esta etapa');
      expect(leitura).toContain('Banca de entrevista 1');
      expect(leitura).not.toContain('O que esta etapa publica');
    });

    it('escolher o tipo descarta publicação, janela e recurso contado de publicação e preserva a banca', () => {
      comFases(ID_AVALIACAO);
      comEtapasEmFases(['AVALIACAO']);
      const etapa = cronograma.etapas.at(0);
      etapa.controls.bancas.setValue([
        {
          id: null,
          identificadorLocal: 'banca-teste',
          copiaDoTipo: null,
          tipoBancaId: 'banca-1',
          regraDeDeliberacao: null,
        },
      ]);
      etapa.controls.produtos.setValue([{ atoCodigo: 'ATO', papel: null }]);
      etapa.controls.inicio.setValue('2027-01-10T08:00');
      edicao.acrescentarRecursoNaEtapa(etapa);
      edicao.alterarRecursoDaEtapa(etapa, 0, { campo: 'ancora', valor: 'CIENCIA_INDIVIDUAL' });
      edicao.acrescentarRecursoNaEtapa(etapa);
      expect(etapa.controls.recursos.value.map((r) => r.ancora)).toEqual([
        'CIENCIA_INDIVIDUAL',
        'PUBLICACAO_DO_ATO',
      ]);

      edicao.escolherTipoEtapa(etapa, TIPO_ETAPA_NOTA_ENEM);

      expect(etapa.controls.bancas.value.map((b) => b.identificadorLocal)).toEqual(['banca-teste']);
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

    it('a recusa acompanha a etapa que a recebeu quando outra sai da lista', async () => {
      comFases(ID_INSCRICAO, ID_AVALIACAO);
      comEtapasEmFases(['COLETA_INSCRICAO', 'AVALIACAO', 'AVALIACAO']);
      const [, segunda, terceira] = cronograma.etapas.controls;

      await recusarEtapas([NOTA_MAXIMA_INVALIDA('etapas[1].notaMaxima')]);
      expect(recusas.recusasDoCampo(segunda, 'notaMaxima')).toHaveLength(1);

      cronograma.removerFase(0);

      expect(cronograma.etapas.controls).toEqual([segunda, terceira]);
      expect(recusas.recusasDoCampo(segunda, 'notaMaxima')).toHaveLength(1);
      expect(recusas.recusasDoCampo(terceira, 'notaMaxima')).toHaveLength(0);
    });

    it('a recusa passa a conferir de novo quando a troca de caráter esvazia o campo', async () => {
      const etapa = etapaAberta();
      etapa.controls.notaMaxima.setValue('10');

      await recusarEtapas([NOTA_MAXIMA_INVALIDA('etapas[0].notaMaxima')]);
      expect(recusas.recusasDoCampo(etapa, 'notaMaxima')[0].aConferir).toBe(false);

      edicao.escolherCarater(etapa, '');
      expect(recusas.recusasDoCampo(etapa, 'notaMaxima')[0].aConferir).toBe(true);
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

    it('mostra a recusa do servidor sob o campo e a deixa a conferir quando a etapa muda', async () => {
      const etapa = etapaAberta();
      edicao.escolherCarater(etapa, 'AMBAS');
      etapa.controls.notaMaxima.setValue('10');
      detectar();

      const resultado = await recusarEtapas([
        {
          field: 'etapas[0].notaMinima',
          code: 'uniplus.selecao.etapa_processo.nota_minima_acima_da_nota_maxima',
          message: 'A nota mínima não pode passar da máxima.',
        },
        {
          field: 'etapas[0].notaMaxima',
          code: 'uniplus.selecao.etapa_processo.nota_maxima_fora_do_passo',
          message: 'A nota máxima precisa ser múltipla do passo.',
        },
      ]);

      expect(resultado.valid).toBe(false);
      const campo = nativo.querySelector('#cr-etapa-nota-maxima-0');
      expect(bloco('cr-etapa-nota-maxima-erro-0')).toContain('múltipla do passo');
      expect(bloco('cr-etapa-nota-erro-0')).toContain('não pode passar da máxima');
      expect(campo?.getAttribute('aria-invalid')).toBe('true');
      expect(campo?.getAttribute('aria-describedby')).toBe('cr-etapa-nota-maxima-erro-0');

      const minima = nativo.querySelector<HTMLInputElement>('#cr-etapa-nota-0');
      if (minima === null) throw new Error('A nota mínima não está na tela.');
      minima.value = '2';
      minima.dispatchEvent(new Event('input'));
      detectar();

      expect(bloco('cr-etapa-nota-maxima-erro-0')).toContain('conferida de novo');
      expect(bloco('cr-etapa-nota-erro-0')).toContain('conferida de novo');
      expect(campo?.getAttribute('aria-invalid')).not.toBe('true');
    });
  });

  describe('forma de avaliação da etapa', () => {
    function etapaComNota(): FormGroup<EtapaForm> {
      comFases(ID_AVALIACAO);
      comEtapasEmFases(['AVALIACAO']);
      expansao.alternarFase(0);
      expansao.alternarEtapa(0);
      const etapa = cronograma.etapas.at(0);
      edicao.escolherCarater(etapa, 'CLASSIFICATORIA');
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

    it('mostra a recusa do passo sob o passo e some com ela quando a forma deixa de ter o passo', async () => {
      const etapa = etapaComNota();
      escolher('input[name="cr-etapa-forma-0"][value="HUMANA"]');
      etapa.controls.passoDoLancamento.setValue('0,5');

      await recusarEtapas([
        {
          field: 'etapas[0].passoDoLancamento',
          code: 'uniplus.selecao.etapa_processo.passo_do_lancamento_invalido',
          message: 'O passo precisa ser maior que zero.',
        },
        {
          field: 'etapas[0].regraConsolidacao',
          code: 'uniplus.selecao.etapa_processo.regra_de_consolidacao_invalida',
          message: 'Escolha a regra de consolidação.',
        },
      ]);

      const passo = nativo.querySelector('#cr-etapa-passo-0');
      expect(bloco('cr-etapa-passo-erro-0')).toContain('maior que zero');
      expect(passo?.getAttribute('aria-describedby')).toContain('cr-etapa-passo-erro-0');
      expect(bloco('cr-etapa-regra-erro-0')).toContain('Escolha a regra');

      escolher('input[name="cr-etapa-forma-0"][value="OBJETIVA"]');
      expect(nativo.querySelector('#cr-etapa-regra-erro-0')).toBeNull();
      expect(nativo.querySelector('#cr-etapa-passo-erro-0')).toBeNull();
    });
  });
});
