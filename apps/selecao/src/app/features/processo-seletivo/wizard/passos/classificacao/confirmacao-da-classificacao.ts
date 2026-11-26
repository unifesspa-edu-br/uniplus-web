import type { ConfirmacaoDeGravacao, ItemDeConfirmacao } from '../../passo-do-wizard';
import type { CriterioDesempateConfigurado, WizardDraft } from '../../processo-seletivo.models';
import {
  classificacaoUsaFormulaLocal,
  exigeResolucaoPesoAreaEnem,
} from './classificacao-para-comando';
import { declaraEdicoesDoEnem, rotuloDaEdicao } from './edicoes-do-enem';
import { leituraDaEscalaDaNotaFinal } from '../../shared/escala-da-nota-final';

/** O que a confirmação da classificação mostra além do rascunho da própria classificação. */
export interface ConteudoDaConfirmacao {
  readonly draft: WizardDraft;
  /** Os avisos sobre critérios de desempate já gravados, dentro da mesma frase de aviso. */
  readonly avisosDoDesempate: readonly string[];
  /** Os critérios que o Desempate adiou até esta gravação: aqui eles saem, e quem confirma os vê. */
  readonly criteriosAdiados: readonly CriterioDesempateConfigurado[];
  readonly rotuloDaArea: (codigo: string) => string;
}

/** O critério como a confirmação o mostra: a regra e, nos de nota por área, as áreas na ordem. */
export function textoDoCriterio(
  criterio: CriterioDesempateConfigurado,
  rotuloDaArea: (codigo: string) => string,
): string {
  return criterio.areas.length > 0
    ? `${criterio.regraCodigo}: ${criterio.areas.map(rotuloDaArea).join(', ')}`
    : criterio.regraCodigo;
}

const NAO_SE_APLICA_IMPORTADA = 'não se aplica (classificação importada)';

/** A confirmação da gravação da classificação inteira, com a precisão e a eliminação. */
export function confirmacaoDaClassificacao(conteudo: ConteudoDaConfirmacao): ConfirmacaoDeGravacao {
  return {
    titulo: 'Confirmar a classificação do processo',
    aviso: avisoDaConfirmacao(conteudo),
    rotuloDeConfirmar: 'Gravar classificação',
    itens: [...itensDaClassificacao(conteudo.draft), ...itensDosCriteriosAdiados(conteudo)],
  };
}

function avisoDaConfirmacao(conteudo: ConteudoDaConfirmacao): string {
  return [
    avisoDaGravacao(conteudo.criteriosAdiados.length > 0),
    ...conteudo.avisosDoDesempate,
  ].join(' ');
}

function avisoDaGravacao(comDesempate: boolean): string {
  return comDesempate
    ? 'A classificação, a precisão, a eliminação e os critérios de desempate serão gravados juntos nesta confirmação.'
    : 'A classificação, a precisão e a eliminação serão gravadas juntas nesta confirmação.';
}

function itensDosCriteriosAdiados(conteudo: ConteudoDaConfirmacao): ItemDeConfirmacao[] {
  return conteudo.criteriosAdiados.map((criterio, indice) => ({
    rotulo: `${indice + 1}º critério de desempate`,
    valor: textoDoCriterio(criterio, conteudo.rotuloDaArea),
  }));
}

function itensDaClassificacao(draft: WizardDraft): ItemDeConfirmacao[] {
  const classificacao = draft.classificacao;
  const local = classificacaoUsaFormulaLocal(classificacao.regraCalculoCodigo);

  return [
    ...itensDoCalculo(classificacao, local),
    ...itensDoEnem(classificacao),
    { rotulo: 'Regras de eliminação', valor: regrasDeEliminacao(classificacao, local) },
    { rotulo: 'Edições do ENEM aceitas', valor: edicoesAceitas(draft) },
  ];
}

/** A regra de cálculo, o arredondamento, a ordem de alocação e a escala da nota final. */
function itensDoCalculo(
  classificacao: WizardDraft['classificacao'],
  local: boolean,
): ItemDeConfirmacao[] {
  return [
    { rotulo: 'Regra de cálculo', valor: classificacao.regraCalculoCodigo },
    { rotulo: 'Arredondamento', valor: arredondamento(classificacao, local) },
    { rotulo: 'Ordem de alocação', valor: classificacao.regraOrdemAlocacaoCodigo },
    { rotulo: 'Escala da nota final', valor: escala(classificacao, local) },
  ];
}

function escala(classificacao: WizardDraft['classificacao'], local: boolean): string {
  return local
    ? leituraDaEscalaDaNotaFinal(classificacao.escalaNotaFinal)
    : NAO_SE_APLICA_IMPORTADA;
}

function arredondamento(classificacao: WizardDraft['classificacao'], local: boolean): string {
  return local
    ? `${classificacao.regraArredondamentoCodigo} — ${classificacao.casasArredondamento} casas`
    : NAO_SE_APLICA_IMPORTADA;
}

function itensDoEnem(classificacao: WizardDraft['classificacao']): ItemDeConfirmacao[] {
  return [
    { rotulo: 'Baseada em ENEM', valor: classificacao.baseadoEmEnem ? 'Sim' : 'Não' },
    {
      rotulo: 'Resolução de Peso por Área',
      valor: exigeResolucaoPesoAreaEnem(classificacao)
        ? classificacao.resolucaoPesoAreaEnem
        : 'não se aplica',
    },
  ];
}

function regrasDeEliminacao(classificacao: WizardDraft['classificacao'], local: boolean): string {
  if (!local) return 'nenhuma (classificação importada)';
  const quantidade = classificacao.regrasEliminacao.length;
  return quantidade === 0 ? 'nenhuma' : `${quantidade} regra(s)`;
}

function edicoesAceitas(draft: WizardDraft): string {
  if (!declaraEdicoesDoEnem(draft)) return 'não se aplica';
  const edicoes = draft.classificacao.edicoesEnem;
  return edicoes.length > 0 ? edicoes.map(rotuloDaEdicao).join(', ') : 'nenhuma escolhida';
}
