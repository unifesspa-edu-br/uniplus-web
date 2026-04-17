import type { KeycloakTokenParsed } from 'keycloak-js';

/**
 * Claims do access token do realm `unifesspa`, incluindo os
 * atributos adicionados pelo scope `uniplus-profile` (protocol
 * mappers `cpf` e `nomeSocial`).
 *
 * Define a forma esperada do JWT e permite consumir o token via
 * dot-notation tipado, sem acessos por chave nem coerções ad-hoc.
 */
export interface UniPlusTokenClaims extends KeycloakTokenParsed {
  /** `sub` — identificador opaco do usuário no Keycloak. */
  sub?: string;
  /** `preferred_username` — login normalizado (admin, gestor, etc.). */
  preferred_username?: string;
  /** Nome completo (`given_name family_name`), populado pelo Keycloak. */
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
  /** CPF numérico puro, injetado pelo scope `uniplus-profile`. */
  cpf?: string;
  /** Nome social do usuário, injetado pelo scope `uniplus-profile`. */
  nomeSocial?: string;
  /** Roles do realm para o client/scope corrente. */
  realm_access?: {
    roles: string[];
  };
}
