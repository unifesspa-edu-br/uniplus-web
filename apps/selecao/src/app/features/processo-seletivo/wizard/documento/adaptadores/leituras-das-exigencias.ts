import type {
  DocumentoDaConfiguracaoBaseLegal,
  DocumentoDaConfiguracaoExigencia,
  DocumentoDaConfiguracaoNoDaArvore,
} from '@uniplus/shared-data/selecao';

import type {
  BaseLegalDoFormulario,
  FormatosDoFormulario,
  IdadeMaximaDoFormulario,
} from '../edicoes/condicoes-da-exigencia.edicao';
import type { NoDoFormulario } from '../edicoes/arvore-de-satisfacao.edicao';
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
    status: base.status ?? '',
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

type CondicaoDoNo = Pick<
  NoDoFormulario,
  'origem' | 'tipo' | 'exigenciaChave' | 'quantidadeMinima' | 'consequencia'
>;

function condicaoDoNo(no: DocumentoDaConfiguracaoNoDaArvore, origem: number): CondicaoDoNo {
  return {
    origem,
    tipo: no.tipo,
    exigenciaChave: no.exigenciaChave ?? '',
    quantidadeMinima: textoDoNumero(no.quantidadeMinima),
    consequencia: no.consequencia ?? '',
  };
}

export function noDoFormulario(
  no: DocumentoDaConfiguracaoNoDaArvore,
  origem: number,
): NoDoFormulario {
  return {
    ...condicaoDoNo(no, origem),
    basesLegais: (no.basesLegais ?? []).map(baseLegalDoFormulario),
    chaveDistincao: no.chaveDistincao ?? '',
    dataReferencia: no.dataReferencia ?? '',
    ocorrenciasEsperadas: no.ocorrenciasEsperadas ?? [],
    repetePorEntidade: no.repetePorEntidade ?? '',
    filhos: (no.filhos ?? []).map(noDoFormulario),
  };
}
