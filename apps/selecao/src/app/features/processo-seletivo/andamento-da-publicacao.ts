const CONFERINDO_E_GRAVANDO =
  'Conferindo e gravando o processo antes de pedir a confirmação da publicação…';

/** Sem texto quando não há conferência em curso: a região viva fica montada, só vazia. */
export function andamentoDaPublicacao(conferindoEGravando: boolean): string {
  return conferindoEGravando ? CONFERINDO_E_GRAVANDO : '';
}
