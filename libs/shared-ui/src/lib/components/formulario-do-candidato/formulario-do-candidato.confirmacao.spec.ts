import { CenarioDoFormularioDoCandidato } from './formulario-do-candidato.testing';
import {
  FORMULARIO_COM_CONFIRMACAO_DO_EMAIL,
  FORMULARIO_DA_FAMILIA_COM_CONFIRMACAO,
} from './formularios-de-exemplo.testing';

describe('FormularioDoCandidatoComponent', () => {
  let cenario: CenarioDoFormularioDoCandidato;

  beforeEach(() => {
    cenario = CenarioDoFormularioDoCandidato.preparar();
  });

  describe('confirmação pedida no campo', () => {
    const EMAIL = 'fernanda_laura_drumond@lhp.com.br';
    const entradas = (
      tela: HTMLElement,
    ): { resposta: HTMLInputElement; confirmacao: HTMLInputElement } => ({
      resposta: tela.querySelector('[data-campo="EMAIL"] input') as HTMLInputElement,
      confirmacao: tela.querySelector('input[id$="-confirmacao"]') as HTMLInputElement,
    });

    it('a confirmação ainda não digitada abre vazia, sem o texto "undefined"', () => {
      const tela = cenario.montar(FORMULARIO_COM_CONFIRMACAO_DO_EMAIL);

      expect(entradas(tela).confirmacao.value).toBe('');
    });

    it('a confirmação de uma ocorrência nova do grupo abre vazia', () => {
      const tela = cenario.montar(FORMULARIO_DA_FAMILIA_COM_CONFIRMACAO, {
        inicial: { grupos: { FAMILIA: [{ id: 'membro-1', respostas: {} }] } },
      });

      const confirmacao = tela.querySelector(
        '[data-campo="FAMILIA.membro-1.EMAIL"] input[id$="-confirmacao"]',
      ) as HTMLInputElement;
      expect(confirmacao.value).toBe('');
    });

    it('a confirmação que não confere com a resposta bloqueia o envio e leva o foco a ela', async () => {
      const tela = cenario.montar(FORMULARIO_COM_CONFIRMACAO_DO_EMAIL);
      const { resposta, confirmacao } = entradas(tela);
      cenario.digitar(resposta, EMAIL);
      cenario.digitar(confirmacao, 'outro_valor@lhp.com.br');

      expect(cenario.fixture.componentInstance.concluirTodasENavegar()).toBe(1);
      cenario.fixture.detectChanges();
      await cenario.fixture.whenStable();

      expect(document.activeElement).toBe(confirmacao);
      expect(confirmacao.getAttribute('aria-invalid')).toBe('true');
      expect(
        tela.querySelector(`#${confirmacao.getAttribute('aria-describedby')}`)?.textContent,
      ).toContain('A confirmação não confere com a resposta.');
    });

    it('a confirmação em branco depois de digitar a resposta bloqueia o envio e pede para confirmar', async () => {
      const tela = cenario.montar(FORMULARIO_COM_CONFIRMACAO_DO_EMAIL);
      const { resposta, confirmacao } = entradas(tela);
      cenario.digitar(resposta, EMAIL);

      expect(cenario.fixture.componentInstance.concluirTodasENavegar()).toBe(1);
      cenario.fixture.detectChanges();
      await cenario.fixture.whenStable();

      expect(document.activeElement).toBe(confirmacao);
      expect(cenario.simulacoes.at(-1)?.paginasConcluidas ?? []).toEqual([]);
    });

    it('a resposta gravada sem confirmação também bloqueia o envio, como a digitada', () => {
      cenario.montar(FORMULARIO_COM_CONFIRMACAO_DO_EMAIL, { inicial: { respostas: { EMAIL } } });

      expect(cenario.fixture.componentInstance.concluirTodasENavegar()).toBe(1);
    });

    it('a resposta gravada deixa enviar quando a confirmação confere', () => {
      const tela = cenario.montar(FORMULARIO_COM_CONFIRMACAO_DO_EMAIL, {
        inicial: { respostas: { EMAIL } },
      });
      cenario.digitar(entradas(tela).confirmacao, EMAIL);

      expect(cenario.fixture.componentInstance.concluirTodasENavegar()).toBe(0);
    });

    it('a confirmação que confere deixa enviar, e vale depois de trocar de seção', () => {
      const tela = cenario.montar(FORMULARIO_COM_CONFIRMACAO_DO_EMAIL);
      const { resposta, confirmacao } = entradas(tela);
      cenario.digitar(resposta, EMAIL);
      cenario.digitar(confirmacao, EMAIL);
      cenario.clicar(cenario.botao('Próxima seção'));

      expect(cenario.fixture.componentInstance.concluirTodasENavegar()).toBe(0);
    });

    it('a confirmação do campo de uma ocorrência do grupo também bloqueia o envio', async () => {
      const tela = cenario.montar(FORMULARIO_DA_FAMILIA_COM_CONFIRMACAO, {
        inicial: { grupos: { FAMILIA: [{ id: 'membro-1', respostas: {} }] } },
      });
      cenario.digitar(
        tela.querySelector('[data-campo="FAMILIA.membro-1.EMAIL"] input') as HTMLInputElement,
        EMAIL,
      );

      expect(cenario.fixture.componentInstance.concluirTodasENavegar()).toBe(1);
      cenario.fixture.detectChanges();
      await cenario.fixture.whenStable();

      expect(document.activeElement).toBe(
        tela.querySelector('[data-campo="FAMILIA.membro-1.EMAIL"] input[id$="-confirmacao"]'),
      );
    });
  });
});
