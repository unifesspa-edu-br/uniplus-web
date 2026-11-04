const BYTES_POR_MB = 1024 * 1024;

export type ResultadoDaValidacao = { ok: true } | { ok: false; reason: string };

/** O que o componente aceita de um arquivo escolhido. */
export interface RegrasDoArquivo {
  readonly tamanhoMaximoMb: number;
  /** Extensões aceitas, separadas por vírgula, como no atributo `accept` (`.pdf,.png`). */
  readonly extensoesAceitas: string;
  readonly tiposMimeAceitos: readonly string[];
  /** A extensão decide e o tipo MIME não é consultado. */
  readonly soPelaExtensao: boolean;
}

/**
 * Validação do lado do cliente: UX e anti-engano. A fronteira real de segurança (magic bytes,
 * antivírus) é do servidor — ver ADR-012 (quarentena, ClamAV, bucket definitivo).
 */
export function validarArquivo(file: File, regras: RegrasDoArquivo): ResultadoDaValidacao {
  if (file.size === 0) {
    return { ok: false, reason: 'O arquivo está vazio.' };
  }
  if (file.size > regras.tamanhoMaximoMb * BYTES_POR_MB) {
    return { ok: false, reason: `Arquivo excede o tamanho máximo de ${regras.tamanhoMaximoMb}MB.` };
  }
  if (!tipoMimeAceito(file, regras) || !extensaoAceita(file, regras)) {
    return {
      ok: false,
      reason: `Tipo de arquivo não permitido. Envie arquivos nos formatos: ${regras.extensoesAceitas}`,
    };
  }
  return { ok: true };
}

function tipoMimeAceito(file: File, regras: RegrasDoArquivo): boolean {
  if (regras.soPelaExtensao) return true;
  const tipo = file.type.toLowerCase();
  return regras.tiposMimeAceitos.some((aceito) => aceito.toLowerCase() === tipo);
}

function extensaoAceita(file: File, regras: RegrasDoArquivo): boolean {
  const ponto = file.name.lastIndexOf('.');
  if (ponto < 0) return false;
  const extensao = file.name.slice(ponto).toLowerCase();
  return regras.extensoesAceitas
    .split(',')
    .map((aceita) => aceita.trim().toLowerCase())
    .includes(extensao);
}
