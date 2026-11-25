import type { FormularioDoCandidato } from './formulario-do-candidato.model';
import { CenarioDoFormularioDoCandidato } from './formulario-do-candidato.testing';
import { FORMULARIO_DE_DUAS_SECOES } from './formularios-de-exemplo.testing';

describe('FormularioDoCandidatoComponent', () => {
  let cenario: CenarioDoFormularioDoCandidato;

  beforeEach(() => {
    cenario = CenarioDoFormularioDoCandidato.preparar();
  });

  describe('passos prefixados', () => {
    const CURSO = { chave: 'curso', titulo: 'Curso', concluido: false };

    it('vêm antes das seções, no indicador e na contagem, e abrem o formulário', () => {
      const tela = cenario.montar(FORMULARIO_DE_DUAS_SECOES, { passosPrefixados: [CURSO] });

      const passos = [...tela.querySelectorAll('nav[aria-label="Passos da inscrição"] li')];
      expect(passos[0].textContent).toContain('Curso');
      expect(passos).toHaveLength(3);
      expect(passos[0].querySelector('button')?.getAttribute('aria-current')).toBe('step');
      expect(tela.querySelector('h3')?.textContent).toContain('passo 1 de 3');
      expect(cenario.botao('Passo anterior').disabled).toBe(true);
    });

    it('a seção seguinte ao passo prefixado é a primeira do formulário e o recusado aparece com erro', () => {
      const tela = cenario.montar(FORMULARIO_DE_DUAS_SECOES, {
        passosPrefixados: [{ ...CURSO, comErro: true }],
      });
      expect(tela.querySelector('nav li')?.classList.contains('is-error')).toBe(true);

      cenario.clicar(cenario.botao('Próximo passo'));

      expect(cenario.fixture.componentInstance.passoPrefixadoAtual()).toBeNull();
      expect(tela.querySelector('h3')?.textContent).toContain('passo 2 de 3');
    });

    it('com a seção válida exigida, o passo prefixado não concluído barra o avanço e avisa quem hospeda', () => {
      cenario.montar(FORMULARIO_DE_DUAS_SECOES, {
        passosPrefixados: [{ ...CURSO, concluido: false }],
        exigirSecaoValida: true,
      });
      const barrados: string[] = [];
      cenario.fixture.componentInstance.avancoBarrado.subscribe((chave) => barrados.push(chave));

      cenario.clicar(cenario.botao('Próximo passo'));
      expect(cenario.fixture.componentInstance.passoPrefixadoAtual()).toBe('curso');
      expect(barrados).toEqual(['curso']);

      cenario.fixture.componentRef.setInput('passosPrefixados', [{ ...CURSO, concluido: true }]);
      cenario.fixture.detectChanges();
      cenario.clicar(cenario.botao('Próximo passo'));
      expect(cenario.fixture.componentInstance.passoPrefixadoAtual()).toBeNull();
    });

    it('"Próxima seção" vale até o último passo, contando os prefixados', () => {
      const tela = cenario.montar(FORMULARIO_DE_DUAS_SECOES, { passosPrefixados: [CURSO] });
      cenario.clicar(cenario.botao('Próximo passo'));

      expect(cenario.botao('Próxima seção')).toBeDefined();
      cenario.clicar(cenario.botao('Próxima seção'));

      expect(tela.querySelector('h3')?.textContent).toContain('passo 3 de 3');
      expect(cenario.botao('Próxima seção')).toBeUndefined();
    });

    it('a recusa que o host apontou no passo prefixado não tira o candidato de lá', () => {
      const tela = cenario.montar(FORMULARIO_DE_DUAS_SECOES, {
        passosPrefixados: [{ ...CURSO, comErro: true }],
        passoDaRecusa: 'curso',
      });

      cenario.fixture.componentRef.setInput('errosDoServidor', [
        { campo: 'NOME_SOCIAL', mensagem: 'Recusado.' },
      ]);
      cenario.fixture.detectChanges();

      expect(cenario.fixture.componentInstance.passoPrefixadoAtual()).toBe('curso');
      expect(tela.querySelector('nav li.is-active')?.textContent).toContain('Curso');
    });

    it('sem recusa do host, a lista nova leva à seção da primeira, e limpar a do host não move ninguém', () => {
      cenario.montar(FORMULARIO_DE_DUAS_SECOES, {
        passosPrefixados: [CURSO],
        passoDaRecusa: 'curso',
      });
      cenario.fixture.componentRef.setInput('errosDoServidor', [
        { campo: 'NOME_SOCIAL', mensagem: 'Recusado.' },
      ]);
      cenario.fixture.detectChanges();
      cenario.fixture.componentRef.setInput('passoDaRecusa', null);
      cenario.fixture.detectChanges();
      expect(cenario.fixture.componentInstance.passoPrefixadoAtual()).toBe('curso');

      cenario.fixture.componentRef.setInput('errosDoServidor', [
        { campo: 'NOME_SOCIAL', mensagem: 'Outra.' },
      ]);
      cenario.fixture.detectChanges();

      expect(cenario.fixture.componentInstance.passoPrefixadoAtual()).toBeNull();
    });

    it('os botões chamam de passo o que antecede as seções e de seção as seções', () => {
      cenario.montar(FORMULARIO_DE_DUAS_SECOES, { passosPrefixados: [CURSO] });
      expect(cenario.botao('Passo anterior')).toBeDefined();

      cenario.clicar(cenario.botao('Próximo passo'));
      expect(cenario.botao('Passo anterior')).toBeDefined();
      expect(cenario.botao('Próxima seção')).toBeDefined();

      cenario.clicar(cenario.botao('Próxima seção'));
      expect(cenario.botao('Seção anterior')).toBeDefined();
    });

    it('o formulário sem seções ainda mostra o passo prefixado', () => {
      const semSecoes: FormularioDoCandidato = {
        ...FORMULARIO_DE_DUAS_SECOES,
        paginas: [],
        coleta: { itens: [], grupos: [] },
      };
      const tela = cenario.montar(semSecoes, { passosPrefixados: [CURSO] });

      expect(tela.querySelector('nav[aria-label="Passos da inscrição"]')?.textContent).toContain(
        'Curso',
      );
      expect(tela.textContent).not.toContain('não tem seção a mostrar');
    });

    it('concluirTodas sem navegar conta as pendências e deixa o candidato onde está', () => {
      const tela = cenario.montar(FORMULARIO_DE_DUAS_SECOES, { passosPrefixados: [CURSO] });

      expect(cenario.fixture.componentInstance.concluirTodas(false)).toBe(2);
      cenario.fixture.detectChanges();

      expect(cenario.fixture.componentInstance.passoPrefixadoAtual()).toBe('curso');
      expect(tela.textContent).not.toContain('itens a corrigir');
    });

    it('sem passos prefixados o título e a barra dizem seção, e a lista é das seções', () => {
      const tela = cenario.montar(FORMULARIO_DE_DUAS_SECOES, { apresentacaoDosPassos: 'lateral' });

      expect(tela.querySelector('h3')?.textContent).toContain('seção 1 de 2');
      expect(tela.querySelector('.step-bar__meta')?.textContent).toContain('Seção 1 de 2');
      expect(tela.querySelector('nav[aria-label="Seções do formulário"]')).not.toBeNull();
    });

    it('a apresentação lateral troca os chips pela coluna e traz o diálogo de seções', () => {
      const tela = cenario.montar(FORMULARIO_DE_DUAS_SECOES, { apresentacaoDosPassos: 'lateral' });

      expect(tela.querySelector('.ui-steps--chips')).toBeNull();
      expect(tela.querySelector('nav.ui-steps--lateral')).not.toBeNull();
      expect(tela.querySelector('dialog .ui-steps--sobreposicao')).not.toBeNull();
    });
  });
});
