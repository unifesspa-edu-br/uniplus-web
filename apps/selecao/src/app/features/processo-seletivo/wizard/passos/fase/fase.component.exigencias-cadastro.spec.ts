import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CaraterEtapa } from '@uniplus/shared-data/selecao';
import {
  exigenciasDaFase,
  todasAsExigencias,
} from '../../shared/exigencias/consulta-das-exigencias';
import { CatalogoDeDocumentos } from '../cronograma/catalogos/catalogo-de-documentos.service';
import {
  fase,
  ID_CPF,
  ID_ETAPA_DOCUMENTAL,
  ID_RECURSOS,
  ID_TIPO_ETAPA,
  TIPOS_DOCUMENTO,
} from './fase.testing';
import { usarFase, type ContextoDaFase } from './fase-passo.testing';

describe('FasePassoComponent', () => {
  let store: ContextoDaFase['store'];
  let detectar: ContextoDaFase['detectar'];
  let nativo: ContextoDaFase['nativo'];
  let comCronograma: ContextoDaFase['comCronograma'];
  let exigencias: ContextoDaFase['exigencias'];
  let eixoEtapa: ContextoDaFase['eixoEtapa'];
  let documentos: ContextoDaFase['documentos'];

  usarFase((tela) => {
    ({ store, detectar, nativo, comCronograma, exigencias, eixoEtapa, documentos } = tela);
  });

  describe('exigências documentais da fase', () => {
    /**
     * O rótulo visível encurtou para caber numa linha do grid dos campos; o nome acessível
     * continua dizendo de que a observação trata.
     */
    it('dá à observação o nome acessível completo com um rótulo visível curto', () => {
      comCronograma(fase({}));
      documentos().escolherDocumento(ID_CPF);
      documentos().acrescentarDocumento();
      detectar();

      const rotulo = nativo.querySelector(`label[for="fase-AVALIACAO-doc-obs-legal-${ID_CPF}-0"]`);
      const normalizar = (texto: string | null | undefined) => texto?.replace(/\s+/g, ' ').trim();
      expect(normalizar(rotulo?.textContent)).toBe('Observação sobre a norma (opcional)');

      const visivel = rotulo?.cloneNode(true) as HTMLElement;
      visivel.querySelectorAll('.sr-only').forEach((oculto) => oculto.remove());
      expect(normalizar(visivel.textContent)).toBe('Observação (opcional)');
      expect(normalizar(rotulo?.querySelector('.sr-only')?.textContent)).toBe('sobre a norma');
    });

    /**
     * A busca deixou de ser um campo à parte: quem filtra é o próprio campo de escolha
     * (`ui-combobox`, coberto no spec dele). O que a fase ainda responde é o que sobra do
     * catálogo para oferecer.
     */
    it('tira do catálogo oferecido o que a fase já exige', () => {
      comCronograma(fase({}));
      const antes = documentos().documentosAlcancados();

      documentos().escolherDocumento(ID_CPF);
      documentos().acrescentarDocumento();
      detectar();

      expect(documentos().documentosAlcancados()).toBe(antes - 1);
      expect(documentos().documentoAAcrescentar(), 'o campo volta ao estado neutro').toBe('');
    });

    it('mostra indisponível, com o motivo, o tipo cuja proteção de dados aguarda aprovação', () => {
      TestBed.inject(CatalogoDeDocumentos).tiposDocumento.set([
        { ...TIPOS_DOCUMENTO[0], protecaoAprovada: false },
      ]);
      comCronograma(fase({}));

      const opcao = documentos()
        .documentosDisponiveis()
        .flatMap((grupo) => grupo.options)
        .find((o) => o.value === ID_CPF);

      expect(opcao?.disabled).toBe(true);
      expect(opcao?.label).toContain('aguarda a aprovação da proteção de dados');
    });

    /**
     * O tipo removido do cadastro sai do catálogo vivo, e a exigência que o cita continua no
     * rascunho — a gravação seguinte a reenvia inteira. Sem sintetizar a linha, ela sumia da
     * tela: não dava para conferir nem remover o que continuava sendo exigido.
     */
    it('mantém à vista o documento cujo tipo saiu do cadastro', () => {
      comCronograma(fase({}));
      documentos().escolherDocumento(ID_CPF);
      documentos().acrescentarDocumento();
      detectar();
      expect(
        exigencias()
          .documentosDaFase()
          .map((doc) => doc.id),
      ).toEqual([ID_CPF]);

      // O cadastro remove o tipo: ele deixa de vir no catálogo.
      TestBed.inject(CatalogoDeDocumentos).tiposDocumento.set(
        TIPOS_DOCUMENTO.filter((tipo) => tipo.id !== ID_CPF),
      );
      detectar();

      expect(
        exigencias()
          .documentosDaFase()
          .map((doc) => doc.id),
        'a exigência continua no rascunho e continua sendo reenviada — precisa continuar à vista',
      ).toEqual([ID_CPF]);
      expect(
        documentos()
          .documentosDisponiveis()
          .flatMap((grupo) => grupo.options),
        'e não volta a ser oferecida para quem ainda não a exige',
      ).not.toContainEqual(expect.objectContaining({ value: ID_CPF }));
    });

    it('remove o documento e o devolve ao seletor', () => {
      comCronograma(fase({}));
      documentos().escolherDocumento(ID_CPF);
      documentos().acrescentarDocumento();
      detectar();

      documentos().removerDocumento(ID_CPF, document.body);
      detectar();

      expect(exigencias().documentosDaFase()).toEqual([]);
      expect(
        documentos()
          .documentosDisponiveis()
          .flatMap((grupo) => grupo.options),
      ).toContainEqual(expect.objectContaining({ value: ID_CPF }));
    });

    it('recorta por fase partindo das fases que o edital tem hoje', () => {
      comCronograma(fase({}), fase({ faseCanonicaId: ID_RECURSOS, codigo: 'RECURSOS', ordem: 2 }));

      exigencias().valerEmTodasAsFases(ID_CPF);
      detectar();
      exigencias().recortarPorFase(ID_CPF);
      detectar();

      // Recortar materializa a exigência em cada fase do edital — congelar o conjunto atual
      // preserva o que valia, em vez de apagar tudo por causa de uma decisão numa fase só.
      expect(
        todasAsExigencias(store.draft().documentos)
          .filter((exigencia) => exigencia.tipoDocumentoId === ID_CPF)
          .map((exigencia) => exigencia.faseCodigo),
      ).toEqual(['AVALIACAO', 'RECURSOS']);
      expect(store.draft().documentos.emTodasAsFases).not.toContain(ID_CPF);
    });

    /**
     * A habilitação do certame regional tem oito etapas e cada uma pede o seu comprovante.
     * Sem dizer qual etapa coleta, os oito documentos apareceriam nas oito.
     */
    it('declara em qual etapa da fase o documento é coletado', () => {
      comCronograma(fase({}));
      store.patchObjectSection('cronograma', {
        etapas: [
          {
            id: ID_ETAPA_DOCUMENTAL,
            nome: 'Análise documental',
            carater: CaraterEtapa.eliminatoria,
            tipoEtapaOrigemId: ID_TIPO_ETAPA,
            peso: '',
            notaMinima: '',
            ordem: 1,
            faseCodigo: 'AVALIACAO',
            produtos: [],
            inicio: '',
            fim: '',
            emiteParecerIndividual: false,
            bancas: [],
            recursos: [],
          },
        ],
      });
      documentos().escolherDocumento(ID_CPF);
      documentos().acrescentarDocumento();
      detectar();

      expect(
        exigencias()
          .etapasDaFaseAberta()
          .map((etapa) => etapa.nome),
      ).toEqual(['Análise documental']);

      eixoEtapa().escolherEtapaDoDocumento(ID_CPF, ID_ETAPA_DOCUMENTAL);
      detectar();

      expect(exigencias().etapaDoDocumento(ID_CPF)).toBe(ID_ETAPA_DOCUMENTAL);
      // A etapa é campo da exigência daquela fase, que é onde ela vive no contrato.
      expect(exigenciasDaFase(store.draft().documentos, 'AVALIACAO')[0].etapaId).toBe(
        ID_ETAPA_DOCUMENTAL,
      );
    });

    /**
     * Voltar o documento à fase inteira tira a etapa do registro: guardá-la como texto
     * vazio faria o comando declarar uma etapa que ninguém escolheu.
     */
    it('devolver o documento à fase inteira apaga a etapa declarada', () => {
      comCronograma(fase({}));
      documentos().escolherDocumento(ID_CPF);
      documentos().acrescentarDocumento();
      eixoEtapa().escolherEtapaDoDocumento(ID_CPF, ID_ETAPA_DOCUMENTAL);
      detectar();

      eixoEtapa().escolherEtapaDoDocumento(ID_CPF, '');
      detectar();

      expect(exigenciasDaFase(store.draft().documentos, 'AVALIACAO')[0].etapaId).toBeNull();
    });

    it('a fase sem etapa não oferece onde coletar', () => {
      comCronograma(fase({}));

      expect(exigencias().etapasDaFaseAberta()).toEqual([]);
    });

    it('tira o documento do processo ao desmarcar a última fase que o exigia', () => {
      comCronograma(fase({}));

      exigencias().alternarExigencia(ID_CPF, true);
      detectar();
      exigencias().alternarExigencia(ID_CPF, false);
      detectar();

      // Desmarcar tira a exigência DESTA fase; o mesmo documento em outra continua, porque
      // são exigências distintas.
      expect(exigenciasDaFase(store.draft().documentos, 'AVALIACAO')).toEqual([]);
    });
  });
});
