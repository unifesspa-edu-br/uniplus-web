import type {
  ChaveDeDistincaoDoNo,
  ConsequenciaDoNo,
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoNoDaArvore,
  TipoDeNoDaArvore,
} from '@uniplus/shared-data/selecao';

import { inteiroQueVale, textoQueVale } from '../valor-que-vale';
import { comBasesLegais, type BaseLegalDoFormulario } from './condicoes-da-exigencia.edicao';
import { ordemFoiMexida, paresPorOrigem, type ComOrigem } from './itens-por-origem';
import { comAlteracoes } from './partes-por-chave';
import { comCampo, comEscolha, comLista, naSecao } from './secao-do-documento';

type No = DocumentoDaConfiguracaoNoDaArvore;

/**
 * O nó como o formulário o tem. O nó não tem chave: `origem` é a posição que ele ocupava entre os
 * irmãos quando o formulário foi lido, e `null` marca o nó criado no formulário. É por ela que o nó
 * movido continua sendo o mesmo nó do documento.
 */
export interface NoDoFormulario extends ComOrigem {
  readonly tipo: TipoDeNoDaArvore;
  readonly exigenciaChave: string;
  readonly quantidadeMinima: string;
  readonly consequencia: ConsequenciaDoNo | '';
  readonly basesLegais: readonly BaseLegalDoFormulario[];
  readonly chaveDistincao: ChaveDeDistincaoDoNo | '';
  readonly dataReferencia: string;
  readonly ocorrenciasEsperadas: readonly string[];
  readonly repetePorEntidade: string;
  readonly filhos: readonly NoDoFormulario[];
}

function condicaoDoNo(no: No, valores: NoDoFormulario): No {
  return comAlteracoes(
    no,
    (atual) => comCampo(atual, 'tipo', valores.tipo),
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

function repeticaoDoNo(no: No, valores: NoDoFormulario): No {
  return comAlteracoes(
    no,
    (atual) => comEscolha(atual, 'chaveDistincao', valores.chaveDistincao),
    (atual) =>
      comCampo(atual, 'dataReferencia', textoQueVale(atual.dataReferencia, valores.dataReferencia)),
    (atual) => comLista(atual, 'ocorrenciasEsperadas', valores.ocorrenciasEsperadas),
    (atual) =>
      comCampo(
        atual,
        'repetePorEntidade',
        textoQueVale(atual.repetePorEntidade, valores.repetePorEntidade),
      ),
  );
}

function noComValores(atual: No | undefined, valores: NoDoFormulario): No {
  return comAlteracoes(
    atual ?? { tipo: valores.tipo },
    (no) => condicaoDoNo(no, valores),
    (no) => repeticaoDoNo(no, valores),
    (no) => comBasesLegais(no, valores.basesLegais),
    (no) => comLista(no, 'filhos', nosComValores(no.filhos, valores.filhos)),
  );
}

function renumerados(nos: No[]): No[] {
  return nos.map((no, posicao) => comCampo(no, 'ordem', posicao + 1));
}

/**
 * Os nós, na ordem do formulário. A `ordem` só é regravada quando a lista muda de ordem ou ganha um
 * nó: lida e devolvida sem mudança, a `ordem` que o documento trazia fica como estava.
 */
function nosComValores(
  atuais: readonly No[] | undefined,
  valores: readonly NoDoFormulario[],
): No[] {
  const lidos = atuais ?? [];
  const pares = paresPorOrigem(lidos, valores);
  const nos = pares.map(([atual, doFormulario]) => noComValores(atual, doFormulario));
  return ordemFoiMexida(lidos, pares) ? renumerados(nos) : nos;
}

/**
 * A árvore de satisfação das exigências. O nó que cita uma exigência retirada segue citando a chave
 * dela: a árvore não persegue a exigência, e a API aponta a referência solta.
 */
export function definirArvoreDeSatisfacao(
  documento: DocumentoDaConfiguracao,
  nos: readonly NoDoFormulario[],
): DocumentoDaConfiguracao {
  return naSecao(documento, 'documentosExigidos', (secao) =>
    comLista(secao, 'arvoreDeSatisfacao', nosComValores(secao.arvoreDeSatisfacao, nos)),
  );
}
