export type DonoDaRecusa = 'fase' | 'etapa';

/** Onde, no que foi enviado, uma recusa do servidor aponta. */
export interface LocalDaRecusa {
  readonly dono: DonoDaRecusa;
  /** Posição do dono na lista enviada, com base zero. */
  readonly indice: number;
  /** Posição do recurso, quando o caminho passa por `recursos[j]` da etapa. */
  readonly recurso: number | null;
  /**
   * O que sobra do caminho depois do dono e do recurso, com os colchetes escritos como pontos
   * (`itensDeAvaliacao.3.pontuacaoMaxima`). Vazio quando a recusa aponta o dono inteiro; `null`
   * quando o dono é reconhecido e o resto do caminho não.
   */
  readonly caminho: string | null;
}

const DONO = /^(?:\$\.|request\.)?(fases|etapas)\[(\d+)\]/i;
const RECURSO_DA_ETAPA = /^\.recursos\[(\d+)\]/i;
const CAMINHO_RECONHECIDO = /^(?:\.\w+(?:\[\d+\])*)*$/;

/** O ponteiro JSON do documento: `/cronograma/fases/0/fim`, com o bloco do documento antes da lista. */
const PONTEIRO_DO_DOCUMENTO = /^\/(?:[^/]+\/)?((?:fases|etapas)\/\d+(?:\/.*)?)$/i;

const DONOS: Readonly<Record<string, DonoDaRecusa>> = { fases: 'fase', etapas: 'etapa' };

/** O ponteiro do documento escrito em pontos e colchetes (`fases[0].fim`); o resto fica como está. */
function emPontosEColchetes(field: string): string {
  const ponteiro = PONTEIRO_DO_DOCUMENTO.exec(field);
  if (ponteiro === null) return field;
  return ponteiro[1]
    .split('/')
    .map((parte, posicao) => {
      if (/^\d+$/.test(parte)) return `[${parte}]`;
      return posicao === 0 ? parte : `.${parte}`;
    })
    .join('');
}

/**
 * O lugar que o `field` da recusa aponta: o dono (fase ou etapa) e o caminho dentro dele, no
 * caminho em pontos e colchetes ou no ponteiro do documento. Devolve `null` quando o `field` nem
 * nomeia o dono, e o dono sem caminho quando só ele é reconhecido.
 */
export function localDaRecusa(campo: string): LocalDaRecusa | null {
  const field = emPontosEColchetes(campo);
  const dono = DONO.exec(field);
  if (dono === null) return null;
  const quem = DONOS[dono[1].toLowerCase()];
  const resto = field.slice(dono[0].length);
  const recurso = quem === 'etapa' ? RECURSO_DA_ETAPA.exec(resto) : null;
  const sobra = recurso === null ? resto : resto.slice(recurso[0].length);
  return {
    dono: quem,
    indice: Number(dono[2]),
    recurso: recurso === null ? null : Number(recurso[1]),
    caminho: CAMINHO_RECONHECIDO.test(sobra) ? comoCaminho(sobra) : null,
  };
}

function comoCaminho(sobra: string): string {
  return sobra.replace(/\[(\d+)\]/g, '.$1').replace(/^\./, '');
}
