import { ComponentFixture } from '@angular/core/testing';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EscolhaComExplicacaoComponent } from './escolha-com-explicacao';
import {
  type EntradasDaEscolha,
  OPCOES,
  RECUSA,
  aplicar,
  montar,
  recusaDaOpcao,
} from './escolha-com-explicacao.testing';

const COM_OPCOES: Partial<EntradasDaEscolha> = {
  opcoes: OPCOES,
  instrucao: 'Escolha uma opção.',
  textoDeObrigatoriedade: '(obrigatório)',
};

describe('EscolhaComExplicacaoComponent: acessibilidade', () => {
  let fixture: ComponentFixture<EscolhaComExplicacaoComponent>;

  beforeEach(() => {
    fixture = montar();
  });

  afterEach(() => fixture.nativeElement.remove());

  async function violacoes(): Promise<unknown[]> {
    const resultado = await axe.run(fixture.nativeElement, {
      rules: { region: { enabled: false } },
    });
    return resultado.violations;
  }

  it.each<[string, Partial<EntradasDaEscolha>]>([
    ['opções, nenhuma marcada', COM_OPCOES],
    ['uma opção marcada', { ...COM_OPCOES, valor: 'NENHUM' }],
    ['recusa ativa', { ...COM_OPCOES, recusas: [RECUSA] }],
    ['erro local', { ...COM_OPCOES, erroLocal: 'Escolha uma opção.' }],
    ['recusa de uma opção', { ...COM_OPCOES, recusas: [recusaDaOpcao('NENHUM'), RECUSA] }],
    [
      'recusa a conferir com nota',
      { ...COM_OPCOES, recusasAConferir: [RECUSA], notaDasRecusasAConferir: 'A conferir.' },
    ],
    ['opções ainda carregando', { opcoes: [], situacao: 'carregando' }],
    ['falha ao carregar as opções', { opcoes: [], situacao: 'falhou', recusas: [RECUSA] }],
    ['lista vazia', { opcoes: [] }],
    ['opção sem explicação', { opcoes: [{ codigo: 'A', rotulo: 'Opção A' }] }],
  ])('não tem violações com %s', async (_nome, entradas) => {
    aplicar(fixture, entradas);

    expect(await violacoes()).toEqual([]);
  });

  it('cada opção tem nome acessível e a explicação como descrição', () => {
    aplicar(fixture, COM_OPCOES);

    const campo = fixture.nativeElement.querySelector('#grupo-opcao-TODOS') as HTMLInputElement;
    const rotulos = campo.labels;
    const descricao = document.getElementById('grupo-explicacao-TODOS');
    expect(rotulos?.[0].textContent?.trim()).toBe('Todos os recursos');
    expect(descricao?.textContent?.trim()).toBe('Todos os recursos suspendem o resultado.');
    expect(campo.getAttribute('aria-describedby')).toContain('grupo-explicacao-TODOS');
  });
});
