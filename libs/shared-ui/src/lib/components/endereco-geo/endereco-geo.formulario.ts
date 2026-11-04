import { FormControl, FormGroup } from '@angular/forms';
import type { CepEncontrado, EnderecoEstruturado } from './endereco-geo.model';
import type { ResolucaoDoEndereco } from './endereco-geo.resolucao';

export interface EnderecoFormControls {
  cep: FormControl<string>;
  logradouro: FormControl<string>;
  numero: FormControl<string>;
  complemento: FormControl<string>;
  bairro: FormControl<string>;
  distrito: FormControl<string>;
  latitude: FormControl<string>;
  longitude: FormControl<string>;
}

/** O que cada campo do formulário do endereço tem escrito. */
export type TextosDoEndereco = { [campo in keyof EnderecoFormControls]: string };

export const ENDERECO_VAZIO: TextosDoEndereco = {
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  distrito: '',
  latitude: '',
  longitude: '',
};

export function criarFormularioDoEndereco(): FormGroup<EnderecoFormControls> {
  return new FormGroup<EnderecoFormControls>({
    cep: new FormControl('', { nonNullable: true }),
    logradouro: new FormControl('', { nonNullable: true }),
    numero: new FormControl('', { nonNullable: true }),
    complemento: new FormControl('', { nonNullable: true }),
    bairro: new FormControl('', { nonNullable: true }),
    distrito: new FormControl('', { nonNullable: true }),
    latitude: new FormControl('', { nonNullable: true }),
    longitude: new FormControl('', { nonNullable: true }),
  });
}

/** Os textos do formulário para um endereço já gravado. */
export function textosDoEndereco(valor: EnderecoEstruturado): TextosDoEndereco {
  return {
    cep: valor.cep ?? '',
    logradouro: valor.logradouro ?? '',
    numero: valor.numero ?? '',
    complemento: valor.complemento ?? '',
    bairro: valor.bairro ?? '',
    distrito: valor.distrito ?? '',
    latitude: valor.latitude ?? '',
    longitude: valor.longitude ?? '',
  };
}

/**
 * Os textos que o CEP resolvido preenche. Numa faixa de CEP o Geo não tem a rua, então nada além
 * de cidade e UF é preenchido.
 */
export function textosDoCep(cep: CepEncontrado, comLogradouro: boolean): Partial<TextosDoEndereco> {
  if (!comLogradouro) {
    return { cep: cep.cep, logradouro: '', bairro: '', distrito: '', latitude: '', longitude: '' };
  }
  return {
    cep: cep.cep,
    logradouro: logradouroCompleto(cep.tipo ?? null, cep.logradouro ?? null),
    bairro: cep.bairro ?? '',
    distrito: cep.distrito ?? '',
    latitude: textoDeCoordenada(cep.latitude),
    longitude: textoDeCoordenada(cep.longitude),
  };
}

/**
 * O endereço que o formulário compõe, ou `null` sem nada preenchido. Só um CEP efetivamente
 * resolvido pelo Geo entra no valor: um CEP digitado e não resolvido (404, ou sem "Buscar") virar
 * `endereco` submeteria um CEP que o usuário não conseguiu validar.
 */
export function montarEndereco(
  texto: TextosDoEndereco,
  resolucao: ResolucaoDoEndereco,
): EnderecoEstruturado | null {
  const cidade = resolucao.cidade();
  const cep = resolucao.cepCorrespondeAoResolvido() ? vazioParaNulo(texto.cep) : null;
  const algumPreenchido =
    cidade !== null ||
    cep !== null ||
    [texto.logradouro, texto.numero, texto.complemento, texto.bairro, texto.distrito].some(
      (v) => v.trim().length > 0,
    );
  if (!algumPreenchido) {
    return null;
  }
  return {
    cep,
    logradouro: vazioParaNulo(texto.logradouro),
    numero: vazioParaNulo(texto.numero),
    complemento: vazioParaNulo(texto.complemento),
    bairro: vazioParaNulo(texto.bairro),
    distrito: vazioParaNulo(texto.distrito),
    cidade,
    latitude: vazioParaNulo(texto.latitude),
    longitude: vazioParaNulo(texto.longitude),
    ...resolucao.paraOValor(),
  };
}

function vazioParaNulo(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function textoDeCoordenada(valor: string | number | null | undefined): string {
  return valor === null || valor === undefined ? '' : String(valor);
}

/**
 * Nome completo do logradouro: o Geo devolve `tipo` ("Rua", "Terceira") separado de
 * `logradouro` e a concatenação cabe ao cliente ("Terceira Avenida Bloco 1740").
 */
function logradouroCompleto(tipo: string | null, logradouro: string | null): string {
  if (logradouro === null || logradouro.length === 0) {
    return '';
  }
  return tipo !== null && tipo.length > 0 ? `${tipo} ${logradouro}` : logradouro;
}
