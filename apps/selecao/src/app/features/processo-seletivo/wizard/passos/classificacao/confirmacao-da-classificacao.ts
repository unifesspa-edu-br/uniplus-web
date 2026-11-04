import type { ConfirmacaoDeGravacao, ItemDeConfirmacao } from '../../passo-do-wizard';
import type { CriterioDesempateConfigurado, WizardDraft } from '../../processo-seletivo.models';
import {
  classificacaoUsaFormulaLocal,
  exigeResolucaoPesoAreaEnem,
} from './classificacao-para-comando';
import { declaraEdicoesDoEnem, rotuloDaEdicao } from './edicoes-do-enem';
import { leituraDaEscalaDaNotaFinal } from './escala-da-nota-final';

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

/** A confirmação da gravação da classificação inteira, com a precisão e a eliminação. */
export function confirmacaoDaClassificacao(conteudo: ConteudoDaConfirmacao): ConfirmacaoDeGravacao {
  return {
    titulo: 'Confirmar a classificação do processo',
    aviso: [
      avisoDaGravacao(conteudo.criteriosAdiados.length > 0),
      ...conteudo.avisosDoDesempate,
    ].join(' '),
    rotuloDeConfirmar: 'Gravar classificação',
    itens: [
      ...itensDaClassificacao(conteudo.draft),
      ...conteudo.criteriosAdiados.map((criterio, indice) => ({
        rotulo: `${indice + 1}º critério de desempate`,
        valor: textoDoCriterio(criterio, conteudo.rotuloDaArea),
      })),
    ],
  };
}

function avisoDaGravacao(comDesempate: boolean): string {
  return comDesempate
    ? 'A classificação, a precisão, a eliminação e os critérios de desempate serão gravados juntos nesta confirmação.'
    : 'A classificação, a precisão e a eliminação serão gravadas juntas nesta confirmação.';
}

function itensDaClassificacao(draft: WizardDraft): ItemDeConfirmacao[] {
  const classificacao = draft.classificacao;
  const local = classificacaoUsaFormulaLocal(classificacao.regraCalculoCodigo);

  return [
    ...itensDoCalculo(classificacao, local),
    { rotulo: 'Baseada em ENEM', valor: classificacao.baseadoEmEnem ? 'Sim' : 'Não' },
    {
      rotulo: 'Resolução de Peso por Área',
      valor: exigeResolucaoPesoAreaEnem(classificacao)
        ? classificacao.resolucaoPesoAreaEnem
        : 'não se aplica',
    },
    {
      rotulo: 'Regras de eliminação',
      valor: local
        ? `${classificacao.regrasEliminacao.length} regra(s)`
        : 'nenhuma (classificação importada)',
    },
    { rotulo: 'Edições do ENEM aceitas', valor: edicoesAceitas(draft) },
  ];
}

/** A regra de cálculo, o arredondamento, a ordem de alocação e a escala da nota final. */
function itensDoCalculo(
  classificacao: WizardDraft['classificacao'],
  local: boolean,
): ItemDeConfirmacao[] {
  const naoSeAplica = 'não se aplica (classificação importada)';
  return [
    { rotulo: 'Regra de cálculo', valor: classificacao.regraCalculoCodigo },
    {
      rotulo: 'Arredondamento',
      valor: local
        ? `${classificacao.regraArredondamentoCodigo} — ${classificacao.casasArredondamento} casas`
        : naoSeAplica,
    },
    { rotulo: 'Ordem de alocação', valor: classificacao.regraOrdemAlocacaoCodigo },
    {
      rotulo: 'Escala da nota final',
      valor: local ? leituraDaEscalaDaNotaFinal(classificacao.escalaNotaFinal) : naoSeAplica,
    },
  ];
}

function edicoesAceitas(draft: WizardDraft): string {
  if (!declaraEdicoesDoEnem(draft)) return 'não se aplica';
  const edicoes = draft.classificacao.edicoesEnem;
  return edicoes.length > 0 ? edicoes.map(rotuloDaEdicao).join(', ') : 'nenhuma escolhida';
}
