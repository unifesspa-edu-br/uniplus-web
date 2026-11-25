import { beforeEach, describe, expect, it } from 'vitest';

import {
  CenarioDoEditorDeFormulario,
  conteudo,
  FAMILIA,
  fato,
  item,
} from './editor-de-formulario.testing';

describe('EditorDeFormularioComponent: no processo', () => {
  let cenario: CenarioDoEditorDeFormulario;

  beforeEach(() => {
    cenario = CenarioDoEditorDeFormulario.preparar();
    cenario.montar();
  });

  it('as condições citam os fatos da inscrição, que não são gravados, e a seção de pressupostos some', () => {
    cenario.entrada('finalidade', 'HABILITACAO');
    cenario.entrada('catalogo', [fato('A'), fato('B'), fato('C'), fato('DA_INSCRICAO')]);
    cenario.entrada('fatosDaInscricao', ['DA_INSCRICAO']);
    cenario.detectar();

    // O campo A é o primeiro: só o fato da inscrição é conhecido antes dele, e a condição nova nasce sobre ele.
    const alternativa = [
      ...cenario.tela.querySelectorAll('insc-item-do-formulario'),
    ][0].querySelector(
      'insc-editor-de-condicoes:last-of-type button:last-of-type',
    ) as HTMLButtonElement;
    alternativa.click();
    cenario.detectar();

    const editado = cenario.emitidos.at(-1);
    expect(editado?.itens?.find((i) => i.fatoCodigo === 'A')?.regras.exibicao?.[0]?.[0]?.fato).toBe(
      'DA_INSCRICAO',
    );
    expect(editado?.pressupostos ?? [], 'o fato da inscrição não é gravado').toEqual([]);
    expect(cenario.tela.textContent).not.toContain('Fatos pressupostos');
    expect(
      cenario.ofertadosEm('f-pagina-S1-acrescentar'),
      'o fato que a inscrição coleta não é oferecido como campo',
    ).not.toContain('DA_INSCRICAO');
  });

  it('o campo de membro de um grupo da inscrição não é citável nas outras finalidades', () => {
    cenario.entrada('finalidade', 'HABILITACAO');
    cenario.entrada('catalogo', [
      fato('A'),
      fato('B'),
      fato('C'),
      { ...fato('PARENTESCO'), escopo: 'MEMBRO_GRUPO' },
    ]);
    cenario.entrada('fatosDaInscricao', ['PARENTESCO']);
    cenario.detectar();

    const alternativa = [
      ...cenario.tela.querySelectorAll('insc-item-do-formulario'),
    ][0].querySelector(
      'insc-editor-de-condicoes:last-of-type button:last-of-type',
    ) as HTMLButtonElement;

    expect(alternativa.disabled, 'só o fato de membro viria antes, e ele não é citável').toBe(true);

    const grupoNovo = [
      ...((cenario.tela.querySelector('#f-pagina-S1-grupo-campo') as HTMLSelectElement | null)
        ?.options ?? []),
    ].map((o) => o.value);
    expect(
      grupoNovo,
      'nem por isso o fato de membro da inscrição volta a ser coletável aqui',
    ).not.toContain('PARENTESCO');
  });

  it('na própria inscrição, os fatos dela não viram conhecidos antes: o primeiro campo não cita o que vem depois', () => {
    cenario.entrada('fatosDaInscricao', ['A', 'B', 'C']);
    cenario.detectar();

    const alternativa = [
      ...cenario.tela.querySelectorAll('insc-item-do-formulario'),
    ][0].querySelector(
      'insc-editor-de-condicoes:last-of-type button:last-of-type',
    ) as HTMLButtonElement;

    expect(alternativa.disabled, 'nada vem antes do primeiro campo da inscrição').toBe(true);
  });

  it('o campo citado por negação noutro formulário fica obrigatório também aqui', () => {
    cenario.entrada('fatosQueExigemRespostaPorFora', ['C']);
    cenario.detectar();

    const opcional = (
      cenario.tela.querySelector('#f-item-C-obrigatoriedade') as HTMLSelectElement
    ).querySelector('option[value="NUNCA"]') as HTMLOptionElement;
    expect(opcional.disabled).toBe(true);
  });

  it('o fato de outra finalidade não é oferecido, e o campo travado não sai e diz por quê', () => {
    cenario.entrada('catalogo', [fato('A'), fato('B'), fato('C'), fato('DE_OUTRA'), fato('LIVRE')]);
    cenario.entrada('fatosIndisponiveis', ['DE_OUTRA']);
    cenario.entrada(
      'remocoesTravadas',
      new Map([['A', 'Uma exigência documental cita este campo.']]),
    );
    cenario.detectar();

    const ofertados = cenario.ofertadosEm('f-pagina-S1-acrescentar');
    expect(ofertados).toContain('LIVRE');
    expect(ofertados).not.toContain('DE_OUTRA');

    const remover = [...cenario.tela.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === 'Remover o campo Campo A',
    ) as HTMLButtonElement;
    expect(remover.disabled).toBe(true);
    expect(cenario.tela.textContent).toContain('Uma exigência documental cita este campo.');
  });

  it('o grupo cujo campo está travado não pode ser removido, e diz por quê', () => {
    const grupo = { ...FAMILIA, subitens: [item('RENDA', 0, { paginaCodigo: null })] };
    cenario.entrada('conteudo', { ...conteudo, grupos: [grupo] });
    cenario.entrada(
      'remocoesTravadas',
      new Map([['RENDA', 'Uma exigência documental cita a renda.']]),
    );
    cenario.detectar();

    const remover = [...cenario.tela.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === 'Remover o grupo Família',
    ) as HTMLButtonElement;
    expect(remover.disabled).toBe(true);
    expect(cenario.tela.textContent).toContain(
      'O grupo não pode ser removido: Uma exigência documental cita a renda.',
    );
  });
});
