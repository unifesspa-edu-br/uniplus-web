import { DocumentoDaConfiguracaoTaxaDeInscricaoFundamentos as Fundamento } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import {
  alternarFundamentoDeIsencao,
  declararSemFundamentosDeIsencao,
  definirCobranca,
  definirFundamentosDeIsencao,
} from '../edicoes/taxa-de-inscricao.edicao';
import { documentoSemNada, exemploDoContrato, NOMES_DOS_EXEMPLOS } from '../exemplos.testing';
import { edicaoDoPasso, valoresDoFormulario, type ValoresDoPagamento } from './pagamento.adaptador';

const SEM_DECLARACAO: ValoresDoPagamento = { cobra: null, valor: '', fundamentos: [] };

describe('adaptador do passo Pagamento', () => {
  it.each(NOMES_DOS_EXEMPLOS)('devolve o exemplo %s idêntico depois de ler e editar', (nome) => {
    const documento = exemploDoContrato(nome);

    expect(edicaoDoPasso(valoresDoFormulario(documento))(documento)).toEqual(documento);
  });

  it('lê o valor em reais no formato do campo', () => {
    const valores = valoresDoFormulario(exemploDoContrato('inscricao-pelo-sistema'));

    expect(valores).toEqual({
      cobra: true,
      valor: '50,00',
      fundamentos: [Fundamento.CADASTRO_UNICO, Fundamento.DOACAO_MEDULA_OSSEA],
    });
  });

  it('lê processo gratuito como declaração, e não como ausência', () => {
    expect(valoresDoFormulario(exemploDoContrato('resultado-importado')).cobra).toBe(false);
  });

  it('lê taxa ausente como não declarada', () => {
    expect(valoresDoFormulario(documentoSemNada())).toEqual(SEM_DECLARACAO);
  });

  it('não cria a taxa quando nada foi declarado', () => {
    const documento = documentoSemNada();

    expect(edicaoDoPasso(SEM_DECLARACAO)(documento)).toBe(documento);
  });

  it('desfazer a resposta remove a cobrança sem tocar no valor', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const valores = { ...valoresDoFormulario(documento), cobra: null };

    const taxa = edicaoDoPasso(valores)(documento).taxaDeInscricao;

    expect(taxa).not.toHaveProperty('cobra');
    expect(taxa?.valor).toBe(50);
  });

  it('declarar que não cobra tira o valor e os fundamentos que a tela esconde', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const valores = { ...valoresDoFormulario(documento), cobra: false };

    expect(edicaoDoPasso(valores)(documento).taxaDeInscricao).toEqual({ cobra: false });
  });

  it.each([
    ['1.000,50', 1000.5],
    ['75', 75],
    ['0,5', 0.5],
  ])('lê o valor %s como %s', (texto, esperado) => {
    const editado = edicaoDoPasso({ ...SEM_DECLARACAO, valor: texto })(documentoSemNada());

    expect(editado.taxaDeInscricao?.valor).toBe(esperado);
  });

  it.each(['', '   ', 'abc', '1.00', '1e3'])('remove o valor quando o texto é "%s"', (texto) => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const valores = { ...valoresDoFormulario(documento), valor: texto };

    expect(edicaoDoPasso(valores)(documento).taxaDeInscricao).not.toHaveProperty('valor');
  });

  it('marca e desmarca fundamento sem repetir', () => {
    const marcado = alternarFundamentoDeIsencao(
      documentoSemNada(),
      Fundamento.CADASTRO_UNICO,
      true,
    );
    const repetido = alternarFundamentoDeIsencao(marcado, Fundamento.CADASTRO_UNICO, true);
    const desmarcado = alternarFundamentoDeIsencao(repetido, Fundamento.CADASTRO_UNICO, false);

    expect(repetido.taxaDeInscricao?.fundamentos).toEqual([Fundamento.CADASTRO_UNICO]);
    expect(desmarcado.taxaDeInscricao?.fundamentos).toEqual([]);
  });

  it('lista de fundamentos vazia só fica no documento onde já existia', () => {
    const semLista = { ...documentoSemNada(), taxaDeInscricao: { cobra: true } };
    const comLista = { ...documentoSemNada(), taxaDeInscricao: { cobra: true, fundamentos: [] } };
    const valores = { ...SEM_DECLARACAO, cobra: true };

    expect(edicaoDoPasso(valores)(semLista)).toEqual(semLista);
    expect(edicaoDoPasso(valores)(comLista)).toEqual(comLista);
  });

  it('devolve intacto tudo o que o passo não edita e não altera o documento recebido', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const antes = structuredClone(documento);
    const valores = { ...valoresDoFormulario(documento), valor: '80,00' };

    const editado = edicaoDoPasso(valores)(documento);

    expect({ ...editado, taxaDeInscricao: undefined }).toEqual({
      ...antes,
      taxaDeInscricao: undefined,
    });
    expect(documento).toEqual(antes);
  });

  it('esvaziar a lista que estava ausente deixa-a ausente, e só a declaração a registra vazia', () => {
    const documento = { ...documentoSemNada(), taxaDeInscricao: { cobra: true } };

    const esvaziado = definirFundamentosDeIsencao(documento, []);
    const declarado = declararSemFundamentosDeIsencao(documento);

    expect(esvaziado.taxaDeInscricao).not.toHaveProperty('fundamentos');
    expect(declarado.taxaDeInscricao).toEqual({ cobra: true, fundamentos: [] });
  });

  it('a lista declarada vazia continua vazia na ida e volta e quando se esvazia de novo', () => {
    const declarado = declararSemFundamentosDeIsencao(documentoSemNada());

    expect(edicaoDoPasso(valoresDoFormulario(declarado))(declarado)).toEqual(declarado);
    expect(definirFundamentosDeIsencao(declarado, []).taxaDeInscricao?.fundamentos).toEqual([]);
  });

  it('declarar sem fundamentos na taxa que não existia cria só a lista vazia', () => {
    expect(declararSemFundamentosDeIsencao(documentoSemNada()).taxaDeInscricao).toEqual({
      fundamentos: [],
    });
  });

  it('a lista vazia volta a ser ausente só quando a cobrança some com o que a acompanha', () => {
    const declarado = declararSemFundamentosDeIsencao(documentoSemNada());

    expect(definirCobranca(declarado, false).taxaDeInscricao).not.toHaveProperty('fundamentos');
  });
});
