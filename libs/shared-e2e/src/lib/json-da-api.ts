/**
 * O DTO do cliente gerado como a API o envia em JSON: cada enum vira o texto dele. As simulações
 * se tipam por ele para que um campo obrigatório que falte, ou sobre, não compile.
 */
export type JsonDaApi<T> = T extends string ? `${T}` : { readonly [K in keyof T]: JsonDaApi<T[K]> };
