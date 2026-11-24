import { afterEach, describe, expect, it } from 'vitest';
import { ESCRITA, Pagina, criado, montarPagina, oferta, sucesso } from './ofertas-curso.testing';
import { valoresDaOferta } from './valores-da-oferta.testing';

const comMudancas = (mudancas: Partial<typeof oferta>): typeof oferta => ({
  ...oferta,
  ...mudancas,
});

describe('Regime de funcionamento da oferta', () => {
  let p: Pagina;
  afterEach(() => p.encerrar());
  const opcoesDe = (nome: string): string[][] =>
    [...p.campo(nome).querySelectorAll('option')].map((o) => [
      o.value,
      o.textContent?.trim() ?? '',
    ]);
  const valoresDeTurno = (): readonly string[] => p.edicao.form.controls.turnos.value;
  const enviarCriacao = async () => p.enviar();
  const concluirCriacao = async (post: Awaited<ReturnType<typeof enviarCriacao>>) => {
    post.flush(...criado());
    await p.recarregarCom([oferta]);
  };
  describe('regime de funcionamento', () => {
    it('oferece Alternância Pedagógica sem remover Intensivo e Extensivo', async () => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      expect(opcoesDe('regimeDeFuncionamento')).toEqual([
        [valoresDaOferta.intensivo.codigo, valoresDaOferta.intensivo.rotulo],
        [valoresDaOferta.funcionamento.codigo, valoresDaOferta.funcionamento.rotulo],
        [valoresDaOferta.alternancia.codigo, valoresDaOferta.alternancia.rotulo],
      ]);
    });

    it.each([valoresDaOferta.regime.codigo, valoresDaOferta.integral.codigo])(
      'cria oferta em Alternância Pedagógica com regime de turno %s',
      async (regimeDeTurno) => {
        p = await montarPagina([]);
        await p.abrirCadastro();
        p.preencher('regimeDeFuncionamento', valoresDaOferta.alternancia.codigo);
        p.preencher('regimeDeTurno', regimeDeTurno);
        await p.propagar();
        if (regimeDeTurno === valoresDaOferta.integral.codigo) {
          p.turno(valoresDaOferta.turnos[1].rotulo).click();
        }
        await p.propagar();

        const post = await enviarCriacao();
        expect(post.request.body).toMatchObject({
          regimeDeFuncionamento: valoresDaOferta.alternancia.codigo,
          regimeDeTurno,
        });
        await concluirCriacao(post);
      },
    );

    it('na edição preserva a Alternância Pedagógica e não mexe no turno', async () => {
      const alternancia = comMudancas({ regimeDeFuncionamento: valoresDaOferta.alternancia });
      p = await montarPagina([alternancia]);
      await p.abrirEdicao();
      expect(p.campo('regimeDeFuncionamento').value).toBe(valoresDaOferta.alternancia.codigo);

      p.preencher('regimeDeFuncionamento', valoresDaOferta.funcionamento.codigo);
      p.preencher('regimeDeFuncionamento', valoresDaOferta.alternancia.codigo);
      await p.propagar();
      expect(p.edicao.form.controls.regimeDeTurno.value).toBe(valoresDaOferta.regime.codigo);
      expect(valoresDeTurno()).toEqual([valoresDaOferta.turnos[0].codigo]);

      const put = await p.enviar(`${ESCRITA}/${oferta.id}`);
      expect(put.request.body.regimeDeFuncionamento).toBe(valoresDaOferta.alternancia.codigo);
      put.flush(...sucesso());
      await p.recarregarCom([alternancia]);
    });

    it('bloqueia o envio de regime Intensivo com regime de turno Regular e explica o motivo', async () => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      p.preencher('regimeDeFuncionamento', valoresDaOferta.intensivo.codigo);
      await p.enviar().catch(() => undefined);
      await p.propagar();

      p.http.expectNone(ESCRITA);
      expect(p.campo('regimeDeFuncionamento').getAttribute('aria-invalid')).toBe('true');
      expect(p.campo('regimeDeFuncionamento').closest('.field')?.textContent).toContain(
        'O regime de funcionamento selecionado exige dois turnos distintos.',
      );
    });

    it('a incompatibilidade some ao declarar o regime de turno Integral', async () => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      p.preencher('regimeDeFuncionamento', valoresDaOferta.intensivo.codigo);
      p.preencher('regimeDeTurno', valoresDaOferta.integral.codigo);
      await p.propagar();
      expect(p.edicao.form.controls.regimeDeFuncionamento.valid).toBe(true);
    });
  });
});
