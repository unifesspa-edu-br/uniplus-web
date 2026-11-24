import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { documentoSemNada, exemploDoContrato, NOMES_DOS_EXEMPLOS } from '../exemplos.testing';
import { edicaoDoPasso, valoresDoFormulario, type ValoresDoFada } from './fada.adaptador';

const SEM_DECLARACAO: ValoresDoFada = {
  aplica: null,
  regra: null,
  fator: '',
  teto: '',
  baseLegal: null,
  fatoDeElegibilidade: null,
};

function documentoQueAplicaOFada(): DocumentoDaConfiguracao {
  return {
    ...documentoSemNada(),
    fada: {
      aplica: true,
      regra: { codigo: 'BONUS-REGIONAL-FATOR', versao: 'v1' },
      fator: 1.5,
      teto: 20,
      codigoDoDadoDeElegibilidade: 'RESIDE_NA_REGIAO',
      baseLegalCodigo: 'LEI_ESTADUAL_DE_EXEMPLO',
      tipoInstrumento: 'LEI',
      identificacao: 'Lei estadual de exemplo',
      descricao: 'FADA para quem estudou na região',
      municipios: [{ codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' }],
    },
  };
}

function idaEVolta(documento: DocumentoDaConfiguracao): DocumentoDaConfiguracao {
  return edicaoDoPasso(valoresDoFormulario(documento))(documento);
}

describe('adaptador do passo FADA', () => {
  it.each(NOMES_DOS_EXEMPLOS)('devolve o exemplo %s idêntico depois de ler e editar', (nome) => {
    const documento = exemploDoContrato(nome);

    expect(idaEVolta(documento)).toEqual(documento);
  });

  it('devolve idêntico o FADA aplicado, com os descritivos da base legal', () => {
    const documento = documentoQueAplicaOFada();

    expect(idaEVolta(documento)).toEqual(documento);
  });

  it('lê o FADA aplicado com os decimais no formato do campo', () => {
    const valores = valoresDoFormulario(documentoQueAplicaOFada());

    expect(valores).toEqual({
      aplica: true,
      regra: { codigo: 'BONUS-REGIONAL-FATOR', versao: 'v1' },
      fator: '1,5',
      teto: '20',
      baseLegal: 'LEI_ESTADUAL_DE_EXEMPLO',
      fatoDeElegibilidade: 'RESIDE_NA_REGIAO',
    });
  });

  it('lê "não aplica" como declaração e bloco ausente como não declarado', () => {
    const documento = { ...documentoSemNada(), fada: { aplica: false } };
    expect(valoresDoFormulario(documento).aplica).toBe(false);
    expect(valoresDoFormulario(documentoSemNada())).toEqual(SEM_DECLARACAO);
  });

  it('não cria o bloco quando nada foi declarado', () => {
    const documento = documentoSemNada();

    expect(edicaoDoPasso(SEM_DECLARACAO)(documento)).toEqual(documento);
  });

  it('desfazer a declaração remove o bloco inteiro', () => {
    const documento = documentoQueAplicaOFada();

    const editado = edicaoDoPasso({ ...valoresDoFormulario(documento), aplica: null })(documento);

    expect(editado).not.toHaveProperty('fada');
  });

  it('declarar que não aplica deixa só a declaração, sem os campos que a API recusa', () => {
    const documento = documentoQueAplicaOFada();

    const editado = edicaoDoPasso({ ...valoresDoFormulario(documento), aplica: false })(documento);

    expect(editado.fada).toEqual({ aplica: false });
  });

  it('com a declaração de que não aplica, os campos digitados não entram no documento', () => {
    const valores = { ...SEM_DECLARACAO, aplica: false, fator: '2' };

    expect(edicaoDoPasso(valores)(documentoSemNada()).fada).toEqual({ aplica: false });
  });

  it('declarar que aplica depois de "não aplica" abre o bloco para os campos', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const valores = { ...SEM_DECLARACAO, aplica: true, fator: '2,25' };

    expect(edicaoDoPasso(valores)(documento).fada).toEqual({ aplica: true, fator: 2.25 });
  });

  it.each(['', '  ', 'abc', '-1', '9'.repeat(400)])(
    'remove o fator e o teto quando o texto é "%s"',
    (texto) => {
      const documento = documentoQueAplicaOFada();
      const valores = { ...valoresDoFormulario(documento), fator: texto, teto: texto };

      const fada = edicaoDoPasso(valores)(documento).fada;

      expect(fada).not.toHaveProperty('fator');
      expect(fada).not.toHaveProperty('teto');
    },
  );

  it('trocar a base legal descarta os descritivos da base anterior', () => {
    const documento = documentoQueAplicaOFada();
    const valores = { ...valoresDoFormulario(documento), baseLegal: 'DECRETO_DE_EXEMPLO' };

    const fada = edicaoDoPasso(valores)(documento).fada;

    expect(fada?.baseLegalCodigo).toBe('DECRETO_DE_EXEMPLO');
    expect(fada).not.toHaveProperty('tipoInstrumento');
    expect(fada).not.toHaveProperty('municipios');
    expect(fada?.fator).toBe(1.5);
  });

  it('limpar a regra e o fato remove as chaves em vez de gravar vazio', () => {
    const documento = documentoQueAplicaOFada();
    const valores = { ...valoresDoFormulario(documento), regra: null, fatoDeElegibilidade: null };

    const fada = edicaoDoPasso(valores)(documento).fada;

    expect(fada).not.toHaveProperty('regra');
    expect(fada).not.toHaveProperty('codigoDoDadoDeElegibilidade');
  });

  it('não altera o documento recebido nem o que o passo não edita', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const antes = structuredClone(documento);

    const editado = edicaoDoPasso({ ...SEM_DECLARACAO, aplica: true })(documento);

    expect({ ...editado, fada: undefined }).toEqual({
      ...antes,
      fada: undefined,
    });
    expect(documento).toEqual(antes);
  });
});
