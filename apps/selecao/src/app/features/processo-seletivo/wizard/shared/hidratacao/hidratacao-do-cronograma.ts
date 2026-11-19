import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import type {
  BancaRequeridaDaFase,
  EtapaPontuada,
  FaseDoCronograma,
  ProdutoDaFase,
  RecursoDaEtapa,
  RecursoDaFase,
} from '../../processo-seletivo.models';
import type { WizardDraft } from '../../processo-seletivo.models';
import { regraDoDto } from '../deliberacao/regra-de-deliberacao-contrato';
import { campoDoInstante } from '../fuso-institucional';
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
    fases: (dto.cronogramaFases ?? []).map(faseDe),
    // Renumeradas na chegada: a etapa gravada sem ordem volta como zero, e com
    // uma etapa só não há duplicata que a conferência acuse nem botão de mover
    // que a conserte — a gravação sairia com ordem zero para voltar recusada,
    // sem nada na tela explicando. A posição na lista é a ordem que o servidor
    // devolveu, então renumerar preserva a sequência que já existia.
    etapas: (dto.etapas ?? []).map(etapaDe).map((etapa, posicao) => ({
      ...etapa,
      ordem: posicao + 1,
    })),
    algoritmoContagemCodigo: algoritmo?.codigo ?? '',
    algoritmoContagemVersao: algoritmo?.versao ?? '',
  };
}

type FaseDoDto = ProcessoSeletivoDto['cronogramaFases'][number];
type EtapaDoDto = ProcessoSeletivoDto['etapas'][number];
type ArgumentosDoRecurso = NonNullable<FaseDoDto['regraRecurso']>['args'];

function congeladosDe(fase: FaseDoDto): NonNullable<FaseDoCronograma['congelados']> {
  return {
    origemData: fase.origemData,
    agrupaEtapas: fase.agrupaEtapas,
    coletaInscricao: fase.coletaInscricao,
    permiteComplementacao: fase.permiteComplementacao,
    coletaSolicitacaoIsencao: fase.coletaSolicitacaoIsencao,
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
    ordem: comoInteiro(fase.ordem),
    inicio: fase.inicio,
    fim: fase.fim,
    produtos: produtosDe(fase.produtos),
    unidadeResponsavelId: fase.unidadeResponsavel?.origemId ?? null,
    faseConcluinteCodigo: fase.faseConcluinteCodigo,
    emiteParecerIndividual: fase.emiteParecerIndividual,
    bancasRequeridas: fase.bancasRequeridas.map(bancaRequeridaDe),
    regraRecurso: recursoDe(fase.regraRecurso, fase.produtos),
  };
}

function identificacaoDaFaseDe(
  fase: FaseDoDto,
): Pick<FaseDoCronograma, 'faseCanonicaId' | 'codigo' | 'congelados'> {
  return {
    faseCanonicaId: fase.faseCanonicaOrigemId,
    codigo: fase.codigo,
    // O detalhe traz o que a fase congelou; o catálogo pode não ter mais esta
    // fase, e é isto que mantém a tela sabendo o que ela exige.
    congelados: congeladosDe(fase),
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
  regra: FaseDoDto['regraRecurso'],
  produtos: FaseDoDto['produtos'],
): RecursoDaFase | null {
  if (regra === null || regra === undefined) return null;

  const ancora = produtos.find((produto) => produto.id === regra.produtoAncoraId);
  return {
    regraCodigo: regra.regra.codigo,
    regraVersao: regra.regra.versao,
    atoAncoraCodigo: ancora?.atoCodigo ?? '',
    ...argumentosDoRecursoDe(regra.args),
  };
}

/** Os argumentos do recurso, que fase e etapa leem do mesmo jeito: o prazo e o efeito suspensivo. */
function argumentosDoRecursoDe(
  args: ArgumentosDoRecurso,
): Omit<RecursoDaFase, 'regraCodigo' | 'regraVersao' | 'atoAncoraCodigo'> {
  return {
    prazoValor: comoTexto(args.prazoValor),
    prazoUnidade: args.prazoUnidade,
    suspensividadePrimeiraInstanciaValor: comoTexto(args.suspensividadePrimeiraInstanciaValor),
    suspensividadePrimeiraInstanciaUnidade: args.suspensividadePrimeiraInstanciaUnidade ?? '',
    admiteInstanciaSuperior: args.admiteInstanciaSuperior,
    suspensividadeSegundaInstanciaValor: comoTexto(args.suspensividadeSegundaInstanciaValor),
    suspensividadeSegundaInstanciaUnidade: args.suspensividadeSegundaInstanciaUnidade ?? '',
  };
}

/**
 * As etapas do processo como o rascunho as guarda. Exportada para a gravação recolher os `id` que
 * o servidor atribuiu sem hidratar o wizard inteiro: o operador pode ter editado outro passo sem
 * gravá-lo, porque a navegação é livre.
 */
export function etapasDe(dto: ProcessoSeletivoDto): EtapaPontuada[] {
  return (dto.etapas ?? []).map(etapaDe);
}

function etapaDe(etapa: EtapaDoDto): EtapaPontuada {
  return {
    id: etapa.id,
    nome: etapa.nome,
    carater: etapa.carater,
    tipoEtapaOrigemId: etapa.tipoEtapa.origemId,
    tipoCongelado: {
      origemId: etapa.tipoEtapa.origemId,
      nome: etapa.tipoEtapa.nome,
      notaDeOrigemNoEnem: etapa.tipoEtapa.notaDeOrigemNoEnem,
    },
    ...avaliacaoDaEtapaDe(etapa),
    ...agendaDaEtapaDe(etapa),
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
function avaliacaoDaEtapaDe(etapa: EtapaDoDto): AvaliacaoDaEtapa {
  return {
    peso: comoTexto(etapa.peso),
    notaMinima: comoTexto(etapa.notaMinima),
    notaMaxima: comoTexto(etapa.notaMaxima),
    passoDoLancamento: comoTexto(etapa.passoDoLancamento),
    formaDeAvaliacao: etapa.formaDeAvaliacao ?? '',
    regraConsolidacaoCodigo: etapa.regraConsolidacao?.codigo ?? '',
    regraConsolidacaoVersao: etapa.regraConsolidacao?.versao ?? '',
    itensDeAvaliacao: (etapa.itensDeAvaliacao ?? []).map((item) => ({
      id: item.id,
      rotulo: item.rotulo,
      pontuacaoMaxima: comoTexto(item.pontuacaoMaxima),
    })),
    escalaDeAtendimento: (etapa.escalaDeAtendimento ?? []).map((nivel) => ({
      rotulo: nivel.rotulo,
      percentual: percentualDaFracao(nivel.fracao),
    })),
  };
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
>;

/** Onde a etapa acontece: a fase, a janela, o que publica, as bancas e os recursos. */
function agendaDaEtapaDe(etapa: EtapaDoDto): AgendaDaEtapa {
  return {
    ordem: comoInteiro(etapa.ordem),
    faseCodigo: etapa.faseCodigo ?? '',
    produtos: produtosDe(etapa.produtos ?? []),
    inicio: instanteDe(etapa.inicio),
    fim: instanteDe(etapa.fim),
    emiteParecerIndividual: etapa.emiteParecerIndividual ?? false,
    bancas: (etapa.bancas ?? []).map((banca) => ({
      tipoBancaId: banca.tipoBancaOrigemId,
      regraDeDeliberacao: regraDoDto(banca.regraDeDeliberacao),
    })),
    recursos: (etapa.recursos ?? []).map(recursoDaEtapaDe),
  };
}

function instanteDe(instante: string | null | undefined): string {
  return instante === null || instante === undefined ? '' : campoDoInstante(instante);
}

function recursoDaEtapaDe(recurso: NonNullable<EtapaDoDto['recursos']>[number]): RecursoDaEtapa {
  return {
    ancora: recurso.ancora as unknown as RecursoDaEtapa['ancora'],
    regraCodigo: recurso.regra.codigo,
    regraVersao: recurso.regra.versao,
    atoAncoraCodigo: recurso.atoAncoraCodigo ?? '',
    ...argumentosDoRecursoDe(recurso.args),
  };
}
