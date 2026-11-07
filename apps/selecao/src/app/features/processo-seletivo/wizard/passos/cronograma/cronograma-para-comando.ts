import type { EtapaProcessoInput, FaseCronogramaInput } from '@uniplus/shared-data/selecao';

import type {
  EtapaPontuada,
  FaseDoCronograma,
  RecursoDaEtapa,
  RecursoDaFase,
} from '../../processo-seletivo.models';
import { FORMA_HUMANA } from '../../shared/forma-de-avaliacao';
import { fracaoDoPercentual } from '../../shared/itens-de-avaliacao';
import { instanciaSuperiorParaComando } from '../../shared/instancia-superior';
import { instanteDoCampo } from '../../shared/fuso-institucional';
import { decimalDoCampo } from '../../shared/numero-do-campo';

type RegraDeRecursoDaFaseInput = NonNullable<FaseCronogramaInput['regraRecurso']>;
type RecursoDaEtapaInput = NonNullable<EtapaProcessoInput['recursos']>[number];

/**
 * Se a janela recursal da etapa tem regra resolvida contra o catálogo — só essas viajam no
 * comando.
 *
 * Exportada porque a prontidão do passo precisa do MESMO predicado para avisar o operador:
 * quando a conferência e o mapeador divergem, a tela aprova o que a gravação descarta.
 */
export function recursoResolvido(recurso: {
  readonly regraCodigo: string;
  readonly regraVersao: string;
}): boolean {
  return recurso.regraCodigo !== '' && recurso.regraVersao !== '';
}

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
    unidadeResponsavelId: fase.unidadeResponsavelId,
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
    regraRecurso: fase.regraRecurso === null ? null : comoComandoDeRecursoDaFase(fase.regraRecurso),
  };
}

function comoComandoDeRecursoDaFase(regra: RecursoDaFase): RegraDeRecursoDaFaseInput {
  return {
    regraCodigo: regra.regraCodigo,
    regraVersao: regra.regraVersao,
    prazoValor: decimalDoCampo(regra.prazoValor) ?? 0,
    prazoUnidade: regra.prazoUnidade as RegraDeRecursoDaFaseInput['prazoUnidade'],
    atoAncoraCodigo: regra.atoAncoraCodigo,
    suspensividadePrimeiraInstanciaValor: decimalDoCampo(
      regra.suspensividadePrimeiraInstanciaValor,
    ),
    suspensividadePrimeiraInstanciaUnidade:
      regra.suspensividadePrimeiraInstanciaUnidade === ''
        ? null
        : regra.suspensividadePrimeiraInstanciaUnidade,
    ...instanciaSuperiorParaComando(regra),
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
    notaMaxima: decimalDoCampo(etapa.notaMaxima ?? ''),
    ...comoComandoDaAvaliacaoDaEtapa(etapa),
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
    // devolveria uma recusa de campo que o operador não sabe ligar ao que fez. Quem avisa
    // que ela ficou de fora é `problemasDasEtapas`, na prontidão do passo — sumir com o
    // trabalho do operador em silêncio era o defeito anterior.
    recursos: etapa.recursos.filter(recursoResolvido).map(comoComandoDeRecursoDaEtapa),
  };
}

type AvaliacaoDaEtapaInput = Pick<
  EtapaProcessoInput,
  | 'formaDeAvaliacao'
  | 'regraConsolidacaoCodigo'
  | 'regraConsolidacaoVersao'
  | 'passoDoLancamento'
  | 'itensDeAvaliacao'
  | 'escalaDeAtendimento'
>;

function comoComandoDaAvaliacaoDaEtapa(etapa: EtapaPontuada): AvaliacaoDaEtapaInput {
  const humana = etapa.formaDeAvaliacao === FORMA_HUMANA;
  return {
    // Regra e passo só existem na avaliação humana, e o servidor recusa os dois fora dela.
    formaDeAvaliacao: textoOuNulo(etapa.formaDeAvaliacao),
    regraConsolidacaoCodigo: humana ? textoOuNulo(etapa.regraConsolidacaoCodigo) : null,
    regraConsolidacaoVersao: humana ? textoOuNulo(etapa.regraConsolidacaoVersao) : null,
    passoDoLancamento: humana ? decimalDoCampo(etapa.passoDoLancamento ?? '') : null,
    // O id do item que a API devolveu volta com ele: é o que mantém o item o mesmo na retificação.
    itensDeAvaliacao: (etapa.itensDeAvaliacao ?? []).map((item) => ({
      id: item.id,
      rotulo: item.rotulo.trim(),
      // A validação do passo recusa antes o que não é número.
      pontuacaoMaxima: decimalDoCampo(item.pontuacaoMaxima) ?? 0,
    })),
    escalaDeAtendimento: (etapa.escalaDeAtendimento ?? []).map((nivel) => ({
      rotulo: nivel.rotulo.trim(),
      fracao: fracaoDoPercentual(nivel.percentual) ?? 0,
    })),
  };
}

function comoComandoDeRecursoDaEtapa(recurso: RecursoDaEtapa): RecursoDaEtapaInput {
  return {
    ancora: recurso.ancora as RecursoDaEtapaInput['ancora'],
    regraCodigo: recurso.regraCodigo,
    regraVersao: recurso.regraVersao,
    prazoValor: decimalDoCampo(recurso.prazoValor) ?? 0,
    prazoUnidade: recurso.prazoUnidade as RecursoDaEtapaInput['prazoUnidade'],
    atoAncoraCodigo: recurso.atoAncoraCodigo === '' ? null : recurso.atoAncoraCodigo,
    // A etapa recorre nas mesmas condições da fase, e o servidor guarda os quatro valores
    // em colunas próprias — mandar `null` fixo apagava o efeito suspensivo declarado a
    // cada gravação do cronograma.
    suspensividadePrimeiraInstanciaValor: decimalDoCampo(
      recurso.suspensividadePrimeiraInstanciaValor,
    ),
    suspensividadePrimeiraInstanciaUnidade:
      recurso.suspensividadePrimeiraInstanciaUnidade === ''
        ? null
        : recurso.suspensividadePrimeiraInstanciaUnidade,
    ...instanciaSuperiorParaComando(recurso),
  };
}

function textoOuNulo(valor: string | undefined): string | null {
  return valor === undefined || valor === '' ? null : valor;
}
