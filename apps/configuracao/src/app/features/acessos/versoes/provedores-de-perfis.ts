import type { Provider } from '@angular/core';
import { EdicaoDosPerfis } from '../edicao-dos-perfis';
import { AtivacaoDoPerfil } from './ativacao-do-perfil';
import { CatalogoDePermissoesStore } from './catalogo-de-permissoes.store';
import { EnvioDaVersao } from './envio-da-versao';
import { EscritaDoPerfil } from './escrita-do-perfil';

/** O que as telas de perfil compartilham para escrever: o catálogo, a escrita em curso, o envio e o formulário. */
export const PROVEDORES_DE_ESCRITA_DE_PERFIS: readonly Provider[] = [
  CatalogoDePermissoesStore,
  EscritaDoPerfil,
  EnvioDaVersao,
  EdicaoDosPerfis,
  AtivacaoDoPerfil,
];
