import { beforeEach, describe, expect, it } from 'vitest';

import { EtapaPontuada } from '../../processo-seletivo.models';

import {
  ETAPA_PERSISTIDA,
  ROTA_CLASSIFICACAO,
  componente,
  controller,
  fixture,
  montarEliminacao,
  oferecidas,
  prepararClassificacaoLocal,
  store,
  tipoEtapaPorId,
} from './eliminacao.testing';

describe('ausência na etapa, pelo passo', () => {
  montarEliminacao();

  describe('ELIM-AUSENCIA-NA-ETAPA — só a etapa, fora do ENEM, uma vez por etapa', () => {
    const AUSENCIA = {
      regraCodigo: 'ELIM-AUSENCIA-NA-ETAPA',
      regraVersao: '1.0',
      etapaRef: 'etapa-1',
      notaMinima: '',
      minimo: '',
      areaCodigo: '',
    };
    const ETAPA_DO_ENEM: EtapaPontuada = {
      ...ETAPA_PERSISTIDA,
      id: 'etapa-enem',
      nome: 'Nota do ENEM',
      ordem: 2,
      tipoCongelado: { origemId: 'tipo-1', notaDeOrigemNoEnem: true },
    };
    const ETAPA_SEM_NOTA: EtapaPontuada = {
      ...ETAPA_PERSISTIDA,
      id: 'etapa-2',
      nome: 'Entrevista',
      carater: '',
      peso: '',
      ordem: 3,
    };

    beforeEach(() => {
      prepararClassificacaoLocal();
      store.patchObjectSection('cronograma', {
        etapas: [ETAPA_PERSISTIDA, ETAPA_DO_ENEM, ETAPA_SEM_NOTA],
      });
    });

    it('aceita a etapa escolhida sem nota mínima, mesmo fora do ENEM', () => {
      store.patchObjectSection('classificacao', { regrasEliminacao: [AUSENCIA] });

      expect(componente.validate().valid).toBe(true);
    });

    it('recusa sem etapa', () => {
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [{ ...AUSENCIA, etapaRef: '' }],
      });

      expect(componente.validate().messages?.join(' ')).toContain('selecione a etapa');
    });

    it('oferece as etapas com e sem nota, nunca a do ENEM', () => {
      store.patchObjectSection('classificacao', { regrasEliminacao: [AUSENCIA] });

      expect(oferecidas('elim-etapa-0')).toEqual(['etapa-1', 'etapa-2']);
    });

    it('não oferece a etapa que outra regra de ausência já cita, e recusa a repetição', () => {
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [AUSENCIA, { ...AUSENCIA, etapaRef: '' }],
      });
      expect(oferecidas('elim-etapa-1')).toEqual(['etapa-2']);

      store.patchObjectSection('classificacao', { regrasEliminacao: [AUSENCIA, AUSENCIA] });
      const resultado = componente.validate();
      expect(resultado.messages?.join(' ')).toContain('Regra de eliminação 2');
      expect(resultado.messages?.join(' ')).toContain('já foi declarada');
    });

    it('julga o ENEM pelo tipo do catálogo quando a etapa não traz o congelado', () => {
      tipoEtapaPorId.set(
        new Map([
          [
            'tipo-1',
            {
              id: 'tipo-1',
              codigo: 'NOTA_ENEM',
              nome: 'Nota do ENEM',
              descricao: null,
              ativo: true,
              admitePontuacao: true,
              admiteEliminacao: false,
              notaDeOrigemNoEnem: true,
              criadoEm: '2026-01-01T00:00:00Z',
            },
          ],
        ]),
      );
      store.patchObjectSection('classificacao', { regrasEliminacao: [AUSENCIA] });

      expect(oferecidas('elim-etapa-0')).toEqual(['etapa-1']);
      expect(componente.validate().messages?.join(' ')).toContain('etapa de nota do ENEM');
    });

    it('recusa a etapa do ENEM gravada, que continua visível para ser trocada', () => {
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [{ ...AUSENCIA, etapaRef: 'etapa-enem' }],
      });

      expect(oferecidas('elim-etapa-0')).toContain('etapa-enem');
      expect(componente.validate().messages?.join(' ')).toContain('etapa de nota do ENEM');
    });

    it('põe a recusa da repetição junto do campo da etapa', async () => {
      store.patchObjectSection('classificacao', { regrasEliminacao: [AUSENCIA] });

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_CLASSIFICACAO).flush(
        {
          type: 'about:blank',
          title: 'Recusada.',
          status: 422,
          code: 'uniplus.validacao',
          traceId: 't',
          errors: [
            {
              field: 'regrasEliminacao[0]',
              code: 'uniplus.selecao.configuracao_classificacao.ausencia_na_etapa_repetida',
              message: 'repetida',
            },
          ],
        },
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
      await gravacao;
      fixture.detectChanges();

      const raiz = fixture.nativeElement as HTMLElement;
      const etapa = raiz.querySelector('#elim-etapa-0');
      expect(etapa?.getAttribute('aria-invalid')).toBe('true');
      expect(etapa?.getAttribute('aria-describedby')).toContain('elim-etapa-erro-0');
      expect(raiz.querySelector('#elim-etapa-erro-0')?.textContent).toContain('já foi declarada');
    });
  });
});
