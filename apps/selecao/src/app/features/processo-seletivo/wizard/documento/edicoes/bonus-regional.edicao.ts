import type {
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoBonusRegional,
} from '@uniplus/shared-data/selecao';

import { referenciaQueVale, type RegraEscolhida } from '../regra-escolhida';
import { decimalQueVale, textoQueVale } from '../valor-que-vale';
import { comCampo, comCodigo } from './secao-do-documento';

type Bonus = DocumentoDaConfiguracaoBonusRegional;

/**
 * O que a API recusa quando o processo não aplica o bônus, e o que descreve a base legal escolhida
 * (só de leitura): nada disso fica numa declaração de "não aplica".
 */
const SEM_APLICACAO = [
  'regra',
  'fator',
  'teto',
  'codigoDoDadoDeElegibilidade',
  'baseLegalBonusRegionalCodigo',
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
export function definirAplicacaoDoBonus(
  documento: DocumentoDaConfiguracao,
  aplica: boolean | null,
): DocumentoDaConfiguracao {
  if (aplica === null) return removerBonus(documento);
  const bonus = documento.bonusRegional;
  const declarado: Bonus = { ...bonus, aplica };
  const semOQueNaoAplica = aplica || bonus?.aplica === false ? declarado : semAplicacao(declarado);
  return { ...documento, bonusRegional: semOQueNaoAplica };
}

function removerBonus(documento: DocumentoDaConfiguracao): DocumentoDaConfiguracao {
  const { bonusRegional, ...resto } = documento;
  return bonusRegional === undefined ? documento : resto;
}

function semAplicacao(bonus: Bonus): Bonus {
  return SEM_APLICACAO.reduce((atual: Bonus, campo) => comCampo(atual, campo, undefined), bonus);
}

/** Os campos do bônus só existem quando o processo declarou que aplica; sem isso, a edição não vale. */
function quandoAplica(
  documento: DocumentoDaConfiguracao,
  alterar: (bonus: Bonus) => Bonus,
): DocumentoDaConfiguracao {
  const bonus = documento.bonusRegional;
  return bonus?.aplica === true ? { ...documento, bonusRegional: alterar(bonus) } : documento;
}

export function definirRegraDoBonus(
  documento: DocumentoDaConfiguracao,
  regra: RegraEscolhida | null,
): DocumentoDaConfiguracao {
  return quandoAplica(documento, (bonus) =>
    comCampo(bonus, 'regra', referenciaQueVale(bonus.regra, regra)),
  );
}

export function definirFatorDoBonus(
  documento: DocumentoDaConfiguracao,
  texto: string,
): DocumentoDaConfiguracao {
  return quandoAplica(documento, (bonus) =>
    comCampo(bonus, 'fator', decimalQueVale(bonus.fator, texto)),
  );
}

export function definirTetoDoBonus(
  documento: DocumentoDaConfiguracao,
  texto: string,
): DocumentoDaConfiguracao {
  return quandoAplica(documento, (bonus) =>
    comCampo(bonus, 'teto', decimalQueVale(bonus.teto, texto)),
  );
}

export function definirBaseLegalDoBonus(
  documento: DocumentoDaConfiguracao,
  codigo: string,
): DocumentoDaConfiguracao {
  return quandoAplica(documento, (bonus) =>
    comCodigo(
      bonus,
      'baseLegalBonusRegionalCodigo',
      textoQueVale(bonus.baseLegalBonusRegionalCodigo, codigo),
      DESCRITIVOS_DA_BASE_LEGAL,
    ),
  );
}

export function definirFatoDeElegibilidade(
  documento: DocumentoDaConfiguracao,
  codigo: string,
): DocumentoDaConfiguracao {
  return quandoAplica(documento, (bonus) =>
    comCampo(
      bonus,
      'codigoDoDadoDeElegibilidade',
      textoQueVale(bonus.codigoDoDadoDeElegibilidade, codigo),
    ),
  );
}
