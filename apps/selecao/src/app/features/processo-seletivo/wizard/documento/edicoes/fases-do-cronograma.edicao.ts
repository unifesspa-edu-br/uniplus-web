import type {
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoCronogramaFase,
} from '@uniplus/shared-data/selecao';

import { chavesTomadas, type ReservasDeChaves } from '../chaves-tomadas';
import { instanteQueVale, textoQueVale } from '../valor-que-vale';
import { novaChave } from '../../shared/chaves/chave-local';
import { comAlteracoes, comPartePorChave, partesAlteradas } from './partes-por-chave';
import { comCampo, comCodigo, comLista, naSecao } from './secao-do-documento';

type Fase = DocumentoDaConfiguracaoCronogramaFase;

/**
 * A fase como o formulário a tem. A janela é a hora de parede do campo de data e hora; a posição
 * da fase na lista do formulário é a posição dela no cronograma, porque as fases não têm `ordem`.
 */
export interface FaseDoFormulario {
  readonly origem?: number;
  readonly chave: string;
  readonly faseCanonicaCodigo: string;
  readonly inicio: string;
  readonly fim: string;
  readonly unidadeResponsavelCodigo: string;
}

function faseComValores(atual: Fase, valores: FaseDoFormulario): Fase {
  return comAlteracoes(
    atual,
    (fase) =>
      comCampo(
        fase,
        'faseCanonicaCodigo',
        textoQueVale(fase.faseCanonicaCodigo, valores.faseCanonicaCodigo),
      ),
    (fase) => comCampo(fase, 'inicio', instanteQueVale(fase.inicio, valores.inicio)),
    (fase) => comCampo(fase, 'fim', instanteQueVale(fase.fim, valores.fim)),
    (fase) => comUnidadeResponsavel(fase, valores.unidadeResponsavelCodigo),
  );
}

/** Trocar a unidade descarta o nome e a sigla da anterior: a API os recalcula do novo código. */
function comUnidadeResponsavel(fase: Fase, codigo: string): Fase {
  return comCodigo(
    fase,
    'unidadeResponsavelCodigo',
    textoQueVale(fase.unidadeResponsavelCodigo, codigo),
    ['unidadeResponsavelNome', 'unidadeResponsavelSigla'],
  );
}

/**
 * As fases do cronograma, na ordem do formulário: mover uma fase no formulário é movê-la no
 * documento. A fase que o formulário deixa de trazer sai sozinha, sem levar as referências que
 * outras partes fazem a ela; a chave dela segue tomada durante a edição.
 */
export function definirFases(
  documento: DocumentoDaConfiguracao,
  fases: readonly FaseDoFormulario[],
): DocumentoDaConfiguracao {
  return naSecao(documento, 'cronograma', (cronograma) =>
    comLista(cronograma, 'fases', partesAlteradas(cronograma.fases ?? [], fases, faseComValores)),
  );
}

/** A fase nova vai ao fim, com a chave atribuída aqui: depois de criada, a chave não muda. */
export function acrescentarFase(
  documento: DocumentoDaConfiguracao,
  faseCanonicaCodigo: string,
  nome: string,
  reservas: ReservasDeChaves,
): DocumentoDaConfiguracao {
  return naSecao(documento, 'cronograma', (cronograma) => {
    const fases = cronograma.fases ?? [];
    const tomadas = chavesDasFases(documento, fases, reservas);
    const chave = novaChave({ tipo: 'fase', nome, tomadas });
    return comCampo(cronograma, 'fases', [...fases, { chave, faseCanonicaCodigo }]);
  });
}

/** Edita a fase da chave; sem ela no documento, nada muda. Chave repetida vale a primeira fase. */
export function naFase(
  documento: DocumentoDaConfiguracao,
  chave: string,
  alterar: (fase: Fase) => Fase,
): DocumentoDaConfiguracao {
  const fases = comPartePorChave(documento.cronograma?.fases ?? [], chave, alterar);
  if (fases === undefined) return documento;
  return naSecao(documento, 'cronograma', (cronograma) => comLista(cronograma, 'fases', fases));
}

function chavesDasFases(
  documento: DocumentoDaConfiguracao,
  fases: readonly Fase[],
  reservas: ReservasDeChaves,
): ReadonlySet<string> {
  return chavesTomadas(
    documento,
    fases.map((fase) => fase.chave),
    reservas,
  );
}
