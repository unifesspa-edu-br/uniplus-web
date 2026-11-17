import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { documentoSemNada, exemploDoContrato, NOMES_DOS_EXEMPLOS } from '../exemplos.testing';
import { edicaoDoPasso, valoresDoFormulario, type ValoresDaFormula } from './formula.adaptador';

const SEM_DECLARACAO: ValoresDaFormula = {
  regraDeCalculo: null,
  regraDeArredondamento: null,
  casasDeArredondamento: '',
  escalaDaNotaFinal: '',
  regraDeOrdemDeAlocacao: null,
  baseadoEmEnem: null,
  resolucaoDoPesoPorArea: '',
  quadroDePesos: [],
};

function documentoBaseadoEmEnem(): DocumentoDaConfiguracao {
  return {
    ...documentoSemNada(),
    classificacao: {
      regraCalculo: { codigo: 'FORMULA-MEDIA-PONDERADA', versao: 'v1' },
      baseadoEmEnem: true,
      resolucaoPesoAreaEnem: 'RESOLUCAO_DE_EXEMPLO',
      quadroPesoAreaEnem: [
        {
          grupoAreaEnemCodigo: 'GRUPO_A',
          grupoAreaEnemRotulo: 'Grupo A',
          baseLegal: 'Resolução de exemplo',
          areas: [{ codigo: 'MATEMATICA', rotulo: 'Matemática', peso: 3, corte: 450 }],
        },
      ],
    },
  };
}

function idaEVolta(documento: DocumentoDaConfiguracao): DocumentoDaConfiguracao {
  return edicaoDoPasso(valoresDoFormulario(documento))(documento);
}

describe('adaptador do passo Fórmula e precisão', () => {
  it.each(NOMES_DOS_EXEMPLOS)('devolve o exemplo %s idêntico depois de ler e editar', (nome) => {
    const documento = exemploDoContrato(nome);

    expect(idaEVolta(documento)).toEqual(documento);
  });

  it('devolve idêntico o documento com o quadro de pesos que a API calculou', () => {
    const documento = documentoBaseadoEmEnem();

    expect(idaEVolta(documento)).toEqual(documento);
  });

  it('lê as regras, a precisão e a escala no formato do campo', () => {
    const valores = valoresDoFormulario(exemploDoContrato('inscricao-pelo-sistema'));

    expect(valores).toMatchObject({
      regraDeCalculo: { codigo: 'CALCULO-MEDIA-PONDERADA', versao: 'v1' },
      regraDeArredondamento: { codigo: 'ARREDONDAMENTO-MEIO-ACIMA', versao: 'v1' },
      casasDeArredondamento: '2',
      escalaDaNotaFinal: '100',
      regraDeOrdemDeAlocacao: { codigo: 'ORDEM-ALOCACAO-POR-NOTA', versao: 'v1' },
      baseadoEmEnem: false,
    });
  });

  it('lê o quadro de pesos só para mostrar', () => {
    const valores = valoresDoFormulario(documentoBaseadoEmEnem());

    expect(valores.quadroDePesos[0]?.areas?.[0]?.codigo).toBe('MATEMATICA');
  });

  it('lê classificação ausente como nada declarado', () => {
    expect(valoresDoFormulario(documentoSemNada())).toEqual(SEM_DECLARACAO);
  });

  it('não cria a classificação quando nada foi declarado', () => {
    const documento = documentoSemNada();

    expect(edicaoDoPasso(SEM_DECLARACAO)(documento)).toBe(documento);
  });

  it('"não é baseada em ENEM" é uma declaração e não se confunde com ausência', () => {
    const declarada = edicaoDoPasso({ ...SEM_DECLARACAO, baseadoEmEnem: false })(
      documentoSemNada(),
    );
    const desfeita = edicaoDoPasso({ ...SEM_DECLARACAO, baseadoEmEnem: null })(
      exemploDoContrato('resultado-importado'),
    );

    expect(declarada.classificacao).toEqual({ baseadoEmEnem: false });
    expect(desfeita.classificacao).not.toHaveProperty('baseadoEmEnem');
  });

  it('devolve a eliminação e o desempate como estavam ao editar a fórmula', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const valores = { ...valoresDoFormulario(documento), escalaDaNotaFinal: '1000' };

    const classificacao = edicaoDoPasso(valores)(documento).classificacao;

    expect(classificacao?.escalaNotaFinal).toBe(1000);
    expect(classificacao?.regrasEliminacao).toEqual(documento.classificacao?.regrasEliminacao);
    expect(classificacao?.criteriosDeDesempate).toEqual(
      documento.classificacao?.criteriosDeDesempate,
    );
  });

  it.each(['', '  ', 'abc', '2,5', '-1'])('remove as casas quando o texto é "%s"', (texto) => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const valores = { ...valoresDoFormulario(documento), casasDeArredondamento: texto };

    expect(edicaoDoPasso(valores)(documento).classificacao).not.toHaveProperty(
      'casasArredondamento',
    );
  });

  it.each(['', 'abc', '1.000', '10,12345'])('remove a escala quando o texto é "%s"', (texto) => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const valores = { ...valoresDoFormulario(documento), escalaDaNotaFinal: texto };

    expect(edicaoDoPasso(valores)(documento).classificacao).not.toHaveProperty('escalaNotaFinal');
  });

  it('aceita a escala com vírgula decimal', () => {
    const editado = edicaoDoPasso({ ...SEM_DECLARACAO, escalaDaNotaFinal: '100,5' })(
      documentoSemNada(),
    );

    expect(editado.classificacao?.escalaNotaFinal).toBe(100.5);
  });

  it('limpar a regra remove a chave, e a regra sem versão leva só o código', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const valores = {
      ...valoresDoFormulario(documento),
      regraDeCalculo: null,
      regraDeArredondamento: { codigo: 'ARREDONDAMENTO-MEIO-ACIMA', versao: '' },
    };

    const classificacao = edicaoDoPasso(valores)(documento).classificacao;

    expect(classificacao).not.toHaveProperty('regraCalculo');
    expect(classificacao?.regraArredondamento).toEqual({ codigo: 'ARREDONDAMENTO-MEIO-ACIMA' });
  });

  it('trocar a regra de cálculo não apaga a precisão: o que ficar incoerente volta no diagnóstico', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const valores = {
      ...valoresDoFormulario(documento),
      regraDeCalculo: { codigo: 'CLASSIFICACAO-IMPORTADA', versao: 'v1' },
    };

    const classificacao = edicaoDoPasso(valores)(documento).classificacao;

    expect(classificacao?.casasArredondamento).toBe(2);
    expect(classificacao?.escalaNotaFinal).toBe(100);
  });

  it('resolução vazia sai do documento em vez de virar texto vazio, e leva o quadro junto', () => {
    const documento = documentoBaseadoEmEnem();
    const valores = { ...valoresDoFormulario(documento), resolucaoDoPesoPorArea: '  ' };

    const classificacao = edicaoDoPasso(valores)(documento).classificacao;

    expect(classificacao).not.toHaveProperty('resolucaoPesoAreaEnem');
    expect(classificacao).not.toHaveProperty('quadroPesoAreaEnem');
  });

  it('trocar a resolução descarta o quadro copiado da anterior', () => {
    const documento = documentoBaseadoEmEnem();
    const valores = { ...valoresDoFormulario(documento), resolucaoDoPesoPorArea: 'OUTRA' };

    const classificacao = edicaoDoPasso(valores)(documento).classificacao;

    expect(classificacao?.resolucaoPesoAreaEnem).toBe('OUTRA');
    expect(classificacao).not.toHaveProperty('quadroPesoAreaEnem');
  });

  it('repetir a mesma resolução mantém o quadro', () => {
    const documento = documentoBaseadoEmEnem();
    const valores = {
      ...valoresDoFormulario(documento),
      resolucaoDoPesoPorArea: ' RESOLUCAO_DE_EXEMPLO ',
    };

    expect(edicaoDoPasso(valores)(documento)).toEqual(documento);
  });

  it.each(['casasDeArredondamento', 'escalaDaNotaFinal'] as const)(
    'texto com centenas de dígitos em %s não vira número que a serialização apaga',
    (campo) => {
      const documento = exemploDoContrato('inscricao-pelo-sistema');
      const valores = { ...valoresDoFormulario(documento), [campo]: '9'.repeat(400) };

      const classificacao = edicaoDoPasso(valores)(documento).classificacao;
      const chave = campo === 'casasDeArredondamento' ? 'casasArredondamento' : 'escalaNotaFinal';

      expect(classificacao).not.toHaveProperty(chave);
    },
  );

  it('devolve intacto tudo fora da classificação e não altera o documento recebido', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const antes = structuredClone(documento);
    const valores = { ...valoresDoFormulario(documento), escalaDaNotaFinal: '10' };

    const editado = edicaoDoPasso(valores)(documento);

    expect({ ...editado, classificacao: undefined }).toEqual({
      ...antes,
      classificacao: undefined,
    });
    expect(documento).toEqual(antes);
  });
});
