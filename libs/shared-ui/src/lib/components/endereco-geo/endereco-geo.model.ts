import { InjectionToken } from '@angular/core';
import type { ApiResult } from '@uniplus/shared-core/http';
import type { Observable } from 'rxjs';

/**
 * Nível até onde o DNE resolveu o CEP — governa quais campos do endereço vêm como âncora
 * (read-only) e quais ficam editáveis. Cascata: `logradouro` (mais específico) → `bairro` →
 * `distrito` → `cidade` (faixa ou CEP único de município). O contrato do Geo expõe o nível como
 * `string`; este union é o roster conhecido, e o valor fora dele vale como o nível mais raso.
 */
export type NivelResolucao = 'logradouro' | 'bairro' | 'distrito' | 'cidade';

/** Roster ordenado do mais específico ao mais raso (cascata do DNE). */
export const NIVEIS_RESOLUCAO: readonly NivelResolucao[] = [
  'logradouro',
  'bairro',
  'distrito',
  'cidade',
] as const;

/** Referência estruturada de cidade ao Geo (espelha `CidadeReferenciaInput`). */
export interface CidadeRef {
  readonly codigoIbge: string;
  readonly nome: string;
  readonly uf: string;
}

/**
 * Valor do componente de endereço — o endereço que ele compõe a partir do CEP (autofill) ou da
 * cidade escolhida sem CEP, na forma de `EnderecoGeoInput`. `null` = sem endereço.
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

/** O CEP resolvido pelo Geo. É estrutural: o `CepResolvidoDto` do Geo satisfaz esta forma. */
export interface CepEncontrado {
  readonly cep: string;
  readonly tipo?: string | null;
  readonly logradouro?: string | null;
  readonly complemento?: string | null;
  readonly bairro?: string | null;
  readonly distrito?: string | null;
  /** O nome da cidade. */
  readonly cidade: string;
  readonly codigoIbge: string;
  readonly uf: string;
  readonly latitude?: string | number | null;
  readonly longitude?: string | number | null;
  readonly nivelResolucao?: string | null;
  readonly origem?: string | null;
}

/** Resolve um CEP de 8 dígitos ao endereço do DNE; o CEP inexistente é a falha 404. */
export type BuscaDeCep = (cep: string) => Observable<ApiResult<CepEncontrado>>;

/**
 * A busca de CEP que o componente de endereço usa. A biblioteca de componentes não fala com a
 * API: quem hospeda o endereço provê a busca, com a de municípios (`BUSCA_DE_MUNICIPIOS`) para o
 * endereço sem CEP.
 */
export const BUSCA_DE_CEP = new InjectionToken<BuscaDeCep>('BUSCA_DE_CEP');

/**
 * Normaliza o `nivelResolucao` (contrato `string`) para o roster conhecido.
 * Valores fora do roster caem no nível mais raso (`cidade`) — o formulário trata como "só a
 * cidade é âncora", mantendo o resto editável.
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
 * Conjunto de campos ancorados (read-only) para um dado `nivelResolucao`, por ADR-0096. Um campo
 * de rank `r` é âncora quando a resolução alcançou aquele nível ou um mais fino — isto é,
 * `rank(campo) >= rank(nivel)`, sendo `cep` e `cidade` sempre âncora quando há resolução.
 * `numero`/`complemento` nunca são âncora (dado próprio, fora do DNE). Sem resolução (entrada
 * manual), nada é ancorado.
 *
 * | nivelResolucao | âncoras (read-only)                       |
 * |----------------|-------------------------------------------|
 * | logradouro     | cep, logradouro, bairro, distrito, cidade |
 * | bairro         | cep, bairro, distrito, cidade             |
 * | distrito       | cep, distrito, cidade                     |
 * | cidade         | cep, cidade                               |
 */
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
