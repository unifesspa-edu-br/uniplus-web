import { describe, expect, it } from 'vitest';
import { conteudoInicial } from '@uniplus/shared-inscricao/formulario';
import { exigenciasDaFase } from '../../shared/exigencias/consulta-das-exigencias';
import {
  comExigenciaSemGrupo,
  exigenciaNova,
  exigenciasVazias,
} from '../../shared/exigencias/exigencias-documentais';
import { regrasDeComprovacaoParaEnvio } from '../../shared/exigencias/gravacao-das-exigencias';
import { fase, ID_AVALIACAO, ID_CPF, ID_HOMOLOGACAO } from './fase.testing';
import { formularioDoRascunho } from '../formulario/formulario-de-inscricao.testing';
import { identificadorDaRegra, usarFase, type ContextoDaFase } from './fase-passo.testing';

describe('FasePassoComponent', () => {
  let store: ContextoDaFase['store'];
  let detectar: ContextoDaFase['detectar'];
  let nativo: ContextoDaFase['nativo'];
  let comCronograma: ContextoDaFase['comCronograma'];
  let abrirFase: ContextoDaFase['abrirFase'];
  let exigencias: ContextoDaFase['exigencias'];
  let editor: ContextoDaFase['editor'];
  let eixoFormulario: ContextoDaFase['eixoFormulario'];
  let documentos: ContextoDaFase['documentos'];

  usarFase((tela) => {
    ({
      store,
      detectar,
      nativo,
      comCronograma,
      abrirFase,
      exigencias,
      editor,
      eixoFormulario,
      documentos,
    } = tela);
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
    const idFormulario = () =>
      `fase-AVALIACAO-doc-formulario-${identificadorDaRegra(exigencias(), ID_CPF)}`;
    const seletor = () => nativo.querySelector<HTMLSelectElement>(`#${idFormulario()}`);

    /** O documento exigido na fase Avaliação, que responde os formulários de códigos dados. */
    function exigirCpfNa(codigos: readonly string[]): void {
      comCronograma(fase({}));
      store.patchObjectSection('formulario', {
        formularios: codigos.map((codigo, indice) =>
          formularioDoRascunho(
            { ...conteudoInicial(), titulo: codigo },
            { codigo, faseCodigo: 'AVALIACAO', gravado: true, obrigatorio: indice === 0 },
          ),
        ),
      });
      documentos().escolherDocumento(ID_CPF);
      documentos().acrescentarDocumento();
      detectar();
    }

    it('na fase dividida obriga a escolher; na de um formulário só vem preenchido; na que não responde nenhum some', () => {
      exigirCpfNa(['INSCRICAO', 'ISENCAO_TAXA']);
      expect(seletor()?.value).toBe('');
      expect(seletor()?.getAttribute('aria-invalid')).toBe('true');
      expect(
        nativo.querySelector(
          `#fase-AVALIACAO-doc-formulario-erro-${identificadorDaRegra(exigencias(), ID_CPF)}`,
        )?.textContent,
      ).toContain('Escolha em que formulário o candidato apresenta este documento.');

      exigirCpfNa(['INSCRICAO']);
      expect(seletor()?.value).toBe('INSCRICAO');
      expect(seletor()?.getAttribute('aria-invalid')).toBeNull();

      exigirCpfNa([]);
      expect(seletor()).toBeNull();
    });

    it('o formulário declarado que a fase não responde mais não é trocado: o campo aparece com o erro e a gravação o leva como declarado', () => {
      exigirCpfNa(['INSCRICAO']);
      eixoFormulario().escolherFormulario(
        identificadorDaRegra(exigencias(), ID_CPF),
        'ISENCAO_TAXA',
      );
      detectar();

      expect(seletor()?.value).toBe('');
      expect(seletor()?.getAttribute('aria-invalid')).toBe('true');
      expect(
        nativo
          .querySelector(
            `#fase-AVALIACAO-doc-formulario-erro-${identificadorDaRegra(exigencias(), ID_CPF)}`,
          )
          ?.textContent?.trim(),
      ).toBe('O formulário ISENCAO_TAXA não é respondido nesta fase; escolha o formulário.');
      const regrasDeComprovacao = regrasDeComprovacaoParaEnvio(store.draft().documentos, {
        faseIdPorCodigo: new Map([['AVALIACAO', ID_AVALIACAO]]),
        modalidadesOfertadas: [],
        etapasVivas: new Set<string>(),
        formulariosPorFase: new Map([['AVALIACAO', ['INSCRICAO']]]),
      }).regras;
      expect(regrasDeComprovacao[0].documento?.momento?.formularioCodigo).toBe('ISENCAO_TAXA');
    });

    it('na fase sem formulário, avisa que o documento espera o formulário, sem recusar e sem oferecer escolha', () => {
      exigirCpfNa([]);

      expect(nativo.querySelector('p.alert--info')?.textContent?.trim()).toBe(
        'O documento será gravado quando a fase tiver formulário (passo Formulários).',
      );
      expect(nativo.querySelector('p.alert--info')?.getAttribute('role')).toBe('status');
      expect(seletor()).toBeNull();
      expect(nativo.querySelector('.field__erro')).toBeNull();
    });

    it('na fase com formulário, o aviso de espera não aparece', () => {
      exigirCpfNa(['INSCRICAO']);

      expect(nativo.textContent).not.toContain('O documento será gravado quando a fase tiver');
    });

    it('um formulário real de código SEM_FORMULARIO é gravado, com esse código', () => {
      exigirCpfNa(['INSCRICAO', 'SEM_FORMULARIO']);
      const campo = seletor() as HTMLSelectElement;

      campo.value = 'SEM_FORMULARIO';
      campo.dispatchEvent(new Event('change'));
      detectar();

      expect(exigencias().exigenciaDoDocumento(ID_CPF).formularioCodigo).toBe('SEM_FORMULARIO');
    });

    it('na fase dividida, a escolha vai ao rascunho e a conferência passa a listar o documento sob o formulário', () => {
      exigirCpfNa(['INSCRICAO', 'ISENCAO_TAXA']);
      const titulos = () =>
        Array.from(nativo.querySelectorAll('h4'), (titulo) => titulo.textContent?.trim());
      expect(titulos()).toEqual(['Formulário a escolher']);

      const campo = seletor() as HTMLSelectElement;
      campo.value = 'ISENCAO_TAXA';
      campo.dispatchEvent(new Event('change'));
      detectar();

      expect(exigencias().exigenciaDoDocumento(ID_CPF).formularioCodigo).toBe('ISENCAO_TAXA');
      expect(titulos()).toEqual(['Formulário ISENCAO_TAXA']);
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
      expect(declarada.formatosPermitidos).toEqual({
        tipo: 'lista',
        itens: ['PDF', 'JPEG'].map((formato) => ({ formato, tamanhoMaximoBytes: null })),
      });
      expect(declarada.tamanhoMaximoBytes).toBe(10 * 1024 * 1024);
    });

    it('a conversão para o comando preserva o que veio do cadastro', () => {
      comCronograma(fase({}));
      documentos().escolherDocumento(ID_CPF);
      documentos().acrescentarDocumento();
      detectar();

      const regrasDeComprovacao = regrasDeComprovacaoParaEnvio(store.draft().documentos, {
        faseIdPorCodigo: new Map([['AVALIACAO', ID_AVALIACAO]]),
        modalidadesOfertadas: [],
        etapasVivas: new Set<string>(),
        formulariosPorFase: new Map(),
      }).regras;

      expect(regrasDeComprovacao[0].documento?.requisitos?.formatosPermitidos).toEqual([
        { formato: 'PDF', tamanhoMaximoBytesMax: null },
        { formato: 'JPEG', tamanhoMaximoBytesMax: null },
      ]);
      expect(regrasDeComprovacao[0].documento?.requisitos?.tamanhoMaximoBytes).toBe(
        10 * 1024 * 1024,
      );
    });

    it('não inventa restrição para tipo cujo cadastro não declara nenhuma', () => {
      comCronograma(fase({}));
      const semRestricao = exigencias().exigenciaDoDocumento('tipo-fora-do-catalogo');

      expect(semRestricao.formatosPermitidos).toEqual({ tipo: 'qualquer' });
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
        fase({ ordem: 1 }),
        fase({ faseCanonicaId: ID_HOMOLOGACAO, codigo: 'HOMOLOGACAO_INSCRICOES', ordem: 2 }),
      );
      abrirFase(ID_HOMOLOGACAO);

      exigencias().valerEmTodasAsFases(ID_CPF);
      detectar();

      const { documentos: declaradas } = store.draft();
      expect(declaradas.regrasDeComprovacao[0].documento?.faseCodigo).toBe(
        'HOMOLOGACAO_INSCRICOES',
      );
      expect(exigenciasDaFase(declaradas, 'AVALIACAO')).toHaveLength(1);
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

      comCronograma(
        fase({}),
        fase({ faseCanonicaId: ID_HOMOLOGACAO, codigo: 'HOMOLOGACAO_INSCRICOES', ordem: 2 }),
      );
      expect(exigenciasDaFase(store.draft().documentos, 'HOMOLOGACAO_INSCRICOES')).toEqual([]);

      exigencias().alternarExigencia(ID_CPF, false);
      detectar();

      // Saiu da AVALIACAO, que é a fase aberta; continua em HOMOLOGACAO_INSCRICOES.
      expect(exigenciasDaFase(store.draft().documentos, 'AVALIACAO')).toEqual([]);
      expect(exigenciasDaFase(store.draft().documentos, 'HOMOLOGACAO_INSCRICOES')).toHaveLength(1);
      expect(store.draft().documentos.emTodasAsFases).not.toContain(ID_CPF);
    });

    it('ligar o alcance de todas as fases preserva o formulário que cada fase declara', () => {
      comCronograma(
        fase({}),
        fase({ faseCanonicaId: ID_HOMOLOGACAO, codigo: 'HOMOLOGACAO_INSCRICOES', ordem: 2 }),
      );
      store.patchSection(
        'documentos',
        comExigenciaSemGrupo(
          comExigenciaSemGrupo(exigenciasVazias(), {
            ...exigenciaNova(ID_CPF, 'AVALIACAO'),
            formularioCodigo: 'INSCRICAO',
          }),
          {
            ...exigenciaNova(ID_CPF, 'HOMOLOGACAO_INSCRICOES'),
            formularioCodigo: 'ISENCAO_TAXA',
          },
        ),
      );

      exigencias().valerEmTodasAsFases(ID_CPF);
      detectar();

      expect(
        exigenciasDaFase(store.draft().documentos, 'HOMOLOGACAO_INSCRICOES')[0].formularioCodigo,
      ).toBe('ISENCAO_TAXA');
    });

    it('a fase acrescentada depois do regime não herda o formulário do modelo que ela não responde', () => {
      comCronograma(fase({}));
      store.patchObjectSection('formulario', {
        formularios: [formularioDoRascunho(conteudoInicial(), { faseCodigo: 'AVALIACAO' })],
      });
      documentos().escolherDocumento(ID_CPF);
      documentos().acrescentarDocumento();
      eixoFormulario().escolherFormulario(identificadorDaRegra(exigencias(), ID_CPF), 'INSCRICAO');
      exigencias().valerEmTodasAsFases(ID_CPF);
      detectar();

      comCronograma(
        fase({}),
        fase({ faseCanonicaId: ID_HOMOLOGACAO, codigo: 'HOMOLOGACAO_INSCRICOES', ordem: 2 }),
      );
      abrirFase(ID_HOMOLOGACAO);
      detectar();

      expect(exigencias().exigidoNestaFase(ID_CPF)).toBe(true);
      expect(eixoFormulario().faltaFormulario(ID_CPF)).toBeNull();
    });

    /** A fase alcançada mas ainda não materializada mostra o que será gravado. */
    it('mostra na fase herdada o que o modelo declara, não um formulário em branco', () => {
      comCronograma(
        fase({}),
        fase({ faseCanonicaId: ID_HOMOLOGACAO, codigo: 'HOMOLOGACAO_INSCRICOES', ordem: 2 }),
      );
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
