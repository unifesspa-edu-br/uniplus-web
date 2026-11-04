import { describe, expect, it } from 'vitest';
import { descreverFase, exigenciasDe } from './descricao-da-fase';
import { publicaResultadoDefinitivo } from '../passos/fase/configuracao-da-fase';
import {
  faseCanonica,
  fase,
  PRELIMINAR,
  DEFINITIVO,
  AVISO,
} from '../passos/cronograma/cronograma-do-certame.testing';

describe('exigências da fase', () => {
  it('a fase que coleta inscrição ou isenção exige janela mesmo com a data definida na execução', () => {
    const naExecucao = faseCanonica({ origemData: 'NA_EXECUCAO' });

    expect(exigenciasDe({ ...naExecucao, coletaInscricao: true }, []).janelaObrigatoria).toBe(true);
    expect(
      exigenciasDe({ ...naExecucao, coletaSolicitacaoIsencao: true }, []).janelaObrigatoria,
    ).toBe(true);
  });

  it('data fixada no edital obriga janela; definida na execução não', () => {
    expect(exigenciasDe(faseCanonica({ origemData: 'NO_EDITAL' }), []).janelaObrigatoria).toBe(
      true,
    );
    expect(exigenciasDe(faseCanonica({ origemData: 'NA_EXECUCAO' }), []).janelaObrigatoria).toBe(
      false,
    );
  });

  /**
   * O que a fase publica é declaração dela, não atributo do catálogo: a mesma
   * fase canônica entra em dois editais publicando coisas diferentes.
   */
  it('publica produto quando a fase declara ao menos um', () => {
    const canonica = faseCanonica({});

    expect(exigenciasDe(canonica, [AVISO]).publicaProduto).toBe(true);
    expect(exigenciasDe(canonica, []).publicaProduto).toBe(false);
  });

  /**
   * Recurso não é sinalizador próprio: cabe contra o resultado preliminar, que
   * é a âncora de que o prazo conta. Fase que só publica o definitivo encerra a
   * matéria, e oferecer ali a configuração levaria o operador a preencher algo
   * que o domínio recusa.
   */
  it('recurso cabe só onde há produto preliminar', () => {
    const canonica = faseCanonica({});

    expect(exigenciasDe(canonica, [PRELIMINAR]).admiteRecurso).toBe(true);
    expect(exigenciasDe(canonica, [DEFINITIVO]).admiteRecurso).toBe(false);
    expect(exigenciasDe(canonica, [AVISO]).admiteRecurso).toBe(false);
    expect(exigenciasDe(canonica, []).admiteRecurso).toBe(false);
  });

  /**
   * Ato que não é resultado não torna a fase produtora de resultado — publicar
   * um comunicado não abre nem encerra matéria nenhuma.
   */
  it('produto sem papel não publica resultado definitivo', () => {
    expect(publicaResultadoDefinitivo([DEFINITIVO])).toBe(true);
    expect(publicaResultadoDefinitivo([PRELIMINAR, AVISO])).toBe(false);
    expect(publicaResultadoDefinitivo([])).toBe(false);
  });

  /**
   * A fase que saiu do catálogo continua descrita pelo que congelou — mas o que
   * ela publica sai dos produtos dela, que o congelado não guarda.
   */
  it('descreve a fase congelada pelos produtos que ela declara', () => {
    const congelada = fase({
      produtos: [PRELIMINAR],
      congelados: {
        origemData: 'NO_EDITAL',
        agrupaEtapas: false,
        coletaInscricao: false,
        permiteComplementacao: false,
        coletaSolicitacaoIsencao: false,
        bancas: [],
      },
    });

    const descricao = descreverFase(congelada, new Map());

    expect(descricao.exigencias?.admiteRecurso).toBe(true);
    expect(descricao.exigencias?.publicaProduto).toBe(true);
    expect(descricao.publicaResultadoDefinitivo).toBe(false);
    expect(descricao.foraDoCatalogo).toBe(true);
  });
});
