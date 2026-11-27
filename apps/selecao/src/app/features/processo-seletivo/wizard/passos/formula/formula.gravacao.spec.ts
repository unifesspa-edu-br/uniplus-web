import { describe, expect, it, beforeEach } from 'vitest';

import { classificacaoDe } from '../../shared/hidratacao/hidratacao-da-classificacao';
import {
  ROTA_CLASSIFICACAO,
  ROTA_DETALHE,
  aguardarReleitura,
  controller,
  fixture as fixtureDaEliminacao,
  montarEliminacao,
  prepararClassificacaoLocal,
  store,
} from '../eliminacao/eliminacao.testing';
import {
  aceitarGravacao,
  falharPorRede,
  recusarGravacao,
} from '../classificacao/recusa-da-gravacao.testing';
import type { FormulaPassoComponent } from './formula.component';
import {
  detalheComoOServidorGravou,
  montarFormulaNoEditorDaEliminacao,
} from './formula.gravacao.testing';

const NOTA_MINIMA_DA_ETAPA = {
  regraCodigo: 'ELIMINACAO_NOTA_MINIMA_ETAPA',
  regraVersao: '1.0',
  etapaRef: 'etapa-1',
  notaMinima: '5',
  minimo: '',
  areaCodigo: '',
};
const AUSENCIA_NA_ETAPA = { ...NOTA_MINIMA_DA_ETAPA, regraCodigo: 'ELIMINACAO_AUSENCIA_NA_ETAPA' };

describe('Fórmula e precisão — gravar e avançar', () => {
  montarEliminacao();
  let formula: FormulaPassoComponent;

  beforeEach(() => {
    formula = montarFormulaNoEditorDaEliminacao().formula;
  });

  function preencherAFormula(): void {
    formula.escolherRegraCalculo('FORMULA_MEDIA_PONDERADA|1.0');
    formula.escolherRegraArredondamento('ARRED-TRUNCAR|1.0');
    formula.alterarCasasArredondamento('3');
    formula.escolherRegraOrdemAlocacao('ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA|1.0');
    formula.alterarEscalaNotaFinal('1000');
  }

  it('anuncia no botão de avanço que o passo grava', () => {
    expect(formula.rotuloDeAvanco()).toBe('Gravar e avançar');
  });

  it('grava o que foi preenchido, e a hidratação do que o servidor gravou devolve os mesmos valores', async () => {
    preencherAFormula();

    const gravacao = formula.persistir();
    const requisicao = controller.expectOne(ROTA_CLASSIFICACAO);
    expect(requisicao.request.method).toBe('PUT');
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await expect(gravacao).resolves.toEqual({ valid: true });

    const relida = classificacaoDe(detalheComoOServidorGravou(requisicao.request.body));
    expect(relida).toMatchObject({
      regraCalculoCodigo: 'FORMULA_MEDIA_PONDERADA',
      regraArredondamentoCodigo: 'ARRED-TRUNCAR',
      casasArredondamento: '3',
      regraOrdemAlocacaoCodigo: 'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA',
      escalaNotaFinal: '1000',
    });
  });

  it('sem regra de cálculo, não envia nada e deixa a pendência no passo', async () => {
    const resultado = await formula.persistir();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.join(' ')).toContain('regra de cálculo');
    controller.expectNone(ROTA_CLASSIFICACAO);
  });

  it('no primeiro percurso, envia a lista de eliminação vazia e a escala nula quando vazia', async () => {
    preencherAFormula();
    formula.alterarEscalaNotaFinal('');

    const gravacao = formula.persistir();
    const requisicao = controller.expectOne(ROTA_CLASSIFICACAO);
    requisicao.flush(null, { status: 204, statusText: 'No Content' });

    expect(requisicao.request.body).toMatchObject({ regrasEliminacao: [], escalaNotaFinal: null });
    await gravacao;
  });

  it('com a Eliminação já gravada, mudar as casas leva as duas regras junto', async () => {
    prepararClassificacaoLocal();
    store.patchObjectSection('classificacao', {
      regrasEliminacao: [NOTA_MINIMA_DA_ETAPA, { ...NOTA_MINIMA_DA_ETAPA, notaMinima: '7' }],
    });
    formula.alterarCasasArredondamento('4');

    const gravacao = formula.persistir();
    const requisicao = controller.expectOne(ROTA_CLASSIFICACAO);
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    const { body } = requisicao.request;

    expect(body.casasArredondamento).toBe(4);
    expect(body.regrasEliminacao.map((regra: { notaMinima: number }) => regra.notaMinima)).toEqual([
      5, 7,
    ]);
    await gravacao;
  });

  it('sem etapa que componha a nota, só avisa: o divisor da média não impede a gravação', async () => {
    prepararClassificacaoLocal();
    store.patchObjectSection('cronograma', { etapas: [] });

    const gravacao = formula.persistir();
    aceitarGravacao();

    expect(formula.avisoDeDivisorInvalido()).toBe(true);
    await expect(gravacao).resolves.toEqual({ valid: true });
  });

  it('recusa sem processo criado, sem enviar nada', async () => {
    prepararClassificacaoLocal();
    store.processoSeletivoId.set(null);

    const resultado = await formula.persistir();

    expect(resultado.valid).toBe(false);
    controller.expectNone(ROTA_CLASSIFICACAO);
  });

  describe('quando o servidor recusa ou não responde', () => {
    const FORA_DO_QUADRO = 'uniplus.selecao.processo_seletivo.desempate_area_enem_fora_do_quadro';

    it('recusa da resolução por critério de desempate gravado: mensagem no passo, recusa sob o campo e valores mantidos', async () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: 'R',
      });

      const gravacao = formula.persistir();
      recusarGravacao({
        title: 'Recusada.',
        code: 'uniplus.validacao',
        errors: [{ field: 'resolucaoPesoAreaEnem', code: FORA_DO_QUADRO, message: 'Critério 1.' }],
      });
      const resultado = await gravacao;

      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.[0]).toContain('Um critério de desempate gravado cita área');
      expect(store.classificacao.recusaPeloDesempatePorArea()).not.toBeNull();
      expect(store.draft().classificacao.resolucaoPesoAreaEnem).toBe('R');
      expect(store.draft().classificacao.casasArredondamento).toBe('2');
    });

    it('falha de rede: a classificação gravada fica desconhecida, o passo recebe a mensagem e os campos seguem', async () => {
      prepararClassificacaoLocal();

      const gravacao = formula.persistir();
      falharPorRede(ROTA_CLASSIFICACAO);
      await aguardarReleitura();
      falharPorRede(ROTA_DETALHE);
      const resultado = await gravacao;

      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.length).toBeGreaterThan(0);
      expect(store.classificacao.gravada()).toEqual({ estado: 'desconhecida' });
      expect(store.draft().classificacao.casasArredondamento).toBe('2');
    });

    it('a recusa de uma regra, vinda da gravação na Fórmula, aparece no campo da regra no passo Eliminação', async () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', { regrasEliminacao: [AUSENCIA_NA_ETAPA] });

      const gravacao = formula.persistir();
      recusarGravacao({
        title: 'Recusada.',
        code: 'uniplus.validacao',
        errors: [
          {
            field: 'regrasEliminacao[0]',
            code: 'uniplus.selecao.configuracao_classificacao.ausencia_na_etapa_repetida',
            message: 'repetida',
          },
        ],
      });
      await gravacao;
      fixtureDaEliminacao.detectChanges();

      const raiz = fixtureDaEliminacao.nativeElement as HTMLElement;
      expect(raiz.querySelector('#elim-etapa-0')?.getAttribute('aria-invalid')).toBe('true');
      expect(raiz.querySelector('#elim-etapa-erro-0')?.textContent).toContain('já foi declarada');
    });
  });
});
