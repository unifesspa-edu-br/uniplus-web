import { beforeEach, describe, expect, it } from 'vitest';

import { CenarioDoEditorDeFormulario, conteudo, fato, item } from './editor-de-formulario.testing';
import { paginaNova } from './modelo/constantes';
import type { ConteudoDoFormulario, FatoDoFormulario } from './modelo/tipos';

describe('EditorDeFormularioComponent: acréscimo de campos, pressupostos e grupos', () => {
  let cenario: CenarioDoEditorDeFormulario;

  beforeEach(() => {
    cenario = CenarioDoEditorDeFormulario.preparar();
    cenario.montar();
  });

  it('anuncia a recusa de termo longo e mantém a escolha', () => {
    const escolha = prepararTermoLongo(cenario);
    escolha.value = 'T1';
    escolha.dispatchEvent(new Event('change'));
    cenario.detectar();
    exigirTermo(cenario);
    expect(cenario.status()).toBe(
      'O código formado a partir do nome deste termo passaria de 60 caracteres, e o termo não pode ser exigido. O nome é definido no cadastro de termos de consentimento.',
    );
    expect(escolha.value).toBe('T1');
    expect(cenario.emitidos).toEqual([]);
  });

  it('o fato que aguarda a aprovação da proteção de dados aparece indisponível, com o motivo, e não se escolhe', () => {
    prepararFatoIndisponivel(cenario);
    verificarFatoIndisponivel(cenario);
  });

  it('recusa acrescentar município sem campo de UF antes, dizendo o que fazer', () => {
    prepararMunicipioSemUf(cenario);
    verificarMunicipioSemUf(cenario);
  });

  it('acrescenta o campo escolhido pela busca, que só oferece os fatos cujo nome casa com o termo', () => {
    prepararBuscaDeCampo(cenario);
    verificarBuscaDeCampo(cenario);
  });

  it('o pressuposto é escolhido pela busca, entre os fatos que podem ser pressupostos, e o foco volta ao campo', async () => {
    prepararBuscaDePressuposto(cenario);
    await verificarBuscaDePressuposto(cenario);
  });

  it('cria o grupo pela seção e, ao incluir o candidato, põe o parentesco primeiro e o mínimo em um', () => {
    prepararCatalogoDoGrupo(cenario);
    verificarCriacaoDeGrupo(cenario);
  });

  it('desmarcar o candidato tira a inclusão e mantém o parentesco', () => {
    prepararGrupoComCandidato(cenario);
    verificarExclusaoDoCandidato(cenario);
  });

  it('a caixa do candidato como membro volta a desmarcada quando a inclusão é recusada', () => {
    prepararGruposParaRecusa(cenario);
    verificarRecusaDoCandidato(cenario);
  });
});

function prepararTermoLongo(cenario: CenarioDoEditorDeFormulario): HTMLSelectElement {
  const revisao = paginaNova('REVISAO', 'Revisão e aceite', 'REVISAO_E_ACEITE');
  cenario.entrada('conteudo', { ...conteudo, paginas: [revisao] });
  cenario.entrada('termosDisponiveis', [
    { termoId: 'T1', nome: 'a'.repeat(61), versoes: [{ versaoId: 'V1', rotulo: '1' }] },
  ]);
  cenario.detectar();
  return cenario.tela.querySelector('#f-termo') as HTMLSelectElement;
}

function exigirTermo(cenario: CenarioDoEditorDeFormulario): void {
  [...cenario.tela.querySelectorAll('button')]
    .find((botao) => botao.textContent?.includes('Exigir termo'))
    ?.click();
  cenario.detectar();
}

function verificarFatoIndisponivel(cenario: CenarioDoEditorDeFormulario): void {
  const ofertados = cenario.ofertadosEm('f-pagina-S1-acrescentar');
  expect(ofertados).toEqual(['RENDA — aguarda a aprovação da proteção de dados']);
  expect(
    cenario.tela
      .querySelector('#f-pagina-S1-acrescentar [role="option"]')
      ?.getAttribute('aria-disabled'),
  ).toBe('true');

  cenario.escolherEm('f-pagina-S1-acrescentar', 'RENDA — aguarda a aprovação da proteção de dados');
  cenario.acrescentarCampo();
  expect(cenario.emitidos).toEqual([]);
}

function verificarMunicipioSemUf(cenario: CenarioDoEditorDeFormulario): void {
  expect(cenario.emitidos).toEqual([]);
  expect(cenario.status()).toContain('Acrescente antes o campo de UF');
}

function verificarBuscaDeCampo(cenario: CenarioDoEditorDeFormulario): void {
  expect(cenario.ofertadosEm('f-pagina-S1-acrescentar', 'renda')).toEqual([
    'RENDA_FAMILIAR',
    'RENDA_PROPRIA',
  ]);
  expect(cenario.ofertadosEm('f-pagina-S1-acrescentar', 'inexistente')).toEqual([]);
  expect(cenario.tela.querySelector('#f-pagina-S1-acrescentar')?.textContent).toContain(
    'Nenhum fato do candidato casa com o que você digitou.',
  );

  cenario.escolherEm('f-pagina-S1-acrescentar', 'RENDA_PROPRIA', 'propria');
  cenario.acrescentarCampo();

  expect(cenario.emitidos.at(-1)?.itens?.map((i) => i.fatoCodigo)).toEqual([
    'A',
    'B',
    'C',
    'RENDA_PROPRIA',
  ]);
  expect(cenario.status()).toBe('Campo “RENDA_PROPRIA” acrescentado ao fim de Escolaridade.');
}

async function verificarBuscaDePressuposto(cenario: CenarioDoEditorDeFormulario): Promise<void> {
  // O fato de outra finalidade não é campo aqui, mas pode vir do formulário anterior.
  expect(cenario.ofertadosEm('f-pressuposto')).toEqual(['DE_OUTRA', 'LIVRE']);
  expect(cenario.ofertadosEm('f-pagina-S1-acrescentar')).toEqual(['LIVRE']);

  cenario.escolherEm('f-pressuposto', 'LIVRE', 'liv');
  (
    [...cenario.tela.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Acrescentar pressuposto'),
    ) as HTMLButtonElement
  ).click();
  cenario.detectar();
  await cenario.fixture.whenStable();

  expect(cenario.emitidos.at(-1)?.pressupostos).toEqual(['LIVRE']);
  expect(
    document.activeElement,
    'o foco vai ao campo de texto, não ao hospedeiro do combobox',
  ).toBe(cenario.tela.querySelector('#f-pressuposto [role="combobox"]'));
}

function verificarCriacaoDeGrupo(cenario: CenarioDoEditorDeFormulario): void {
  const rotulo = cenario.tela.querySelector('#f-pagina-S1-grupo-rotulo') as HTMLInputElement;
  rotulo.value = 'Composição familiar';
  rotulo.dispatchEvent(new Event('input'));
  const campo = cenario.tela.querySelector('#f-pagina-S1-grupo-campo') as HTMLSelectElement;
  campo.value = 'RENDA';
  campo.dispatchEvent(new Event('change'));
  cenario.detectar();
  (
    [...cenario.tela.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Acrescentar grupo repetível'),
    ) as HTMLButtonElement
  ).click();
  cenario.detectar();

  const grupo = cenario.emitidos.at(-1)?.grupos?.[0];
  expect(grupo?.codigo).toBe('COMPOSICAO_FAMILIAR');
  expect(cenario.status()).toBe(
    'Grupo repetível “Composição familiar” acrescentado ao fim de Escolaridade.',
  );

  const incluir = [...cenario.tela.querySelectorAll('input[type="checkbox"]')].find((c) =>
    c.parentElement?.textContent?.includes('O próprio candidato é um dos membros'),
  ) as HTMLInputElement;
  incluir.click();
  cenario.detectar();

  const comCandidato = cenario.emitidos.at(-1)?.grupos?.[0];
  expect(comCandidato?.ocorrencias.minimo).toBe(1);
  expect(comCandidato?.subitens.map((c) => c.fatoCodigo)).toEqual(['PARENTESCO', 'RENDA']);
}

function verificarExclusaoDoCandidato(cenario: CenarioDoEditorDeFormulario): void {
  const caixa = [...cenario.tela.querySelectorAll('input[type="checkbox"]')].find((c) =>
    c.parentElement?.textContent?.includes('O próprio candidato é um dos membros'),
  ) as HTMLInputElement;
  caixa.click();
  cenario.detectar();

  const grupo = cenario.emitidos.at(-1)?.grupos?.[0];
  expect(grupo?.ocorrencias.incluiCandidato).toBe(false);
  expect(grupo?.subitens.map((c) => c.fatoCodigo)).toEqual(['PARENTESCO', 'RENDA']);
  expect(cenario.status()).toBe('O candidato deixa de ser um dos membros.');
}

function verificarRecusaDoCandidato(cenario: CenarioDoEditorDeFormulario): void {
  const caixas = [...cenario.tela.querySelectorAll('input[type="checkbox"]')].filter((c) =>
    c.parentElement?.textContent?.includes('O próprio candidato é um dos membros'),
  ) as HTMLInputElement[];
  caixas[1].click();
  cenario.detectar();

  expect(caixas[1].checked).toBe(false);
  expect(cenario.status()).toContain('O parentesco já é campo de outro grupo');
}

function prepararFatoIndisponivel(cenario: CenarioDoEditorDeFormulario): void {
  cenario.entrada('catalogo', [
    fato('A'),
    fato('B'),
    fato('C'),
    { ...fato('RENDA'), protecaoAprovada: false },
  ]);
  cenario.detectar();
}

function prepararMunicipioSemUf(cenario: CenarioDoEditorDeFormulario): void {
  cenario.entrada('catalogo', [
    fato('A'),
    fato('B'),
    fato('C'),
    {
      ...fato('MUNICIPIO'),
      dominio: { codigo: 'OPCAO', rotulo: 'OPCAO' },
      fonteValores: { codigo: 'MUNICIPIOS', rotulo: 'MUNICIPIOS' },
    },
  ]);
  cenario.detectar();
  cenario.escolherEm('f-pagina-S1-acrescentar', 'MUNICIPIO');
  cenario.acrescentarCampo();
}

function prepararBuscaDeCampo(cenario: CenarioDoEditorDeFormulario): void {
  cenario.entrada('catalogo', [
    fato('A'),
    fato('B'),
    fato('C'),
    fato('RENDA_FAMILIAR'),
    fato('RENDA_PROPRIA'),
    fato('ESCOLA'),
  ]);
  cenario.detectar();
}

function prepararBuscaDePressuposto(cenario: CenarioDoEditorDeFormulario): void {
  cenario.entrada('finalidade', 'ISENCAO');
  cenario.entrada('catalogo', [
    fato('A'),
    fato('B'),
    fato('C'),
    fato('DE_OUTRA'),
    fato('LIVRE'),
    { ...fato('INATIVO'), ativo: false },
  ]);
  cenario.entrada('fatosIndisponiveis', ['DE_OUTRA']);
  cenario.detectar();
}

function prepararCatalogoDoGrupo(cenario: CenarioDoEditorDeFormulario): void {
  const membro = (codigo: string): FatoDoFormulario => ({
    ...fato(codigo),
    escopo: 'MEMBRO_GRUPO',
  });
  cenario.entrada('catalogo', [
    fato('A'),
    fato('B'),
    fato('C'),
    membro('RENDA'),
    {
      ...membro('PARENTESCO'),
      dominio: { codigo: 'OPCAO', rotulo: 'OPCAO' },
      valoresDominio: ['PROPRIO_CANDIDATO'],
    },
  ]);
  cenario.detectar();
}

function prepararGrupoComCandidato(cenario: CenarioDoEditorDeFormulario): void {
  const grupoComCandidato: NonNullable<ConteudoDoFormulario['grupos']>[number] = {
    codigo: 'FAMILIA',
    ordem: 3,
    rotulo: 'Família',
    paginaCodigo: 'S1',
    ocorrencias: { minimo: 1, maximo: null, incluiCandidato: true },
    regras: { exibicao: null, obrigatoriedade: { tipo: 'SEMPRE', predicado: null } },
    subitens: [
      item('PARENTESCO', 0, { paginaCodigo: null }),
      item('RENDA', 1, { paginaCodigo: null }),
    ],
  };
  cenario.entrada('conteudo', { ...conteudo, grupos: [grupoComCandidato] });
  cenario.detectar();
}

function prepararGruposParaRecusa(cenario: CenarioDoEditorDeFormulario): void {
  const grupoDe = (
    codigo: string,
    campos: string[],
  ): NonNullable<ConteudoDoFormulario['grupos']>[number] => ({
    codigo,
    ordem: 3,
    rotulo: codigo,
    paginaCodigo: 'S1',
    ocorrencias: { minimo: 0, maximo: null, incluiCandidato: false },
    regras: { exibicao: null, obrigatoriedade: { tipo: 'SEMPRE', predicado: null } },
    subitens: campos.map((c, i) => item(c, i, { paginaCodigo: null })),
  });
  cenario.entrada('conteudo', {
    ...conteudo,
    grupos: [grupoDe('A_GRUPO', ['PARENTESCO']), { ...grupoDe('B_GRUPO', ['RENDA']), ordem: 4 }],
  });
  cenario.detectar();
}
