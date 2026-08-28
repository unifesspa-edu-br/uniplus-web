/**
 * Status do Processo Seletivo como a leitura os devolve: o servidor serializa
 * o enum em PascalCase, diferente do vocabulário que aceita na escrita.
 */
export const STATUS_PROCESSO = {
  RASCUNHO: 'Rascunho',
  PUBLICADO: 'Publicado',
  ENCERRADO: 'Encerrado',
  CANCELADO: 'Cancelado',
} as const;
