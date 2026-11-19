import { describe, expect, it } from 'vitest';
import { ID_AVALIACAO, ID_BANCA_HETERO } from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';

describe('CronogramaPassoComponent: etapas', () => {
  let expansao: ContextoDoCronograma['expansao'];
  let edicao: ContextoDoCronograma['edicao'];
  let conferencia: ContextoDoCronograma['conferencia'];
  let cronograma: ContextoDoCronograma['cronograma'];
  let detectar: ContextoDoCronograma['detectar'];
  let nativo: ContextoDoCronograma['nativo'];
  let comFases: ContextoDoCronograma['comFases'];
  let comEtapasEmFases: ContextoDoCronograma['comEtapasEmFases'];

  usarCronograma((tela) => {
    ({ expansao, edicao, conferencia, cronograma, detectar, nativo, comFases, comEtapasEmFases } =
      tela);
  });

  it('abre a etapa pelo resumo, e mais de uma ao mesmo tempo', () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO', 'AVALIACAO']);
    expansao.alternarFase(0);
    detectar();

    expect(expansao.etapaAberta(0), 'a etapa chega fechada').toBe(false);

    expansao.alternarEtapa(0);
    expansao.alternarEtapa(1);
    detectar();

    expect(expansao.etapaAberta(0)).toBe(true);
    expect(expansao.etapaAberta(1)).toBe(true);
  });

  /** Fechada, a etapa mostra só o que já está declarado — é assim que a lista distingue. */
  it('a etapa fechada resume o que já declarou', () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);
    expansao.alternarFase(0);
    detectar();

    const etapa = cronograma.etapas.at(0);
    expect(edicao.marcasDaEtapa(etapa)).toEqual(['Prova objetiva']);

    edicao.acrescentarRecursoNaEtapa(etapa);
    detectar();

    expect(edicao.marcasDaEtapa(etapa)).toContain('1 recurso');
  });

  /**
   * Terceiro nível do mesmo padrão: o bloco que cresce com o que se declara nele também
   * chega recolhido, com a contagem no cabeçalho.
   */
  it('os blocos que crescem dentro da etapa chegam recolhidos', () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);
    expansao.alternarFase(0);
    expansao.alternarEtapa(0);
    detectar();

    expect(expansao.blocoAberto(0, 'recursos')).toBe(false);
    expect(expansao.blocoAberto(0, 'publica')).toBe(false);
    expect(edicao.resumoDosRecursos(cronograma.etapas.at(0))).toBe('nenhum recurso');
    expect(edicao.resumoDasPublicacoes(cronograma.etapas.at(0))).toBe('não publica nada');
  });

  it('o cabeçalho do bloco conta o que há dentro dele', () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);
    const etapa = cronograma.etapas.at(0);

    edicao.acrescentarRecursoNaEtapa(etapa);
    edicao.acrescentarRecursoNaEtapa(etapa);
    detectar();

    expect(edicao.resumoDosRecursos(etapa)).toBe('2 recursos');
  });

  it('o cabeçalho do bloco conta as publicações e ignora a linha sem ato', () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);
    const etapa = cronograma.etapas.at(0);

    edicao.acrescentarProdutoNaEtapa(etapa);
    expect(edicao.resumoDasPublicacoes(etapa)).toBe('não publica nada');

    etapa.controls.produtos.setValue([{ atoCodigo: 'EDITAL', papel: null }]);
    expect(edicao.resumoDasPublicacoes(etapa)).toBe('1 publicação');

    etapa.controls.produtos.setValue([
      { atoCodigo: 'EDITAL', papel: null },
      { atoCodigo: 'RESULTADO', papel: null },
    ]);
    expect(edicao.resumoDasPublicacoes(etapa)).toBe('2 publicações');
  });

  it('a etapa fechada conta publicações, bancas, recursos e o parecer individual', () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);
    const etapa = cronograma.etapas.at(0);
    etapa.controls.produtos.setValue([
      { atoCodigo: 'EDITAL', papel: null },
      { atoCodigo: 'RESULTADO', papel: null },
    ]);
    edicao.alternarBancaDaEtapa(etapa, ID_BANCA_HETERO, true);
    edicao.acrescentarRecursoNaEtapa(etapa);
    edicao.acrescentarRecursoNaEtapa(etapa);
    etapa.controls.emiteParecerIndividual.setValue(true);

    expect(edicao.marcasDaEtapa(etapa)).toEqual([
      'Prova objetiva',
      '2 publicações',
      '1 banca',
      '2 recursos',
      'parecer individual',
    ]);
  });

  it('marcar a banca duas vezes não a repete, e desmarcar a retira', () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);
    const etapa = cronograma.etapas.at(0);

    edicao.alternarBancaDaEtapa(etapa, ID_BANCA_HETERO, true);
    edicao.alternarBancaDaEtapa(etapa, ID_BANCA_HETERO, true);
    expect(edicao.bancasDaEtapa(etapa)).toEqual([
      { tipoBancaId: ID_BANCA_HETERO, regraDeDeliberacao: null },
    ]);

    edicao.alternarBancaDaEtapa(etapa, ID_BANCA_HETERO, false);
    expect(edicao.bancasDaEtapa(etapa)).toEqual([]);
  });

  describe('instância superior da janela de recurso da etapa', () => {
    function janelaAberta() {
      comFases(ID_AVALIACAO);
      comEtapasEmFases(['AVALIACAO']);
      const etapa = cronograma.etapas.at(0);
      edicao.acrescentarRecursoNaEtapa(etapa);
      // O catálogo não responde neste cenário: a regra resolvida é o que faz a janela viajar.
      etapa.controls.recursos.setValue(
        etapa.controls.recursos.value.map((recurso) => ({
          ...recurso,
          regraCodigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
          regraVersao: 'v1',
        })),
      );
      expansao.alternarFase(0);
      expansao.alternarEtapa(0);
      expansao.alternarBloco(0, 'recursos');
      detectar();
      return etapa;
    }

    const radio = (valor: 'true' | 'false') =>
      Array.from(
        nativo.querySelectorAll<HTMLInputElement>(
          'input[type="radio"][name^="admiteInstanciaSuperior-0-0"]',
        ),
      ).find((r) => r.value === valor);

    it('nasce sem resposta, com o campo marcado como inválido e a recusa no resumo', () => {
      const etapa = janelaAberta();

      expect(etapa.controls.recursos.value[0]?.admiteInstanciaSuperior).toBeNull();
      expect(radio('true')?.checked).toBe(false);
      expect(radio('false')?.checked).toBe(false);
      expect(radio('true')?.getAttribute('aria-invalid')).toBe('true');
      expect(conferencia.problemas()).toContainEqual(expect.stringContaining('instância superior'));
    });

    it('guarda no rascunho a resposta escolhida', () => {
      const etapa = janelaAberta();

      radio('false')?.click();
      detectar();

      expect(etapa.controls.recursos.value[0]?.admiteInstanciaSuperior).toBe(false);
      expect(radio('false')?.getAttribute('aria-invalid')).toBeNull();
      expect(conferencia.problemas()).not.toContainEqual(
        expect.stringContaining('instância superior'),
      );
    });

    it('esconde o tempo de bloqueio superior com Não e o mostra com Sim', () => {
      janelaAberta();

      radio('false')?.click();
      detectar();
      expect(nativo.querySelector('#cr-rec-susp2-val-0-0')).toBeNull();
      expect(nativo.querySelector('#cr-rec-susp2-un-0-0')).toBeNull();

      radio('true')?.click();
      detectar();
      expect(nativo.querySelector('#cr-rec-susp2-val-0-0')).not.toBeNull();
      expect(nativo.querySelector('#cr-rec-susp2-un-0-0')).not.toBeNull();
    });
  });

  it('abrir um bloco de uma etapa não abre o da outra', () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO', 'AVALIACAO']);
    expansao.alternarFase(0);
    detectar();

    expansao.alternarBloco(0, 'recursos');

    expect(expansao.blocoAberto(0, 'recursos')).toBe(true);
    expect(expansao.blocoAberto(1, 'recursos')).toBe(false);
    expect(expansao.blocoAberto(0, 'publica'), 'cada bloco tem o seu estado').toBe(false);
  });

  /**
   * Quem decide se peso e nota mínima têm o que fazer é o CARÁTER, não o tipo: o divisor da
   * média soma o peso de quem compõe nota e ignora a eliminatória pura.
   */
  it('peso só aparece na etapa que compõe a nota final', () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);
    const etapa = cronograma.etapas.at(0);

    edicao.escolherCarater(etapa, 'classificatoria');
    expect(edicao.etapaComponeNota(etapa)).toBe(true);
    expect(edicao.etapaElimina(etapa)).toBe(false);

    edicao.escolherCarater(etapa, 'eliminatoria');
    expect(edicao.etapaComponeNota(etapa)).toBe(false);
    expect(edicao.etapaElimina(etapa)).toBe(true);

    edicao.escolherCarater(etapa, 'ambas');
    expect(edicao.etapaComponeNota(etapa)).toBe(true);
    expect(edicao.etapaElimina(etapa)).toBe(true);
  });

  /**
   * Sem isto, quem declara peso e depois muda para eliminatória fica com o valor gravado e
   * invisível — indo ao servidor a cada gravação, sem que nada o use.
   */
  it('trocar o caráter apaga o campo que deixou de valer', () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);
    const etapa = cronograma.etapas.at(0);
    etapa.controls.peso.setValue('3');
    etapa.controls.notaMinima.setValue('5');

    edicao.escolherCarater(etapa, 'eliminatoria');

    expect(etapa.controls.peso.value, 'a eliminatória não entra no divisor da média').toBe('');
    expect(etapa.controls.notaMinima.value, 'o corte continua sendo dela').toBe('5');

    edicao.escolherCarater(etapa, 'classificatoria');

    expect(etapa.controls.notaMinima.value, 'quem não elimina não tem corte').toBe('');
  });

  it('a etapa sem nome aparece na lista mesmo assim', () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);
    cronograma.etapas.at(0).controls.nome.setValue('   ');

    expect(edicao.nomeDaEtapa(cronograma.etapas.at(0))).toBe('Etapa sem nome');
  });
});
