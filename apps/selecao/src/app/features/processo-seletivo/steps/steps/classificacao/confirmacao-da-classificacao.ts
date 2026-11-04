import type { ConfirmacaoDeGravacao } from '../../passo-do-wizard';
import type { CriterioDesempateConfigurado, WizardDraft } from '../../processo-seletivo.models';
import { desempateUsaAreas } from '../desempate/desempate-para-comando';
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
  return desempateUsaAreas(criterio.regraCodigo)
    ? `${criterio.regraCodigo}: ${criterio.areas.map(rotuloDaArea).join(', ')}`
    : criterio.regraCodigo;
}

/** A confirmação da gravação da classificação inteira, com a precisão e a eliminação. */
export function confirmacaoDaClassificacao(conteudo: ConteudoDaConfirmacao): ConfirmacaoDeGravacao {
  const { draft, avisosDoDesempate, criteriosAdiados } = conteudo;
  const classificacao = draft.classificacao;
  const local = classificacaoUsaFormulaLocal(classificacao.regraCalculoCodigo);
  const naoSeAplica = 'não se aplica (classificação importada)';

  return {
    titulo: 'Confirmar a classificação do processo',
    aviso: [
      criteriosAdiados.length > 0
        ? 'A classificação, a precisão, a eliminação e os critérios de desempate serão gravados juntos nesta confirmação.'
        : 'A classificação, a precisão e a eliminação serão gravadas juntas nesta confirmação.',
      ...avisosDoDesempate,
    ].join(' '),
    rotuloDeConfirmar: 'Gravar classificação',
    itens: [
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
      ...criteriosAdiados.map((criterio, indice) => ({
        rotulo: `${indice + 1}º critério de desempate`,
        valor: textoDoCriterio(criterio, conteudo.rotuloDaArea),
      })),
    ],
  };
}

function edicoesAceitas(draft: WizardDraft): string {
  if (!declaraEdicoesDoEnem(draft)) return 'não se aplica';
  const edicoes = draft.classificacao.edicoesEnem;
  return edicoes.length > 0 ? edicoes.map(rotuloDaEdicao).join(', ') : 'nenhuma escolhida';
}
