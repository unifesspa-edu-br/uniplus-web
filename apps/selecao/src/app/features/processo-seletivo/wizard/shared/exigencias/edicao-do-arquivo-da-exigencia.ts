import type { FormatosAceitos } from '../../processo-seletivo.models';

export function aceitarQualquerFormato(): FormatosAceitos {
  return { tipo: 'qualquer' };
}

export function selecionarFormato(formatos: FormatosAceitos, formato: string): FormatosAceitos {
  const itens = formatos.tipo === 'lista' ? formatos.itens : [];
  if (itens.some((item) => item.formato === formato)) return formatos;
  return { tipo: 'lista', itens: [...itens, { formato, tamanhoMaximoBytes: null }] };
}

export function retirarFormato(formatos: FormatosAceitos, formato: string): FormatosAceitos {
  if (formatos.tipo === 'qualquer') return formatos;
  return { tipo: 'lista', itens: formatos.itens.filter((item) => item.formato !== formato) };
}

export function definirTamanhoDoFormato(
  formatos: FormatosAceitos,
  formato: string,
  tamanhoMaximoBytes: number | null,
): FormatosAceitos {
  if (formatos.tipo === 'qualquer') return formatos;
  return {
    tipo: 'lista',
    itens: formatos.itens.map((item) =>
      item.formato === formato ? { ...item, tamanhoMaximoBytes } : item,
    ),
  };
}

export function tamanhoDoFormatoInvalido(
  tamanhoDoFormato: number | null,
  tamanhoDaExigencia: number | null,
): boolean {
  if (tamanhoDoFormato === null) return false;
  return (
    !Number.isInteger(tamanhoDoFormato) ||
    tamanhoDoFormato <= 0 ||
    tamanhoDoFormato > 2_147_483_647 ||
    (tamanhoDaExigencia !== null && tamanhoDoFormato > tamanhoDaExigencia)
  );
}
