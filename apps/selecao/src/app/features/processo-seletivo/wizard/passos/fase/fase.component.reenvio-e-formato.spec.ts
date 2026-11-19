import { describe, expect, it } from 'vitest';
import type { AtributosCongeladosDaFase } from '../../processo-seletivo.models';
import { exigenciasDaFase } from '../../shared/exigencias/consulta-das-exigencias';
import {
  comExigencia,
  exigenciaNova,
  exigenciasVazias,
} from '../../shared/exigencias/exigencias-documentais';
import { arvoreDeExigencias } from '../../shared/exigencias/gravacao-das-exigencias';
import { congeladosDaFase, fase, ID_AVALIACAO, ID_CPF, ID_RECURSOS } from './fase.testing';
import { usarFase, type ContextoDaFase } from './fase-passo.testing';

describe('FasePassoComponent', () => {
  let componente: ContextoDaFase['componente'];
  let store: ContextoDaFase['store'];
  let detectar: ContextoDaFase['detectar'];
  let nativo: ContextoDaFase['nativo'];
  let comCronograma: ContextoDaFase['comCronograma'];
  let exigencias: ContextoDaFase['exigencias'];
  let editor: ContextoDaFase['editor'];
  let eixoFormulario: ContextoDaFase['eixoFormulario'];
  let documentos: ContextoDaFase['documentos'];

  usarFase((tela) => {
    ({
      componente,
      store,
      detectar,
      nativo,
      comCronograma,
      exigencias,
      editor,
      eixoFormulario,
      documentos,
    } = tela);
  });

  /**
   * A consequência "abre pendência para reenvio" só é aceita em fase que admite
   * complementação. O sinalizador vem do cadastro da fase canônica e este passo não o edita —
   * antes disto a opção era oferecida em qualquer fase e o operador só descobria no 422 da
   * gravação, sobre um campo que a tela não deixava corrigir.
   */
  describe('consequência de reenvio e complementação da fase', () => {
    it('não oferece o reenvio em fase que não admite complementação', () => {
      comCronograma(fase({}));

      expect(editor().faseAdmiteComplementacao()).toBe(false);
      expect(
        editor()
          .consequenciasDaFase()
          .map((opcao) => opcao.valor),
      ).not.toContain('PENDENCIA_REENVIO');
    });

    it('oferece o reenvio na fase que admite', () => {
      comCronograma(fase({ congelados: congeladosDaFase({ permiteComplementacao: true }) }));

      expect(editor().faseAdmiteComplementacao()).toBe(true);
      expect(
        editor()
          .consequenciasDaFase()
          .map((opcao) => opcao.valor),
      ).toContain('PENDENCIA_REENVIO');
    });

    /**
     * A recusa de quem JÁ tem o reenvio gravado é conferida na prontidão do Cronograma, não
     * aqui: esta superfície é embutida com `faseFixada` e o `validar()` dela nunca é chamado
     * pela página. O teste correspondente vive em `cronograma.component.spec.ts`.
     */
    it('deixa escrever o reenvio quando ele já está no rascunho', () => {
      comCronograma(fase({}));
      documentos().escolherDocumento(ID_CPF);
      documentos().acrescentarDocumento();
      detectar();
      editor().escolherConsequencia(ID_CPF, 'PENDENCIA_REENVIO');
      detectar();

      expect(editor().consequenciaDoDocumento(ID_CPF)).toBe('PENDENCIA_REENVIO');
    });
  });

  /**
   * Formato e tamanho da exigência vêm do cadastro do tipo de documento — é lá que o CEPS os
   * declara, e é de lá que a própria tela tira o texto que mostra ao operador. A tradução
   * "texto livre do cadastro → vocabulário fechado da exigência" é código do browser: nenhum
   * teste da API a alcança, e antes desta cobertura o único tipo restrito do catálogo local
   * era resíduo de smoke que nenhum certame usava.
   */
  /**
   * O documento é apresentado no bloco de comprovação de um formulário, e inscrição e isenção podem
   * dividir a fase: a fase dividida pede a escolha, a de um formulário só a preenche e a que não
   * responde formulário nenhum não a mostra.
   */
  describe('formulário em que o documento é apresentado', () => {
    const ID_FORMULARIO = `fase-AVALIACAO-doc-formulario-${ID_CPF}`;
    const seletor = () => nativo.querySelector<HTMLSelectElement>(`#${ID_FORMULARIO}`);

    function exigirCpfNa(congelados: Partial<AtributosCongeladosDaFase> | null): void {
      comCronograma(
        fase({ congelados: congelados === null ? null : congeladosDaFase(congelados) }),
      );
      documentos().escolherDocumento(ID_CPF);
      documentos().acrescentarDocumento();
      detectar();
    }

    it('na fase dividida obriga a escolher; na de um formulário só vem preenchido; na que não responde nenhum some', () => {
      exigirCpfNa({ coletaInscricao: true, coletaSolicitacaoIsencao: true });
      expect(seletor()?.value).toBe('');
      expect(seletor()?.getAttribute('aria-invalid')).toBe('true');
      expect(
        nativo.querySelector(`#fase-AVALIACAO-doc-formulario-erro-${ID_CPF}`)?.textContent,
      ).toContain('Escolha em que formulário o candidato apresenta este documento.');

      exigirCpfNa({ coletaInscricao: true });
      expect(seletor()?.value).toBe('INSCRICAO');
      expect(seletor()?.getAttribute('aria-invalid')).toBeNull();

      exigirCpfNa(null);
      expect(seletor()).toBeNull();
    });

    it('o formulário declarado que a fase não responde mais não é trocado: o campo aparece com o erro e a gravação o leva como declarado', () => {
      exigirCpfNa({ coletaInscricao: true });
      eixoFormulario().escolherFinalidade(ID_CPF, 'ISENCAO_TAXA');
      detectar();

      expect(seletor()?.value).toBe('');
      expect(seletor()?.getAttribute('aria-invalid')).toBe('true');
      expect(
        nativo.querySelector(`#fase-AVALIACAO-doc-formulario-erro-${ID_CPF}`)?.textContent?.trim(),
      ).toBe(
        'O formulário de isenção da taxa de inscrição não é respondido nesta fase; escolha o formulário.',
      );
      const raizes = arvoreDeExigencias(store.draft().documentos, {
        faseIdPorCodigo: new Map([['AVALIACAO', ID_AVALIACAO]]),
        modalidadesOfertadas: [],
        etapasVivas: new Set<string>(),
        finalidadesPorFase: new Map([['AVALIACAO', ['INSCRICAO']]]),
      });
      expect(raizes[0].documento?.finalidade).toBe('ISENCAO_TAXA');
    });

    it('na fase que não responde formulário nenhum, o formulário declarado antes se desfaz pela opção "Nenhum"', () => {
      exigirCpfNa(null);
      eixoFormulario().escolherFinalidade(ID_CPF, 'ISENCAO_TAXA');
      detectar();
      const campo = seletor() as HTMLSelectElement;

      campo.value = 'SEM_FORMULARIO';
      campo.dispatchEvent(new Event('change'));
      detectar();

      expect(exigencias().exigenciaDoDocumento(ID_CPF).finalidade).toBeNull();
      expect(seletor()).toBeNull();
    });

    it('na fase dividida, a escolha vai ao rascunho e a conferência passa a listar o documento sob o formulário', () => {
      exigirCpfNa({ coletaInscricao: true, coletaSolicitacaoIsencao: true });
      const titulos = () =>
        Array.from(nativo.querySelectorAll('h4'), (titulo) => titulo.textContent?.trim());
      expect(titulos()).toEqual(['Formulário a escolher']);

      const campo = seletor() as HTMLSelectElement;
      campo.value = 'ISENCAO_TAXA';
      campo.dispatchEvent(new Event('change'));
      detectar();

      expect(exigencias().exigenciaDoDocumento(ID_CPF).finalidade).toBe('ISENCAO_TAXA');
      expect(titulos()).toEqual(['Formulário de isenção da taxa de inscrição']);
    });
  });

  describe('formato e tamanho derivados do cadastro', () => {
    it('a exigência nasce com o que o cadastro do tipo declara', () => {
      comCronograma(fase({}));
      documentos().escolherDocumento(ID_CPF);
      documentos().acrescentarDocumento();
      detectar();

      const declarada = exigencias().exigenciaDoDocumento(ID_CPF);
      // O cadastro diz "pdf,jpg"; o contrato da exigência fala PDF e JPEG.
      expect(declarada.formatosPermitidos).toEqual(['PDF', 'JPEG']);
      expect(declarada.tamanhoMaximoBytes).toBe(10 * 1024 * 1024);
    });

    it('a conversão para o comando preserva o que veio do cadastro', () => {
      comCronograma(fase({}));
      documentos().escolherDocumento(ID_CPF);
      documentos().acrescentarDocumento();
      detectar();

      const raizes = arvoreDeExigencias(store.draft().documentos, {
        faseIdPorCodigo: new Map([['AVALIACAO', ID_AVALIACAO]]),
        modalidadesOfertadas: [],
        etapasVivas: new Set<string>(),
        finalidadesPorFase: new Map(),
      });

      expect(raizes[0].documento?.formatosPermitidos).toEqual(['PDF', 'JPEG']);
      expect(raizes[0].documento?.tamanhoMaximoBytes).toBe(10 * 1024 * 1024);
    });

    it('não inventa restrição para tipo cujo cadastro não declara nenhuma', () => {
      comCronograma(fase({}));
      const semRestricao = exigencias().exigenciaDoDocumento('tipo-fora-do-catalogo');

      expect(semRestricao.formatosPermitidos).toBe('QUALQUER');
      expect(semRestricao.tamanhoMaximoBytes).toBeNull();
    });
  });

  /**
   * O alcance "vale em todas as fases" é intenção de UI: o contrato só conhece a exigência
   * materializada em cada fase. O que a tela precisa garantir é que a intenção não vire perda
   * — nem ao semear, nem ao desmarcar.
   */
  describe('alcance de todas as fases na tela', () => {
    it('semeia o modelo na fase ABERTA, não na primeira do cronograma', () => {
      comCronograma(
        fase({ faseCanonicaId: ID_RECURSOS, codigo: 'RECURSOS', ordem: 1 }),
        fase({ ordem: 2 }),
      );
      // A fase aberta é a AVALIACAO (a fixada do componente), não a primeira da lista.
      exigencias().valerEmTodasAsFases(ID_CPF);
      detectar();

      const naAvaliacao = exigenciasDaFase(store.draft().documentos, 'AVALIACAO');
      expect(naAvaliacao).toHaveLength(1);
      expect(naAvaliacao[0].tipoDocumentoId).toBe(ID_CPF);
    });

    /**
     * Desmarcar numa fase que só tinha o documento por herança não pode apagá-lo das demais
     * que também o tinham por herança — o operador age numa fase e perderia em outras.
     */
    it('desmarcar numa fase preserva o documento nas outras que o herdavam', () => {
      // O alcance é declarado com UMA fase no cronograma; a segunda entra depois, e só existe
      // para o documento por herança — é esse o caso em que largar o alcance sem materializar
      // apagaria o documento de uma fase que o operador nem estava olhando.
      comCronograma(fase({}));
      documentos().escolherDocumento(ID_CPF);
      documentos().acrescentarDocumento();
      detectar();
      exigencias().valerEmTodasAsFases(ID_CPF);
      detectar();

      comCronograma(fase({}), fase({ faseCanonicaId: ID_RECURSOS, codigo: 'RECURSOS', ordem: 2 }));
      expect(exigenciasDaFase(store.draft().documentos, 'RECURSOS')).toEqual([]);

      exigencias().alternarExigencia(ID_CPF, false);
      detectar();

      // Saiu da AVALIACAO, que é a fase aberta; continua em RECURSOS.
      expect(exigenciasDaFase(store.draft().documentos, 'AVALIACAO')).toEqual([]);
      expect(exigenciasDaFase(store.draft().documentos, 'RECURSOS')).toHaveLength(1);
      expect(store.draft().documentos.emTodasAsFases).not.toContain(ID_CPF);
    });

    it('ligar o alcance de todas as fases preserva o formulário que cada fase declara', () => {
      const dividida = congeladosDaFase({ coletaInscricao: true, coletaSolicitacaoIsencao: true });
      comCronograma(
        fase({ congelados: dividida }),
        fase({ faseCanonicaId: ID_RECURSOS, codigo: 'RECURSOS', ordem: 2, congelados: dividida }),
      );
      store.patchSection(
        'documentos',
        comExigencia(
          comExigencia(exigenciasVazias(), {
            ...exigenciaNova(ID_CPF, 'AVALIACAO'),
            finalidade: 'INSCRICAO',
          }),
          {
            ...exigenciaNova(ID_CPF, 'RECURSOS'),
            finalidade: 'ISENCAO_TAXA',
          },
        ),
      );

      exigencias().valerEmTodasAsFases(ID_CPF);
      detectar();

      expect(exigenciasDaFase(store.draft().documentos, 'RECURSOS')[0].finalidade).toBe(
        'ISENCAO_TAXA',
      );
    });

    it('a fase acrescentada depois do regime não herda o formulário do modelo que ela não responde', () => {
      const daInscricao = congeladosDaFase({ coletaInscricao: true });
      comCronograma(fase({ congelados: daInscricao }));
      documentos().escolherDocumento(ID_CPF);
      documentos().acrescentarDocumento();
      eixoFormulario().escolherFinalidade(ID_CPF, 'INSCRICAO');
      exigencias().valerEmTodasAsFases(ID_CPF);
      detectar();

      comCronograma(
        fase({ congelados: daInscricao }),
        fase({
          faseCanonicaId: ID_RECURSOS,
          codigo: 'RECURSOS',
          ordem: 2,
          congelados: congeladosDaFase(),
        }),
      );
      componente.abrirFase(ID_RECURSOS);
      detectar();

      expect(exigencias().exigidoNestaFase(ID_CPF)).toBe(true);
      expect(eixoFormulario().faltaFormulario(ID_CPF)).toBeNull();
    });

    /** A fase alcançada mas ainda não materializada mostra o que será gravado. */
    it('mostra na fase herdada o que o modelo declara, não um formulário em branco', () => {
      comCronograma(fase({}), fase({ faseCanonicaId: ID_RECURSOS, codigo: 'RECURSOS', ordem: 2 }));
      documentos().escolherDocumento(ID_CPF);
      documentos().acrescentarDocumento();
      detectar();
      editor().escolherObrigatoriedade(ID_CPF, 'nao');
      detectar();
      exigencias().valerEmTodasAsFases(ID_CPF);
      detectar();

      expect(exigencias().exigidoNestaFase(ID_CPF)).toBe(true);
      expect(exigencias().exigenciaDoDocumento(ID_CPF).obrigatorio).toBe(false);
    });
  });
});
