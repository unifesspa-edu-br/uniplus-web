import type { FormatosAceitos } from '../../processo-seletivo.models';

export function lerFormatosAceitos(valor: unknown): FormatosAceitos {
  if (valor === 'QUALQUER') return { tipo: 'qualquer' };
  if (!Array.isArray(valor)) throw new Error('Formatos de arquivo inválidos.');
  return { tipo: 'lista', itens: valor.map(lerFormato) };
}

function lerFormato(valor: unknown): { formato: string; tamanhoMaximoBytes: number | null } {
  if (typeof valor === 'string') return { formato: valor, tamanhoMaximoBytes: null };
  if (typeof valor !== 'object' || valor === null || !('formato' in valor)) {
    throw new Error('Formato de arquivo inválido.');
  }
  const formato = valor.formato;
  const tamanho = 'tamanhoMaximoBytesMax' in valor ? valor.tamanhoMaximoBytesMax : null;
  if (typeof formato !== 'string' || (tamanho !== null && typeof tamanho !== 'number')) {
    throw new Error('Formato de arquivo inválido.');
  }
  return { formato, tamanhoMaximoBytes: tamanho };
}

export function formatosParaEnvio(formatos: FormatosAceitos): unknown {
  if (formatos.tipo === 'qualquer') return 'QUALQUER';
  return formatos.itens.map(({ formato, tamanhoMaximoBytes }) => ({
    formato,
    tamanhoMaximoBytesMax: tamanhoMaximoBytes,
  }));
}
