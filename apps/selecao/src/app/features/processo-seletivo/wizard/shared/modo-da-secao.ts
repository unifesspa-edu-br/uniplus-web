/**
 * Como uma seção do editor se apresenta: edição liberada, edição travada (os controles ficam
 * desabilitados) ou só consulta (texto, sem controles). Quem monta a seção decide o modo pela
 * permissão efetiva; a seção não decide o acesso.
 */
export type ModoDaSecao = 'edicao' | 'bloqueado' | 'consulta';
