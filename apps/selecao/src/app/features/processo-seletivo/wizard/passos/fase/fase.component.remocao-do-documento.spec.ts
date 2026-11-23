import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { criarGrupo, trocarQuantidadeMinima } from '../../shared/exigencias/composicao-dos-grupos';
import { CatalogoDeDocumentos } from '../cronograma/catalogos/catalogo-de-documentos.service';
import { fase, TIPOS_DOCUMENTO } from './fase.testing';
import { usarFase, type ContextoDaFase } from './fase-passo.testing';

const DOCUMENTOS = ['RG', 'CIN', 'Passaporte', 'Diploma'];

function preparar(tela: ContextoDaFase): string {
  const tipos = DOCUMENTOS.map((nome, indice) => ({
    ...TIPOS_DOCUMENTO[0],
    id: `documento-${indice}`,
    nome,
  }));
  TestBed.inject(CatalogoDeDocumentos).tiposDocumento.set(tipos);
  tela.comCronograma(fase({}));
  for (const tipo of tipos) {
    tela.documentos().escolherDocumento(tipo.id);
    tela.documentos().acrescentarDocumento();
  }
  return combinarDocumentos(tela);
}

function combinarDocumentos(tela: ContextoDaFase): string {
  const exigencias = tela.store.draft().documentos;
  const identificadores = exigencias.regrasDeComprovacao.map(
    (regra) => regra.identificadorNoRascunho,
  );
  const grupo = criarGrupo(exigencias, identificadores.slice(0, 3), 'grupo');
  tela.store.patchSection('documentos', trocarQuantidadeMinima(grupo, 'grupo', 2));
  tela.detectar();
  return identificadores[2];
}

function clicar(tela: ContextoDaFase, nome: string): void {
  const botoes = Array.from(tela.nativo.querySelectorAll<HTMLButtonElement>('dialog button'));
  const botao = botoes.find((item) => item.textContent?.trim() === nome);
  if (!botao) throw new Error(`Botão ${nome} não encontrado`);
  botao.click();
  tela.detectar();
}

describe('remoção de documento da combinação', () => {
  let tela: ContextoDaFase;
  usarFase((contexto) => {
    tela = contexto;
  });

  it('permite cancelar e depois confirmar a remoção', () => {
    const identificador = preparar(tela);
    const outraRegra = tela.store.draft().documentos.regrasDeComprovacao[0];
    const origem = document.createElement('button');
    document.body.appendChild(origem);
    conferirCancelamento(tela, identificador, origem);
    tela.documentos().removerDocumento(identificador, origem);
    tela.detectar();
    clicar(tela, 'Remover');
    expect(tela.exigencias().declaracoesDaFase()).toHaveLength(3);
    expect(tela.store.draft().documentos.regrasDeComprovacao[0]).toEqual(outraRegra);
    expect(tela.store.draft().documentos.regrasDeComprovacao[1].quantidadeMinima).toBe(2);
    origem.remove();
  });
});

function conferirCancelamento(
  tela: ContextoDaFase,
  identificador: string,
  origem: HTMLElement,
): void {
  const antes = tela.store.draft().documentos;
  origem.focus();
  tela.documentos().removerDocumento(identificador, origem);
  tela.detectar();
  expect(tela.nativo.querySelector('dialog')?.textContent).toContain('RG, CIN');
  clicar(tela, 'Cancelar');
  expect(tela.store.draft().documentos).toEqual(antes);
  expect(document.activeElement).toBe(origem);
}
