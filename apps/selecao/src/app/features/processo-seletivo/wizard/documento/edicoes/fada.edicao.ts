import type {
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoFada,
} from '@uniplus/shared-data/selecao';

import { referenciaQueVale, type RegraEscolhida } from '../regra-escolhida';
import { decimalQueVale, textoQueVale } from '../valor-que-vale';
import { comCampo, comCodigo } from './secao-do-documento';

type Fada = DocumentoDaConfiguracaoFada;

/**
 * O que a API recusa quando o processo não aplica o FADA, e o que descreve a base legal escolhida
 * (só de leitura): nada disso fica numa declaração de "não aplica".
 */
const SEM_APLICACAO = [
  'regra',
  'fator',
  'teto',
  'codigoDoDadoDeElegibilidade',
  'baseLegalCodigo',
  'tipoInstrumento',
  'identificacao',
  'descricao',
  'municipios',
] as const;

const DESCRITIVOS_DA_BASE_LEGAL = [
  'tipoInstrumento',
  'identificacao',
  'descricao',
  'municipios',
] as const;

/**
 * A declaração é obrigatória para o processo ser publicado, então `null` remove o bloco inteiro:
 * ausente é "ainda não decidiu". `false` deixa só a declaração; `true` mantém o que já havia.
 */
export function definirAplicacaoDoFada(
  documento: DocumentoDaConfiguracao,
  aplica: boolean | null,
): DocumentoDaConfiguracao {
  if (aplica === null) return removerFada(documento);
  const fada = documento.fada;
  const declarado: Fada = { ...fada, aplica };
  const semOQueNaoAplica = aplica || fada?.aplica === false ? declarado : semAplicacao(declarado);
  return { ...documento, fada: semOQueNaoAplica };
}

function removerFada(documento: DocumentoDaConfiguracao): DocumentoDaConfiguracao {
  const { fada, ...resto } = documento;
  return fada === undefined ? documento : resto;
}

function semAplicacao(fada: Fada): Fada {
  return SEM_APLICACAO.reduce((atual: Fada, campo) => comCampo(atual, campo, undefined), fada);
}

/** Os campos do FADA só existem quando o processo declarou que aplica; sem isso, a edição não vale. */
function quandoAplica(
  documento: DocumentoDaConfiguracao,
  alterar: (fada: Fada) => Fada,
): DocumentoDaConfiguracao {
  const fada = documento.fada;
  return fada?.aplica === true ? { ...documento, fada: alterar(fada) } : documento;
}

export function definirRegraDoFada(
  documento: DocumentoDaConfiguracao,
  regra: RegraEscolhida | null,
): DocumentoDaConfiguracao {
  return quandoAplica(documento, (fada) =>
    comCampo(fada, 'regra', referenciaQueVale(fada.regra, regra)),
  );
}

export function definirFatorDoFada(
  documento: DocumentoDaConfiguracao,
  texto: string,
): DocumentoDaConfiguracao {
  return quandoAplica(documento, (fada) =>
    comCampo(fada, 'fator', decimalQueVale(fada.fator, texto)),
  );
}

export function definirTetoDoFada(
  documento: DocumentoDaConfiguracao,
  texto: string,
): DocumentoDaConfiguracao {
  return quandoAplica(documento, (fada) =>
    comCampo(fada, 'teto', decimalQueVale(fada.teto, texto)),
  );
}

export function definirBaseLegalDoFada(
  documento: DocumentoDaConfiguracao,
  codigo: string,
): DocumentoDaConfiguracao {
  return quandoAplica(documento, (fada) =>
    comCodigo(
      fada,
      'baseLegalCodigo',
      textoQueVale(fada.baseLegalCodigo, codigo),
      DESCRITIVOS_DA_BASE_LEGAL,
    ),
  );
}

export function definirFatoDeElegibilidade(
  documento: DocumentoDaConfiguracao,
  codigo: string,
): DocumentoDaConfiguracao {
  return quandoAplica(documento, (fada) =>
    comCampo(
      fada,
      'codigoDoDadoDeElegibilidade',
      textoQueVale(fada.codigoDoDadoDeElegibilidade, codigo),
    ),
  );
}
