import { DocumentoDaConfiguracaoIdentificacaoOrigemCandidatos as Origem } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { catalogoPorCodigo } from '../catalogos-por-codigo';
import { documentoSemNada, exemploDoContrato, NOMES_DOS_EXEMPLOS } from '../exemplos.testing';
import {
  edicaoDoPasso,
  valoresDoFormulario,
  type CatalogosDaIdentificacao,
  type ValoresDaIdentificacao,
} from './identificacao.adaptador';

const CATALOGOS: CatalogosDaIdentificacao = {
  unidades: catalogoPorCodigo([
    { codigo: 'CEPS', rotulo: 'CEPS — Centro de Processos Seletivos (catálogo)' },
    { codigo: 'PROEG', rotulo: 'PROEG — Pró-Reitoria de Ensino de Graduação' },
  ]),
};

const SEM_VALORES: ValoresDaIdentificacao = {
  nome: '',
  unidade: null,
  origem: '',
  localidade: null,
  identificadorLegivel: '',
};

function valoresDe(nome: Parameters<typeof exemploDoContrato>[0]): ValoresDaIdentificacao {
  return valoresDoFormulario(exemploDoContrato(nome), CATALOGOS);
}

describe('adaptador do passo Identificação', () => {
  it.each(NOMES_DOS_EXEMPLOS)('devolve o exemplo %s idêntico depois de ler e editar', (nome) => {
    const documento = exemploDoContrato(nome);

    expect(edicaoDoPasso(valoresDoFormulario(documento, CATALOGOS))(documento)).toEqual(documento);
  });

  it('lê a unidade pelo rótulo que o processo gravou, e não pelo do catálogo vivo', () => {
    expect(valoresDe('inscricao-pelo-sistema').unidade).toEqual({
      codigo: 'CEPS',
      rotulo: 'CEPS — Centro de Processos Seletivos',
    });
  });

  it('lê o município com o nome e a UF só de leitura', () => {
    expect(valoresDe('inscricao-pelo-sistema').localidade).toEqual({
      codigoIbge: '1504208',
      nome: 'Marabá',
      uf: 'PA',
    });
  });

  it('usa o catálogo para a unidade que ainda não tem rótulo gravado', () => {
    const documento = {
      ...documentoSemNada(),
      identificacao: { unidadeAdministradoraCodigo: 'PROEG' },
    };

    expect(valoresDoFormulario(documento, CATALOGOS).unidade?.rotulo).toBe(
      'PROEG — Pró-Reitoria de Ensino de Graduação',
    );
  });

  it('lê a unidade fora do catálogo pelo código, sem esconder a referência', () => {
    const documento = {
      ...documentoSemNada(),
      identificacao: { unidadeAdministradoraCodigo: 'EXTINTA' },
    };

    expect(valoresDoFormulario(documento, CATALOGOS).unidade).toEqual({
      codigo: 'EXTINTA',
      rotulo: 'EXTINTA',
    });
  });

  it('lê origem não escolhida como vazia', () => {
    expect(valoresDoFormulario(documentoSemNada(), CATALOGOS)).toEqual(SEM_VALORES);
  });

  it('não cria a identificação quando nenhum campo foi preenchido', () => {
    const documento = documentoSemNada();

    expect(edicaoDoPasso(SEM_VALORES)(documento)).toBe(documento);
  });

  it('campo apagado sai do documento em vez de virar texto vazio', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');

    const editado = edicaoDoPasso({ ...SEM_VALORES, nome: '   ' })(documento);

    expect(editado.identificacao).not.toHaveProperty('nome');
    expect(editado.identificacao?.tipoProcessoCodigo).toBe('REGULAR_UNIFICADO');
  });

  it('trocar a unidade descarta o nome e a sigla da unidade anterior', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const valores = {
      ...valoresDe('inscricao-pelo-sistema'),
      unidade: { codigo: 'PROEG', rotulo: '' },
    };

    const identificacao = edicaoDoPasso(valores)(documento).identificacao;

    expect(identificacao?.unidadeAdministradoraCodigo).toBe('PROEG');
    expect(identificacao).not.toHaveProperty('unidadeAdministradoraNome');
    expect(identificacao).not.toHaveProperty('unidadeAdministradoraSigla');
  });

  it('trocar o município descarta o nome e a UF do município anterior', () => {
    const documento = exemploDoContrato('inscricao-pelo-sistema');
    const valores = {
      ...valoresDe('inscricao-pelo-sistema'),
      localidade: { codigoIbge: '1505502' },
    };

    const identificacao = edicaoDoPasso(valores)(documento).identificacao;

    expect(identificacao?.localidadeCodigoIbge).toBe('1505502');
    expect(identificacao).not.toHaveProperty('localidadeNome');
    expect(identificacao).not.toHaveProperty('localidadeUf');
  });

  it('grava a origem escolhida e devolve intacto o que o passo não edita', () => {
    const documento = exemploDoContrato('resultado-importado');
    const valores = { ...valoresDe('resultado-importado'), origem: Origem.INSCRICAO_PROPRIA };

    const editado = edicaoDoPasso(valores)(documento);

    expect(editado.identificacao?.origemCandidatos).toBe(Origem.INSCRICAO_PROPRIA);
    expect({ ...editado, identificacao: undefined }).toEqual({
      ...documento,
      identificacao: undefined,
    });
  });
});
