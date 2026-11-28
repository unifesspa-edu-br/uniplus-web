import type { ReferenciaAoSuporte } from '@uniplus/shared-core/http';
import type { Notification } from './notification.service';

export interface FilaComAviso {
  readonly fila: readonly Notification[];
  readonly repetido: boolean;
}

function codigoDaReferencia(referencia: ReferenciaAoSuporte | undefined): string | null {
  if (referencia === undefined) return null;
  return referencia.origem === 'servidor' ? referencia.codigoDoErro : referencia.codigo;
}

/** Dois avisos são o mesmo quando têm o mesmo tipo, o mesmo título e o mesmo código do erro (ausente também vale como valor). */
function chaveDeRepeticao(aviso: Notification): string {
  return JSON.stringify([aviso.type, aviso.title, codigoDaReferencia(aviso.referencia)]);
}

function identificadorDoPedidoDe(referencia: ReferenciaAoSuporte | undefined): string | null {
  if (referencia?.origem !== 'servidor') return null;
  const identificador = referencia.identificadorDoPedido;
  return identificador === null || identificador === '' ? null : identificador;
}

function identificadoresAnteriores(existente: Notification, novo: Notification): readonly string[] {
  const anterior = identificadorDoPedidoDe(existente.referencia);
  const atual = identificadorDoPedidoDe(novo.referencia);
  const todos = anterior === null ? [] : [anterior];
  const reunidos = [
    ...existente.identificadoresAnteriores,
    ...todos,
    ...novo.identificadoresAnteriores,
  ];
  return reunidos.filter((id, posicao) => id !== atual && reunidos.indexOf(id) === posicao);
}

function agrupar(existente: Notification, novo: Notification): Notification {
  return {
    ...existente,
    detail: novo.detail,
    referencia: novo.referencia,
    persistent: existente.persistent || novo.persistent,
    ocorrencias: existente.ocorrencias + novo.ocorrencias,
    identificadoresAnteriores: identificadoresAnteriores(existente, novo),
  };
}

/**
 * Inclui o aviso na fila. Quando já há um aviso com a mesma chave, ele é mantido (mesmo `id`), vai
 * para a posição de mais novo e passa a mostrar os dados da última ocorrência.
 */
export function incluirNaFila(fila: readonly Notification[], novo: Notification): FilaComAviso {
  const chave = chaveDeRepeticao(novo);
  const existente = fila.find((aviso) => chaveDeRepeticao(aviso) === chave);
  if (existente === undefined) return { fila: [...fila, novo], repetido: false };
  const restantes = fila.filter((aviso) => aviso !== existente);
  return { fila: [...restantes, agrupar(existente, novo)], repetido: true };
}
