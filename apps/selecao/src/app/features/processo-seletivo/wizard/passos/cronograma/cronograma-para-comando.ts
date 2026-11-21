import type { EtapaProcessoInput, FaseCronogramaInput } from '@uniplus/shared-data/selecao';

import type {
  BancaDaEtapa,
  BancaRequeridaDaFase,
  EtapaPontuada,
  FaseDoCronograma,
  ProcedimentoDeRecurso,
  ProdutoDaFase,
  RecursoDaEtapa,
  RecursoDaFase,
} from '../../processo-seletivo.models';
import type { ParametrosDoRecurso } from '../../shared/configuracao-do-recurso/parametros-do-recurso';
import { regraComoInput } from '../../shared/deliberacao/regra-de-deliberacao-contrato';
import { FORMA_HUMANA } from '../../shared/forma-de-avaliacao';
import { fracaoDoPercentual } from '../../shared/itens-de-avaliacao';
import { instanteDoCampo } from '../../shared/fuso-institucional';
import { emOrdemAlfabetica } from '../../shared/decisoes-da-fase-ou-etapa/tipos-de-decisao-declarados';
import { decimalDoCampo } from '../../shared/numero-do-campo';
import { alvoParaComando } from '../../shared/procedimentos-do-recurso/alvo-do-procedimento';

type RegraDeRecursoDaFaseInput = NonNullable<FaseCronogramaInput['regraRecurso']>;
type RecursoDaEtapaInput = NonNullable<EtapaProcessoInput['recursos']>[number];
type ProdutoDaFaseInput = NonNullable<FaseCronogramaInput['produtos']>[number];
type BancaRequeridaInput = NonNullable<FaseCronogramaInput['bancasRequeridas']>[number];
type ProdutoDaEtapaInput = NonNullable<EtapaProcessoInput['produtos']>[number];
type BancaDaEtapaInput = NonNullable<EtapaProcessoInput['bancas']>[number];
type ProcedimentoDeRecursoInput = NonNullable<RegraDeRecursoDaFaseInput['procedimentos']>[number];

/**
 * Se o recurso da etapa tem regra resolvida contra o catálogo — só essas viajam no
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
 * Os produtos, o parecer individual, as bancas requeridas e
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
    noMesmoMomentoDaAnterior: fase.noMesmoMomentoDaAnterior,
    unidadeResponsavelId: fase.unidadeResponsavelId,
    produtos: fase.produtos.map(comoComandoDoProdutoDaFase),
    emiteParecerIndividual: fase.emiteParecerIndividual,
    bancasRequeridas: fase.bancasRequeridas.map(comoComandoDeBancaRequerida),
    regraRecurso: fase.regraRecurso === null ? null : comoComandoDeRecursoDaFase(fase.regraRecurso),
    tiposDeDecisao: emOrdemAlfabetica(fase.tiposDeDecisao ?? []),
  };
}

function comoComandoDoProdutoDaFase(produto: ProdutoDaFase): ProdutoDaFaseInput {
  return { atoCodigo: produto.atoCodigo, papel: produto.papel };
}

function comoComandoDeBancaRequerida(banca: BancaRequeridaDaFase): BancaRequeridaInput {
  return {
    tipoBancaId: banca.tipoBancaId,
    categoriasDocumentoIds: [...banca.categoriasDocumentoIds],
    regraDeDeliberacao: regraComoInput(banca.regraDeDeliberacao),
  };
}

function comoComandoDeRecursoDaFase(regra: RecursoDaFase): RegraDeRecursoDaFaseInput {
  return {
    regraCodigo: regra.regraCodigo,
    regraVersao: regra.regraVersao,
    atoAncoraCodigo: regra.atoAncoraCodigo,
    ...parametrosParaComando(regra),
    procedimentos: regra.procedimentos.map(comoComandoDoProcedimento),
  };
}

type ParametrosDoRecursoInput = Pick<
  RegraDeRecursoDaFaseInput,
  | 'prazoValor'
  | 'prazoUnidade'
  | 'admiteInstanciaSuperior'
  | 'prazoSegundaInstanciaValor'
  | 'prazoSegundaInstanciaUnidade'
  | 'efeitoSuspensivo'
  | 'guardaDaVaga'
>;

/**
 * Os parâmetros do recurso como o comando os recebe, iguais na fase e na etapa. O que a pessoa não
 * preencheu viaja como nulo e o valor lido viaja como veio: quem confere prazo, efeito e guarda é
 * o servidor. A pergunta da instância superior em aberto não chega aqui, a conferência do passo
 * barra a gravação antes.
 */
export function parametrosParaComando(parametros: ParametrosDoRecurso): ParametrosDoRecursoInput {
  return {
    prazoValor: decimalDoCampo(parametros.prazoValor),
    prazoUnidade: codigoOuNulo(parametros.prazoUnidade),
    admiteInstanciaSuperior: parametros.admiteInstanciaSuperior === true,
    prazoSegundaInstanciaValor: decimalDoCampo(parametros.prazoSegundaInstanciaValor),
    prazoSegundaInstanciaUnidade: codigoOuNulo(parametros.prazoSegundaInstanciaUnidade),
    efeitoSuspensivo: codigoOuNulo(parametros.efeitoSuspensivo),
    guardaDaVaga: codigoOuNulo(parametros.guardaDaVaga),
  };
}

function codigoOuNulo<T extends string>(codigo: T | ''): T | null {
  return codigo === '' ? null : codigo;
}

/** O procedimento como o comando o recebe: a sugestão é só dica de leitura e não viaja. */
function comoComandoDoProcedimento(
  procedimento: ProcedimentoDeRecurso,
): ProcedimentoDeRecursoInput {
  return {
    tipoDeDecisao: procedimento.tipoDeDecisao,
    alvo: alvoParaComando(procedimento.alvo),
    regraCodigo: procedimento.regraCodigo,
    regraVersao: procedimento.regraVersao,
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
    ...comoComandoDaPontuacaoDaEtapa(etapa),
    ...comoComandoDaAvaliacaoDaEtapa(etapa),
    ...comoComandoDaAgendaDaEtapa(etapa),
    ...comoComandoDoQueAEtapaDeclara(etapa),
  };
}

function comoComandoDoQueAEtapaDeclara(
  etapa: EtapaPontuada,
): Pick<
  EtapaProcessoInput,
  'produtos' | 'emiteParecerIndividual' | 'bancas' | 'recursos' | 'tiposDeDecisao'
> {
  return {
    produtos: etapa.produtos.map(comoComandoDoProdutoDaEtapa),
    emiteParecerIndividual: etapa.emiteParecerIndividual,
    bancas: etapa.bancas.map(comoComandoDeBancaDaEtapa),
    recursos: comoComandoDosRecursosDaEtapa(etapa),
    tiposDeDecisao: emOrdemAlfabetica(etapa.tiposDeDecisao ?? []),
  };
}

function comoComandoDaPontuacaoDaEtapa(
  etapa: EtapaPontuada,
): Pick<EtapaProcessoInput, 'peso' | 'notaMinima' | 'notaMaxima'> {
  return {
    peso: decimalDoCampo(etapa.peso),
    notaMinima: decimalDoCampo(etapa.notaMinima),
    notaMaxima: decimalDoCampo(etapa.notaMaxima ?? ''),
  };
}

function comoComandoDaAgendaDaEtapa(
  etapa: EtapaPontuada,
): Pick<EtapaProcessoInput, 'ordem' | 'faseCodigo' | 'inicio' | 'fim'> {
  return {
    ordem: etapa.ordem,
    faseCodigo: etapa.faseCodigo === '' ? null : etapa.faseCodigo,
    inicio: etapa.inicio === '' ? null : instanteDoCampo(etapa.inicio),
    fim: etapa.fim === '' ? null : instanteDoCampo(etapa.fim),
  };
}

function comoComandoDoProdutoDaEtapa(
  produto: EtapaPontuada['produtos'][number],
): ProdutoDaEtapaInput {
  return { atoCodigo: produto.atoCodigo, papel: produto.papel as ProdutoDaEtapaInput['papel'] };
}

function comoComandoDeBancaDaEtapa(banca: BancaDaEtapa): BancaDaEtapaInput {
  return {
    tipoBancaId: banca.tipoBancaId,
    regraDeDeliberacao: regraComoInput(banca.regraDeDeliberacao),
  };
}

// Recurso sem regra resolvida não viaja: o catálogo ainda não respondeu, e mandá-la
// devolveria uma recusa de campo que o operador não sabe ligar ao que fez. Quem avisa
// que ela ficou de fora é `problemasDasEtapas`, na prontidão do passo — sumir com o
// trabalho do operador em silêncio era o defeito anterior.
function comoComandoDosRecursosDaEtapa(etapa: EtapaPontuada): RecursoDaEtapaInput[] {
  return etapa.recursos.filter(recursoResolvido).map(comoComandoDeRecursoDaEtapa);
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
    ...comoComandoDosItensDaAvaliacao(etapa),
  };
}

function comoComandoDosItensDaAvaliacao(
  etapa: EtapaPontuada,
): Pick<AvaliacaoDaEtapaInput, 'itensDeAvaliacao' | 'escalaDeAtendimento'> {
  return {
    itensDeAvaliacao: (etapa.itensDeAvaliacao ?? []).map((item) => ({
      id: item.id,
      rotulo: item.rotulo.trim(),
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
    atoAncoraCodigo: recurso.atoAncoraCodigo === '' ? null : recurso.atoAncoraCodigo,
    ...parametrosParaComando(recurso),
    procedimentos: recurso.procedimentos.map(comoComandoDoProcedimento),
  };
}

function textoOuNulo(valor: string | undefined): string | null {
  return valor === undefined || valor === '' ? null : valor;
}
