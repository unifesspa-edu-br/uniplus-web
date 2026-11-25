import { CenarioDoFormularioDoCandidato } from './formulario-do-candidato.testing';
import {
  FORMULARIO_COM_GRUPO_DA_FAMILIA,
  FORMULARIO_COM_TERMO_DE_VERACIDADE,
  FORMULARIO_DA_FAMILIA_COM_DOIS_SUBCAMPOS,
  FORMULARIO_DE_DUAS_SECOES,
} from './formularios-de-exemplo.testing';

describe('FormularioDoCandidatoComponent', () => {
  let cenario: CenarioDoFormularioDoCandidato;

  beforeEach(() => {
    cenario = CenarioDoFormularioDoCandidato.preparar();
  });

  it('a recusa do servidor leva à seção do campo, põe o foco nele e some quando ele muda', async () => {
    const tela = cenario.montar(FORMULARIO_DE_DUAS_SECOES);
    cenario.fixture.componentRef.setInput('errosDoServidor', [
      { campo: 'NOME_SOCIAL', mensagem: 'Informe nome e sobrenome.' },
    ]);
    cenario.fixture.detectChanges();
    await cenario.fixture.whenStable();

    const input = tela.querySelector('input') as HTMLInputElement;
    expect(tela.querySelector('h3')?.textContent).toContain('Nome');
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(tela.querySelector(`#${input.getAttribute('aria-describedby')}`)?.textContent).toContain(
      'Informe nome e sobrenome.',
    );
    expect(cenario.itemDoPasso('2').classList).toContain('is-error');

    cenario.digitar(input, 'Ariel Drumond');

    expect(tela.textContent).not.toContain('Informe nome e sobrenome.');
  });

  it('a recusa do servidor a um campo de ocorrência aparece ao lado dele, e a do grupo, no grupo', () => {
    const tela = cenario.montar(FORMULARIO_COM_GRUPO_DA_FAMILIA, {
      inicial: { grupos: { FAMILIA: [{ id: 'membro-1', respostas: { RENDA: 100 } }] } },
    });
    cenario.fixture.componentRef.setInput('errosDoServidor', [
      { campo: 'FAMILIA.membro-1.RENDA', mensagem: 'Renda acima do teto.' },
      { campo: 'FAMILIA', mensagem: 'Informe de 1 a 2.' },
    ]);
    cenario.fixture.detectChanges();

    const renda = tela.querySelector('[data-campo="FAMILIA.membro-1.RENDA"]');
    expect(renda?.querySelector('.field__error')?.textContent).toContain('Renda acima do teto.');
    expect(
      tela.querySelector('fieldset.formulario-candidato__grupo > .field__error')?.textContent,
    ).toContain('Informe de 1 a 2.');
  });

  it('editar um subcampo do grupo descarta só a recusa dele e preserva a de outro subcampo e a de outra ocorrência', () => {
    const tela = cenario.montar(FORMULARIO_DA_FAMILIA_COM_DOIS_SUBCAMPOS, {
      inicial: {
        grupos: {
          FAMILIA: [
            { id: 'membro-1', respostas: { RENDA: 100, PROFISSAO: 'Agricultora' } },
            { id: 'membro-2', respostas: { RENDA: 200 } },
          ],
        },
      },
    });
    cenario.fixture.componentRef.setInput('errosDoServidor', [
      { campo: 'FAMILIA.membro-1.RENDA', mensagem: 'Renda acima do teto.' },
      { campo: 'FAMILIA.membro-1.PROFISSAO', mensagem: 'Profissão não aceita.' },
      { campo: 'FAMILIA.membro-2.RENDA', mensagem: 'Renda do segundo acima do teto.' },
    ]);
    cenario.fixture.detectChanges();

    cenario.digitar(
      tela.querySelector('[data-campo="FAMILIA.membro-1.RENDA"] input') as HTMLInputElement,
      '90',
    );

    expect(tela.textContent).not.toContain('Renda acima do teto.');
    expect(tela.textContent).toContain('Profissão não aceita.');
    expect(tela.textContent).toContain('Renda do segundo acima do teto.');
  });

  it('remover a ocorrência que a API recusou tira a marcação de erro da seção, e a mensagem não volta', () => {
    const tela = cenario.montar(FORMULARIO_DA_FAMILIA_COM_DOIS_SUBCAMPOS, {
      inicial: {
        grupos: {
          FAMILIA: [
            { id: 'membro-1', respostas: { RENDA: 100 } },
            { id: 'membro-2', respostas: { RENDA: 200 } },
          ],
        },
      },
    });
    cenario.fixture.componentRef.setInput('errosDoServidor', [
      { campo: 'FAMILIA.membro-2.RENDA', mensagem: 'Renda do segundo acima do teto.' },
    ]);
    cenario.fixture.detectChanges();
    expect(cenario.itemDoPasso('1').classList).toContain('is-error');

    cenario.clicar(cenario.botao('Remover Integrante 2'));
    expect(cenario.itemDoPasso('1').classList).not.toContain('is-error');

    cenario.clicar(cenario.botao('Acrescentar'));
    expect(cenario.itemDoPasso('1').classList).not.toContain('is-error');
    expect(tela.textContent).not.toContain('Renda do segundo acima do teto.');
  });

  it('editar um subcampo descarta a recusa do próprio grupo, como a de cardinalidade', () => {
    const tela = cenario.montar(FORMULARIO_DA_FAMILIA_COM_DOIS_SUBCAMPOS, {
      inicial: { grupos: { FAMILIA: [{ id: 'membro-1', respostas: { RENDA: 100 } }] } },
    });
    cenario.fixture.componentRef.setInput('errosDoServidor', [
      { campo: 'FAMILIA', mensagem: 'Quantidade de integrantes recusada.' },
    ]);
    cenario.fixture.detectChanges();
    expect(tela.textContent).toContain('Quantidade de integrantes recusada.');

    cenario.digitar(
      tela.querySelector('[data-campo="FAMILIA.membro-1.RENDA"] input') as HTMLInputElement,
      '90',
    );

    expect(tela.textContent).not.toContain('Quantidade de integrantes recusada.');
  });

  it('a recusa do servidor a um termo aparece no termo', () => {
    const tela = cenario.montar(FORMULARIO_COM_TERMO_DE_VERACIDADE);
    cenario.fixture.componentRef.setInput('errosDoServidor', [
      { campo: 'VERACIDADE', mensagem: 'Aceite a versão vigente do termo.' },
    ]);
    cenario.fixture.detectChanges();

    expect(tela.querySelector('.formulario-candidato__termo .field__error')?.textContent).toContain(
      'Aceite a versão vigente do termo.',
    );
  });

  it('a recusa do servidor avisa no topo da seção que tem o campo recusado', () => {
    const tela = cenario.montar(FORMULARIO_DE_DUAS_SECOES, {
      errosDoServidor: [{ campo: 'EMAIL', mensagem: 'Recusado.' }],
    });

    expect(tela.querySelector('.formulario-candidato__secao ui-alert')?.textContent).toContain(
      'O servidor recusou 1 resposta desta seção',
    );
  });
});
