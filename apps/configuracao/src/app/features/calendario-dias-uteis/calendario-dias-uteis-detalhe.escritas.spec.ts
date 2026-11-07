import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DiaNaoUtilDialogoComponent } from './dia-nao-util-dialogo.component';
import {
  DIA_ESTADUAL,
  ESCRITA_DO_DIA,
  LEITURA,
  MARABA,
  PaginaDoDetalhe,
  calendarioCom,
  montarDetalhe,
  problema,
} from './calendario-dias-uteis.testing';

describe('CalendarioDiasUteisDetalhePage — inclusão de dia não útil', () => {
  let p: PaginaDoDetalhe;

  beforeEach(async () => {
    p = await montarDetalhe([DIA_ESTADUAL]);
    await p.abrirCadastro();
    p.escrever(p.campo('descricao') as HTMLTextAreaElement, 'Data nova');
    await p.propagar();
  });
  afterEach(() => p.http.verify());

  const submeter = (): void => {
    p.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
  };
  const cancelar = (): HTMLButtonElement =>
    [...p.dialogo().querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Cancelar',
    ) as HTMLButtonElement;
  const recarregarCom = async (dias: readonly unknown[]): Promise<void> => {
    await p.propagar();
    p.http.expectOne(LEITURA).flush(calendarioCom(dias));
    await p.propagar();
  };
  const aceitar = () => calendarioCom([DIA_ESTADUAL]);

  it('abre o diálogo com a data do dia clicado, que não se edita', () => {
    const data = p.campo('data') as HTMLInputElement;

    expect(data.value).toBe('2026-09-16');
    expect(data.matches(':disabled')).toBe(true);
    expect(p.dialogo().getAttribute('aria-label') ?? p.dialogo().textContent).toContain(
      'Adicionar novo feriado ao calendário',
    );
  });

  it('identifica os campos obrigatórios para tecnologias assistivas', () => {
    for (const nome of ['abrangencia', 'uf', 'data', 'descricao']) {
      expect(p.campo(nome).getAttribute('aria-required')).toBe('true');
    }
  });

  describe('gravação pendente', () => {
    it('deixa o formulário somente leitura, com foco no botão, sem fechar por Cancelar, X nem Esc', async () => {
      const post = await p.enviar();
      const botao = p.salvar();

      expect(p.campo('descricao').matches(':disabled')).toBe(true);
      expect((p.campo('descricao') as HTMLTextAreaElement).value).toBe('Data nova');
      expect(botao.getAttribute('aria-disabled')).toBe('true');
      expect(botao.getAttribute('aria-busy')).toBe('true');
      expect(botao.textContent).toContain('Salvando...');
      expect(botao.querySelector('ui-spinner')).not.toBeNull();
      expect(document.activeElement).toBe(botao);
      expect(p.dialogo().querySelector('[role="status"]')?.textContent).toContain('Adicionando');
      expect(
        p.dialogo().querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled,
      ).toBe(true);
      expect(cancelar().matches(':disabled')).toBe(true);
      p.dialogo().dispatchEvent(new Event('cancel', { cancelable: true }));
      await p.propagar();
      expect(p.edicao.aberto()).toBe(true);

      post.flush(aceitar());
      await recarregarCom([DIA_ESTADUAL]);
      expect(p.edicao.aberto()).toBe(false);
    });

    it('clique e submissão repetidos não geram segundo envio', async () => {
      const post = await p.enviar();
      const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
      p.salvar().dispatchEvent(clique);
      submeter();
      await p.propagar();

      expect(clique.defaultPrevented).toBe(true);
      p.http.expectNone(ESCRITA_DO_DIA);
      post.flush(aceitar());
      await recarregarCom([DIA_ESTADUAL]);
    });

    it('a submissão repetida nem chega a pedir o salvamento ao formulário', async () => {
      const pedidos: string[] = [];
      p.fixture.debugElement
        .query(By.directive(DiaNaoUtilDialogoComponent))
        .componentInstance.salvar.subscribe(() => pedidos.push('salvar'));
      const post = await p.enviar();
      expect(pedidos).toEqual(['salvar']);

      submeter();
      await p.propagar();

      expect(pedidos).toEqual(['salvar']);
      post.flush(aceitar());
      await recarregarCom([DIA_ESTADUAL]);
    });

    it('chamadas concorrentes à edição não geram segunda requisição, nem reabrem o diálogo', async () => {
      p.edicao.salvar();
      p.edicao.salvar();
      p.edicao.abrirCadastro();
      p.edicao.fechar();
      await p.propagar();

      expect(p.edicao.aberto()).toBe(true);
      p.http.expectOne(ESCRITA_DO_DIA).flush(aceitar());
      await recarregarCom([DIA_ESTADUAL]);
    });

    it('Enter num campo leva o foco ao botão e, na falha 500, o envio segue disponível com a mesma chave', async () => {
      p.campo('descricao').focus();
      submeter();
      await p.propagar();
      const post = p.http.expectOne(ESCRITA_DO_DIA);
      const chave = post.request.headers.get('Idempotency-Key');

      expect(p.campo('descricao').matches(':disabled')).toBe(true);
      expect(document.activeElement).toBe(p.salvar());
      post.flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
      await p.propagar();
      await p.propagar();

      expect(p.campo('descricao').matches(':disabled')).toBe(false);
      expect(p.elemento('cfg-dia-nao-util-dialogo ui-alert').textContent).toContain('Falha');
      expect(p.erros).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(p.salvar());
      expect(p.salvar().getAttribute('aria-disabled')).toBeNull();
      submeter();
      await p.propagar();
      const repeticao = p.http.expectOne(ESCRITA_DO_DIA);
      expect(repeticao.request.headers.get('Idempotency-Key')).toBe(chave);
      repeticao.flush(aceitar());
      await recarregarCom([DIA_ESTADUAL]);
    });
  });

  describe('foco depois da inclusão', () => {
    const NOVO_DIA = {
      ...DIA_ESTADUAL,
      id: '019f41cf-69fd-759a-ac6d-09acabc1b199',
      data: '2026-09-16',
      descricao: 'Data nova',
    };
    const botaoDoDia = (data: string): HTMLButtonElement =>
      p.elemento(`button[data-dia="${data}"]`);
    const incluir = async (): Promise<void> => {
      const post = await p.enviar();
      post.flush(aceitar());
      await p.propagar();
    };

    it('o dia que estava vazio ganha ocorrência e o foco volta ao botão novo dele, só ao fim da recarga', async () => {
      const botaoAntigo = botaoDoDia('2026-09-16');
      await incluir();
      expect(document.activeElement).not.toBe(botaoDoDia('2026-09-16'));

      await recarregarCom([DIA_ESTADUAL, NOVO_DIA]);

      expect(botaoDoDia('2026-09-16')).not.toBe(botaoAntigo);
      expect(botaoDoDia('2026-09-16').getAttribute('aria-label')).toContain('Data nova');
      expect(document.activeElement).toBe(botaoDoDia('2026-09-16'));
    });

    it('o dia que já tinha ocorrência recebe o foco de volta', async () => {
      cancelar().click();
      await p.propagar();
      await p.abrirCadastro('15 de agosto de 2026');
      p.escrever(p.campo('descricao') as HTMLTextAreaElement, 'Outra');
      await incluir();
      await recarregarCom([DIA_ESTADUAL, { ...NOVO_DIA, data: '2026-08-15' }]);

      expect(document.activeElement).toBe(botaoDoDia('2026-08-15'));
    });

    it('se a recarga falha e a grade sai da tela, o foco vai ao título da página', async () => {
      await incluir();
      await p.propagar();
      p.http.expectOne(LEITURA).flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
      await p.propagar();

      expect(p.fixture.nativeElement.querySelector('button[data-dia]')).toBeNull();
      expect(document.activeElement).toBe(p.elemento('#cfg-calendario-detalhe-title'));
    });

    it('não toma o foco de quem o levou a outro lugar durante a espera pela recarga', async () => {
      await incluir();
      const outro = botaoDoDia('2026-08-15');
      outro.focus();

      await recarregarCom([DIA_ESTADUAL, NOVO_DIA]);

      expect(document.activeElement).toBe(outro);
    });

    it('a inclusão recusada deixa o foco no diálogo, sem devolvê-lo à grade', async () => {
      const post = await p.enviar();
      post.flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
      await p.propagar();
      await p.propagar();

      expect(p.edicao.aberto()).toBe(true);
      expect(document.activeElement).toBe(p.salvar());
    });
  });

  describe('foco com a inclusão recusada e o foco livre', () => {
    it('não vai à grade que está atrás do diálogo, que segue aberto', async () => {
      const post = await p.enviar();
      post.flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
      (document.activeElement as HTMLElement).blur();
      await p.propagar();
      await p.propagar();

      expect(p.edicao.aberto()).toBe(true);
      expect(document.activeElement?.closest('cfg-calendario-mensal')).toBeNull();
    });
  });

  describe('campo desabilitado por regra de negócio', () => {
    it.each(['sucesso', 'recusa'] as const)(
      'a data continua desabilitada após %s',
      async (desfecho) => {
        const post = await p.enviar();
        expect(p.edicao.form.controls.data.disabled).toBe(true);

        if (desfecho === 'sucesso') post.flush(aceitar());
        else
          post.flush(
            ...problema(422, {
              code: 'uniplus.configuracao.calendario_dias_uteis.descricao_obrigatoria',
            }),
          );
        await p.propagar();

        expect(p.edicao.form.controls.data.disabled).toBe(true);
        if (desfecho === 'recusa') {
          expect(p.campo('data').matches(':disabled')).toBe(true);
          expect(p.campo('descricao').matches(':disabled')).toBe(false);
        } else {
          await recarregarCom([DIA_ESTADUAL]);
        }
      },
    );
  });

  describe('envio barrado localmente', () => {
    it('leva o foco ao primeiro campo inválido e não envia', async () => {
      p.escrever(p.campo('descricao') as HTMLTextAreaElement, '   ');
      p.salvar().focus();
      p.salvar().click();
      await p.propagar();
      await p.propagar();

      p.http.expectNone(ESCRITA_DO_DIA);
      expect(document.activeElement).toBe(p.campo('descricao'));
      expect(p.campo('descricao').getAttribute('aria-invalid')).toBe('true');
    });
  });

  describe('desfecho', () => {
    it('depois do sucesso fecha o diálogo e o painel, avisa e recarrega, com a grade sempre à vista', async () => {
      const post = await p.enviar();
      const chave = post.request.headers.get('Idempotency-Key');
      const diasAntes = p.fixture.nativeElement.querySelectorAll(
        'button.cfg-calendario-mensal__dia',
      ).length;

      post.flush(aceitar());
      await p.propagar();

      expect(p.sucessos).toHaveBeenCalledWith('Dia não útil adicionado');
      expect(p.edicao.aberto()).toBe(false);
      expect(p.selecao.painelAberto()).toBe(false);
      expect(p.fixture.nativeElement.querySelector('.list-state__loading')).toBeNull();
      expect(
        p.fixture.nativeElement.querySelectorAll('button.cfg-calendario-mensal__dia').length,
      ).toBe(diasAntes);
      await recarregarCom([DIA_ESTADUAL]);

      await p.abrirCadastro('23 de setembro de 2026');
      p.escrever(p.campo('descricao') as HTMLTextAreaElement, 'Outra');
      const segunda = await p.enviar();
      expect(segunda.request.headers.get('Idempotency-Key')).not.toBe(chave);
      segunda.flush(aceitar());
      await recarregarCom([DIA_ESTADUAL]);
    });

    it('não herda a descrição da inclusão anterior ao abrir outra data', async () => {
      const post = await p.enviar();
      post.flush(aceitar());
      await recarregarCom([DIA_ESTADUAL]);

      await p.abrirCadastro('23 de setembro de 2026');

      expect((p.campo('descricao') as HTMLTextAreaElement).value).toBe('');
      expect((p.campo('data') as HTMLInputElement).value).toBe('2026-09-23');
      expect(p.edicao.form.controls.descricao.value).toBe('');
    });

    it('Cancelar fecha o diálogo sem enviar e sem deixar resíduo para a próxima abertura', async () => {
      cancelar().click();
      await p.propagar();

      expect(p.edicao.aberto()).toBe(false);
      p.http.expectNone(ESCRITA_DO_DIA);
      expect(p.edicao.form.controls.descricao.value).toBe('');
    });

    it('a abrangência municipal envia o snapshot da opção escolhida na Geo', async () => {
      p.escolher(p.campo('abrangencia') as HTMLSelectElement, 'MUNICIPAL');
      await p.propagar();
      await p.municipioDoDialogo();

      const post = await p.enviar();

      expect(post.request.body).toMatchObject({
        abrangencia: 'MUNICIPAL',
        data: '2026-09-16',
        municipioIbge: MARABA.codigoIbge,
        municipioNome: 'Marabá',
        municipioUf: 'PA',
        uf: null,
      });
      post.flush(aceitar());
      await recarregarCom([DIA_ESTADUAL]);
    });

    it('reabrir depois de escolher o município municipal não leva o município para a próxima abertura', async () => {
      p.escolher(p.campo('abrangencia') as HTMLSelectElement, 'MUNICIPAL');
      await p.propagar();
      await p.municipioDoDialogo();
      cancelar().click();
      await p.propagar();

      await p.abrirCadastro();

      expect((p.campo('abrangencia') as HTMLSelectElement).value).toBe('ESTADUAL');
      expect(p.edicao.form.controls.municipioNome.value).toBeNull();
      expect(p.edicao.form.controls.codigoMunicipio.validator).toBeNull();
    });
  });
});
