import { TestBed } from '@angular/core/testing';
import { FatoCandidatoView } from '@uniplus/shared-data/configuracao';
import {
  OrigemCandidatos,
  StatusProcesso,
  type ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';
import { beforeEach, describe, expect, it } from 'vitest';
import { CatalogoDeFatos } from './catalogos/catalogo-de-fatos.service';
import {
  BASE,
  PROCESSO_ID,
  ROTA_PROCESSO,
  ROTA_DOCUMENTOS,
  ID_INSCRICAO,
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
    } = tela);
  });

  /**
   * O processo em que o candidato se inscreve deriva a modalidade da inscrição: o cronograma põe no
   * formulário as perguntas que as regras das modalidades ofertadas citam, mesmo sem exigência que
   * recorte por modalidade, e, sem a fase de inscrição, as deixa esperar por ela em vez de recusar
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
    const FORMULARIO = {
      finalidade: 'INSCRICAO',
      faseId: FASE.id,
      titulo: null,
      modeloOrigemId: null,
      modeloOrigemCodigo: null,
      etapas: [
        {
          codigo: 'DADOS_BASICOS',
          ordem: 0,
          tipo: 'SECAO',
          bloco: null,
          titulo: 'Dados básicos',
          descricao: null,
          aviso: null,
          exibicao: null,
        },
        {
          codigo: 'REVISAO_E_ACEITE',
          ordem: 1,
          tipo: 'BLOCO',
          bloco: 'REVISAO_E_ACEITE',
          titulo: 'Revisão e aceite',
          descricao: null,
          aviso: null,
          exibicao: null,
        },
      ],
      fatosColetados: [
        {
          fatoCodigo: 'NOME',
          ordem: 0,
          rotulo: 'Nome',
          tipoRenderizacao: 'TEXTO',
          obrigatoriedade: { tipo: 'SEMPRE', predicado: null },
          precondicao: null,
          opcoes: null,
          etapaCodigo: 'DADOS_BASICOS',
          formato: null,
          ajuda: null,
          pedirConfirmacao: false,
          restricoes: [],
          impedimento: null,
        },
      ],
      termos: [],
      grupos: [],
    };

    beforeEach(() => {
      store.patchObjectSection('identificacao', {
        origemCandidatos: OrigemCandidatos.inscricaoPropria,
      });
      TestBed.inject(CatalogoDeFatos).fatos.set([
        {
          codigo: 'CONCORRER_PCD',
          nome: 'Concorrer na reserva para pessoa com deficiência',
          dominio: 'BOOLEANO',
          origem: 'DECLARADO',
          cardinalidade: 'UNIVALORADO',
          binding: 'CAMPO_INSCRICAO:CONCORRER_PCD',
          escopo: 'CANDIDATO',
          fonteValores: null,
          ativo: true,
          valoresDominio: null,
        } as unknown as FatoCandidatoView,
      ]);
    });

    const gravarExigencias = (): Promise<{ valid: boolean; messages?: string[] }> =>
      exigencias.gravar(PROCESSO_ID);

    it('põe a pergunta das regras congeladas no processo com inscrição própria, sem exigência que recorte', async () => {
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
        status: StatusProcesso.publicado,
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

    it('lê a janela da fase em dia e hora, não em texto de campo', () => {
      emConsulta();

      expect(edicao.dataHoraLida('2026-03-01T08:00')).toBe('01/03/2026 08:00');
      expect(edicao.dataHoraLida('')).toBe('');
    });
  });
});
