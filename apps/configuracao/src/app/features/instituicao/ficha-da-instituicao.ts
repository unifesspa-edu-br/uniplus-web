import { InstituicaoDto } from '@uniplus/shared-data/organizacao';
import { nullIfBlank } from '../../shared/formulario';

/** Texto exibido em campos opcionais sem valor (acessível a leitor de tela). */
export const NAO_INFORMADO = '—';

/** O texto do campo opcional, ou o travessão quando não há valor a mostrar. */
export function textoOuNaoInformado(valor: string | null | undefined): string {
  return nullIfBlank(valor) ?? NAO_INFORMADO;
}

/** O rótulo da cidade da sede: a do endereço estruturado ou, na falta dele, a da instituição. */
export function cidadeDaSede(instituicao: InstituicaoDto): string {
  const cidade = instituicao.endereco?.cidade ?? instituicao.cidade;
  return cidade ? `${cidade.nome} — ${cidade.uf}` : NAO_INFORMADO;
}

/** A linha do endereço estruturado: logradouro, número e complemento, bairro e distrito. */
export function linhaDoEndereco(instituicao: InstituicaoDto): string {
  const endereco = instituicao.endereco;
  if (endereco === null || endereco === undefined) {
    return NAO_INFORMADO;
  }
  const numeroComplemento = [endereco.numero, endereco.complemento]
    .map(nullIfBlank)
    .filter((parte) => parte !== null)
    .join(' — ');
  const partes = [endereco.logradouro, numeroComplemento, endereco.bairro, endereco.distrito]
    .map(nullIfBlank)
    .filter((parte) => parte !== null);
  return partes.length > 0 ? partes.join(', ') : NAO_INFORMADO;
}
