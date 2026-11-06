import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import type {
  EtapaPontuada,
  FaseDoCronograma,
  RecursoDaFase,
} from '../../processo-seletivo.models';
import type { WizardDraft } from '../../processo-seletivo.models';
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

function faseDe(fase: ProcessoSeletivoDto['cronogramaFases'][number]): FaseDoCronograma {
  return {
    faseCanonicaId: fase.faseCanonicaOrigemId,
    codigo: fase.codigo,
    // O detalhe traz o que a fase congelou; o catálogo pode não ter mais esta
    // fase, e é isto que mantém a tela sabendo o que ela exige.
    congelados: {
      origemData: fase.origemData,
      agrupaEtapas: fase.agrupaEtapas,
      coletaInscricao: fase.coletaInscricao,
      permiteComplementacao: fase.permiteComplementacao,
      coletaSolicitacaoIsencao: fase.coletaSolicitacaoIsencao,
      bancas: fase.bancasRequeridas.map((banca) => ({
        id: banca.tipoBancaOrigemId,
        codigo: banca.codigo,
      })),
    },
    ordem: comoInteiro(fase.ordem),
    inicio: fase.inicio,
    fim: fase.fim,
    produtos: fase.produtos.map((produto) => ({
      atoCodigo: produto.atoCodigo,
      papel: produto.papel ?? null,
    })),
    unidadeResponsavelId: fase.unidadeResponsavel?.origemId ?? null,
    faseConcluinteCodigo: fase.faseConcluinteCodigo,
    emiteParecerIndividual: fase.emiteParecerIndividual,
    bancasRequeridas: fase.bancasRequeridas.map((banca) => ({
      tipoBancaId: banca.tipoBancaOrigemId,
      categoriasDocumentoIds: banca.recorteDeCompetencia.map(
        (categoria) => categoria.categoriaDocumentoOrigemId,
      ),
    })),
    regraRecurso: recursoDe(fase.regraRecurso, fase.produtos),
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
  regra: ProcessoSeletivoDto['cronogramaFases'][number]['regraRecurso'],
  produtos: ProcessoSeletivoDto['cronogramaFases'][number]['produtos'],
): RecursoDaFase | null {
  if (regra === null || regra === undefined) return null;

  const args = regra.args;
  const ancora = produtos.find((produto) => produto.id === regra.produtoAncoraId);
  return {
    regraCodigo: regra.regra.codigo,
    regraVersao: regra.regra.versao,
    prazoValor: comoTexto(args.prazoValor),
    prazoUnidade: args.prazoUnidade,
    atoAncoraCodigo: ancora?.atoCodigo ?? '',
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

function etapaDe(etapa: ProcessoSeletivoDto['etapas'][number]): EtapaPontuada {
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
    ordem: comoInteiro(etapa.ordem),
    faseCodigo: etapa.faseCodigo ?? '',
    produtos: (etapa.produtos ?? []).map((produto) => ({
      atoCodigo: produto.atoCodigo,
      papel: produto.papel ?? null,
    })),
    inicio:
      etapa.inicio === null || etapa.inicio === undefined ? '' : campoDoInstante(etapa.inicio),
    fim: etapa.fim === null || etapa.fim === undefined ? '' : campoDoInstante(etapa.fim),
    emiteParecerIndividual: etapa.emiteParecerIndividual ?? false,
    bancas: (etapa.bancas ?? []).map((banca) => banca.tipoBancaOrigemId),
    recursos: (etapa.recursos ?? []).map((recurso) => ({
      ancora: recurso.ancora as unknown as 'atoPublicado' | 'cienciaIndividual',
      regraCodigo: recurso.regra.codigo,
      regraVersao: recurso.regra.versao,
      prazoValor: comoTexto(recurso.args.prazoValor),
      prazoUnidade: recurso.args.prazoUnidade,
      atoAncoraCodigo: recurso.atoAncoraCodigo ?? '',
      // Mesma leitura que `recursoDe` faz para a fase. Sem ela, a gravação seguinte
      // reenviava os quatro em branco e apagava o efeito suspensivo declarado.
      suspensividadePrimeiraInstanciaValor: comoTexto(
        recurso.args.suspensividadePrimeiraInstanciaValor,
      ),
      suspensividadePrimeiraInstanciaUnidade:
        recurso.args.suspensividadePrimeiraInstanciaUnidade ?? '',
      admiteInstanciaSuperior: recurso.args.admiteInstanciaSuperior,
      suspensividadeSegundaInstanciaValor: comoTexto(
        recurso.args.suspensividadeSegundaInstanciaValor,
      ),
      suspensividadeSegundaInstanciaUnidade:
        recurso.args.suspensividadeSegundaInstanciaUnidade ?? '',
    })),
  };
}
