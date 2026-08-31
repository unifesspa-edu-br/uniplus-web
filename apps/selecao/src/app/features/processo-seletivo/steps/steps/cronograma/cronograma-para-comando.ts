import type { EtapaProcessoInput, FaseCronogramaInput } from '@uniplus/shared-data/selecao';

import type { EtapaPontuada, FaseDoCronograma } from '../../processo-seletivo.models';
import { decimalDoCampo } from '../../shared/numero-do-campo';

/**
 * A fase como o comando a recebe.
 *
 * A regra de recurso atravessa inalterada: quem a edita é o passo que a
 * configura, e a gravação do cronograma substitui a coleção inteira — deixá-la
 * de fora aqui apagaria, a cada mudança de data, o recurso já declarado.
 */
export function comoComandoDeFase(fase: FaseDoCronograma): FaseCronogramaInput {
  return {
    ordem: fase.ordem,
    faseCanonicaId: fase.faseCanonicaId,
    inicio: fase.inicio,
    fim: fase.fim,
    atoProduzidoCodigo: fase.atoProduzidoCodigo,
    tiposBancaIds: [...fase.tiposBancaIds],
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
  };
}
