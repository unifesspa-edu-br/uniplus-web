import { CenarioDoFormularioDoCandidato } from './formulario-do-candidato.testing';
import {
  FORMULARIO_COM_GRUPO_DA_FAMILIA,
  FORMULARIO_COM_TERMO_DE_VERACIDADE,
  FORMULARIO_DE_DUAS_SECOES,
  itemDasRegras,
} from './formularios-de-exemplo.testing';

describe('FormularioDoCandidatoComponent', () => {
  let cenario: CenarioDoFormularioDoCandidato;

  beforeEach(() => {
    cenario = CenarioDoFormularioDoCandidato.preparar();
  });

  it('concluir todas com pendência não dá seção nenhuma como concluída nem muda o indicador', () => {
    const tela = cenario.montar(FORMULARIO_DE_DUAS_SECOES);

    expect(cenario.fixture.componentInstance.concluirTodas()).toBe(2);
    cenario.fixture.detectChanges();

    expect(cenario.simulacoes.at(-1)?.paginasConcluidas ?? []).toEqual([]);
    expect(tela.querySelectorAll('nav li.is-done')).toHaveLength(0);
  });

  it('concluir todas leva à seção da primeira pendência, põe o foco nela e anuncia quantas são', () => {
    const tela = cenario.montar(FORMULARIO_DE_DUAS_SECOES);
    cenario.digitar(
      tela.querySelector('input') as HTMLInputElement,
      'fernanda_laura_drumond@lhp.com.br',
    );

    expect(cenario.fixture.componentInstance.concluirTodas()).toBe(1);
    cenario.fixture.detectChanges();

    const input = tela.querySelector('input') as HTMLInputElement;
    expect(tela.querySelector('h3')?.textContent).toContain('Nome');
    expect(document.activeElement).toBe(input);
    expect(cenario.simulacoes.at(-1)?.paginasConcluidas ?? []).toEqual([]);
    expect(tela.querySelector('[aria-live="polite"]')?.textContent).toBe(
      'Há 1 item a corrigir. O primeiro está na seção Nome.',
    );
  });

  it('concluir todas sem pendência dá as seções como concluídas, e o opcional em branco não pende', () => {
    const tela = cenario.montar({
      ...FORMULARIO_DE_DUAS_SECOES,
      regras: {
        paginas: [
          { codigo: 'Inscricao:CONTATO', itens: [itemDasRegras('EMAIL')] },
          {
            codigo: 'Inscricao:NOME',
            itens: [itemDasRegras('NOME_SOCIAL', { obrigatoriedade: { tipo: 'NUNCA' } })],
          },
        ],
      },
    });
    cenario.digitar(
      tela.querySelector('input') as HTMLInputElement,
      'fernanda_laura_drumond@lhp.com.br',
    );

    expect(cenario.fixture.componentInstance.concluirTodas()).toBe(0);
    cenario.fixture.detectChanges();

    expect(cenario.simulacoes.at(-1)?.paginasConcluidas).toEqual([
      'Inscricao:CONTATO',
      'Inscricao:NOME',
    ]);
    expect(tela.querySelector('h3')?.textContent).toContain('Contato');
  });

  it('concluir todas conta o termo obrigatório sem aceite e leva o foco a ele', () => {
    const tela = cenario.montar(FORMULARIO_COM_TERMO_DE_VERACIDADE);

    expect(cenario.fixture.componentInstance.concluirTodas()).toBe(1);
    cenario.fixture.detectChanges();

    expect(document.activeElement).toBe(
      tela.querySelector('[data-campo="VERACIDADE"] input[type="checkbox"]'),
    );
  });

  it('concluir todas conta o grupo obrigatório sem integrante', () => {
    cenario.montar(FORMULARIO_COM_GRUPO_DA_FAMILIA);

    expect(cenario.fixture.componentInstance.concluirTodas()).toBe(1);
  });

  it('concluir todas leva o foco ao subitem pendente da ocorrência em que ele está', async () => {
    const tela = cenario.montar(FORMULARIO_COM_GRUPO_DA_FAMILIA, {
      inicial: {
        grupos: {
          FAMILIA: [
            { id: 'membro-1', respostas: { RENDA: 1200 } },
            { id: 'membro-2', respostas: {} },
          ],
        },
      },
    });

    expect(cenario.fixture.componentInstance.concluirTodas()).toBe(1);
    cenario.fixture.detectChanges();
    await cenario.fixture.whenStable();

    expect(document.activeElement).toBe(
      tela.querySelector('[data-campo="FAMILIA.membro-2.RENDA"] input'),
    );
  });
});
