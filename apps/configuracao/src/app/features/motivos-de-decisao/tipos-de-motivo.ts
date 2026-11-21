const TIPO_COM_SUBCLASSIFICACAO = 'ISENCAO_DA_TAXA';

/** A subclassificação existe só onde o tipo a pede: na isenção, o fundamento de isenção. */
export function tipoPedeSubclassificacao(tipo: string): boolean {
  return tipo === TIPO_COM_SUBCLASSIFICACAO;
}
