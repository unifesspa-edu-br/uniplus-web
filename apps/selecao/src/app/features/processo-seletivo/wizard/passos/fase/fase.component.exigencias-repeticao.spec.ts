import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { exigenciasLocalizadasDaFase } from '../../shared/exigencias/consulta-das-exigencias';
import {
  comRepeticao,
  exigenciaNova,
  folhaDe,
} from '../../shared/exigencias/exigencias-documentais';
import { CatalogoDeFatos } from '../cronograma/catalogos/catalogo-de-fatos.service';
import { fase, ID_AVALIACAO, ID_CPF, ID_RECURSOS } from './fase.testing';
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
    /**
     * O documento se repete pelas ocorrências de um grupo repetível do formulário — cada membro da
     * composição familiar entrega o seu —, e o gatilho dele passa a ler, em cada ocorrência, os
     * campos do grupo (ADR-0138, UNI-REQ-0069).
     */
    describe('repetir o documento pelas ocorrências de um grupo do formulário', () => {
      const PARENTESCO = {
        id: '01960000-0000-7000-0000-0000000000e2',
        codigo: 'PARENTESCO',
        nome: 'Parentesco',
        descricao: 'Grau de parentesco do membro.',
        dominio: 'CATEGORICO',
        origem: 'DECLARADO',
        cardinalidade: 'ESCALAR',
        valoresDominio: ['FILHO', 'CONJUGE'],
        pontoResolucao: 'AVALIACAO',
        binding: 'CAMPO_FORMULARIO:PARENTESCO',
        valoresDominioDeclarados: null,
        fonteValores: null,
        ativo: true,
        escopo: 'MEMBRO_GRUPO',
        classificacaoProtecao: 'PESSOAL',
        hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
        finalidadeTratamento: 'Compor a renda familiar.',
        protecaoAprovada: true,
      };
      const SUBITEM = {
        fatoCodigo: 'PARENTESCO',
        ordem: 0,
        rotulo: 'Parentesco',
        tipoRenderizacao: 'SELECAO_UNICA',
        obrigatoriedade: 'SEMPRE',
        precondicao: null,
        etapaCodigo: null,
        predicadoObrigatoriedade: null,
        ajuda: null,
        pedirConfirmacao: false,
      };
      const FAMILIA = {
        codigo: 'FAMILIA',
        ordem: 0,
        rotulo: 'Composição familiar',
        etapaCodigo: null,
        minimo: 1,
        maximo: null,
        exibicao: null,
        obrigatoriedade: 'SEMPRE',
        predicadoObrigatoriedade: null,
        subitens: [SUBITEM],
        incluiCandidato: true,
      };

      /** A habilitação, respondida na fase Recursos, com ou sem a composição familiar. */
      function comHabilitacao(grupos: readonly (typeof FAMILIA)[]): void {
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
                itens: [],
                grupos: [...grupos],
              },
            },
          ],
        });
      }

      function exigirCpfNaFase(faseCanonicaId: string): void {
        componente.abrirFase(faseCanonicaId);
        documentos().escolherDocumento(ID_CPF);
        documentos().acrescentarDocumento();
        gatilho().escolherExigidoDe(ID_CPF, 'quem');
        detectar();
      }

      const campoRepetirPor = () =>
        nativo.querySelector<HTMLSelectElement>(`select[id$="doc-repeticao-${ID_CPF}"]`);
      const folhaDoCpf = () =>
        exigenciasLocalizadasDaFase(
          store.draft().documentos,
          componente.faseDoRascunho()?.codigo ?? '',
        ).find(({ documento }) => documento.tipoDocumentoId === ID_CPF);

      beforeEach(() => {
        TestBed.inject(CatalogoDeFatos).fatos.set([PARENTESCO]);
        comCronograma(
          fase({}),
          fase({ faseCanonicaId: ID_RECURSOS, codigo: 'RECURSOS', ordem: 2 }),
        );
      });

      it('sem grupo repetível nos formulários, não oferece repetir e diz de onde vem a lista', () => {
        comHabilitacao([]);
        exigirCpfNaFase(ID_RECURSOS);

        expect(campoRepetirPor()).toBeNull();
        expect(nativo.textContent).toContain('Nenhum formulário do processo tem grupo repetível');
      });

      it('escolher o grupo repete a folha e abre ao gatilho os campos dele', () => {
        comHabilitacao([FAMILIA]);
        exigirCpfNaFase(ID_RECURSOS);

        expect(
          Array.from(campoRepetirPor()?.options ?? []).map((opcao) => opcao.text.trim()),
        ).toEqual(['Não repete: um por candidato', 'Composição familiar (FAMILIA)']);
        expect(
          gatilho()
            .fatosDoGatilhoDoDocumento(ID_CPF)
            .map((fato) => fato.codigo),
        ).toEqual([]);

        gatilho().escolherRepeticao(ID_CPF, 'FAMILIA');
        detectar();

        expect(folhaDoCpf()?.repeticao).toEqual({ grupo: 'FAMILIA', herdada: false });
        expect(
          gatilho()
            .fatosDoGatilhoDoDocumento(ID_CPF)
            .map((fato) => fato.codigo),
        ).toEqual(['PARENTESCO']);
        expect(documentos().resumos()[0]?.repeticao).toBe(
          'Um por ocorrência de Composição familiar',
        );
      });

      it('não oferece o grupo respondido depois da fase do documento, e diz por quê', () => {
        comHabilitacao([FAMILIA]);
        exigirCpfNaFase(ID_AVALIACAO);

        expect(Array.from(campoRepetirPor()?.options ?? []).map((opcao) => opcao.value)).toEqual([
          '',
        ]);
        expect(nativo.textContent).toContain(
          'Não oferecidos aqui: “Composição familiar”, respondido na fase Recursos, depois desta.',
        );
      });

      it('a repetição que deixou de valer fica marcada no campo, com o que fazer', () => {
        comHabilitacao([FAMILIA]);
        exigirCpfNaFase(ID_AVALIACAO);
        store.patchSection(
          'documentos',
          comRepeticao(store.draft().documentos, ID_CPF, 'AVALIACAO', 'FAMILIA'),
        );
        detectar();

        const campo = campoRepetirPor();
        expect(campo?.selectedOptions[0]?.text.trim()).toBe('Composição familiar (não vale mais)');
        expect(campo?.getAttribute('aria-invalid')).toBe('true');
        expect(nativo.querySelector(`[id$="doc-repeticao-erro-${ID_CPF}"]`)?.textContent).toContain(
          'O grupo “Composição familiar” é respondido na fase Recursos, depois da fase em que o documento é exigido.',
        );
      });

      it('dentro de grupo de alternativas que se repete, mostra a repetição herdada só para leitura', () => {
        comHabilitacao([FAMILIA]);
        componente.abrirFase(ID_RECURSOS);
        const folha = folhaDe(exigenciaNova(ID_CPF, 'RECURSOS'));
        store.patchSection('documentos', {
          raizes: [
            {
              ...folha,
              tipo: 'OU',
              documento: null,
              filhos: [folha],
              repetePorEntidade: 'FAMILIA',
            },
          ],
          emTodasAsFases: [],
        });
        detectar();
        documentos().alternarEdicao(ID_CPF);
        detectar();

        expect(campoRepetirPor()).toBeNull();
        expect(nativo.textContent).toContain(
          'Composição familiar, declarado no grupo de alternativas',
        );
        expect(
          gatilho()
            .fatosDoGatilhoDoDocumento(ID_CPF)
            .map((fato) => fato.codigo),
        ).toEqual(['PARENTESCO']);
      });

      it('a repetição herdada que deixou de valer diz o que fazer sem apontar campo que o documento não tem', () => {
        comHabilitacao([]);
        componente.abrirFase(ID_RECURSOS);
        const folha = folhaDe(exigenciaNova(ID_CPF, 'RECURSOS'));
        store.patchSection('documentos', {
          raizes: [
            {
              ...folha,
              tipo: 'OU',
              documento: null,
              filhos: [folha],
              repetePorEntidade: 'FAMILIA',
            },
          ],
          emTodasAsFases: [],
        });
        detectar();
        documentos().alternarEdicao(ID_CPF);
        detectar();

        const erro = nativo.querySelector('.doc-item .field__erro')?.textContent ?? '';
        expect(erro).toContain(
          'Nenhum formulário do processo tem mais o grupo “FAMILIA”, pelo qual o documento se repete. ' +
            'Como resolver: no passo Formulários, ponha o grupo num formulário respondido até a fase do documento; ou retire este documento da fase.',
        );
      });
    });

    /**
     * Congelar o conjunto de fases vivas preserva o que estava valendo; começar
     * do zero apagaria a exigência das outras fases por causa de uma decisão
     * tomada numa só.
     */
    /**
     * A fase lista o que exige, e o seletor oferece o resto: com setenta e quatro tipos no
     * cadastro, uma caixa por documento em cada fase punha centenas de controles numa
     * rolagem só, e o que o certame de fato exige ficava perdido entre eles.
     */
    it('oferece no seletor o documento que a fase ainda não exige', () => {
      comCronograma(fase({}));

      expect(exigencias().documentosDaFase()).toEqual([]);
      expect(
        documentos()
          .documentosDisponiveis()
          .flatMap((grupo) => grupo.options),
      ).toContainEqual(expect.objectContaining({ value: ID_CPF }));
      expect(nativo.textContent).toContain('Esta fase ainda não exige documento nenhum.');
    });

    it('acrescenta o documento escolhido e o tira do seletor', () => {
      comCronograma(fase({}));

      documentos().escolherDocumento(ID_CPF);
      documentos().acrescentarDocumento();
      detectar();

      expect(
        exigencias()
          .documentosDaFase()
          .map((doc) => doc.id),
      ).toEqual([ID_CPF]);
      expect(
        documentos()
          .documentosDisponiveis()
          .flatMap((grupo) => grupo.options),
      ).not.toContainEqual(expect.objectContaining({ value: ID_CPF }));
      // O seletor volta ao estado neutro: o próximo documento começa do zero.
      expect(documentos().documentoAAcrescentar()).toBe('');
    });
  });
});
