import { beforeEach, describe, expect, it } from 'vitest';
import { CenarioDoEditorDeFormulario, conteudo, FAMILIA } from '../editor-de-formulario.testing';
import { paginaNova } from '../modelo/constantes';

let cenario: CenarioDoEditorDeFormulario;

function botao(texto: string, raiz: ParentNode = cenario.tela): HTMLButtonElement {
  return [...raiz.querySelectorAll('button')].find((b) =>
    b.textContent?.includes(texto),
  ) as HTMLButtonElement;
}

function alterar(id: string, valor: string, evento = 'change'): void {
  const campo = cenario.tela.querySelector(`#${id}`) as HTMLInputElement;
  campo.value = valor;
  campo.dispatchEvent(new Event(evento));
  cenario.detectar();
}

function comPagina(codigo: string, titulo: string, bloco: string | null = null): void {
  const pagina = { ...paginaNova(codigo, titulo, bloco), ordem: 1 };
  cenario.entrada('conteudo', { ...conteudo, paginas: [...(conteudo.paginas ?? []), pagina] });
  cenario.detectar();
}

function ancestral(id: string, seletor: string): Element {
  return cenario.tela.querySelector(`#${id}`)?.closest(seletor) as Element;
}

describe('Ações do editor de formulário', () => {
  beforeEach(() => {
    cenario = CenarioDoEditorDeFormulario.preparar();
    cenario.montar();
  });

  it('acrescenta uma seção antes da revisão e anuncia a inclusão', () => {
    comPagina('REVISAO', 'Revisão', 'REVISAO_E_ACEITE');
    botao('Acrescentar seção').click();
    cenario.detectar();
    expect(cenario.emitidos.at(-1)?.paginas?.map((p) => p.apresentacao.titulo)).toEqual([
      'Escolaridade',
      'Nova seção',
      'Revisão',
    ]);
    expect(cenario.status()).toContain('Seção nova acrescentada');
  });

  it('acrescenta um bloco admitido e deixa de oferecê-lo', () => {
    botao('Acrescentar bloco “Comprovação documental”').click();
    cenario.detectar();
    expect(
      cenario.emitidos.at(-1)?.paginas?.some((p) => p.bloco === 'COMPROVACAO_DOCUMENTAL'),
    ).toBe(true);
    expect(cenario.status()).toContain('Bloco “Comprovação documental” acrescentado');
    expect(
      [...cenario.tela.querySelectorAll('button')].some((b) =>
        b.textContent?.includes('Acrescentar bloco “Comprovação documental”'),
      ),
    ).toBe(false);
  });

  it('remove um campo sem dependentes e anuncia a remoção', () => {
    const artigo = ancestral('f-item-C-titulo', 'article');
    botao('Remover', artigo).click();
    cenario.detectar();
    expect(cenario.emitidos.at(-1)?.itens?.map((i) => i.fatoCodigo)).toEqual(['A', 'B']);
    expect(cenario.status()).toBe('Campo “Campo C” removido de Escolaridade.');
  });

  it('recusa remover um campo citado por outro', () => {
    const artigo = ancestral('f-item-A-titulo', 'article');
    botao('Remover', artigo).click();
    cenario.detectar();
    expect(cenario.emitidos).toEqual([]);
    expect(cenario.status()).toContain('cita');
  });

  it('move uma seção e informa a nova posição', () => {
    comPagina('S2', 'Documentos');
    cenario.clicar('f-pagina-S2-subir');
    cenario.detectar();
    expect(cenario.status()).toBe('“Documentos” foi para a posição 1 de 2.');
  });

  it('remove uma seção vazia e mantém a seção com campos', () => {
    comPagina('S2', 'Documentos');
    const secao = ancestral('f-pagina-S2-nome', 'section');
    botao('Remover', secao).click();
    cenario.detectar();
    expect(cenario.emitidos.at(-1)?.paginas?.map((p) => p.codigo)).toEqual(['S1']);
    expect(cenario.status()).toBe('Documentos removida.');
  });

  it('remove um grupo e preserva os campos da seção', () => {
    cenario.entrada('conteudo', { ...conteudo, grupos: [FAMILIA] });
    cenario.detectar();
    const grupo = ancestral('f-grupo-FAMILIA-titulo', 'article');
    botao('Remover', grupo).click();
    cenario.detectar();
    expect(cenario.emitidos.at(-1)?.grupos).toEqual([]);
    expect(cenario.status()).toBe('Grupo “Família” removido de Escolaridade.');
  });

  it('exige a versão promovida de um termo selecionado', () => {
    comPagina('REVISAO', 'Revisão', 'REVISAO_E_ACEITE');
    cenario.entrada('termosDisponiveis', [
      { termoId: 'T1', nome: 'Consentimento', versoes: [{ versaoId: 'V1', rotulo: 'Versão 1' }] },
    ]);
    cenario.detectar();
    alterar('f-termo', 'T1');
    botao('Exigir termo').click();
    cenario.detectar();
    expect(cenario.emitidos.at(-1)?.termos?.[0]?.termo).toEqual({ termoId: 'T1', versaoId: 'V1' });
    expect(cenario.status()).toBe('Termo “Consentimento” exigido na revisão e aceite.');
  });
});
