import { NIVEIS_RESOLUCAO, type NivelResolucao } from '@uniplus/shared-data/geo';

/** Referência estruturada de cidade ao Geo (espelha `CidadeReferenciaInput`). */
export interface CidadeRef {
  readonly codigoIbge: string;
  readonly nome: string;
  readonly uf: string;
}

/**
 * Valor do componente de endereço estruturado — o sub-objeto que o front
 * compõe a partir do CEP (autofill) ou da entrada manual. O parent mapeia
 * `cidade` para os campos `cidade*` do command e o restante para `endereco`
 * (ver `EnderecoGeoInput` / `CidadeReferenciaInput`). `null` = sem endereço.
 */
export interface EnderecoEstruturado {
  readonly cep: string | null;
  readonly logradouro: string | null;
  readonly numero: string | null;
  readonly complemento: string | null;
  readonly bairro: string | null;
  readonly distrito: string | null;
  readonly cidade: CidadeRef | null;
  readonly latitude: string | null;
  readonly longitude: string | null;
  readonly nivelResolucao: string | null;
  readonly origem: string | null;
}

/** Campos de logradouro do DNE que o `nivelResolucao` pode ancorar. */
export type CampoEndereco = 'cep' | 'logradouro' | 'bairro' | 'distrito' | 'cidade';

/** Proveniência atribuída a um endereço preenchido manualmente (sem CEP). */
export const ORIGEM_MANUAL = 'manual';

/** Proveniência atribuída a um endereço resolvido pela API Geo (autofill). */
export const ORIGEM_GEO = 'geo-api';

/**
 * Normaliza o `nivelResolucao` (contrato `string`) para o roster conhecido.
 * Valores fora do roster (ou nulos) caem no nível mais raso (`cidade`) — o
 * formulário trata como "só a cidade é âncora", mantendo o resto editável.
 */
export function normalizarNivel(nivel: string | null | undefined): NivelResolucao | null {
  if (nivel === null || nivel === undefined) {
    return null;
  }
  return (NIVEIS_RESOLUCAO as readonly string[]).includes(nivel)
    ? (nivel as NivelResolucao)
    : 'cidade';
}

/**
 * Conjunto de campos ancorados (read-only) para um dado `nivelResolucao`, por
 * ADR-0096 / tabela de comportamento da story #412. Um campo de rank `r` é
 * âncora quando a resolução alcançou aquele nível ou um mais fino — isto é,
 * `rank(campo) >= rank(nivel)`, sendo `cep` e `cidade` sempre âncora quando há
 * resolução. `numero`/`complemento` nunca são âncora (dado próprio, fora do
 * DNE). Sem resolução (entrada manual), nada é ancorado.
 *
 * | nivelResolucao | âncoras (read-only)                       |
 * |----------------|-------------------------------------------|
 * | logradouro     | cep, logradouro, bairro, distrito, cidade |
 * | bairro         | cep, bairro, distrito, cidade             |
 * | distrito       | cep, distrito, cidade                     |
 * | cidade         | cep, cidade                               |
 */
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

/** Heurística: o `field`/`code` do backend pertence ao bloco de endereço/cidade. */
export function ehErroDeEndereco(valor: string): boolean {
  const normalizado = valor.toLocaleLowerCase('pt-BR');
  return (
    normalizado.includes('endereco') ||
    normalizado.includes('cep') ||
    normalizado.includes('cidade')
  );
}

export function camposAncorados(nivel: NivelResolucao | null): ReadonlySet<CampoEndereco> {
  if (nivel === null) {
    return new Set<CampoEndereco>();
  }
  const rankNivel = NIVEIS_RESOLUCAO.indexOf(nivel);
  const ancorados = new Set<CampoEndereco>(['cep', 'cidade']);
  for (const campo of ['logradouro', 'bairro', 'distrito'] as const) {
    if (NIVEIS_RESOLUCAO.indexOf(campo) >= rankNivel) {
      ancorados.add(campo);
    }
  }
  return ancorados;
}
