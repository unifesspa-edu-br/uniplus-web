import type {
  CriterioDeDistincaoDaRegra,
  ConsequenciaDaRegra,
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoRegraDeComprovacao,
  FormaDeComprovacaoDaConfiguracao,
} from '@uniplus/shared-data/selecao';

import { inteiroQueVale, textoQueVale } from '../valor-que-vale';
import { comBasesLegais, type BaseLegalDoFormulario } from './condicoes-da-exigencia.edicao';
import { paresPorOrigem, type ComOrigem } from './itens-por-origem';
import { comAlteracoes } from './partes-por-chave';
import { comCampo, comEscolha, comLista, naSecao } from './secao-do-documento';

type Regra = DocumentoDaConfiguracaoRegraDeComprovacao;

/** A posição de origem identifica a regra entre as regras do mesmo grupo. */
export interface RegraDoFormulario extends ComOrigem {
  readonly forma: FormaDeComprovacaoDaConfiguracao;
  readonly exigenciaChave: string;
  readonly quantidadeMinima: string;
  readonly consequencia: ConsequenciaDaRegra | '';
  readonly basesLegais: readonly BaseLegalDoFormulario[];
  readonly criterioDeDistincao: CriterioDeDistincaoDaRegra | '';
  readonly dataReferencia: string;
  readonly ocorrenciasEsperadas: readonly string[];
  readonly grupoDoFormularioParaRepeticao: string;
  readonly itens: readonly RegraDoFormulario[];
}

function condicaoDaRegra(regra: Regra, valores: RegraDoFormulario): Regra {
  return comAlteracoes(
    regra,
    (atual) => comCampo(atual, 'forma', valores.forma),
    (atual) =>
      comCampo(atual, 'exigenciaChave', textoQueVale(atual.exigenciaChave, valores.exigenciaChave)),
    (atual) =>
      comCampo(
        atual,
        'quantidadeMinima',
        inteiroQueVale(atual.quantidadeMinima, valores.quantidadeMinima),
      ),
    (atual) => comEscolha(atual, 'consequencia', valores.consequencia),
  );
}

function repeticaoDaRegra(regra: Regra, valores: RegraDoFormulario): Regra {
  return comAlteracoes(
    regra,
    (atual) => comEscolha(atual, 'criterioDeDistincao', valores.criterioDeDistincao),
    (atual) =>
      comCampo(atual, 'dataReferencia', textoQueVale(atual.dataReferencia, valores.dataReferencia)),
    (atual) => comLista(atual, 'ocorrenciasEsperadas', valores.ocorrenciasEsperadas),
    (atual) =>
      comCampo(
        atual,
        'grupoDoFormularioParaRepeticao',
        textoQueVale(atual.grupoDoFormularioParaRepeticao, valores.grupoDoFormularioParaRepeticao),
      ),
  );
}

function regraComValores(atual: Regra | undefined, valores: RegraDoFormulario): Regra {
  return comAlteracoes(
    atual ?? { forma: valores.forma },
    (regra) => condicaoDaRegra(regra, valores),
    (regra) => repeticaoDaRegra(regra, valores),
    (regra) => comBasesLegais(regra, valores.basesLegais),
    (regra) => comLista(regra, 'itens', regrasComValores(regra.itens, valores.itens)),
  );
}

function regrasComValores(
  atuais: readonly Regra[] | undefined,
  valores: readonly RegraDoFormulario[],
): Regra[] {
  return paresPorOrigem(atuais ?? [], valores).map(([atual, valor]) =>
    regraComValores(atual, valor),
  );
}

/** Mantém as referências a exigências removidas para que a API possa apontá-las. */
export function definirRegrasDeComprovacao(
  documento: DocumentoDaConfiguracao,
  regras: readonly RegraDoFormulario[],
): DocumentoDaConfiguracao {
  return naSecao(documento, 'documentosExigidos', (secao) =>
    comLista(secao, 'regrasDeComprovacao', regrasComValores(secao.regrasDeComprovacao, regras)),
  );
}
