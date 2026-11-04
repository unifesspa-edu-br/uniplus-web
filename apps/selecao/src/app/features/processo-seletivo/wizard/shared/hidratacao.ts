import { FundamentoIsencao, OrigemCandidatos } from '@uniplus/shared-data/selecao';
import type { FundamentoIsencaoCodigo, ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import type {
  FormularioDeInscricao,
  OrigemCandidatosSelecionada,
  WizardDraft,
} from '../processo-seletivo.models';
import { formulariosDoServidor } from '../passos/formulario/formularios-por-finalidade';
import { exigenciasDe } from './exigencias/leitura-das-exigencias';
import { comoTexto } from './hidratacao/campos-lidos';
import {
  atendimentoDe,
  bonusDe,
  classificacaoDe,
  desempateDe,
} from './hidratacao/hidratacao-da-classificacao';
import { cronogramaDe } from './hidratacao/hidratacao-do-cronograma';
import { cascataDe, distribuicoesDe } from './hidratacao/hidratacao-das-vagas';
import { formatarValorEmReais } from './valor-em-reais';

export { desempateDe } from './hidratacao/hidratacao-da-classificacao';
export { etapasDe } from './hidratacao/hidratacao-do-cronograma';
export {
  classificarDocumentos,
  descreverDocumento,
  TIPO_DE_MIDIA_DO_EDITAL,
  uploadItemDe,
  type ReadbackDocumentos,
} from './hidratacao/documentos-do-edital';

/**
 * Projeta o `ProcessoSeletivoDto` (fonte durável) sobre o rascunho editável. Toda dimensão que o
 * wizard grava precisa ser lida de volta aqui: o que não for mapeado é reescrito em branco na
 * gravação seguinte, porque os comandos substituem a coleção inteira.
 */
export function hidratarDraft(draft: WizardDraft, dto: ProcessoSeletivoDto): WizardDraft {
  return {
    ...draft,
    tipoProcesso: {
      selected: dto.tipoProcesso.origemId,
      rotulo: dto.tipoProcesso.nome,
      codigo: dto.tipoProcesso.codigo,
    },
    pagamento: pagamentoDe(dto),
    opcoesDeCurso: { numero: comoTexto(dto.opcoesDeCurso?.numero) },
    vagas: { ofertas: distribuicoesDe(dto), cascata: cascataDe(dto) },
    cronograma: cronogramaDe(dto),
    classificacao: classificacaoDe(dto),
    bonus: bonusDe(dto),
    desempate: desempateDe(dto),
    atendimento: atendimentoDe(dto),
    documentos: exigenciasDe(dto),
    formulario: formularioDe(dto),
    identificacao: {
      ...draft.identificacao,
      nome: dto.nome,
      identificadorLegivel: dto.identificadorLegivel ?? '',
      unidadeAdministradoraId: dto.unidadeAdministradora.origemId,
      origemCandidatos: decodificarOrigemCandidatos(dto.origemCandidatos),
      localidade: {
        codigoIbge: dto.localidade.codigoIbge,
        nome: dto.localidade.nome,
        uf: dto.localidade.uf,
      },
    },
  };
}

/**
 * Os formulários de cada finalidade (conteúdo pelo mesmo mapeamento da gravação e fase em que cada
 * um é respondido), a política que ancora a apuração de idade e as regras de derivação. As fases
 * voltam como CÓDIGO: o id não sobrevive a uma gravação de cronograma que remova e reacrescente
 * a fase.
 */
function formularioDe(dto: ProcessoSeletivoDto): FormularioDeInscricao {
  const codigoPorFaseId = new Map((dto.cronogramaFases ?? []).map((f) => [f.id, f.codigo]));
  const referencia = dto.referenciaTemporalFatos;

  return {
    ...formulariosDoServidor({
      formularios: dto.formularios ?? [],
      cronogramaFases: dto.cronogramaFases ?? [],
    }),
    referenciaTemporal: {
      tipo: referencia?.tipo ?? '',
      data: referencia?.data ?? '',
      faseCodigo:
        referencia?.faseId === null || referencia?.faseId === undefined
          ? ''
          : (codigoPorFaseId.get(referencia.faseId) ?? ''),
    },
    derivacao: (dto.regrasDerivacao ?? []).map((config) => ({
      codigoFato: config.codigoFato,
      regras: config.regras,
    })),
  };
}

/**
 * Projeta a taxa gravada. Ausente é "ainda não declarado", diferente de declarar que não cobra, e
 * vira `cobra: null` para o passo continuar exigindo a declaração. O valor volta como texto, com a
 * vírgula decimal que o operador digita.
 */
function pagamentoDe(dto: ProcessoSeletivoDto): WizardDraft['pagamento'] {
  const config = dto.configuracaoTaxaInscricao;
  if (config === null || config === undefined) {
    return { cobra: null, valor: '', fundamentos: [] };
  }

  return {
    cobra: config.cobra,
    valor: valorGravadoComoTexto(config.valor),
    fundamentos: [...config.fundamentos].filter(ehFundamentoConhecido),
  };
}

/** O valor gravado chega como número do JSON, não como a escrita do operador. */
function valorGravadoComoTexto(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '';
  return Number.isFinite(valor) ? formatarValorEmReais(valor) : '';
}

/**
 * O detalhe devolve os fundamentos como texto livre e a gravação aceita vocabulário fechado: o
 * código desconhecido sai do rascunho em vez de seguir para um comando que o recusaria.
 */
function ehFundamentoConhecido(codigo: string): codigo is FundamentoIsencaoCodigo {
  const conhecidos: readonly string[] = Object.values(FundamentoIsencao);
  return conhecidos.includes(codigo);
}

/**
 * A leitura devolve o nome do enum de domínio (`InscricaoPropria`) e a criação recebe
 * `inscricaoPropria`. Sem traduzir, a retomada gravaria no rascunho um valor que nenhuma `<option>`
 * tem. Valor fora do vocabulário vira `''`, e a validação cobra a escolha.
 */
export function decodificarOrigemCandidatos(valor: string): OrigemCandidatosSelecionada {
  const normalizado = valor.charAt(0).toLowerCase() + valor.slice(1);
  if (normalizado === OrigemCandidatos.inscricaoPropria) {
    return OrigemCandidatos.inscricaoPropria;
  }
  if (normalizado === OrigemCandidatos.importacaoExterna) {
    return OrigemCandidatos.importacaoExterna;
  }
  return '';
}
