import { beforeEach, describe, expect, it } from 'vitest';
import { UnidadePrazoCodigo } from '@uniplus/shared-data/selecao';
import { recurso } from './configuracao-da-fase.testing';
import { FaseEmEdicao } from './fase-em-edicao';
import {
  fase,
  ID_AVALIACAO,
  ID_BANCA_HETERO,
  ID_CATEGORIA_RACA,
  ID_HOMOLOGACAO,
  proximoPasso,
} from './fase.testing';
import { usarFase, type ContextoDaFase } from './fase-passo.testing';

describe('FasePassoComponent', () => {
  let componente: ContextoDaFase['componente'];
  let store: ContextoDaFase['store'];
  let detectar: ContextoDaFase['detectar'];
  let nativo: ContextoDaFase['nativo'];
  let raiz: ContextoDaFase['raiz'];
  let comCronograma: ContextoDaFase['comCronograma'];
  let abrirFase: ContextoDaFase['abrirFase'];
  let selecionado: ContextoDaFase['selecionado'];
  let publicacoes: ContextoDaFase['publicacoes'];

  usarFase((tela) => {
    ({
      componente,
      store,
      detectar,
      nativo,
      raiz,
      comCronograma,
      abrirFase,
      selecionado,
      publicacoes,
    } = tela);
  });

  it('abre a fase que o Cronograma fixa, mesmo quando não é a primeira', () => {
    comCronograma(
      fase({}),
      fase({ faseCanonicaId: ID_HOMOLOGACAO, codigo: 'HOMOLOGACAO_INSCRICOES', ordem: 2 }),
    );
    abrirFase(ID_HOMOLOGACAO);

    expect(componente.faseAberta()).toBe(ID_HOMOLOGACAO);
    expect(raiz.injector.get(FaseEmEdicao).nomeDaFaseAberta()).toBe('Homologação das inscrições');
  });

  it('espelha no formulário a fase que chega ao rascunho', () => {
    comCronograma(
      fase({
        produtos: [{ atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' }],
        emiteParecerIndividual: true,
      }),
    );

    expect(publicacoes().produtos).toEqual([
      { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' },
    ]);
    expect(componente.formulario()?.controls.emiteParecerIndividual.value).toBe(true);
  });
  /**
   * O que a tela mostra é o que o operador acredita ter declarado. Um seletor em
   * branco sobre uma fase que publica faria ele gravar por cima do que existe
   * sem perceber — e a gravação substitui a coleção inteira.
   */
  describe('o que os seletores exibem', () => {
    beforeEach(() => {
      comCronograma(
        fase({
          produtos: [{ atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' }],
          bancasRequeridas: [
            {
              id: null,
              identificadorLocal: 'banca-teste',
              copiaDoTipo: null,
              tipoBancaId: ID_BANCA_HETERO,
              categoriasDocumentoIds: [ID_CATEGORIA_RACA],
              regraDeDeliberacao: null,
            },
          ],
          regraRecurso: null,
        }),
      );
    });

    it('mostra a publicação que a fase declara, não o rótulo de escolha', () => {
      expect(selecionado('fase-AVALIACAO-produto-ato-0')).toBe('RESULTADO_FINAL');
    });

    it('mostra o papel que a publicação declara', () => {
      expect(selecionado('fase-AVALIACAO-produto-papel-0')).toBe('DEFINITIVO');
    });

    it('mostra a banca que a fase requer', () => {
      expect(selecionado('fase-AVALIACAO-banca-0')).toBe(ID_BANCA_HETERO);
    });

    it('mostra a regra de recurso escolhida', async () => {
      comCronograma(
        fase({
          produtos: [
            { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' },
            { atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' },
          ],
          regraRecurso: recurso(),
        }),
      );

      // O bloco da regra de recurso só entra no DOM depois de `admiteRecurso`
      // ligar, e o valor do seletor é escrito no microtask seguinte.
      await proximoPasso();
      detectar();

      expect(selecionado('fase-AVALIACAO-regra')).toBe('RECURSO-PRAZO-ANCORADO-EM-ATO');
      expect(selecionado('fase-AVALIACAO-ancora')).toBe('RESULTADO_PRELIMINAR');
    });
  });
  describe('instância superior da regra de recurso', () => {
    const PREFIXO_DOS_PARAMETROS = `recurso-fase-${ID_AVALIACAO}`;

    function faseComRecurso(admiteInstanciaSuperior: boolean | null) {
      return fase({
        produtos: [
          { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' },
          { atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' },
        ],
        regraRecurso: recurso({
          admiteInstanciaSuperior,
          prazoSegundaInstanciaValor: '48',
          prazoSegundaInstanciaUnidade: UnidadePrazoCodigo.horas,
        }),
      });
    }

    function radio(valor: 'sim' | 'nao'): HTMLInputElement | null {
      return nativo.querySelector<HTMLInputElement>(`#${PREFIXO_DOS_PARAMETROS}-superior-${valor}`);
    }

    async function abrir(admite: boolean | null): Promise<void> {
      comCronograma(faseComRecurso(admite));
      await proximoPasso();
      detectar();
    }

    it('esconde o prazo da 2ª instância quando o recurso não admite instância superior', async () => {
      await abrir(false);

      expect(nativo.querySelector(`#${PREFIXO_DOS_PARAMETROS}-prazo-segunda-valor`)).toBeNull();
      expect(nativo.querySelector(`#${PREFIXO_DOS_PARAMETROS}-prazo-segunda-unidade`)).toBeNull();
    });

    it('mostra o prazo da 2ª instância quando o recurso admite instância superior', async () => {
      await abrir(true);

      expect(nativo.querySelector(`#${PREFIXO_DOS_PARAMETROS}-prazo-segunda-valor`)).not.toBeNull();
      expect(
        nativo.querySelector(`#${PREFIXO_DOS_PARAMETROS}-prazo-segunda-unidade`),
      ).not.toBeNull();
    });

    it('nasce sem resposta e liga o erro ao campo por aria-describedby', async () => {
      await abrir(null);

      expect(radio('sim')?.checked).toBe(false);
      expect(radio('nao')?.checked).toBe(false);
      expect(radio('sim')?.getAttribute('aria-invalid')).toBe('true');
      expect(componente.erroDoCampo('recurso.admiteInstanciaSuperior')).not.toBeNull();

      const descricao = nativo
        .querySelector('fieldset[aria-describedby*="superior-erro"]')
        ?.getAttribute('aria-describedby')
        ?.split(' ');
      expect(descricao?.every((id) => nativo.querySelector(`#${id}`) !== null)).toBe(true);
    });

    it('guarda no rascunho a resposta escolhida', async () => {
      await abrir(null);

      radio('nao')?.click();
      detectar();

      expect(store.draft().cronograma.fases[0].regraRecurso?.admiteInstanciaSuperior).toBe(false);
      expect(componente.erroDoCampo('recurso.admiteInstanciaSuperior')).toBeNull();
    });

    it('preserva a resposta lida do servidor ao editar outro campo', async () => {
      await abrir(false);

      componente.formulario()?.controls.recurso.controls.prazoValor.setValue('5');
      detectar();

      expect(store.draft().cronograma.fases[0].regraRecurso).toMatchObject({
        prazoValor: '5',
        admiteInstanciaSuperior: false,
      });
    });
  });
  describe('âncora do prazo de recurso', () => {
    /**
     * Com um só resultado preliminar não há escolha a fazer, e pré-selecionar
     * poupa um clique — sem eleger nada, porque não há alternativa.
     */
    it('pré-seleciona a âncora quando a fase publica um preliminar só', () => {
      comCronograma(
        fase({
          produtos: [
            { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' },
            { atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' },
          ],
          regraRecurso: recurso({ atoAncoraCodigo: '' }),
        }),
      );

      expect(store.draft().cronograma.fases[0].regraRecurso?.atoAncoraCodigo).toBe(
        'RESULTADO_PRELIMINAR',
      );
    });

    /**
     * Gabarito e resultado preliminares são publicações legítimas da mesma
     * fase, e cabe recurso de qualquer uma. Eleger uma em silêncio contaria a
     * janela da publicação errada.
     */
    it('não elege a âncora quando a fase publica dois preliminares', () => {
      comCronograma(
        fase({
          produtos: [
            { atoCodigo: 'GABARITO_PRELIMINAR', papel: 'PRELIMINAR' },
            { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' },
            { atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' },
          ],
          regraRecurso: recurso({ atoAncoraCodigo: '' }),
        }),
      );

      expect(store.draft().cronograma.fases[0].regraRecurso?.atoAncoraCodigo).toBe('');
      expect(componente.erroDoCampo('recurso.ancora')).toContain('Escolha a publicação preliminar');
    });

    /**
     * Ligar o interruptor não muda a lista de âncoras possíveis nem recria o
     * formulário, e o campo ficaria vazio esperando uma escolha que não existe.
     */
    it('pré-seleciona a âncora ao ligar o recurso numa fase com um preliminar só', () => {
      comCronograma(
        fase({
          produtos: [
            { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' },
            { atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' },
          ],
        }),
      );

      componente.formulario()?.controls.admiteRecurso.setValue(true);
      detectar();

      expect(store.draft().cronograma.fases[0].regraRecurso?.atoAncoraCodigo).toBe(
        'RESULTADO_PRELIMINAR',
      );
    });

    it('oferece à escolha só as publicações preliminares da própria fase', () => {
      comCronograma(
        fase({
          produtos: [
            { atoCodigo: 'GABARITO_PRELIMINAR', papel: 'PRELIMINAR' },
            { atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' },
            { atoCodigo: 'COMUNICADO', papel: null },
          ],
        }),
      );

      expect(raiz.injector.get(FaseEmEdicao).ancorasPossiveis()).toEqual([
        { codigo: 'GABARITO_PRELIMINAR', nome: 'Gabarito preliminar' },
      ]);
    });
  });
});
