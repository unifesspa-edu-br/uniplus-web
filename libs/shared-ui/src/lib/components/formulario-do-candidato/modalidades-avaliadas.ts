import type { DocumentosAvaliados } from './documentos-avaliados';
import {
  comoInteiro,
  type DependenciasDaAvaliacao,
  type Inteiro,
  type PassoDoFormulario,
} from './formulario-do-candidato.model';

/** As respostas dão o conjunto de modalidades: ele está em `itens`. */
export const CONCORRE = 'CONCORRE';
/** As respostas estão completas e não levam a nenhuma modalidade ofertada. */
export const NAO_CONCORRE = 'NAO_CONCORRE';
/** Falta responder o que `pendencias` lista para saber as modalidades. */
export const FALTA_RESPONDER = 'FALTA_RESPONDER';

export interface ModalidadeAvaliada {
  readonly codigo: string;
  /** O nome congelado na publicação do processo. */
  readonly nome: string;
  readonly ordem: Inteiro;
}

/** Uma pergunta visível sem resposta de que a avaliação depende. */
export interface PendenciaDaAvaliacao {
  readonly fatoCodigo: string;
  readonly rotulo: string;
  readonly secaoCodigo?: string | null;
}

/**
 * As modalidades que as respostas dão, como a API as calcula (ADR-0143). Sem derivação, o processo não
 * define pela inscrição as modalidades de concorrência e a situação é nula.
 */
export interface ModalidadesAvaliadas {
  readonly derivada: boolean;
  readonly situacao: string | null;
  readonly itens: readonly ModalidadeAvaliada[];
  readonly pendencias: readonly PendenciaDaAvaliacao[];
}

/** Os nomes dos cursos das opções declaradas; nulo na opção ainda não escolhida. */
export interface OpcoesDeCursoNaTela {
  readonly primeira: string | null;
  readonly segunda: string | null;
}

/**
 * O que a tela sabe da avaliação agora. Calculando, a última avaliação continua à vista até a nova
 * chegar; com erro, também — o envio não depende dela.
 */
export interface AvaliacaoNaTela {
  readonly modalidades: ModalidadesAvaliadas | null;
  /**
   * As modalidades da 2ª opção de curso, que tem a própria distribuição de vagas; nulas quando a
   * inscrição não declara 2ª opção. Ausente, a avaliação não conhece 2ª opção.
   */
  readonly modalidadesSegundaOpcao?: ModalidadesAvaliadas | null;
  /** Os nomes dos cursos escolhidos, para titular as modalidades de cada opção. */
  readonly opcoesDeCurso?: OpcoesDeCursoNaTela | null;
  readonly documentos: DocumentosAvaliados | null;
  readonly calculando: boolean;
  readonly erro: string | null;
}

/** Os nomes das modalidades na ordem da oferta. */
export function nomesNaOrdem(modalidades: ModalidadesAvaliadas | null): readonly string[] {
  if (modalidades?.situacao !== CONCORRE) return [];
  return nomesPelaOrdem(modalidades.itens);
}

/** Os nomes de um conjunto de modalidades, na ordem da oferta: o código nunca vai à tela. */
export function nomesPelaOrdem(itens: readonly ModalidadeAvaliada[]): readonly string[] {
  return [...itens].sort((a, b) => comoInteiro(a.ordem) - comoInteiro(b.ordem)).map((m) => m.nome);
}

/**
 * O que dizer quando o conjunto muda: "Você passou a concorrer em: …; deixou de concorrer em: …". Só
 * anuncia a troca entre dois conjuntos conhecidos — calcular, errar ou faltar resposta não é troca.
 */
export function anunciarMudancaDasModalidades(
  anteriores: ModalidadesAvaliadas | null,
  atuais: ModalidadesAvaliadas | null,
): string {
  if (!conhecidas(anteriores) || !conhecidas(atuais)) return '';
  const antes = nomesNaOrdem(anteriores);
  const depois = nomesNaOrdem(atuais);
  const entraram = depois.filter((nome) => !antes.includes(nome));
  const sairam = antes.filter((nome) => !depois.includes(nome));
  const passou = `passou a concorrer em: ${entraram.join(', ')}`;
  const deixou = `deixou de concorrer em: ${sairam.join(', ')}`;
  if (entraram.length > 0 && sairam.length > 0) return `Você ${passou}; ${deixou}.`;
  if (entraram.length > 0) return `Você ${passou}.`;
  if (sairam.length > 0) return `Você ${deixou}.`;
  return '';
}

/** O conjunto está decidido: o candidato concorre a estas, ou a nenhuma. */
export function conhecidas(
  modalidades: ModalidadesAvaliadas | null,
): modalidades is ModalidadesAvaliadas {
  return modalidades?.situacao === CONCORRE || modalidades?.situacao === NAO_CONCORRE;
}

/** Uma seção do formulário com respostas de que as modalidades dependem. */
export interface SecaoQueDefineAsModalidades {
  readonly chave: string;
  readonly titulo: string;
}

/**
 * As seções, na ordem do formulário, em que o candidato responde o que decide as modalidades: as que
 * têm um campo das dependências, ou um grupo delas — pelo grupo ou por um subitem `GRUPO.FATO`.
 */
export function secoesQueDefinemAsModalidades(
  passos: readonly PassoDoFormulario[],
  dependencias: DependenciasDaAvaliacao | null | undefined,
): SecaoQueDefineAsModalidades[] {
  if (!dependencias) return [];
  const fatos = new Set(dependencias.fatos);
  const grupos = new Set([
    ...dependencias.grupos,
    ...dependencias.fatos.filter((f) => f.includes('.')).map((f) => f.split('.')[0]),
  ]);
  return passos
    .filter(
      (passo) =>
        passo.bloco === null &&
        (passo.campos.some((c) => fatos.has(c.campo.fatoCodigo)) ||
          passo.grupos.some((g) => grupos.has(g.grupo.codigo))),
    )
    .map((passo) => ({ chave: passo.chave, titulo: passo.titulo }));
}
