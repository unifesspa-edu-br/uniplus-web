import type { ValidacaoDoPasso } from '../wizard/processo-seletivo.models';

/** Normaliza `message` (forma simples) e `messages` (lista) para `string[]`. */
export function mensagensDe(resultado: ValidacaoDoPasso): string[] {
  if (resultado.messages && resultado.messages.length > 0) return resultado.messages;
  return [resultado.message ?? 'Preencha os campos obrigatórios para continuar.'];
}

/** O resultado de um `persistir()` que lançou em vez de responder. */
export function falhaAoConcluir(): ValidacaoDoPasso {
  return {
    valid: false,
    messages: ['Não foi possível concluir a operação. Tente novamente.'],
  };
}
