/** A recusa do servidor que a tela prende a um controle pelo código de erro, com o título público. */
export interface RecusaPorCodigo {
  readonly controle: 'codigo' | 'nome';
  readonly mensagem: string;
}

const RECUSAS_POR_CODIGO: ReadonlyMap<string, RecusaPorCodigo> = new Map([
  [
    'uniplus.configuracao.modalidade.codigo_ja_existe',
    { controle: 'codigo', mensagem: 'Código já utilizado por outra modalidade viva.' },
  ],
  [
    'uniplus.configuracao.modalidade.nome_obrigatorio',
    { controle: 'nome', mensagem: 'Nome da modalidade é obrigatório' },
  ],
  [
    'uniplus.configuracao.modalidade.nome_tamanho',
    { controle: 'nome', mensagem: 'Tamanho do nome da modalidade inválido' },
  ],
  [
    'uniplus.configuracao.modalidade.nome_ja_existe',
    { controle: 'nome', mensagem: 'Já existe uma modalidade ativa com este nome' },
  ],
]);

/** O código comparado é o do wire (`uniplus.<modulo>.<razao>`); o de domínio é chave de busca do servidor. */
export function recusaPorCodigo(codigo: string): RecusaPorCodigo | null {
  return RECUSAS_POR_CODIGO.get(codigo) ?? null;
}
