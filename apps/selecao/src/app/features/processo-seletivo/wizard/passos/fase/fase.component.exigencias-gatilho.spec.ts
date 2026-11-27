import {
  EscopoFatoCodigo,
  ClassificacaoDeProtecaoCodigo,
  HipoteseLegalTratamentoCodigo,
} from '@uniplus/shared-data/configuracao';
import { codigoComRotulo } from '@uniplus/shared-testing/contrato';
import {
  DADO_SIM_OU_NAO,
  ORIGEM_DECLARADA,
  VALOR_UNICO,
} from '../../shared/valores-do-catalogo.testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { OperadorCodigo } from '@uniplus/shared-data/configuracao';
import { item } from '../formulario/formulario-de-inscricao.testing';
import { CatalogoDeFatos } from '../cronograma/catalogos/catalogo-de-fatos.service';
import { fase, ID_CPF, ID_HOMOLOGACAO } from './fase.testing';
import { identificadorDaRegra, usarFase, type ContextoDaFase } from './fase-passo.testing';

describe('FasePassoComponent', () => {
  let store: ContextoDaFase['store'];
  let detectar: ContextoDaFase['detectar'];
  let nativo: ContextoDaFase['nativo'];
  let comCronograma: ContextoDaFase['comCronograma'];
  let abrirFase: ContextoDaFase['abrirFase'];
  let exigencias: ContextoDaFase['exigencias'];
  let gatilho: ContextoDaFase['gatilho'];
  let documentos: ContextoDaFase['documentos'];

  usarFase((tela) => {
    ({ store, detectar, nativo, comCronograma, abrirFase, exigencias, gatilho, documentos } = tela);
  });

  describe('exigências documentais da fase', () => {
    it('exige o documento na fase aberta, e só nela', () => {
      comCronograma(
        fase({}),
        fase({ faseCanonicaId: ID_HOMOLOGACAO, codigo: 'HOMOLOGACAO_INSCRICOES', ordem: 2 }),
      );

      exigencias().alternarExigencia(ID_CPF, true);
      detectar();

      expect(exigencias().exigidoNestaFase(ID_CPF)).toBe(true);
      abrirFase(ID_HOMOLOGACAO);
      detectar();
      expect(exigencias().exigidoNestaFase(ID_CPF)).toBe(false);
    });

    /**
     * O gatilho só cita o que já se sabe do candidato na fase em que o documento é cobrado: o
     * dado coletado pela habilitação não condiciona documento da avaliação, que vem antes.
     */
    describe('gatilho com fatos de outros formulários', () => {
      const LAUDO = {
        id: '01960000-0000-7000-0000-0000000000e1',
        codigo: 'LAUDO_RECENTE',
        nome: 'Laudo recente',
        descricao: 'Laudo médico recente do candidato.',
        dominio: DADO_SIM_OU_NAO,
        origem: ORIGEM_DECLARADA,
        cardinalidade: VALOR_UNICO,
        valoresDominio: null,
        pontoResolucao: 'AVALIACAO',
        binding: 'CAMPO_FORMULARIO:LAUDO_RECENTE',
        valoresDominioDeclarados: null,
        fonteValores: null,
        ativo: true,
        escopo: codigoComRotulo(EscopoFatoCodigo.CANDIDATO, 'Candidato'),
        classificacaoProtecao: codigoComRotulo(ClassificacaoDeProtecaoCodigo.PESSOAL, 'Pessoal'),
        hipoteseLegal: codigoComRotulo(
          HipoteseLegalTratamentoCodigo.EXECUCAO_POLITICAS_PUBLICAS,
          'Execução de políticas públicas',
        ),
        finalidadeTratamento: 'Conferir o laudo do candidato.',
        protecaoAprovada: true,
        operadoresAdmitidos: [{ codigo: OperadorCodigo.IGUAL, rotulo: 'é' }],
      };

      beforeEach(() => {
        TestBed.inject(CatalogoDeFatos).fatos.set([LAUDO]);
        comCronograma(
          fase({}),
          fase({ faseCanonicaId: ID_HOMOLOGACAO, codigo: 'HOMOLOGACAO_INSCRICOES', ordem: 2 }),
        );
        store.patchObjectSection('formulario', {
          formularios: [
            {
              codigo: 'HABILITACAO',
              gravado: false,
              obrigatorio: true,
              consequenciaDaFaltaDeEnvio: null,
              modeloOrigemCodigo: null,
              faseCodigo: 'HOMOLOGACAO_INSCRICOES',
              conteudo: {
                titulo: null,
                paginas: [],
                termos: [],
                pressupostos: null,
                grupos: [],
                itens: [item('LAUDO_RECENTE', 0, '', { paginaCodigo: null })],
              },
            },
          ],
        });
        documentos().escolherDocumento(ID_CPF);
        documentos().acrescentarDocumento();
        gatilho().escolherExigidoDe(ID_CPF, 'quem');
        detectar();
      });

      it('não oferece na fase anterior o dado que a habilitação coleta', () => {
        expect(
          gatilho()
            .fatosDoGatilhoDoDocumento(identificadorDaRegra(exigencias(), ID_CPF))
            .map((fato) => fato.codigo),
        ).toEqual([]);
        expect(nativo.querySelector('.doc-item__gatilho')?.textContent).toContain(
          'Nenhum dado do candidato é conhecido até esta fase para condicionar o documento.',
        );
      });

      it('oferece na fase da habilitação o dado que ela coleta', () => {
        abrirFase(ID_HOMOLOGACAO);
        documentos().escolherDocumento(ID_CPF);
        documentos().acrescentarDocumento();
        gatilho().escolherExigidoDe(ID_CPF, 'quem');
        detectar();

        expect(
          gatilho()
            .fatosDoGatilhoDoDocumento(identificadorDaRegra(exigencias(), ID_CPF))
            .map((fato) => fato.codigo),
        ).toEqual(['LAUDO_RECENTE']);
      });

      it('mostra na condição gravada o que fazer para o gatilho valer', () => {
        gatilho().escreverCondicoes(ID_CPF, [
          { clausula: 1, fato: 'LAUDO_RECENTE', operador: 'IGUAL', valor: 'true' },
        ]);
        detectar();

        const alerta = nativo.querySelector('.doc-item__gatilho [role="alert"]');
        expect(alerta?.textContent).toContain(
          '“Laudo recente” só é conhecido na fase Homologação das inscrições, depois da fase em que o documento é exigido. Como resolver: exija o documento na fase Homologação das inscrições',
        );
      });
    });
  });
});
