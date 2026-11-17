import type {
  AncoraDoRecursoDaEtapa,
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoPropriedadesDoRecurso,
  DocumentoDaConfiguracaoRecursoDaEtapa,
  UnidadeDaSuspensividade,
  UnidadeDaSuspensividadeNaSegundaInstancia,
  UnidadeDoPrazoDoRecurso,
} from '@uniplus/shared-data/selecao';

import { decimalQueVale, textoQueVale } from '../valor-que-vale';
import { naFase } from './fases-do-cronograma.edicao';
import { paresPorOrigem, type ComOrigem } from './itens-por-origem';
import { naEtapa } from './na-etapa';
import { editarOcorrenciaDaEtapa, editarOcorrenciaDaFase } from './ocorrencia-da-fase-ou-etapa';
import { comAlteracoes } from './partes-por-chave';
import { comCampo, comEscolha, comLista } from './secao-do-documento';

type Propriedades = DocumentoDaConfiguracaoPropriedadesDoRecurso;
type RecursoDaEtapa = DocumentoDaConfiguracaoRecursoDaEtapa;

/**
 * O prazo e o efeito suspensivo do recurso, como o formulário os tem. Os procedimentos de recurso
 * não fazem parte: têm a edição própria e voltam como estavam.
 */
export interface RecursoDoFormulario {
  readonly regraCodigo: string;
  readonly regraVersao: string;
  readonly prazoValor: string;
  readonly prazoUnidade: UnidadeDoPrazoDoRecurso | '';
  readonly atoAncoraCodigo: string;
  readonly suspensividadePrimeiraInstanciaValor: string;
  readonly suspensividadePrimeiraInstanciaUnidade: UnidadeDaSuspensividade | '';
  readonly admiteInstanciaSuperior: boolean | null;
  readonly suspensividadeSegundaInstanciaValor: string;
  readonly suspensividadeSegundaInstanciaUnidade: UnidadeDaSuspensividadeNaSegundaInstancia | '';
}

/** O recurso da etapa não tem chave: `origem` é a posição dele na lista da etapa quando foi lido. */
export interface RecursoDaEtapaDoFormulario extends RecursoDoFormulario, ComOrigem {
  readonly ancora: AncoraDoRecursoDaEtapa | '';
}

function regraEPrazo<T extends Propriedades>(parte: T, valores: RecursoDoFormulario): T {
  return comAlteracoes(
    parte,
    (atual) => comCampo(atual, 'regraCodigo', textoQueVale(atual.regraCodigo, valores.regraCodigo)),
    (atual) => comCampo(atual, 'regraVersao', textoQueVale(atual.regraVersao, valores.regraVersao)),
    (atual) => comCampo(atual, 'prazoValor', decimalQueVale(atual.prazoValor, valores.prazoValor)),
    (atual) => comEscolha(atual, 'prazoUnidade', valores.prazoUnidade),
    (atual) =>
      comCampo(
        atual,
        'atoAncoraCodigo',
        textoQueVale(atual.atoAncoraCodigo, valores.atoAncoraCodigo),
      ),
  );
}

function valorDaPrimeiraInstancia<T extends Propriedades>(parte: T, texto: string): T {
  const atual = parte.suspensividadePrimeiraInstanciaValor;
  return comCampo(parte, 'suspensividadePrimeiraInstanciaValor', decimalQueVale(atual, texto));
}

function valorDaSegundaInstancia<T extends Propriedades>(parte: T, texto: string): T {
  const atual = parte.suspensividadeSegundaInstanciaValor;
  return comCampo(parte, 'suspensividadeSegundaInstanciaValor', decimalQueVale(atual, texto));
}

function suspensividade<T extends Propriedades>(parte: T, valores: RecursoDoFormulario): T {
  const { suspensividadePrimeiraInstanciaUnidade: primeira } = valores;
  const { suspensividadeSegundaInstanciaUnidade: segunda } = valores;
  return comAlteracoes(
    parte,
    (atual) => valorDaPrimeiraInstancia(atual, valores.suspensividadePrimeiraInstanciaValor),
    (atual) => comEscolha(atual, 'suspensividadePrimeiraInstanciaUnidade', primeira),
    (atual) => valorDaSegundaInstancia(atual, valores.suspensividadeSegundaInstanciaValor),
    (atual) => comEscolha(atual, 'suspensividadeSegundaInstanciaUnidade', segunda),
  );
}

function comRecurso<T extends Propriedades>(parte: T, valores: RecursoDoFormulario): T {
  return comAlteracoes(
    parte,
    (atual) => regraEPrazo(atual, valores),
    (atual) =>
      comCampo(atual, 'admiteInstanciaSuperior', valores.admiteInstanciaSuperior ?? undefined),
    (atual) => suspensividade(atual, valores),
  );
}

function regraDoRecurso(
  atual: Propriedades | undefined,
  recurso: RecursoDoFormulario | null,
): Propriedades | undefined {
  return recurso === null ? undefined : comRecurso(atual ?? {}, recurso);
}

/**
 * A janela de recurso da fase. Sem recurso (`null`) a fase deixa de admitir recurso e a regra sai
 * inteira, com os procedimentos que ela tinha; com recurso, a regra que não existia nasce vazia e
 * recebe os valores.
 */
export function definirRecursoDaFase(
  documento: DocumentoDaConfiguracao,
  faseChave: string,
  recurso: RecursoDoFormulario | null,
  ocorrencia = 0,
): DocumentoDaConfiguracao {
  return editarOcorrenciaDaFase(documento, faseChave, ocorrencia, (isolado) =>
    naFase(isolado, faseChave, (fase) =>
      comCampo(fase, 'regraRecurso', regraDoRecurso(fase.regraRecurso, recurso)),
    ),
  );
}

function recursoDaEtapaComValores(
  atual: RecursoDaEtapa | undefined,
  valores: RecursoDaEtapaDoFormulario,
): RecursoDaEtapa {
  return comAlteracoes(
    atual ?? {},
    (recurso) => comEscolha(recurso, 'ancora', valores.ancora),
    (recurso) => comRecurso(recurso, valores),
  );
}

/** Os recursos da etapa, na ordem do formulário; o que o formulário deixa de trazer sai. */
export function definirRecursosDaEtapa(
  documento: DocumentoDaConfiguracao,
  etapaChave: string,
  recursos: readonly RecursoDaEtapaDoFormulario[],
  ocorrencia = 0,
): DocumentoDaConfiguracao {
  return editarOcorrenciaDaEtapa(documento, etapaChave, ocorrencia, (isolado) =>
    naEtapa(isolado, etapaChave, (etapa) => {
      const pares = paresPorOrigem(etapa.recursos ?? [], recursos);
      const novos = pares.map(([atual, valores]) => recursoDaEtapaComValores(atual, valores));
      return comLista(etapa, 'recursos', novos);
    }),
  );
}
