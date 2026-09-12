import type { EtapaProcessoInput, FaseCronogramaInput } from '@uniplus/shared-data/selecao';

import type { EtapaPontuada, FaseDoCronograma } from '../../processo-seletivo.models';
import { instanteDoCampo } from '../../shared/fuso-institucional';
import { decimalDoCampo } from '../../shared/numero-do-campo';

/**
 * A fase como o comando a recebe.
 *
 * Os produtos, a fase concluinte, o parecer individual, as bancas requeridas e
 * a regra de recurso atravessam inalterados: quem os edita é a superfície da
 * fase, e a gravação do cronograma substitui a coleção inteira — deixá-los de
 * fora aqui apagaria, a cada mudança de data, o que a fase declara publicar, as
 * bancas que ela requer e o recurso ancorado no que ela publica.
 */
export function comoComandoDeFase(fase: FaseDoCronograma): FaseCronogramaInput {
  return {
    ordem: fase.ordem,
    faseCanonicaId: fase.faseCanonicaId,
    inicio: fase.inicio,
    fim: fase.fim,
    produtos: fase.produtos.map((produto) => ({
      atoCodigo: produto.atoCodigo,
      papel: produto.papel,
    })),
    faseConcluinteCodigo: fase.faseConcluinteCodigo,
    emiteParecerIndividual: fase.emiteParecerIndividual,
    bancasRequeridas: fase.bancasRequeridas.map((banca) => ({
      tipoBancaId: banca.tipoBancaId,
      categoriasDocumentoIds: [...banca.categoriasDocumentoIds],
    })),
    regraRecurso:
      fase.regraRecurso === null
        ? null
        : {
            regraCodigo: fase.regraRecurso.regraCodigo,
            regraVersao: fase.regraRecurso.regraVersao,
            prazoValor: decimalDoCampo(fase.regraRecurso.prazoValor) ?? 0,
            prazoUnidade: fase.regraRecurso.prazoUnidade as NonNullable<
              FaseCronogramaInput['regraRecurso']
            >['prazoUnidade'],
            atoAncoraCodigo: fase.regraRecurso.atoAncoraCodigo,
            suspensividadePrimeiraInstanciaValor: decimalDoCampo(
              fase.regraRecurso.suspensividadePrimeiraInstanciaValor,
            ),
            suspensividadePrimeiraInstanciaUnidade:
              fase.regraRecurso.suspensividadePrimeiraInstanciaUnidade === ''
                ? null
                : fase.regraRecurso.suspensividadePrimeiraInstanciaUnidade,
            suspensividadeSegundaInstanciaValor: decimalDoCampo(
              fase.regraRecurso.suspensividadeSegundaInstanciaValor,
            ),
            suspensividadeSegundaInstanciaUnidade:
              fase.regraRecurso.suspensividadeSegundaInstanciaUnidade === ''
                ? null
                : fase.regraRecurso.suspensividadeSegundaInstanciaUnidade,
          },
  };
}

/**
 * A etapa como o comando a recebe.
 *
 * `id` só vai quando existe: é ele que diz ao servidor que a etapa é a mesma de
 * antes, e é por ele que desempate e cláusula de eliminação continuam
 * apontando para ela. Enviar `null` numa etapa que já existe a recriaria com
 * outro id, e as regras que a referenciam ficariam órfãs.
 *
 * Peso e nota mínima seguem em branco quando o campo está vazio — o domínio
 * distingue "não declarado" de zero, e mandar zero faria uma etapa sem peso
 * declarar que não conta para a nota.
 */
export function comoComandoDeEtapa(etapa: EtapaPontuada): EtapaProcessoInput {
  return {
    ...(etapa.id === null ? {} : { id: etapa.id }),
    nome: etapa.nome.trim(),
    carater: etapa.carater as EtapaProcessoInput['carater'],
    tipoEtapaOrigemId: etapa.tipoEtapaOrigemId,
    peso: decimalDoCampo(etapa.peso),
    notaMinima: decimalDoCampo(etapa.notaMinima),
    ordem: etapa.ordem,
    faseCodigo: etapa.faseCodigo === '' ? null : etapa.faseCodigo,
    produtos: etapa.produtos.map((produto) => ({
      atoCodigo: produto.atoCodigo,
      papel: produto.papel as EtapaProcessoInput['produtos'] extends readonly (infer P)[]
        ? P extends { papel: infer T }
          ? T
          : never
        : never,
    })),
    inicio: etapa.inicio === '' ? null : instanteDoCampo(etapa.inicio),
    fim: etapa.fim === '' ? null : instanteDoCampo(etapa.fim),
    emiteParecerIndividual: etapa.emiteParecerIndividual,
    bancas: etapa.bancas.map((tipoBancaId) => ({ tipoBancaId })),
    // Janela sem regra resolvida não viaja: o catálogo ainda não respondeu, e mandá-la
    // devolveria uma recusa de campo que o operador não sabe ligar ao que fez.
    recursos: etapa.recursos
      .filter((recurso) => recurso.regraCodigo !== '' && recurso.regraVersao !== '')
      .map((recurso) => ({
      ancora: recurso.ancora as NonNullable<EtapaProcessoInput['recursos']>[number]['ancora'],
      regraCodigo: recurso.regraCodigo,
      regraVersao: recurso.regraVersao,
      prazoValor: decimalDoCampo(recurso.prazoValor) ?? 0,
      prazoUnidade: recurso.prazoUnidade as NonNullable<EtapaProcessoInput['recursos']>[number]['prazoUnidade'],
      atoAncoraCodigo: recurso.atoAncoraCodigo === '' ? null : recurso.atoAncoraCodigo,
      suspensividadePrimeiraInstanciaValor: null,
      suspensividadePrimeiraInstanciaUnidade: null,
      suspensividadeSegundaInstanciaValor: null,
      suspensividadeSegundaInstanciaUnidade: null,
    })),
  };
}
