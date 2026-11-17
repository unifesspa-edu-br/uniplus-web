import type {
  CaraterDaEtapa,
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoEtapa,
  FormaDeAvaliacaoDaEtapa,
} from '@uniplus/shared-data/selecao';

import { novaChave } from '../../shared/chaves/chave-local';
import { chavesTomadas, type ReservasDeChaves } from '../chaves-tomadas';
import { type RegraEscolhida, referenciaQueVale } from '../regra-escolhida';
import { decimalQueVale, instanteQueVale, textoQueVale } from '../valor-que-vale';
import {
  comAvaliacao,
  type ItemDoFormulario,
  type NivelDoFormulario,
} from './avaliacao-da-etapa.edicao';
import { comAlteracoes, mudouDeOrdem, partesPareadas } from './partes-por-chave';
import { comCampo, comEscolha, comLista } from './secao-do-documento';

type Etapa = DocumentoDaConfiguracaoEtapa;

/**
 * A etapa como o formulário a tem. Os números e a janela vão em texto, como os campos os escrevem;
 * caráter e forma de avaliação vazios são "ainda não escolhidos".
 */
export interface EtapaDoFormulario {
  readonly origem?: number;
  readonly chave: string;
  readonly nome: string;
  readonly carater: CaraterDaEtapa | '';
  readonly tipoEtapaCodigo: string;
  readonly peso: string;
  readonly notaMinima: string;
  readonly notaMaxima: string;
  readonly passoDoLancamento: string;
  readonly formaDeAvaliacao: FormaDeAvaliacaoDaEtapa | '';
  readonly regraDeConsolidacao: RegraEscolhida | null;
  readonly faseChave: string;
  readonly inicio: string;
  readonly fim: string;
  readonly itensDeAvaliacao: readonly ItemDoFormulario[];
  readonly escalaDeAtendimento: readonly NivelDoFormulario[];
}

function identidadeDaEtapa(etapa: Etapa, valores: EtapaDoFormulario): Etapa {
  return comAlteracoes(
    etapa,
    (atual) => comCampo(atual, 'nome', textoQueVale(atual.nome, valores.nome)),
    (atual) => comEscolha(atual, 'carater', valores.carater),
    (atual) =>
      comCampo(
        atual,
        'tipoEtapaCodigo',
        textoQueVale(atual.tipoEtapaCodigo, valores.tipoEtapaCodigo),
      ),
    (atual) => comCampo(atual, 'faseChave', textoQueVale(atual.faseChave, valores.faseChave)),
  );
}

function notasDaEtapa(etapa: Etapa, valores: EtapaDoFormulario): Etapa {
  return comAlteracoes(
    etapa,
    (atual) => comCampo(atual, 'peso', decimalQueVale(atual.peso, valores.peso)),
    (atual) => comCampo(atual, 'notaMinima', decimalQueVale(atual.notaMinima, valores.notaMinima)),
    (atual) => comCampo(atual, 'notaMaxima', decimalQueVale(atual.notaMaxima, valores.notaMaxima)),
    (atual) =>
      comCampo(
        atual,
        'passoDoLancamento',
        decimalQueVale(atual.passoDoLancamento, valores.passoDoLancamento),
      ),
  );
}

function formaDeAvaliarDaEtapa(etapa: Etapa, valores: EtapaDoFormulario): Etapa {
  return comAlteracoes(
    etapa,
    (atual) => comEscolha(atual, 'formaDeAvaliacao', valores.formaDeAvaliacao),
    (atual) =>
      comCampo(
        atual,
        'regraConsolidacao',
        referenciaQueVale(atual.regraConsolidacao, valores.regraDeConsolidacao),
      ),
  );
}

function janelaDaEtapa(etapa: Etapa, valores: EtapaDoFormulario): Etapa {
  return comAlteracoes(
    etapa,
    (atual) => comCampo(atual, 'inicio', instanteQueVale(atual.inicio, valores.inicio)),
    (atual) => comCampo(atual, 'fim', instanteQueVale(atual.fim, valores.fim)),
  );
}

function etapaComValores(atual: Etapa, valores: EtapaDoFormulario): Etapa {
  return comAlteracoes(
    atual,
    (etapa) => identidadeDaEtapa(etapa, valores),
    (etapa) => notasDaEtapa(etapa, valores),
    (etapa) => formaDeAvaliarDaEtapa(etapa, valores),
    (etapa) => janelaDaEtapa(etapa, valores),
    (etapa) => comAvaliacao(etapa, valores.itensDeAvaliacao, valores.escalaDeAtendimento),
  );
}

/**
 * As etapas, na ordem do formulário. A `ordem` só é renumerada, de 1 em diante, quando alguma
 * etapa mudou de lugar: retirar uma etapa ou editá-la deixa a `ordem` das demais como está.
 * A etapa que o formulário deixa de trazer sai, sem levar as referências que outras partes fazem
 * a ela; a chave dela segue tomada durante a edição.
 */
export function definirEtapas(
  documento: DocumentoDaConfiguracao,
  etapas: readonly EtapaDoFormulario[],
): DocumentoDaConfiguracao {
  const atuais = documento.etapas ?? [];
  const pares = partesPareadas(atuais, etapas);
  const alteradas = pares.map(([atual, valores]) => etapaComValores(atual, valores));
  const resultado = mudouDeOrdem(atuais, pares)
    ? alteradas.map((etapa, posicao) => comCampo(etapa, 'ordem', posicao + 1))
    : alteradas;
  return comLista(documento, 'etapas', resultado);
}

/** A etapa nova vai ao fim, depois da maior `ordem` que já existe, com a chave atribuída aqui. */
export function acrescentarEtapa(
  documento: DocumentoDaConfiguracao,
  nome: string,
  reservas: ReservasDeChaves,
): DocumentoDaConfiguracao {
  const etapas = documento.etapas ?? [];
  const tomadas = chavesTomadas(
    documento,
    etapas.map((etapa) => etapa.chave),
    reservas,
  );
  const maiorOrdem = Math.max(0, ...etapas.map((etapa) => etapa.ordem ?? 0));
  const nova: Etapa = { chave: novaChave({ tipo: 'etapa', nome, tomadas }), ordem: maiorOrdem + 1 };
  return comLista(documento, 'etapas', [...etapas, nova]);
}
