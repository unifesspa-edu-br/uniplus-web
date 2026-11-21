import { describe, expect, it } from 'vitest';

import { ID_AVALIACAO, ID_RESULTADO } from './cronograma.testing';
import { DEFINITIVO, PRELIMINAR } from './cronograma-do-certame.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import {
  AjudantesDaPublicacaoRecusada,
  daFase,
  PRELIMINAR_SEM_DEFINITIVO,
  SEM_DEFINITIVO,
} from './cronograma-recusas-da-publicacao.testing';

const SEM_PERIODO = { inicio: null, fim: null };
const MENSAGEM_DO_FIM = 'A fase Resultado final não publica definitivo e não declara a data final.';
const MENSAGEM_DOS_PRODUTOS = 'A fase Resultado final publica o preliminar sem o definitivo.';
const NOTA_DA_PUBLICACAO = 'Apontada na última tentativa de publicação.';
const FIM_RECUSADO = { field: 'fases[0].fim', code: SEM_DEFINITIVO, message: MENSAGEM_DO_FIM };

describe('CronogramaPassoComponent: recusas da publicação nas fases', () => {
  let tela: ContextoDoCronograma;
  let ajudantes: AjudantesDaPublicacaoRecusada;

  usarCronograma((montada) => {
    tela = montada;
    ajudantes = new AjudantesDaPublicacaoRecusada(montada);
  });

  const abrirResultado = (ajuste: Parameters<ContextoDoCronograma['comFaseAjustada']>[1]): void => {
    tela.comFaseAjustada(ID_RESULTADO, ajuste);
    tela.expansao.abrirFases([0]);
    tela.detectar();
  };
  const campo = (id: string) => tela.nativo.querySelector<HTMLElement>(`#${id}`);

  describe('Fim da fase', () => {
    it.each([
      ['no caminho em pontos e colchetes', 'fases[0].fim'],
      ['no ponteiro do documento', '/cronograma/fases/0/fim'],
    ])('leva a recusa ao campo Fim, %s', (_forma, field) => {
      abrirResultado({ produtos: [], ...SEM_PERIODO });

      ajudantes.recusar({ ...FIM_RECUSADO, field, identificadores: [daFase('RESULTADO_FINAL')] });

      expect(campo('cr-fim-0')?.getAttribute('aria-invalid')).toBe('true');
      expect(campo('cr-fim-0')?.getAttribute('aria-describedby')).toContain('cr-fim-erro-0');
      expect(ajudantes.bloco('cr-fim-erro-0')).toContain(MENSAGEM_DO_FIM);
      expect(ajudantes.bloco('cr-fim-erro-0')).toContain(SEM_DEFINITIVO);
      expect(ajudantes.bloco('cr-fim-erro-0')).toContain(NOTA_DA_PUBLICACAO);
    });

    it('mostra a página que explica o código junto da recusa', () => {
      abrirResultado({ produtos: [], ...SEM_PERIODO });

      ajudantes.recusar({ ...FIM_RECUSADO, identificadores: [daFase('RESULTADO_FINAL')] });

      expect(campo('cr-fim-erro-0')?.querySelector('a')?.getAttribute('href')).toContain(
        SEM_DEFINITIVO,
      );
    });

    it('não liga ao campo a recusa que a API deu sem identificadores', () => {
      abrirResultado({ produtos: [], ...SEM_PERIODO });

      ajudantes.recusar(FIM_RECUSADO);

      expect(campo('cr-fim-0')?.getAttribute('aria-invalid')).toBeNull();
      expect(ajudantes.bloco('cr-fim-erro-0')).toBeNull();
    });
  });

  describe('lista de publicações da fase', () => {
    it('leva a recusa da fase com preliminar sem definitivo à lista, abaixo dela', () => {
      abrirResultado({ produtos: [PRELIMINAR], ...SEM_PERIODO });

      ajudantes.recusar({
        field: 'fases[0].produtos',
        code: PRELIMINAR_SEM_DEFINITIVO,
        message: MENSAGEM_DOS_PRODUTOS,
        identificadores: [daFase('RESULTADO_FINAL')],
      });

      const bloco = ajudantes.bloco('fase-RESULTADO_FINAL-produtos-erro');
      expect(bloco).toContain(MENSAGEM_DOS_PRODUTOS);
      expect(bloco).toContain(PRELIMINAR_SEM_DEFINITIVO);
    });

    it('leva ao campo da lista a recusa de um item dela, sem apontar o item pela posição', () => {
      abrirResultado({ produtos: [PRELIMINAR, DEFINITIVO], ...SEM_PERIODO });

      ajudantes.recusar({
        field: 'fases[0].produtos[1].atoCodigo',
        code: PRELIMINAR_SEM_DEFINITIVO,
        message: MENSAGEM_DOS_PRODUTOS,
        identificadores: [daFase('RESULTADO_FINAL')],
      });

      expect(ajudantes.bloco('fase-RESULTADO_FINAL-produtos-erro')).toContain(
        MENSAGEM_DOS_PRODUTOS,
      );
    });
  });

  describe('fase que mudou de lugar ou saiu', () => {
    it('acha a fase pelo código depois de outra pessoa mudar a ordem', () => {
      tela.comFases(ID_AVALIACAO, ID_RESULTADO);
      tela.expansao.abrirFases([0, 1]);
      tela.detectar();

      ajudantes.recusar({ ...FIM_RECUSADO, identificadores: [daFase('RESULTADO_FINAL')] });

      expect(ajudantes.bloco('cr-fim-erro-1')).toContain(MENSAGEM_DO_FIM);
      expect(ajudantes.bloco('cr-fim-erro-0')).toBeNull();
    });

    it('leva ao topo do passo a recusa de uma fase que não existe mais, e não a outra fase', () => {
      tela.comFases(ID_AVALIACAO);
      tela.expansao.abrirFases([0]);
      tela.detectar();

      ajudantes.recusar({ ...FIM_RECUSADO, identificadores: [daFase('FASE_REMOVIDA')] });

      const texto = ajudantes.bloco('cr-recusas-da-publicacao-titulo');
      expect(texto).toContain('Recusas da última publicação que não apontam campo nesta tela');
      expect(tela.nativo.textContent).toContain(MENSAGEM_DO_FIM);
      expect(ajudantes.bloco('cr-fim-erro-0')).toBeNull();
    });

    it('não mostra o bloco do topo do passo quando toda recusa achou o campo', () => {
      abrirResultado({ produtos: [], ...SEM_PERIODO });

      ajudantes.recusar({ ...FIM_RECUSADO, identificadores: [daFase('RESULTADO_FINAL')] });

      expect(ajudantes.bloco('cr-recusas-da-publicacao-titulo')).toBeNull();
    });
  });

  describe('a conferir de novo', () => {
    const FIM_PREENCHIDO = '2026-03-10T18:00:00-03:00';
    const preencherOFim = (fim: string | null): void => {
      const [fase] = tela.store.draft().cronograma.fases;
      tela.store.patchObjectSection('cronograma', { fases: [{ ...fase, fim }] });
      tela.detectar();
    };

    it('mantém a recusa à vista e tira a marca de inválido quando a pessoa altera a fase', () => {
      abrirResultado({ produtos: [], ...SEM_PERIODO });
      ajudantes.recusar({ ...FIM_RECUSADO, identificadores: [daFase('RESULTADO_FINAL')] });

      preencherOFim(FIM_PREENCHIDO);

      expect(campo('cr-fim-0')?.getAttribute('aria-invalid')).toBeNull();
      expect(ajudantes.bloco('cr-fim-erro-0')).toContain(MENSAGEM_DO_FIM);
      expect(ajudantes.bloco('cr-fim-erro-0')).toContain('conferida de novo na próxima publicação');
    });

    it('segue a conferir mesmo quando o valor volta ao que a publicação conferiu', () => {
      abrirResultado({ produtos: [], ...SEM_PERIODO });
      ajudantes.recusar({ ...FIM_RECUSADO, identificadores: [daFase('RESULTADO_FINAL')] });

      preencherOFim(FIM_PREENCHIDO);
      preencherOFim(null);

      expect(campo('cr-fim-0')?.getAttribute('aria-invalid')).toBeNull();
      expect(ajudantes.bloco('cr-fim-erro-0')).toContain('conferida de novo na próxima publicação');
    });

    it('a resposta seguinte da publicação a põe de volta como recusa que vale', () => {
      abrirResultado({ produtos: [], ...SEM_PERIODO });
      ajudantes.recusar({ ...FIM_RECUSADO, identificadores: [daFase('RESULTADO_FINAL')] });
      preencherOFim(FIM_PREENCHIDO);
      preencherOFim(null);

      ajudantes.recusar({ ...FIM_RECUSADO, identificadores: [daFase('RESULTADO_FINAL')] });

      expect(campo('cr-fim-0')?.getAttribute('aria-invalid')).toBe('true');
    });
  });

  describe('"Ir ao campo"', () => {
    it('abre a fase da recusa e põe o foco no campo Fim', async () => {
      tela.comFaseAjustada(ID_RESULTADO, { produtos: [], ...SEM_PERIODO });
      ajudantes.recusar({ ...FIM_RECUSADO, identificadores: [daFase('RESULTADO_FINAL')] });
      expect(tela.expansao.faseExpandida(0)).toBe(false);

      await ajudantes.irAoCampo(0);

      expect(tela.expansao.faseExpandida(0)).toBe(true);
      expect(document.activeElement).toBe(campo('cr-fim-0'));
      expect(ajudantes.publicacao.destino()).toBeNull();
    });

    it('acha a fase na posição nova depois de outra pessoa mudar a ordem', async () => {
      tela.comFases(ID_AVALIACAO, ID_RESULTADO);
      ajudantes.recusar({ ...FIM_RECUSADO, identificadores: [daFase('RESULTADO_FINAL')] });

      await ajudantes.irAoCampo(0);

      expect(tela.expansao.faseExpandida(1)).toBe(true);
      expect(tela.expansao.faseExpandida(0)).toBe(false);
      expect(document.activeElement).toBe(campo('cr-fim-1'));
    });
  });
});
