import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SituacaoInscricao } from '@uniplus/shared-data/selecao';

import { itemDaLista } from './inscricao-lista.model';
import { CenarioDaListaDeInscricoes, INSCRICOES, inscricao } from './inscricao-lista.page.testing';

describe('InscricaoListaPage', () => {
  let cenario: CenarioDaListaDeInscricoes;

  beforeEach(() => {
    cenario = CenarioDaListaDeInscricoes.preparar();
  });

  afterEach(() => cenario.restaurar());

  it('exibe estado de carregamento antes dos dados chegarem', () => {
    const indicador = cenario.tela().querySelector('.inscricao-spinner');
    expect(indicador?.getAttribute('role')).toBe('status');
    expect(indicador?.textContent).toContain('Carregando inscrições');
  });

  it('exibe ui-spinner durante o carregamento e o remove após os dados chegarem', async () => {
    expect(cenario.tela().querySelector('ui-spinner')).toBeTruthy();

    await cenario.carregar();

    expect(cenario.tela().querySelector('ui-spinner')).toBeNull();
  });

  it('exibe saudação com o nome do candidato autenticado', async () => {
    cenario.definirNome('Ana Silva');
    await cenario.carregar();

    expect(cenario.tela().querySelector('h1')?.textContent?.trim()).toContain('Olá, Ana Silva');
  });

  it('usa "Candidato" como fallback quando displayName está vazio', async () => {
    cenario.definirNome('');
    await cenario.carregar();

    expect(cenario.tela().querySelector('h1')?.textContent?.trim()).toContain('Olá, Candidato');
  });

  it('exibe o texto de apoio da página', async () => {
    await cenario.carregar();

    expect(cenario.tela().textContent).toContain('Aqui você acompanha todas as suas inscrições.');
  });

  it('exibe as inscrições após o carregamento', async () => {
    await cenario.carregar(INSCRICOES);

    expect(cenario.itens().length).toBe(INSCRICOES.length);
  });

  it('sem o nome do processo, que deixou de ser público, mostra um texto neutro', () => {
    expect(itemDaLista(inscricao('p9', SituacaoInscricao.rascunho, null)).nome).toBe(
      'Processo seletivo',
    );
  });

  it('cada inscrição mostra o curso escolhido, sem repetir o nome nem o CPF do titular', async () => {
    await cenario.carregar(INSCRICOES);

    const item = cenario.itens()[1];
    expect(item.textContent).toContain('Medicina (Bacharelado)');
    expect(item.textContent).not.toContain('1ª opção');
    expect(item.textContent).not.toContain('CPF');
  });

  it('com duas opções de curso, cada uma sai com a sua ordem', async () => {
    await cenario.carregar([
      {
        ...inscricao('p1', SituacaoInscricao.submetida, 'Medicina 2027'),
        opcoesDeCurso: [
          { ordem: 1, cursoNome: 'Direito', cursoGrau: 'Bacharelado' },
          { ordem: 2, cursoNome: 'Medicina', cursoGrau: 'Bacharelado' },
        ],
      },
    ]);

    const cursos = Array.from(cenario.tela().querySelectorAll('.inscricao-curso')).map((c) =>
      c.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(cursos).toEqual(['1ª opção Direito (Bacharelado)', '2ª opção Medicina (Bacharelado)']);
  });

  it('rascunho que ainda não escolheu curso diz que o curso não foi escolhido', async () => {
    await cenario.carregar([
      inscricao('p1', SituacaoInscricao.rascunho, 'Auxílio estudantil 2026'),
    ]);

    expect(cenario.itens()[0].textContent).toContain('Curso ainda não escolhido');
  });

  it('exibe alerta de erro com botão "Tentar novamente"', async () => {
    await cenario.falharOCarregamento();

    expect(cenario.tela().querySelector('.alert__title')?.textContent).toContain(
      'Não foi possível carregar as inscrições',
    );
    expect(cenario.botao('Tentar novamente')).toBeTruthy();
  });

  it('com o recurso em erro, a lista fica vazia em vez de lançar', async () => {
    await cenario.falharOCarregamento();

    expect(() => cenario.listaDoComponente()).not.toThrow();
    expect(cenario.listaDoComponente()).toEqual([]);
  });

  it('"Tentar novamente" recarrega e exibe a lista ao ter sucesso', async () => {
    await cenario.falharOCarregamento();

    cenario.botao('Tentar novamente')?.click();
    await cenario.assentar();

    await cenario.carregar(INSCRICOES);
    await cenario.macrotarefa();
    cenario.fixture.detectChanges();

    expect(cenario.tela().querySelector('ui-alert')).toBeFalsy();
    expect(cenario.itens().length).toBe(INSCRICOES.length);
  });

  it('"Tentar novamente" não usa disabled e mantém o foco no botão enquanto a leitura corre', async () => {
    await cenario.falharOCarregamento();
    const tentar = cenario.botao('Tentar novamente') as HTMLButtonElement;
    tentar.focus();

    tentar.click();
    await cenario.assentar();

    expect(tentar.disabled).toBe(false);
    expect(tentar.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(tentar);
    expect(cenario.situacaoDaNovaTentativa()).toBe('Tentando novamente…');
  });

  it('a nova tentativa que dá certo leva o foco ao título, sem tê-lo movido ao clicar', async () => {
    await cenario.falharOCarregamento();
    const titulo = cenario.tela().querySelector('h1');
    const tentar = cenario.botao('Tentar novamente') as HTMLButtonElement;
    tentar.focus();

    tentar.click();
    await cenario.assentar();
    expect(document.activeElement).not.toBe(titulo);

    await cenario.carregar(INSCRICOES);
    await cenario.macrotarefa();
    cenario.fixture.detectChanges();

    expect(document.activeElement).toBe(titulo);
  });
});
