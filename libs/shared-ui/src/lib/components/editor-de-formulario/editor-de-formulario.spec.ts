import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { EditorDeFormularioComponent } from './editor-de-formulario';
import type { ConteudoDoFormulario, FatoDoFormulario, ItemDoFormulario } from './formulario-editavel';

const fato = (codigo: string): FatoDoFormulario => ({
  codigo,
  nome: codigo,
  dominio: 'BOOLEANO',
  binding: `CAMPO_FORMULARIO:${codigo}`,
  cardinalidade: 'ESCALAR',
  fonteValores: null,
  escopo: 'CANDIDATO',
  ativo: true,
});

const item = (fatoCodigo: string, ordem: number, extra: Partial<ItemDoFormulario> = {}): ItemDoFormulario => ({
  fatoCodigo,
  ordem,
  rotulo: `Campo ${fatoCodigo}`,
  tipoRenderizacao: 'BOOLEANO',
  obrigatoriedade: 'SEMPRE',
  precondicao: null,
  etapaCodigo: 'S1',
  pedirConfirmacao: false,
  ...extra,
});

const conteudo: ConteudoDoFormulario = {
  titulo: null,
  etapas: [{ codigo: 'S1', ordem: 0, tipo: 'SECAO', bloco: null, titulo: 'Escolaridade', descricao: null, aviso: null }],
  itens: [item('A', 0), item('B', 1, { precondicao: [[{ fato: 'A', operador: 'IGUAL', valor: true }]] }), item('C', 2)],
  termos: [],
  pressupostos: [],
  grupos: [],
};

describe('EditorDeFormularioComponent', () => {
  let fixture: ComponentFixture<EditorDeFormularioComponent>;
  let emitidos: ConteudoDoFormulario[];

  beforeEach(() => {
    fixture = TestBed.createComponent(EditorDeFormularioComponent);
    fixture.componentRef.setInput('conteudo', conteudo);
    fixture.componentRef.setInput('catalogo', [fato('A'), fato('B'), fato('C')]);
    fixture.componentRef.setInput('finalidade', 'INSCRICAO');
    fixture.componentRef.setInput('idBase', 'f');
    emitidos = [];
    fixture.componentInstance.conteudoChange.subscribe((novo) => {
      emitidos.push(novo);
      fixture.componentRef.setInput('conteudo', novo);
    });
    fixture.detectChanges();
  });

  const tela = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const status = (): string => tela().querySelector('[role="status"]')?.textContent?.trim() ?? '';
  const clicar = (id: string): void => (tela().querySelector(`#${id}`) as HTMLButtonElement).click();

  it('mostra na região de status a recusa do movimento que quebraria uma condição, sem mexer no conteúdo', () => {
    clicar('f-item-B-subir');
    fixture.detectChanges();

    expect(emitidos).toEqual([]);
    expect(status()).toBe('“Campo B” cita “A”, que ficaria depois. Mova primeiro o campo citado.');
  });

  it('anuncia a posição nova do campo movido', () => {
    clicar('f-item-C-subir');
    fixture.detectChanges();

    expect(emitidos).toHaveLength(1);
    expect(status()).toBe('“Campo C” movido para a posição 2 de 3 em Escolaridade.');
  });

  it('ligar o impedimento cita a resposta do próprio campo e torna o campo obrigatório', () => {
    const opcional: ConteudoDoFormulario = { ...conteudo, itens: [item('A', 0, { obrigatoriedade: 'NUNCA' })] };
    fixture.componentRef.setInput('conteudo', opcional);
    fixture.detectChanges();

    const caixa = [...tela().querySelectorAll('input[type="checkbox"]')].find((c) =>
      c.parentElement?.textContent?.includes('Impedir a inscrição'),
    ) as HTMLInputElement;
    caixa.click();
    fixture.detectChanges();

    const ligado = emitidos.at(-1)?.itens?.[0];
    expect(ligado?.obrigatoriedade).toBe('SEMPRE');
    expect(ligado?.impedimento?.quando?.[0]?.[0]?.fato).toBe('A');
  });

  it('recusa acrescentar município sem campo de UF antes, dizendo o que fazer', () => {
    fixture.componentRef.setInput('catalogo', [fato('A'), fato('B'), fato('C'), { ...fato('MUNICIPIO'), dominio: 'CATEGORICO', fonteValores: 'GEO_MUNICIPIO' }]);
    fixture.detectChanges();
    const combo = tela().querySelector('#f-etapa-S1-acrescentar') as HTMLSelectElement;
    combo.value = 'MUNICIPIO';
    combo.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const botao = [...tela().querySelectorAll('button')].find((b) => b.textContent?.includes('Acrescentar campo')) as HTMLButtonElement;
    botao.click();
    fixture.detectChanges();

    expect(emitidos).toEqual([]);
    expect(status()).toContain('Acrescente antes o campo de UF');
  });

  it('cria o grupo pela seção e, ao incluir o candidato, põe o parentesco primeiro e o mínimo em um', () => {
    const membro = (codigo: string): FatoDoFormulario => ({ ...fato(codigo), escopo: 'MEMBRO_GRUPO' });
    fixture.componentRef.setInput('catalogo', [fato('A'), fato('B'), fato('C'), membro('RENDA'), { ...membro('PARENTESCO'), dominio: 'CATEGORICO', valoresDominio: ['PROPRIO_CANDIDATO'] }]);
    fixture.detectChanges();

    const rotulo = tela().querySelector('#f-etapa-S1-grupo-rotulo') as HTMLInputElement;
    rotulo.value = 'Composição familiar';
    rotulo.dispatchEvent(new Event('input'));
    const campo = tela().querySelector('#f-etapa-S1-grupo-campo') as HTMLSelectElement;
    campo.value = 'RENDA';
    campo.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    ([...tela().querySelectorAll('button')].find((b) => b.textContent?.includes('Acrescentar grupo repetível')) as HTMLButtonElement).click();
    fixture.detectChanges();

    const grupo = emitidos.at(-1)?.grupos?.[0];
    expect(grupo?.codigo).toBe('COMPOSICAO_FAMILIAR');
    expect(status()).toBe('Grupo repetível “Composição familiar” acrescentado ao fim de Escolaridade.');

    const incluir = [...tela().querySelectorAll('input[type="checkbox"]')].find((c) =>
      c.parentElement?.textContent?.includes('O próprio candidato é um dos membros'),
    ) as HTMLInputElement;
    incluir.click();
    fixture.detectChanges();

    const comCandidato = emitidos.at(-1)?.grupos?.[0];
    expect(comCandidato?.minimo).toBe(1);
    expect(comCandidato?.subitens.map((c) => c.fatoCodigo)).toEqual(['PARENTESCO', 'RENDA']);
  });

  it('a caixa do candidato como membro volta a desmarcada quando a inclusão é recusada', () => {
    const grupoDe = (codigo: string, campos: string[]): NonNullable<ConteudoDoFormulario['grupos']>[number] => ({
      codigo, ordem: 3, rotulo: codigo, etapaCodigo: 'S1', minimo: 0, maximo: null, exibicao: null, obrigatoriedade: 'SEMPRE',
      predicadoObrigatoriedade: null, incluiCandidato: false, subitens: campos.map((c, i) => item(c, i, { etapaCodigo: null })),
    });
    fixture.componentRef.setInput('conteudo', { ...conteudo, grupos: [grupoDe('A_GRUPO', ['PARENTESCO']), { ...grupoDe('B_GRUPO', ['RENDA']), ordem: 4 }] });
    fixture.detectChanges();

    const caixas = [...tela().querySelectorAll('input[type="checkbox"]')].filter((c) =>
      c.parentElement?.textContent?.includes('O próprio candidato é um dos membros'),
    ) as HTMLInputElement[];
    caixas[1].click();
    fixture.detectChanges();

    expect(caixas[1].checked).toBe(false);
    expect(status()).toContain('O parentesco já é campo de outro grupo');
  });
});
