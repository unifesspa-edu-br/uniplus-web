import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { CatalogoDeFatos } from '../cronograma/catalogos/catalogo-de-fatos.service';
import { fase, ID_CPF, ID_RECURSOS } from './fase.testing';
import { usarFase, type ContextoDaFase } from './fase-passo.testing';

describe('FasePassoComponent', () => {
  let componente: ContextoDaFase['componente'];
  let store: ContextoDaFase['store'];
  let detectar: ContextoDaFase['detectar'];
  let nativo: ContextoDaFase['nativo'];
  let comCronograma: ContextoDaFase['comCronograma'];
  let exigencias: ContextoDaFase['exigencias'];
  let gatilho: ContextoDaFase['gatilho'];
  let documentos: ContextoDaFase['documentos'];

  usarFase((tela) => {
    ({ componente, store, detectar, nativo, comCronograma, exigencias, gatilho, documentos } =
      tela);
  });

  describe('exigências documentais da fase', () => {
    it('exige o documento na fase aberta, e só nela', () => {
      comCronograma(fase({}), fase({ faseCanonicaId: ID_RECURSOS, codigo: 'RECURSOS', ordem: 2 }));

      exigencias().alternarExigencia(ID_CPF, true);
      detectar();

      expect(exigencias().exigidoNestaFase(ID_CPF)).toBe(true);
      componente.abrirFase(ID_RECURSOS);
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
        dominio: 'BOOLEANO',
        origem: 'DECLARADO',
        cardinalidade: 'ESCALAR',
        valoresDominio: null,
        pontoResolucao: 'AVALIACAO',
        binding: 'CAMPO_FORMULARIO:LAUDO_RECENTE',
        valoresDominioDeclarados: null,
        fonteValores: null,
        ativo: true,
        escopo: 'CANDIDATO',
        classificacaoProtecao: 'PESSOAL',
        hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
        finalidadeTratamento: 'Conferir o laudo do candidato.',
        protecaoAprovada: true,
      };

      beforeEach(() => {
        TestBed.inject(CatalogoDeFatos).fatos.set([LAUDO]);
        comCronograma(
          fase({}),
          fase({ faseCanonicaId: ID_RECURSOS, codigo: 'RECURSOS', ordem: 2 }),
        );
        store.patchObjectSection('formulario', {
          outrasFinalidades: [
            {
              finalidade: 'HABILITACAO',
              faseCodigo: 'RECURSOS',
              conteudo: {
                titulo: null,
                etapas: [],
                termos: [],
                pressupostos: null,
                grupos: [],
                itens: [
                  {
                    fatoCodigo: 'LAUDO_RECENTE',
                    ordem: 0,
                    rotulo: 'Laudo recente',
                    tipoRenderizacao: 'BOOLEANO',
                    obrigatoriedade: 'SEMPRE',
                    precondicao: null,
                    etapaCodigo: null,
                    predicadoObrigatoriedade: null,
                    ajuda: null,
                    pedirConfirmacao: false,
                  },
                ],
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
            .fatosDoGatilhoDoDocumento(ID_CPF)
            .map((fato) => fato.codigo),
        ).toEqual([]);
        expect(nativo.querySelector('.doc-item__gatilho')?.textContent).toContain(
          'Nenhum dado do candidato é conhecido até esta fase para condicionar o documento.',
        );
      });

      it('oferece na fase da habilitação o dado que ela coleta', () => {
        componente.abrirFase(ID_RECURSOS);
        documentos().escolherDocumento(ID_CPF);
        documentos().acrescentarDocumento();
        gatilho().escolherExigidoDe(ID_CPF, 'quem');
        detectar();

        expect(
          gatilho()
            .fatosDoGatilhoDoDocumento(ID_CPF)
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
          '“Laudo recente” só é conhecido na fase Recursos, depois da fase em que o documento é exigido. Como resolver: exija o documento na fase Recursos',
        );
      });
    });
  });
});
