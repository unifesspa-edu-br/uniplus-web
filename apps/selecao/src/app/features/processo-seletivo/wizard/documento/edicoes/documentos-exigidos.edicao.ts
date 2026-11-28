import type {
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoExigencia as Exigencia,
  DocumentoDaConfiguracaoRegraDeComprovacao as Regra,
} from '@uniplus/shared-data/selecao';

import type { ExigenciasDoRascunho } from '../../modelos/exigencias.models';
import { comAlcanceDeTodasAsFases } from '../../shared/exigencias/alcance-das-exigencias';
import type { ReservasDeChaves } from '../chaves-tomadas';
import { exigenciasPorChave, regrasEmOrdem } from '../exigencias/exigencia-no-editor';
import {
  exigenciasNoDocumento,
  type ContextoDasExigencias,
} from '../exigencias/exigencia-no-documento';
import {
  chavesCitadas,
  regrasNoDocumento,
  type ContextoDasRegras,
} from '../exigencias/regras-no-documento';
import { comAlteracoes } from './partes-por-chave';
import {
  comLista,
  naSecao,
  type EdicaoDoDocumento,
  type SecaoDoDocumento,
} from './secao-do-documento';

type Secao = SecaoDoDocumento<'documentosExigidos'>;

/**
 * Leva ao documento as exigências de documento como a tela as tem, sem gravar nada. A exigência
 * que a tela criou recebe uma chave que nem a versão base nem a edição já usaram; o que a tela não
 * edita, como a regra que cita exigência inexistente e a exigência que nenhuma regra cita, fica
 * como estava.
 */
export function edicaoDasExigencias(
  exigencias: ExigenciasDoRascunho,
  reservas: ReservasDeChaves,
): EdicaoDoDocumento {
  return (documento) =>
    naSecao(documento, 'documentosExigidos', (secao) =>
      secaoEditada(documento, secao, exigencias, reservas),
    );
}

function secaoEditada(
  documento: DocumentoDaConfiguracao,
  secao: Secao,
  exigencias: ExigenciasDoRascunho,
  reservas: ReservasDeChaves,
): Secao {
  const fases = documento.cronograma?.fases ?? [];
  const { lista, regras } = convertidas(secao, exigencias, { documento, fases, reservas });
  return comAlteracoes(
    secao,
    (atual) => comLista(atual, 'exigencias', lista),
    (atual) => comLista(atual, 'regrasDeComprovacao', regras),
  );
}

function convertidas(
  secao: Secao,
  exigencias: ExigenciasDoRascunho,
  contexto: ContextoDasExigencias,
) {
  const codigos = contexto.fases.map((fase) => fase.tipoFaseCodigo);
  const regrasDaTela = comAlcanceDeTodasAsFases(exigencias, codigos).regrasDeComprovacao;
  const originais = secao.exigencias ?? [];
  const editadas = exigenciasNoDocumento(originais, regrasDaTela, contexto);
  const contextoDasRegras = contextoDaConversao(secao, editadas.chavePorDocumento);
  const regras = regrasNoDocumento(secao.regrasDeComprovacao, regrasDaTela, contextoDasRegras);
  return { lista: semAsRetiradas(secao, editadas.exigencias, regras), regras };
}

function contextoDaConversao(
  secao: Secao,
  chavePorDocumento: ContextoDasRegras['chavePorDocumento'],
): ContextoDasRegras {
  return {
    porOrigem: regrasEmOrdem(secao.regrasDeComprovacao ?? []),
    usadas: new Set<number>(),
    exigencias: exigenciasPorChave(secao.exigencias ?? []),
    chavePorDocumento,
  };
}

function semAsRetiradas(secao: Secao, exigencias: readonly Exigencia[], regras: readonly Regra[]) {
  const retiradas = chavesRetiradas(secao, regras);
  return exigencias.filter(({ chave }) => !retiradas.has(chave));
}

/** A exigência cuja única regra saiu sai com ela; a que nenhuma regra citava continua. */
function chavesRetiradas(secao: Secao, regras: readonly Regra[]) {
  const agora = chavesCitadas(regras);
  return new Set(
    [...chavesCitadas(secao.regrasDeComprovacao ?? [])].filter((chave) => !agora.has(chave)),
  );
}
