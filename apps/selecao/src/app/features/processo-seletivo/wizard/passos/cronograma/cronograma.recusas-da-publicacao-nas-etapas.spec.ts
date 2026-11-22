import { describe, expect, it } from 'vitest';

import { umRecursoDaEtapa } from '../../shared/etapa-do-cronograma.testing';
import { ID_AVALIACAO } from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import {
  AjudantesDaPublicacaoRecusada,
  daEtapa,
  doRecurso,
} from './cronograma-recusas-da-publicacao.testing';

const ETAPA = '01960000-0000-7000-0000-0000000000e1';
const RECURSO = '01960000-0000-7000-0000-0000000000f1';
const RECURSO_GRAVADO_DE_NOVO = '01960000-0000-7000-0000-0000000000f2';
const CODIGO = 'uniplus.selecao.recurso.prazo_nao_positivo';
const PRAZO = 'cr-rec-0-0-prazo-interposicao-valor';
const NOTA_DO_RECURSO_REGRAVADO =
  'Sobre um recurso que foi gravado de novo depois desta tentativa de publicação.';

describe('CronogramaPassoComponent: recusas da publicação nas etapas', () => {
  let tela: ContextoDoCronograma;
  let ajudantes: AjudantesDaPublicacaoRecusada;

  usarCronograma((montada) => {
    tela = montada;
    ajudantes = new AjudantesDaPublicacaoRecusada(montada);
  });

  /** Uma etapa com `Id` e um recurso com `Id`, abertos para a recusa aparecer. */
  function etapaComRecurso(recursoId: string = RECURSO): void {
    tela.comFases(ID_AVALIACAO);
    tela.comEtapasEmFases(['AVALIACAO']);
    const etapa = tela.cronograma.etapas.at(0);
    etapa.controls.id.setValue(ETAPA);
    etapa.controls.recursos.setValue([
      umRecursoDaEtapa({ id: recursoId, ancora: 'cienciaIndividual', atoAncoraCodigo: '' }),
    ]);
    tela.expansao.abrirFases([0]);
    tela.expansao.abrirEtapas([0]);
    tela.expansao.abrirBloco(0, 'recursos');
    tela.detectar();
  }
  const campo = (id: string) => tela.nativo.querySelector<HTMLElement>(`#${id}`);

  describe('campo da etapa', () => {
    it('acha a etapa pelo Id, e não pela posição que a API deu', () => {
      etapaComRecurso();

      ajudantes.recusar({
        field: 'etapas[7].notaMaxima',
        code: CODIGO,
        message: 'A nota máxima não serve.',
        identificadores: [daEtapa(ETAPA)],
      });

      expect(ajudantes.bloco('cr-etapa-nota-maxima-erro-0')).toContain('A nota máxima não serve.');
      expect(campo('cr-etapa-nota-maxima-0')?.getAttribute('aria-invalid')).toBe('true');
    });

    it('leva ao campo da lista, e não a um item pela posição, a recusa de item de avaliação', () => {
      etapaComRecurso();

      ajudantes.recusar({
        field: 'etapas[0].itensDeAvaliacao[3].pontuacaoMaxima',
        code: CODIGO,
        message: 'A pontuação do item não serve.',
        identificadores: [daEtapa(ETAPA)],
      });

      expect(ajudantes.bloco('cr-etapa-0-itens-erro')).toContain('A pontuação do item não serve.');
    });

    it('leva ao bloco do passo a recusa de uma etapa que não existe mais', () => {
      etapaComRecurso();

      ajudantes.recusar({
        field: 'etapas[0].notaMaxima',
        code: CODIGO,
        message: 'Recusa da etapa removida.',
        identificadores: [daEtapa('01960000-0000-7000-0000-00000000ffff')],
      });

      expect(ajudantes.bloco('cr-recusas-da-publicacao-titulo')).toContain(
        'Recusas da última publicação que não apontam campo nesta tela',
      );
      expect(tela.nativo.textContent).toContain('Recusa da etapa removida.');
      expect(ajudantes.bloco('cr-etapa-nota-maxima-erro-0')).toBeNull();
    });
  });

  describe('recurso da etapa', () => {
    const recusarOPrazo = (): void =>
      ajudantes.recusar({
        field: 'etapas[4].recursos[2].prazoValor',
        code: CODIGO,
        message: 'O prazo precisa ser maior que zero.',
        identificadores: [daEtapa(ETAPA), doRecurso(RECURSO)],
      });

    it('acha o recurso pelo Id e liga a recusa ao campo do recurso', () => {
      etapaComRecurso();

      recusarOPrazo();

      expect(campo(PRAZO)?.getAttribute('aria-invalid')).toBe('true');
      expect(tela.nativo.textContent).toContain('O prazo precisa ser maior que zero.');
      expect(tela.nativo.textContent).toContain(CODIGO);
    });

    it('com o recurso gravado de novo, deixa a recusa no topo da etapa e não aponta outro recurso', () => {
      etapaComRecurso();
      recusarOPrazo();

      etapaComRecurso(RECURSO_GRAVADO_DE_NOVO);

      expect(campo(PRAZO)?.getAttribute('aria-invalid')).toBeNull();
      expect(ajudantes.bloco('cr-etapa-recusas-0')).toContain(
        'O prazo precisa ser maior que zero.',
      );
      expect(ajudantes.bloco('cr-etapa-recusas-0')).toContain(NOTA_DO_RECURSO_REGRAVADO);
      expect(ajudantes.bloco('cr-etapa-recusas-0')).toContain('conferida de novo');
    });

    it('com dois recursos gravados de novo e o mesmo código, mostra no topo da etapa as duas recusas', () => {
      etapaComRecurso(RECURSO_GRAVADO_DE_NOVO);

      ajudantes.recusar(
        {
          field: 'etapas[0].recursos[0].prazoValor',
          code: CODIGO,
          message: 'O prazo do primeiro recurso não serve.',
          identificadores: [daEtapa(ETAPA), doRecurso(RECURSO)],
        },
        {
          field: 'etapas[0].recursos[1].prazoValor',
          code: CODIGO,
          message: 'O prazo do segundo recurso não serve.',
          identificadores: [daEtapa(ETAPA), doRecurso('01960000-0000-7000-0000-0000000000f3')],
        },
      );

      expect(ajudantes.bloco('cr-etapa-recusas-0')).toContain(
        'O prazo do primeiro recurso não serve.',
      );
      expect(ajudantes.bloco('cr-etapa-recusas-0')).toContain(
        'O prazo do segundo recurso não serve.',
      );
    });

    it('sem o Id do recurso na recusa, deixa a recusa no topo da etapa', () => {
      etapaComRecurso();

      ajudantes.recusar({
        field: 'etapas[0].recursos[5].prazoValor',
        code: CODIGO,
        message: 'O prazo precisa ser maior que zero.',
        identificadores: [daEtapa(ETAPA)],
      });

      expect(campo(PRAZO)?.getAttribute('aria-invalid')).toBeNull();
      expect(ajudantes.bloco('cr-etapa-recusas-0')).toContain(NOTA_DO_RECURSO_REGRAVADO);
    });

    it('passa a recusa a conferir de novo quando a pessoa altera o recurso', () => {
      etapaComRecurso();
      recusarOPrazo();

      const recurso = tela.cronograma.etapas.at(0).controls.recursos.value[0];
      tela.cronograma.etapas.at(0).controls.recursos.setValue([{ ...recurso, prazoValor: '5' }]);
      tela.detectar();

      expect(campo(PRAZO)?.getAttribute('aria-invalid')).toBeNull();
      expect(tela.nativo.textContent).toContain('conferida de novo na próxima publicação');
    });

    it('"Ir ao campo" abre a fase, a etapa e o bloco dos recursos e põe o foco no prazo', async () => {
      tela.comFases(ID_AVALIACAO);
      tela.comEtapasEmFases(['AVALIACAO']);
      const etapa = tela.cronograma.etapas.at(0);
      etapa.controls.id.setValue(ETAPA);
      etapa.controls.recursos.setValue([
        umRecursoDaEtapa({ id: RECURSO, ancora: 'cienciaIndividual', atoAncoraCodigo: '' }),
      ]);
      recusarOPrazo();

      await ajudantes.irAoCampo(0);

      expect(tela.expansao.etapaAberta(0)).toBe(true);
      expect(tela.expansao.blocoAberto(0, 'recursos')).toBe(true);
      expect(document.activeElement).toBe(campo(PRAZO));
    });
  });
});
