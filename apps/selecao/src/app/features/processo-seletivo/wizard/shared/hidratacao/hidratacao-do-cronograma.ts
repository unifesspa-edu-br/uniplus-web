import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import type {
  BancaDaEtapa,
  BancaRequeridaDaFase,
  EtapaPontuada,
  FaseDoCronograma,
  ItemDeAvaliacaoDaEtapa,
  NivelDeAtendimentoDaEtapa,
  ProcedimentoDeRecurso,
  ProdutoDaFase,
  RecursoDaEtapa,
  RecursoDaFase,
} from '../../processo-seletivo.models';
import type { WizardDraft } from '../../processo-seletivo.models';
import { regraDoDto } from '../deliberacao/regra-de-deliberacao-contrato';
import { campoDoInstante } from '../fuso-institucional';
import { alvoLidoDoServidor } from '../procedimentos-do-recurso/alvo-do-procedimento';
import { percentualDaFracao } from '../itens-de-avaliacao';
import { comoInteiro, comoTexto } from './campos-lidos';

/**
 * Projeta o cronograma, as etapas pontuadas e a convenção de contagem.
 *
 * Guarda os identificadores **de origem**, que é o que a gravação recebe: a fase pelo id da fase
 * canônica, a banca pelo id do tipo de banca. O `id` do detalhe identifica o snapshot, não a entidade
 * do catálogo, e reenviá-lo produziria referência que o servidor não resolve. A etapa é a exceção:
 * seu `id` é reenviado, porque desempate e eliminação o referenciam.
 *
 * Os números voltam como texto porque é o que o campo edita.
 */
export function cronogramaDe(dto: ProcessoSeletivoDto): WizardDraft['cronograma'] {
  const algoritmo = dto.algoritmoContagemPrazo;

  return {
    fases: dto.cronogramaFases.map(faseDe),
    etapas: etapasRenumeradasDe(dto),
    algoritmoContagemCodigo: algoritmo?.codigo ?? '',
    algoritmoContagemVersao: algoritmo?.versao ?? '',
  };
}

// Renumeradas na chegada: a etapa gravada sem ordem volta como zero, e com
// uma etapa só não há duplicata que a conferência acuse nem botão de mover
// que a conserte — a gravação sairia com ordem zero para voltar recusada,
// sem nada na tela explicando. A posição na lista é a ordem que o servidor
// devolveu, então renumerar preserva a sequência que já existia.
function etapasRenumeradasDe(dto: ProcessoSeletivoDto): EtapaPontuada[] {
  return dto.etapas.map(etapaDe).map((etapa, posicao) => ({ ...etapa, ordem: posicao + 1 }));
}

type FaseDoDto = ProcessoSeletivoDto['cronogramaFases'][number];
type EtapaDoDto = ProcessoSeletivoDto['etapas'][number];
type RecursoDaFaseDoDto = NonNullable<FaseDoDto['publicacoes']['regraRecurso']>;
type ParametrosDoRecurso = RecursoDaFaseDoDto['parametros'];
type ProcedimentoDoDto = RecursoDaFaseDoDto['procedimentos'][number];
type RecursoDaEtapaDoDto = EtapaDoDto['publicacoes']['recursos'][number];

function congeladosDe(fase: FaseDoDto): NonNullable<FaseDoCronograma['congelados']> {
  const { faseCanonica } = fase;
  return {
    origemData: faseCanonica.origemData,
    agrupaEtapas: faseCanonica.agrupaEtapas,
    coletaInscricao: faseCanonica.coletaInscricao,
    permiteComplementacao: faseCanonica.permiteComplementacao,
    coletaSolicitacaoIsencao: faseCanonica.coletaSolicitacaoIsencao,
    bancas: fase.bancasRequeridas.map((banca) => ({
      id: banca.tipoBancaOrigemId,
      codigo: banca.codigo,
    })),
  };
}

function produtosDe(
  produtos: readonly {
    readonly atoCodigo: string;
    readonly papel?: ProdutoDaFase['papel'] | null;
  }[],
): ProdutoDaFase[] {
  return produtos.map((produto) => ({
    atoCodigo: produto.atoCodigo,
    papel: produto.papel ?? null,
  }));
}

function faseDe(fase: FaseDoDto): FaseDoCronograma {
  return {
    ...identificacaoDaFaseDe(fase),
    ...agendaDaFaseDe(fase.cronograma),
    ...publicacoesDaFaseDe(fase.publicacoes),
    bancasRequeridas: fase.bancasRequeridas.map(bancaRequeridaDe),
  };
}

function identificacaoDaFaseDe(
  fase: FaseDoDto,
): Pick<FaseDoCronograma, 'faseCanonicaId' | 'codigo' | 'congelados'> {
  return {
    faseCanonicaId: fase.faseCanonica.origemId,
    codigo: fase.codigo,
    // O detalhe traz o que a fase congelou; o catálogo pode não ter mais esta
    // fase, e é isto que mantém a tela sabendo o que ela exige.
    congelados: congeladosDe(fase),
  };
}

/** Quando a fase acontece e quem responde por ela. */
function agendaDaFaseDe(
  cronograma: FaseDoDto['cronograma'],
): Pick<
  FaseDoCronograma,
  'ordem' | 'inicio' | 'fim' | 'unidadeResponsavelId' | 'faseConcluinteCodigo'
> {
  return {
    ordem: comoInteiro(cronograma.ordem),
    inicio: cronograma.inicio,
    fim: cronograma.fim,
    unidadeResponsavelId: cronograma.unidadeResponsavel?.origemId ?? null,
    faseConcluinteCodigo: cronograma.faseConcluinteCodigo,
  };
}

/** O que a fase publica, o recurso que admite e os tipos de decisão que declara. */
function publicacoesDaFaseDe(
  publicacoes: FaseDoDto['publicacoes'],
): Pick<
  FaseDoCronograma,
  'produtos' | 'emiteParecerIndividual' | 'regraRecurso' | 'tiposDeDecisao'
> {
  return {
    produtos: produtosDe(publicacoes.produtos),
    emiteParecerIndividual: publicacoes.emiteParecerIndividual,
    regraRecurso: recursoDe(publicacoes.regraRecurso, publicacoes.produtos),
    tiposDeDecisao: [...publicacoes.tiposDeDecisao],
  };
}

function bancaRequeridaDe(banca: FaseDoDto['bancasRequeridas'][number]): BancaRequeridaDaFase {
  return {
    tipoBancaId: banca.tipoBancaOrigemId,
    categoriasDocumentoIds: banca.recorteDeCompetencia.map(
      (categoria) => categoria.categoriaDocumentoOrigemId,
    ),
    regraDeDeliberacao: regraDoDto(banca.regraDeDeliberacao),
  };
}

/**
 * A presença da regra é o que faz a fase admitir recurso. O hash da referência não volta ao
 * rascunho: o servidor o recompõe do catálogo, e guardá-lo criaria uma cópia que envelhece sozinha.
 *
 * A âncora chega como identidade da publicação e é gravada como código do tipo de ato; a ponte são
 * os produtos da própria fase, que trazem `id` e `atoCodigo` juntos, sem perda porque o ato entra
 * uma vez só em cada fase. Sem o cruzamento, uma mudança de data reenviaria a âncora em branco, e o
 * prazo de recurso passaria a contar de outra publicação em silêncio.
 */
function recursoDe(
  regra: FaseDoDto['publicacoes']['regraRecurso'],
  produtos: FaseDoDto['publicacoes']['produtos'],
): RecursoDaFase | null {
  if (regra === null || regra === undefined) return null;

  const ancora = produtos.find((produto) => produto.id === regra.produtoAncoraId);
  return {
    regraCodigo: regra.regra.codigo,
    regraVersao: regra.regra.versao,
    atoAncoraCodigo: ancora?.atoCodigo ?? '',
    ...parametrosDoRecursoDe(regra.parametros),
    procedimentos: procedimentosDe(regra.procedimentos),
  };
}

/**
 * Os procedimentos como o servidor os declarou, com a sugestão ao lado: ela é só leitura e não
 * volta no comando.
 */
function procedimentosDe(
  procedimentos: readonly ProcedimentoDoDto[],
): readonly ProcedimentoDeRecurso[] {
  return procedimentos.map((procedimento) => ({
    tipoDeDecisao: procedimento.tipoDeDecisao,
    alvo: alvoLidoDoServidor(procedimento.alvo),
    regraCodigo: procedimento.regra.codigo,
    regraVersao: procedimento.regra.versao,
    sugestao: procedimento.sugestao,
  }));
}

/** Os parâmetros do recurso, que fase e etapa leem do mesmo jeito: o prazo e o efeito suspensivo. */
function parametrosDoRecursoDe(
  parametros: ParametrosDoRecurso,
): Omit<RecursoDaFase, 'regraCodigo' | 'regraVersao' | 'atoAncoraCodigo' | 'procedimentos'> {
  return {
    prazoValor: comoTexto(parametros.prazoValor),
    prazoUnidade: parametros.prazoUnidade,
    suspensividadePrimeiraInstanciaValor: comoTexto(
      parametros.suspensividadePrimeiraInstanciaValor,
    ),
    suspensividadePrimeiraInstanciaUnidade: parametros.suspensividadePrimeiraInstanciaUnidade ?? '',
    admiteInstanciaSuperior: parametros.admiteInstanciaSuperior,
    suspensividadeSegundaInstanciaValor: comoTexto(parametros.suspensividadeSegundaInstanciaValor),
    suspensividadeSegundaInstanciaUnidade: parametros.suspensividadeSegundaInstanciaUnidade ?? '',
  };
}

/**
 * As etapas do processo como o rascunho as guarda. Exportada para a gravação recolher os `id` que
 * o servidor atribuiu sem hidratar o wizard inteiro: o operador pode ter editado outro passo sem
 * gravá-lo, porque a navegação é livre.
 */
export function etapasDe(dto: ProcessoSeletivoDto): EtapaPontuada[] {
  return dto.etapas.map(etapaDe);
}

function etapaDe(etapa: EtapaDoDto): EtapaPontuada {
  return {
    id: etapa.id,
    ...identificacaoDaEtapaDe(etapa.identificacao),
    ...avaliacaoDaEtapaDe(etapa),
    ...agendaDaEtapaDe(etapa),
  };
}

function identificacaoDaEtapaDe(
  identificacao: EtapaDoDto['identificacao'],
): Pick<EtapaPontuada, 'nome' | 'carater' | 'tipoEtapaOrigemId' | 'tipoCongelado'> {
  const { tipoEtapa } = identificacao;
  return {
    nome: identificacao.nome,
    carater: identificacao.carater,
    tipoEtapaOrigemId: tipoEtapa.origemId,
    tipoCongelado: {
      origemId: tipoEtapa.origemId,
      nome: tipoEtapa.nome,
      notaDeOrigemNoEnem: tipoEtapa.notaDeOrigemNoEnem,
    },
  };
}

type AvaliacaoDaEtapa = Pick<
  EtapaPontuada,
  | 'peso'
  | 'notaMinima'
  | 'notaMaxima'
  | 'passoDoLancamento'
  | 'formaDeAvaliacao'
  | 'regraConsolidacaoCodigo'
  | 'regraConsolidacaoVersao'
  | 'itensDeAvaliacao'
  | 'escalaDeAtendimento'
>;

/** Como a etapa pontua: a escala da nota, a forma de avaliar e os itens e níveis de atendimento. */
function avaliacaoDaEtapaDe({ nota, avaliacao }: EtapaDoDto): AvaliacaoDaEtapa {
  return {
    peso: comoTexto(nota.peso),
    notaMinima: comoTexto(nota.notaMinima),
    notaMaxima: comoTexto(nota.notaMaxima),
    passoDoLancamento: comoTexto(nota.passoDoLancamento),
    formaDeAvaliacao: avaliacao.formaDeAvaliacao ?? '',
    regraConsolidacaoCodigo: avaliacao.regraConsolidacao?.codigo ?? '',
    regraConsolidacaoVersao: avaliacao.regraConsolidacao?.versao ?? '',
    itensDeAvaliacao: avaliacao.itensDeAvaliacao.map(itemDeAvaliacaoDe),
    escalaDeAtendimento: (avaliacao.escalaDeAtendimento ?? []).map(nivelDeAtendimentoDe),
  };
}

function itemDeAvaliacaoDe(
  item: EtapaDoDto['avaliacao']['itensDeAvaliacao'][number],
): ItemDeAvaliacaoDaEtapa {
  return { id: item.id, rotulo: item.rotulo, pontuacaoMaxima: comoTexto(item.pontuacaoMaxima) };
}

function nivelDeAtendimentoDe(
  nivel: NonNullable<EtapaDoDto['avaliacao']['escalaDeAtendimento']>[number],
): NivelDeAtendimentoDaEtapa {
  return { rotulo: nivel.rotulo, percentual: percentualDaFracao(nivel.fracao) };
}

type AgendaDaEtapa = Pick<
  EtapaPontuada,
  | 'ordem'
  | 'faseCodigo'
  | 'produtos'
  | 'inicio'
  | 'fim'
  | 'emiteParecerIndividual'
  | 'bancas'
  | 'recursos'
  | 'tiposDeDecisao'
>;

/** Onde a etapa acontece: a posição, a fase e a janela, mais as bancas, os recursos e as decisões. */
function agendaDaEtapaDe(etapa: EtapaDoDto): AgendaDaEtapa {
  const { identificacao, janela } = etapa;
  return {
    ordem: comoInteiro(identificacao.ordem),
    faseCodigo: identificacao.faseCodigo ?? '',
    inicio: instanteDe(janela.inicio),
    fim: instanteDe(janela.fim),
    bancas: etapa.bancas.map(bancaDaEtapaDe),
    ...publicacoesDaEtapaDe(etapa.publicacoes),
  };
}

function publicacoesDaEtapaDe(
  publicacoes: EtapaDoDto['publicacoes'],
): Pick<EtapaPontuada, 'produtos' | 'emiteParecerIndividual' | 'recursos' | 'tiposDeDecisao'> {
  return {
    produtos: produtosDe(publicacoes.produtos),
    emiteParecerIndividual: publicacoes.emiteParecerIndividual,
    recursos: publicacoes.recursos.map(recursoDaEtapaDe),
    tiposDeDecisao: [...publicacoes.tiposDeDecisao],
  };
}

function bancaDaEtapaDe(banca: EtapaDoDto['bancas'][number]): BancaDaEtapa {
  return {
    tipoBancaId: banca.tipoBancaOrigemId,
    regraDeDeliberacao: regraDoDto(banca.regraDeDeliberacao),
  };
}

function instanteDe(instante: string | null): string {
  return instante === null ? '' : campoDoInstante(instante);
}

function recursoDaEtapaDe(recurso: RecursoDaEtapaDoDto): RecursoDaEtapa {
  return {
    ancora: recurso.ancora as RecursoDaEtapa['ancora'],
    regraCodigo: recurso.regra.codigo,
    regraVersao: recurso.regra.versao,
    atoAncoraCodigo: recurso.atoAncoraCodigo ?? '',
    ...parametrosDoRecursoDe(recurso.parametros),
    procedimentos: procedimentosDe(recurso.procedimentos),
  };
}
