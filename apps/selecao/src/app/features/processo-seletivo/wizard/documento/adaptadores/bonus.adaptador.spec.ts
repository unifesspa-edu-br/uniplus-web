import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { documentoSemNada, exemploDoContrato, NOMES_DOS_EXEMPLOS } from '../exemplos.testing';
import { edicaoDoPasso, valoresDoFormulario, type ValoresDoBonus } from './bonus.adaptador';

const SEM_DECLARACAO: ValoresDoBonus = {
  aplica: null,
  regra: null,
  fator: '',
  teto: '',
  baseLegal: null,
  fatoDeElegibilidade: null,
};

function documentoQueAplicaOBonus(): DocumentoDaConfiguracao {
  return {
    ...documentoSemNada(),
    bonusRegional: {
      aplica: true,
      regra: { codigo: 'BONUS-REGIONAL-FATOR', versao: 'v1' },
      fator: 1.5,
      teto: 20,
      fatoElegibilidadeCodigo: 'RESIDE_NA_REGIAO',
      baseLegalBonusRegionalCodigo: 'LEI_ESTADUAL_DE_EXEMPLO',
      tipoInstrumento: 'LEI',
      identificacao: 'Lei estadual de exemplo',
      descricao: 'Bônus para quem estudou na região',
      municipios: [{ codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' }],
    },
  };
}

function idaEVolta(documento: DocumentoDaConfiguracao): DocumentoDaConfiguracao {
  return edicaoDoPasso(valoresDoFormulario(documento))(documento);
}

describe('adaptador do passo Bônus', () => {
  it.each(NOMES_DOS_EXEMPLOS)('devolve o exemplo %s idêntico depois de ler e editar', (nome) => {
    const documento = exemploDoContrato(nome);

    expect(idaEVolta(documento)).toEqual(documento);
  });

  it('devolve idêntico o bônus aplicado, com os descritivos da base legal', () => {
    const documento = documentoQueAplicaOBonus();

    expect(idaEVolta(documento)).toEqual(documento);
  });

  it('lê o bônus aplicado com os decimais no formato do campo', () => {
    const valores = valoresDoFormulario(documentoQueAplicaOBonus());

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
    expect(valoresDoFormulario(exemploDoContrato('inscricao-pelo-sistema')).aplica).toBe(false);
    expect(valoresDoFormulario(documentoSemNada())).toEqual(SEM_DECLARACAO);
  });

  it('não cria o bloco quando nada foi declarado', () => {
    const documento = documentoSemNada();

    expect(edicaoDoPasso(SEM_DECLARACAO)(documento)).toEqual(documento);
  });

  it('desfazer a declaração remove o bloco inteiro', () => {
    const documento = documentoQueAplicaOBonus();

    const editado = edicaoDoPasso({ ...valoresDoFormulario(documento), aplica: null })(documento);

    expect(editado).not.toHaveProperty('bonusRegional');
  });

  it('declarar que não aplica deixa só a declaração, sem os campos que a API recusa', () => {
    const documento = documentoQueAplicaOBonus();

    const editado = edicaoDoPasso({ ...valoresDoFormulario(documento), aplica: false })(documento);

    expect(editado.bonusRegional).toEqual({ aplica: false });
  });

  it('com a declaração de que não aplica, os campos digitados não entram no documento', () => {
    const valores = { ...SEM_DECLARACAO, aplica: false, fator: '2' };

    expect(edicaoDoPasso(valores)(documentoSemNada()).bonusRegional).toEqual({ aplica: false });
  });

  it('declarar que aplica depois de "não aplica" abre o bloco para os campos', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const valores = { ...SEM_DECLARACAO, aplica: true, fator: '2,25' };

    expect(edicaoDoPasso(valores)(documento).bonusRegional).toEqual({ aplica: true, fator: 2.25 });
  });

  it.each(['', '  ', 'abc', '-1', '9'.repeat(400)])(
    'remove o fator e o teto quando o texto é "%s"',
    (texto) => {
      const documento = documentoQueAplicaOBonus();
      const valores = { ...valoresDoFormulario(documento), fator: texto, teto: texto };

      const bonus = edicaoDoPasso(valores)(documento).bonusRegional;

      expect(bonus).not.toHaveProperty('fator');
      expect(bonus).not.toHaveProperty('teto');
    },
  );

  it('trocar a base legal descarta os descritivos da base anterior', () => {
    const documento = documentoQueAplicaOBonus();
    const valores = { ...valoresDoFormulario(documento), baseLegal: 'DECRETO_DE_EXEMPLO' };

    const bonus = edicaoDoPasso(valores)(documento).bonusRegional;

    expect(bonus?.baseLegalBonusRegionalCodigo).toBe('DECRETO_DE_EXEMPLO');
    expect(bonus).not.toHaveProperty('tipoInstrumento');
    expect(bonus).not.toHaveProperty('municipios');
    expect(bonus?.fator).toBe(1.5);
  });

  it('limpar a regra e o fato remove as chaves em vez de gravar vazio', () => {
    const documento = documentoQueAplicaOBonus();
    const valores = { ...valoresDoFormulario(documento), regra: null, fatoDeElegibilidade: null };

    const bonus = edicaoDoPasso(valores)(documento).bonusRegional;

    expect(bonus).not.toHaveProperty('regra');
    expect(bonus).not.toHaveProperty('fatoElegibilidadeCodigo');
  });

  it('não altera o documento recebido nem o que o passo não edita', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const antes = structuredClone(documento);

    const editado = edicaoDoPasso({ ...SEM_DECLARACAO, aplica: true })(documento);

    expect({ ...editado, bonusRegional: undefined }).toEqual({
      ...antes,
      bonusRegional: undefined,
    });
    expect(documento).toEqual(antes);
  });
});
