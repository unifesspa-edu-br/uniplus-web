import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { RecusaDoCampo } from '../recusa-do-campo/recusa-do-campo';
import {
  EscolhaComExplicacaoComponent,
  type OpcaoDeEscolhaComExplicacao,
  type SituacaoDasOpcoes,
} from './escolha-com-explicacao';
import type { RecusaDaEscolha } from './recusas-da-escolha';

export const OPCOES: readonly OpcaoDeEscolhaComExplicacao[] = [
  {
    codigo: 'TODOS',
    rotulo: 'Todos os recursos',
    descricao: 'Todos os recursos suspendem o resultado.',
  },
  {
    codigo: 'NENHUM',
    rotulo: 'Nenhum recurso',
    descricao: 'Nenhum recurso suspende o resultado.',
  },
  {
    codigo: 'DECIDE',
    rotulo: 'A unidade decide',
    descricao: 'A unidade decide, recurso a recurso, se o resultado fica suspenso.',
  },
];

/** A mesma recusa, apontada a uma opção. */
export function recusaDaOpcao(opcao: string, codigo = RECUSA.codigo): RecusaDaEscolha {
  return { ...RECUSA, codigo, mensagem: `${RECUSA.mensagem} (${opcao})`, opcao };
}

export const RECUSA: RecusaDoCampo = {
  codigo: 'uniplus.selecao.exemplo.escolha_obrigatoria',
  mensagem: 'Escolha o efeito do recurso.',
  pagina: 'https://exemplo.unifesspa.edu.br/erros/uniplus.selecao.exemplo.escolha_obrigatoria',
};

export interface EntradasDaEscolha {
  prefixoDoId: string;
  instrucao: string;
  opcoes: readonly OpcaoDeEscolhaComExplicacao[];
  valor: string;
  erroLocal: string | null;
  recusas: readonly RecusaDaEscolha[];
  recusasAConferir: readonly RecusaDaEscolha[];
  notaDasRecusasAConferir: string | null;
  textoDeObrigatoriedade: string | null;
  desabilitado: boolean;
  situacao: SituacaoDasOpcoes;
  textoSemOpcoes: string;
}

/** A tela montada no documento, com o grupo `grupo` e a legenda "Efeito do recurso". */
export function montar(): ComponentFixture<EscolhaComExplicacaoComponent> {
  TestBed.configureTestingModule({ imports: [EscolhaComExplicacaoComponent] });
  const fixture = TestBed.createComponent(EscolhaComExplicacaoComponent);
  document.body.appendChild(fixture.nativeElement);
  fixture.componentRef.setInput('prefixoDoId', 'grupo');
  fixture.componentRef.setInput('legenda', 'Efeito do recurso');
  return fixture;
}

/** Entrega as entradas informadas ao componente e redesenha. */
export function aplicar(
  fixture: ComponentFixture<EscolhaComExplicacaoComponent>,
  entradas: Partial<EntradasDaEscolha>,
): void {
  for (const [nome, valor] of Object.entries(entradas)) {
    fixture.componentRef.setInput(nome, valor);
  }
  fixture.detectChanges();
}
