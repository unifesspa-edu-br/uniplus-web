import { EscopoFatoCodigo } from '@uniplus/shared-data/configuracao';
import { codigoComRotulo } from '@uniplus/shared-testing/contrato';
import { BlocoSistemaCodigo } from '@uniplus/shared-data/selecao';
import { PCD } from '../../shared/gatilho-de-exigencia.testing';
import { TestBed } from '@angular/core/testing';
import {
  OrigemCandidatosCodigo,
  SituacaoDoProcessoSeletivoCodigo,
  type ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  campoDoServidor,
  paginaDoServidor,
  formularioDoServidor,
} from '../../shared/formulario-do-servidor.testing';
import { CatalogoDeFatos } from './catalogos/catalogo-de-fatos.service';
import {
  BASE,
  PROCESSO_ID,
  ROTA_PROCESSO,
  ROTA_DOCUMENTOS,
  ID_INSCRICAO,
  ID_RESULTADO,
  FASE_SUMIDA,
  PROCESSO_COM_ETAPA_GRAVADA,
} from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';

describe('CronogramaPassoComponent: modalidades ofertadas e consulta', () => {
  let edicao: ContextoDoCronograma['edicao'];
  let exigencias: ContextoDoCronograma['exigencias'];
  let cronograma: ContextoDoCronograma['cronograma'];
  let store: ContextoDoCronograma['store'];
  let controller: ContextoDoCronograma['controller'];
  let detectar: ContextoDoCronograma['detectar'];
  let nativo: ContextoDoCronograma['nativo'];
  let proximoPasso: ContextoDoCronograma['proximoPasso'];
  let comFases: ContextoDoCronograma['comFases'];
  let comFaseAjustada: ContextoDoCronograma['comFaseAjustada'];

  usarCronograma((tela) => {
    ({
      edicao,
      exigencias,
      cronograma,
      store,
      controller,
      detectar,
      nativo,
      proximoPasso,
      comFases,
      comFaseAjustada,
    } = tela);
  });

  /**
   * O processo em que o candidato se inscreve deriva a modalidade da inscrição: o cronograma põe no
   * formulário as perguntas que as regras das modalidades ofertadas citam, mesmo sem exigência que
   * seleção de modalidades, e, sem a fase de inscrição, as deixa esperar por ela em vez de recusar
   * o cronograma.
   */
  describe('perguntas das modalidades ofertadas', () => {
    const ROTA_DERIVACAO = `${ROTA_PROCESSO}/regras-derivacao`;
    const ROTA_INSCRICAO = `${BASE}/api/selecao/admin/processos-seletivos/${PROCESSO_ID}/formularios/INSCRICAO`;
    const FASE = { id: 'F-INSCRICAO', codigo: 'INSCRICAO', coletaInscricao: true };
    const DISTRIBUICAO = [
      {
        modalidades: [
          { codigo: 'AC', descricao: 'Ampla concorrência', regraDeAplicabilidade: [] },
          {
            codigo: 'AC_PCD',
            descricao: 'Pessoa com deficiência',
            regraDeAplicabilidade: [[{ fato: 'CONCORRER_PCD', operador: 'IGUAL', valor: true }]],
          },
        ],
      },
    ];
    const FORMULARIO = formularioDoServidor({
      faseId: FASE.id,
      paginas: [
        paginaDoServidor('DADOS_BASICOS', 0, null, 'Dados básicos'),
        paginaDoServidor(
          'REVISAO_E_ACEITE',
          1,
          BlocoSistemaCodigo.REVISAO_E_ACEITE,
          'Revisão e aceite',
        ),
      ],
      coleta: { itens: [campoDoServidor('NOME', 0, 'DADOS_BASICOS')], grupos: [] },
    });

    beforeEach(() => {
      store.patchObjectSection('identificacao', {
        origemCandidatos: OrigemCandidatosCodigo.INSCRICAO_PROPRIA,
      });
      TestBed.inject(CatalogoDeFatos).fatos.set([
        {
          ...PCD,
          escopo: codigoComRotulo(EscopoFatoCodigo.CANDIDATO, 'Candidato'),
          codigo: 'CONCORRER_PCD',
          nome: 'Concorrer na reserva para pessoa com deficiência',
          binding: 'CAMPO_INSCRICAO:CONCORRER_PCD',
        },
      ]);
    });

    const gravarExigencias = (): Promise<{ valid: boolean; messages?: string[] }> =>
      exigencias.gravar(PROCESSO_ID);

    it('põe a pergunta das regras congeladas no processo com inscrição própria, sem exigência que restrinja as modalidades', async () => {
      const gravacao = gravarExigencias();
      controller.expectOne(ROTA_PROCESSO).flush({
        ...PROCESSO_COM_ETAPA_GRAVADA,
        cronogramaFases: [FASE],
        formularios: [FORMULARIO],
        distribuicaoVagas: DISTRIBUICAO,
        regrasDerivacao: [],
      });
      await proximoPasso();

      controller
        .expectOne((r) => r.method === 'PUT' && r.url === ROTA_INSCRICAO)
        .flush(null, { status: 204, statusText: 'No Content' });
      await proximoPasso();
      const itens = controller.expectOne(
        (r) => r.method === 'PUT' && r.url === `${ROTA_INSCRICAO}/itens`,
      );
      expect(itens.request.body.itens.map((i: { fatoCodigo: string }) => i.fatoCodigo)).toEqual([
        'CONCORRER_PCD',
      ]);
      itens.flush(null, { status: 204, statusText: 'No Content' });
      await proximoPasso();
      controller.match((r) => r.method === 'GET' && r.url === ROTA_PROCESSO);
      await proximoPasso();

      controller.expectOne(ROTA_DOCUMENTOS).flush(null, { status: 204, statusText: 'No Content' });
      await expect(gravacao).resolves.toEqual({ valid: true });
      controller.expectNone((r) => r.url.startsWith(ROTA_DERIVACAO));
    });

    it('sem fase de inscrição, grava o cronograma e deixa as perguntas esperarem pela fase', async () => {
      const gravacao = gravarExigencias();
      controller.expectOne(ROTA_PROCESSO).flush({
        ...PROCESSO_COM_ETAPA_GRAVADA,
        formularios: [],
        distribuicaoVagas: DISTRIBUICAO,
        regrasDerivacao: [],
      });
      await proximoPasso();

      controller.expectOne(ROTA_DOCUMENTOS).flush(null, { status: 204, statusText: 'No Content' });
      await expect(gravacao).resolves.toEqual({ valid: true });
      controller.expectNone((r) => r.url.startsWith(ROTA_INSCRICAO));
    });
  });

  describe('em consulta', () => {
    function emConsulta(): void {
      comFases(ID_INSCRICAO);
      detectar();
      cronograma.acrescentarEtapa('COLETA_INSCRICAO');
      store.remoteSnapshot.set({
        situacao: {
          codigo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
          rotulo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
        },
      } as unknown as ProcessoSeletivoDto);
      detectar();
    }

    /** O processo publicado só se lê: a linha do tempo vira texto, sem campo nem ação de edição. */
    it('lê fases e etapas como texto, sem campo nem botão', () => {
      emConsulta();

      expect(nativo.querySelectorAll('select, input, textarea, button')).toHaveLength(0);
      const leitura = (nativo.textContent ?? '').replace(/\s+/g, ' ');
      expect(leitura).toContain('Etapas desta fase');
      expect(leitura).toContain('Convenção de contagem de prazo');
      expect(leitura).not.toContain('Acrescentar');
    });

    it('nomeia pelo que o processo congelou o tipo da etapa que o cadastro já não tem', () => {
      emConsulta();
      const etapa = cronograma.etapas.at(0);
      const removido = '01960000-0000-7000-0000-0000000000e9';
      etapa.controls.tipoEtapaOrigemId.setValue(removido);
      etapa.controls.tipoCongelado.setValue({
        origemId: removido,
        nome: 'Prova de redação',
        notaDeOrigemNoEnem: false,
      });

      expect(edicao.etapaLida(etapa).tipo).toBe('Prova de redação (removido do cadastro)');
    });

    it('lê o Fim que a fase guarda quando o período não é obrigatório, e diz que o início é da execução', () => {
      comFaseAjustada(ID_RESULTADO, {
        produtos: [{ atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' }],
        inicio: null,
        fim: '2026-03-10T18:00:00-03:00',
      });
      store.remoteSnapshot.set({
        situacao: {
          codigo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
          rotulo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
        },
      } as unknown as ProcessoSeletivoDto);
      detectar();

      const leitura = (nativo.textContent ?? '').replace(/\s+/g, ' ');
      expect(leitura).toContain('Fim');
      expect(leitura).toContain('10/03/2026 18:00');
      expect(leitura).toContain('O início desta fase não consta do edital');
      expect(leitura).not.toContain('Início');
    });

    it('lê o Fim guardado da fase que o catálogo e o processo não descrevem', () => {
      comFaseAjustada(FASE_SUMIDA, { fim: '2026-03-10T18:00:00-03:00' });
      store.remoteSnapshot.set({
        situacao: {
          codigo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
          rotulo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
        },
      } as unknown as ProcessoSeletivoDto);
      detectar();

      const leitura = (nativo.textContent ?? '').replace(/\s+/g, ' ');
      expect(leitura).toContain('não está no catálogo carregado');
      expect(leitura).toContain('10/03/2026 18:00');
    });

    it('diz que o Fim da fase que o catálogo e o processo não descrevem está no horário de Belém', () => {
      comFaseAjustada(FASE_SUMIDA, { fim: '2026-03-10T18:00:00-03:00' });
      store.remoteSnapshot.set({
        situacao: {
          codigo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
          rotulo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
        },
      } as unknown as ProcessoSeletivoDto);
      detectar();

      const leitura = (nativo.textContent ?? '').replace(/\s+/g, ' ');
      expect(leitura).toContain('Data e hora no horário de Belém');
    });

    it('lê a janela da fase em dia e hora, não em texto de campo', () => {
      emConsulta();

      expect(edicao.dataHoraLida('2026-03-01T08:00')).toBe('01/03/2026 08:00');
      expect(edicao.dataHoraLida('')).toBe('');
    });
  });
});
