import type {
  DocumentoDaConfiguracaoBaseLegal,
  DocumentoDaConfiguracaoExigencia,
  DocumentoDaConfiguracaoRegraDeComprovacao,
} from '@uniplus/shared-data/selecao';

import type {
  BaseLegalDoFormulario,
  FormatosDoFormulario,
  IdadeMaximaDoFormulario,
} from '../edicoes/condicoes-da-exigencia.edicao';
import type { RegraDoFormulario } from '../edicoes/regras-de-comprovacao.edicao';
import { textoDoNumero } from '../texto-do-campo';

type Exigencia = DocumentoDaConfiguracaoExigencia;

export function baseLegalDoFormulario(
  base: DocumentoDaConfiguracaoBaseLegal,
  origem: number,
): BaseLegalDoFormulario {
  return {
    origem,
    referencia: base.referencia ?? '',
    abrangencia: base.abrangencia ?? '',
    situacao: base.situacao ?? '',
    observacao: base.observacao ?? '',
  };
}

export function idadeMaximaDoFormulario(
  idade: Exigencia['idadeMaximaEmissao'],
): IdadeMaximaDoFormulario | null {
  if (idade === undefined) return null;
  return {
    valor: textoDoNumero(idade.valor),
    unidade: idade.unidade ?? '',
    referenciaTipo: idade.referenciaTipo ?? '',
    data: idade.data ?? '',
    referenciaFaseChave: idade.referenciaFaseChave ?? '',
  };
}

export function formatosDoFormulario(
  formatos: Exigencia['formatosPermitidos'],
): FormatosDoFormulario | null {
  if (formatos === undefined) return null;
  return {
    qualquer: formatos.qualquer ?? null,
    lista: (formatos.lista ?? []).map((item, origem) => ({
      origem,
      formato: item.formato ?? '',
      tamanhoMaximoBytesMax: textoDoNumero(item.tamanhoMaximoBytesMax),
    })),
  };
}

type CondicaoDaRegra = Pick<
  RegraDoFormulario,
  'origem' | 'forma' | 'exigenciaChave' | 'quantidadeMinima' | 'consequencia'
>;

function condicaoDaRegra(
  regra: DocumentoDaConfiguracaoRegraDeComprovacao,
  origem: number,
): CondicaoDaRegra {
  return {
    origem,
    forma: regra.forma,
    exigenciaChave: regra.exigenciaChave ?? '',
    quantidadeMinima: textoDoNumero(regra.quantidadeMinima),
    consequencia: regra.consequencia ?? '',
  };
}

export function regraDoFormulario(
  regra: DocumentoDaConfiguracaoRegraDeComprovacao,
  origem: number,
): RegraDoFormulario {
  return {
    ...condicaoDaRegra(regra, origem),
    basesLegais: (regra.basesLegais ?? []).map(baseLegalDoFormulario),
    criterioDeDistincao: regra.criterioDeDistincao ?? '',
    dataReferencia: regra.dataReferencia ?? '',
    ocorrenciasEsperadas: regra.ocorrenciasEsperadas ?? [],
    grupoDoFormularioParaRepeticao: regra.grupoDoFormularioParaRepeticao ?? '',
    itens: (regra.itens ?? []).map(regraDoFormulario),
  };
}
