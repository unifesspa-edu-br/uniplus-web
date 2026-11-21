import { describe, expect, it } from 'vitest';
import { descreverFase, exigenciasDe } from './descricao-da-fase';
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
   * A publicação do processo exige o Fim da fase que não publica o definitivo. A tela só indica:
   * a indicação nasce do que a fase declara publicar.
   */
  it('o Fim é obrigatório para publicar quando a fase não publica resultado definitivo', () => {
    const canonica = faseCanonica({});

    expect(exigenciasDe(canonica, []).fimObrigatorio).toBe(true);
    expect(exigenciasDe(canonica, [AVISO]).fimObrigatorio).toBe(true);
    expect(exigenciasDe(canonica, [PRELIMINAR]).fimObrigatorio).toBe(true);
    expect(exigenciasDe(canonica, [DEFINITIVO]).fimObrigatorio).toBe(false);
    expect(exigenciasDe(canonica, [PRELIMINAR, DEFINITIVO]).fimObrigatorio).toBe(false);
  });

  it('o Fim obrigatório não depende de o período ser obrigatório', () => {
    const naExecucao = faseCanonica({ origemData: 'NA_EXECUCAO' });

    expect(exigenciasDe(naExecucao, []).janelaObrigatoria).toBe(false);
    expect(exigenciasDe(naExecucao, []).fimObrigatorio).toBe(true);
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
    expect(descricao.exigencias?.fimObrigatorio).toBe(true);
    expect(descricao.foraDoCatalogo).toBe(true);
  });
});
