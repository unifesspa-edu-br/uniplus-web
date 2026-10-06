import type { AbstractControl, ValidationErrors } from '@angular/forms';
import {
  ORIGEM_MANUAL,
  type CidadeRef,
  type EnderecoEstruturado,
} from '@uniplus/shared-ui/components';

/** Estrutura de leitura do endereço aninhado no DTO (qualquer módulo). */
export interface EnderecoGeoLeitura {
  readonly cep: string | null;
  readonly logradouro: string | null;
  readonly numero: string | null;
  readonly complemento: string | null;
  readonly bairro: string | null;
  readonly distrito: string | null;
  readonly cidade: CidadeRef | null;
  readonly latitude: string | number | null;
  readonly longitude: string | number | null;
  readonly nivelResolucao: string | null;
  readonly origem: string | null;
}

/** Endereço estruturado enviado dentro dos commands (estrutura de `EnderecoGeoInput`). */
export interface EnderecoGeoEnvio {
  readonly cep: string | null;
  readonly logradouro: string | null;
  readonly numero: string | null;
  readonly complemento: string | null;
  readonly bairro: string | null;
  readonly distrito: string | null;
  readonly cidade: CidadeRef;
  readonly latitude: string | null;
  readonly longitude: string | null;
  readonly nivelResolucao: string;
  readonly origem: string;
}

/** Parte do command relativa ao endereço: cidade top-level + `endereco` aninhado. */
export interface EnderecoCommandPart {
  readonly cidadeCodigoIbge: string | null;
  readonly cidadeNome: string | null;
  readonly cidadeUf: string | null;
  readonly endereco: EnderecoGeoEnvio | null;
}

function coagirTexto(valor: string | number | null | undefined): string | null {
  if (valor === null || valor === undefined) {
    return null;
  }
  const texto = String(valor).trim();
  return texto.length > 0 ? texto : null;
}

/**
 * Monta o valor do componente (`EnderecoEstruturado`) a partir do par
 * `cidade`/`endereco` aninhados do DTO — compartilhado por Instituição, Campus e
 * Local de Oferta. Quando há cidade sem endereço estruturado (all-or-nothing,
 * ADR-0055), devolve só a cidade em modo manual.
 */
export function enderecoEstruturadoDe(
  cidade: CidadeRef | null | undefined,
  endereco: EnderecoGeoLeitura | null | undefined,
): EnderecoEstruturado | null {
  if (endereco) {
    const cid = endereco.cidade ?? cidade ?? null;
    return {
      cep: coagirTexto(endereco.cep),
      logradouro: coagirTexto(endereco.logradouro),
      numero: coagirTexto(endereco.numero),
      complemento: coagirTexto(endereco.complemento),
      bairro: coagirTexto(endereco.bairro),
      distrito: coagirTexto(endereco.distrito),
      cidade: cid ? { codigoIbge: cid.codigoIbge, nome: cid.nome, uf: cid.uf } : null,
      latitude: coagirTexto(endereco.latitude),
      longitude: coagirTexto(endereco.longitude),
      nivelResolucao: endereco.nivelResolucao ?? null,
      origem: endereco.origem ?? null,
    };
  }
  if (cidade) {
    return {
      cep: null,
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      distrito: null,
      cidade: { codigoIbge: cidade.codigoIbge, nome: cidade.nome, uf: cidade.uf },
      latitude: null,
      longitude: null,
      nivelResolucao: null,
      origem: ORIGEM_MANUAL,
    };
  }
  return null;
}

/**
 * Traduz o endereço estruturado do componente para os campos do command: a
 * cidade vira a referência top-level (`cidade*`); o `endereco` aninhado só é
 * enviado quando há um CEP de 8 dígitos (o backend exige CEP no VO de endereço).
 * Sem CEP, persiste só a cidade (fluxo "sem CEP", CA-02). Compartilhado pelas
 * três telas.
 */
export function enderecoParaCommand(e: EnderecoEstruturado | null): EnderecoCommandPart {
  if (e === null || e.cidade === null) {
    return { cidadeCodigoIbge: null, cidadeNome: null, cidadeUf: null, endereco: null };
  }
  const cidade: CidadeRef = {
    codigoIbge: e.cidade.codigoIbge,
    nome: e.cidade.nome,
    uf: e.cidade.uf,
  };
  const cepDigitos = (e.cep ?? '').replace(/\D/g, '');
  const endereco: EnderecoGeoEnvio | null =
    cepDigitos.length === 8
      ? {
          cep: cepDigitos,
          logradouro: e.logradouro,
          numero: e.numero,
          complemento: e.complemento,
          bairro: e.bairro,
          distrito: e.distrito,
          cidade,
          latitude: e.latitude,
          longitude: e.longitude,
          nivelResolucao: e.nivelResolucao ?? 'cidade',
          origem: e.origem ?? ORIGEM_MANUAL,
        }
      : null;
  return {
    cidadeCodigoIbge: cidade.codigoIbge,
    cidadeNome: cidade.nome,
    cidadeUf: cidade.uf,
    endereco,
  };
}

/**
 * Validator: exige uma cidade no endereço (Campus e Local de Oferta têm cidade
 * obrigatória no contrato — `cidade*` não-nulo). Instituição não usa (cidade
 * opcional, all-or-nothing).
 */
export function cidadeObrigatoriaValidator(
  control: AbstractControl<EnderecoEstruturado | null>,
): ValidationErrors | null {
  return control.value?.cidade ? null : { cidadeObrigatoria: true };
}

/** Chaves de domínio que marcam um `field`/`code` como pertencente ao endereço. */
const CHAVES_ENDERECO = ['endereco', 'cep', 'cidade'] as const;

/**
 * Heurística: o `field`/`code` do backend pertence ao bloco de endereço/cidade.
 * Casa por **segmento** do path (`.`/`_`), não por substring crua, para não
 * classificar errado uma chave que apenas contenha o trecho (ex.: "concepcao"
 * contém "cep"). Cada segmento bate se for igual ou começar com uma chave —
 * cobrindo `Endereco.Cep`, `endereco_referencia.cep_formato_invalido` e
 * `CidadeCodigoIbge`.
 */
export function ehErroDeEndereco(valor: string): boolean {
  return valor
    .toLocaleLowerCase('pt-BR')
    .split(/[._]/)
    .some((segmento) => CHAVES_ENDERECO.some((chave) => segmento === chave || segmento.startsWith(chave)));
}
