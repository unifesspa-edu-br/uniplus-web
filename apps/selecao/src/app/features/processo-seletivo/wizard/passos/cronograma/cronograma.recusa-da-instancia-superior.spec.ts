import { describe, expect, it } from 'vitest';

import { PARAMETROS_COM_INSTANCIA_SUPERIOR } from '../../shared/configuracao-do-recurso/parametros-do-recurso.testing';
import { umRecursoDaEtapa } from '../../shared/etapa-do-cronograma.testing';
import { prefixoDoRecursoDaFase } from '../fase/ids-da-fase';
import { ID_AVALIACAO } from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import {
  AjudantesDaPublicacaoRecusada,
  daEtapa,
  daFase,
  doRecurso,
} from './cronograma-recusas-da-publicacao.testing';
import {
  AjudantesDeRecusasDasFases,
  REGRA_DO_RECURSO,
} from './cronograma-recusas-das-fases.testing';

const CODIGO = 'uniplus.selecao.banca.tipo_nao_admite_instancia_superior';
const ETAPA = '01960000-0000-7000-0000-0000000000e1';
const RECURSO = '01960000-0000-7000-0000-0000000000f1';
const MENSAGEM_DA_FASE =
  'O recurso da fase admite instância superior, mas o item se encerra na 1ª.';
const MENSAGEM_DA_ETAPA = 'O recurso da etapa admite instância superior, mas o item se encerra.';
const DA_FASE = `${prefixoDoRecursoDaFase(ID_AVALIACAO)}-superior`;
const DA_ETAPA = 'cr-rec-0-0-superior';
const LISTA_DA_FASE = 'fase-AVALIACAO-recurso-recusa';
const LISTA_DA_ETAPA = 'cr-rec-recusas-0-0';

describe('CronogramaPassoComponent: recusa da instância superior pela publicação', () => {
  let tela: ContextoDoCronograma;
  let publicacao: AjudantesDaPublicacaoRecusada;
  let fases: AjudantesDeRecusasDasFases;

  usarCronograma((montada) => {
    tela = montada;
    publicacao = new AjudantesDaPublicacaoRecusada(montada);
    fases = new AjudantesDeRecusasDasFases(montada);
  });

  const campo = (id: string) => tela.nativo.querySelector<HTMLElement>(`#${id}`);
  const vezes = (texto: string) => (tela.nativo.textContent ?? '').split(texto).length - 1;

  function comRecursoNaFase(): void {
    tela.comFases(ID_AVALIACAO);
    tela.comUmaEtapa();
    fases.declararRegraDeRecurso({ ...REGRA_DO_RECURSO, ...PARAMETROS_COM_INSTANCIA_SUPERIOR });
    tela.expansao.abrirFases([0]);
    tela.detectar();
  }

  function comRecursoNaEtapa(): void {
    tela.comFases(ID_AVALIACAO);
    tela.comEtapasEmFases(['AVALIACAO']);
    const etapa = tela.cronograma.etapas.at(0);
    etapa.controls.id.setValue(ETAPA);
    etapa.controls.recursos.setValue([
      umRecursoDaEtapa({
        ...PARAMETROS_COM_INSTANCIA_SUPERIOR,
        id: RECURSO,
        ancora: 'CIENCIA_INDIVIDUAL',
        atoAncoraCodigo: '',
      }),
    ]);
    tela.expansao.abrirFases([0]);
    tela.expansao.abrirEtapas([0]);
    tela.expansao.abrirBloco(0, 'recursos');
    tela.detectar();
  }

  const recusarNaFase = () =>
    publicacao.recusar({
      field: 'fases[0].regraRecurso.admiteInstanciaSuperior',
      code: CODIGO,
      message: MENSAGEM_DA_FASE,
      identificadores: [daFase('AVALIACAO')],
    });
  const recusarNaEtapa = () =>
    publicacao.recusar({
      field: 'etapas[0].recursos[0].admiteInstanciaSuperior',
      code: CODIGO,
      message: MENSAGEM_DA_ETAPA,
      identificadores: [daEtapa(ETAPA), doRecurso(RECURSO)],
    });

  describe('na regra de recurso da fase', () => {
    it('mostra a mensagem junto da pergunta e na lista do "Ir ao campo", e em mais nenhum lugar', () => {
      comRecursoNaFase();

      recusarNaFase();

      expect(publicacao.bloco(`${DA_FASE}-recusas`)).toContain(MENSAGEM_DA_FASE);
      expect(publicacao.bloco(LISTA_DA_FASE)).toContain(MENSAGEM_DA_FASE);
      expect(vezes(MENSAGEM_DA_FASE)).toBe(2);
      expect(campo(`${DA_FASE}-sim`)?.getAttribute('aria-invalid')).toBe('true');
      expect(
        campo(`${DA_FASE}-sim`)?.closest('fieldset')?.getAttribute('aria-describedby'),
      ).toContain(`${DA_FASE}-recusas`);
    });

    it('"Ir ao campo" leva o foco à opção marcada da pergunta', async () => {
      comRecursoNaFase();
      recusarNaFase();

      await publicacao.irAoCampo(0);

      expect(document.activeElement).toBe(campo(`${DA_FASE}-sim`));
    });
  });

  describe('no recurso da etapa', () => {
    it('mostra a mensagem junto da pergunta e na lista do "Ir ao campo", e em mais nenhum lugar', () => {
      comRecursoNaEtapa();

      recusarNaEtapa();

      expect(publicacao.bloco(`${DA_ETAPA}-recusas`)).toContain(MENSAGEM_DA_ETAPA);
      expect(publicacao.bloco(LISTA_DA_ETAPA)).toContain(MENSAGEM_DA_ETAPA);
      expect(vezes(MENSAGEM_DA_ETAPA)).toBe(2);
      expect(campo(`${DA_ETAPA}-sim`)?.getAttribute('aria-invalid')).toBe('true');
    });

    it('"Ir ao campo" leva o foco à opção marcada da pergunta', async () => {
      comRecursoNaEtapa();
      recusarNaEtapa();

      await publicacao.irAoCampo(0);

      expect(document.activeElement).toBe(campo(`${DA_ETAPA}-sim`));
    });
  });
});
