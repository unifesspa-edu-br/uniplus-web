import { afterEach, describe, expect, it } from 'vitest';
import {
  ESCRITA,
  Pagina,
  criado,
  engCiv,
  ige,
  maraba,
  montarPagina,
  oferta,
  sucesso,
} from './ofertas-curso.testing';

const comMudancas = (mudancas: Partial<typeof oferta>): typeof oferta => ({
  ...oferta,
  ...mudancas,
});

describe('OfertasCursoPage — regras do formulário', () => {
  let p: Pagina;
  afterEach(() => p.encerrar());

  const opcoesDe = (nome: string): string[][] =>
    [...p.campo(nome).querySelectorAll('option')].map((o) => [
      o.value,
      o.textContent?.trim() ?? '',
    ]);
  const valoresDeTurno = (): readonly string[] => p.edicao.form.controls.turnos.value;
  const abrirPrimeiraEdicao = async (): Promise<void> => {
    p.elemento<HTMLButtonElement>('button[aria-label^="Editar oferta de curso"]').click();
    await p.propagar();
  };
  const enviarCriacao = async () => {
    const post = await p.enviar();
    return post;
  };
  const concluirCriacao = async (post: Awaited<ReturnType<typeof enviarCriacao>>) => {
    post.flush(...criado());
    await p.recarregarCom([oferta]);
  };

  describe('regime de funcionamento', () => {
    it('oferece Alternância Pedagógica sem remover Intensivo e Extensivo', async () => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      expect(opcoesDe('regimeDeFuncionamento')).toEqual([
        ['INTENSIVO', 'Intensivo'],
        ['EXTENSIVO', 'Extensivo'],
        ['ALTERNANCIA_PEDAGOGICA', 'Alternância Pedagógica'],
      ]);
    });

    it.each(['REGULAR', 'INTEGRAL'])(
      'cria oferta em Alternância Pedagógica com regime de turno %s',
      async (regimeDeTurno) => {
        p = await montarPagina([]);
        await p.abrirCadastro();
        p.preencher('regimeDeFuncionamento', 'ALTERNANCIA_PEDAGOGICA');
        p.preencher('regimeDeTurno', regimeDeTurno);
        await p.propagar();
        if (regimeDeTurno === 'INTEGRAL') {
          p.turno('Vespertino').click();
        }
        await p.propagar();

        const post = await enviarCriacao();
        expect(post.request.body).toMatchObject({
          regimeDeFuncionamento: 'ALTERNANCIA_PEDAGOGICA',
          regimeDeTurno,
        });
        await concluirCriacao(post);
      },
    );

    it('na edição preserva a Alternância Pedagógica e não mexe no turno', async () => {
      const alternancia = comMudancas({ regimeDeFuncionamento: 'ALTERNANCIA_PEDAGOGICA' });
      p = await montarPagina([alternancia]);
      await p.abrirEdicao();
      expect(p.campo('regimeDeFuncionamento').value).toBe('ALTERNANCIA_PEDAGOGICA');

      p.preencher('regimeDeFuncionamento', 'EXTENSIVO');
      p.preencher('regimeDeFuncionamento', 'ALTERNANCIA_PEDAGOGICA');
      await p.propagar();
      expect(p.edicao.form.controls.regimeDeTurno.value).toBe('REGULAR');
      expect(valoresDeTurno()).toEqual(['MATUTINO']);

      const put = await p.enviar(`${ESCRITA}/${oferta.id}`);
      expect(put.request.body.regimeDeFuncionamento).toBe('ALTERNANCIA_PEDAGOGICA');
      put.flush(...sucesso());
      await p.recarregarCom([alternancia]);
    });

    it('bloqueia o envio de regime Intensivo com regime de turno Regular e explica o motivo', async () => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      p.preencher('regimeDeFuncionamento', 'INTENSIVO');
      await p.enviar().catch(() => undefined);
      await p.propagar();

      p.http.expectNone(ESCRITA);
      expect(p.campo('regimeDeFuncionamento').getAttribute('aria-invalid')).toBe('true');
      expect(p.campo('regimeDeFuncionamento').closest('.field')?.textContent).toContain(
        'A oferta INTENSIVO exige regime de turno INTEGRAL; foi declarado REGULAR.',
      );
    });

    it('a incompatibilidade some ao declarar o regime de turno Integral', async () => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      p.preencher('regimeDeFuncionamento', 'INTENSIVO');
      p.preencher('regimeDeTurno', 'INTEGRAL');
      await p.propagar();
      expect(p.edicao.form.controls.regimeDeFuncionamento.valid).toBe(true);
    });
  });

  describe('programa e base legal', () => {
    it('só fora do programa Regular a base legal aparece e é obrigatória', async () => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      expect(p.fixture.nativeElement.querySelector('[formcontrolname="baseLegal"]')).toBeNull();

      p.preencher('programaDeOferta', 'PARFOR');
      await p.propagar();
      expect(p.campo('baseLegal').getAttribute('aria-required')).toBe('true');
      expect(p.edicao.form.controls.baseLegal.hasError('required')).toBe(true);

      p.preencher('programaDeOferta', 'REGULAR');
      await p.propagar();
      expect(p.fixture.nativeElement.querySelector('[formcontrolname="baseLegal"]')).toBeNull();
      expect(p.edicao.form.controls.baseLegal.hasError('required')).toBe(false);
    });

    it('sem a base legal o envio não parte, e com ela segue no corpo', async () => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      p.preencher('programaDeOferta', 'PARFOR');
      await p.propagar();
      p.salvar().click();
      await p.propagar();
      p.http.expectNone(ESCRITA);
      expect(p.campo('baseLegal').getAttribute('aria-invalid')).toBe('true');

      p.preencher('baseLegal', 'Convênio Forma Pará nº 004/2020');
      const post = await enviarCriacao();
      expect(post.request.body).toMatchObject({ baseLegal: 'Convênio Forma Pará nº 004/2020' });
      await concluirCriacao(post);
    });

    it('voltar ao programa Regular limpa a base legal, mas preserva o ato de autorização', async () => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      p.preencher('programaDeOferta', 'PARFOR');
      await p.propagar();
      p.preencher('baseLegal', 'X'.repeat(600));
      p.preencher('atoAutorizacaoMec', 'Portaria SERES/MEC nº 270/2021');
      expect(p.edicao.form.controls.baseLegal.hasError('maxlength')).toBe(true);

      p.preencher('programaDeOferta', 'REGULAR');
      await p.propagar();
      const { baseLegal, atoAutorizacaoMec } = p.edicao.form.controls;
      expect(baseLegal.value).toBe('');
      expect(baseLegal.valid).toBe(true);
      expect(atoAutorizacaoMec.value).toBe('Portaria SERES/MEC nº 270/2021');
    });
  });

  describe('criação e edição', () => {
    it('cria enviando a origem da unidade e não o id do DTO de leitura', async () => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      p.preencher('vagasAnuaisAutorizadas', '40');
      const post = await enviarCriacao();

      expect(post.request.method).toBe('POST');
      expect(post.request.body).toMatchObject({
        cursoId: engCiv.id,
        localOfertaId: maraba.id,
        unidadeOfertanteOrigemId: ige.id,
        programaDeOferta: 'REGULAR',
        formatoPedagogico: 'PRESENCIAL',
        regimeDeFuncionamento: 'EXTENSIVO',
        regimeDeTurno: 'REGULAR',
        turnos: ['MATUTINO'],
        vagasAnuaisAutorizadas: 40,
      });
      post.flush(...criado());
      await p.recarregarCom([oferta]);
      expect(p.edicao.aberto()).toBe(false);
    });

    it('não envia sem os vínculos obrigatórios', async () => {
      p = await montarPagina([]);
      p.novo().click();
      await p.responderUnidades();
      p.salvar().click();
      await p.propagar();

      p.http.expectNone(ESCRITA);
      for (const nome of ['cursoId', 'localOfertaId', 'unidadeOfertanteOrigemId']) {
        expect(p.campo(nome).getAttribute('aria-invalid')).toBe('true');
      }
    });

    it('na edição os três vínculos são texto, ficam desabilitados e não vão no corpo', async () => {
      p = await montarPagina();
      await p.abrirEdicao();
      const { cursoId, localOfertaId, unidadeOfertanteOrigemId } = p.edicao.form.controls;
      expect([cursoId, localOfertaId, unidadeOfertanteOrigemId].map((c) => c.disabled)).toEqual([
        true,
        true,
        true,
      ]);
      expect(p.fixture.nativeElement.querySelector('#cfg-oferta-curso-id')).toBeNull();
      expect(p.fixture.nativeElement.textContent).toContain('Bacharelado · Graduação');
      expect(p.fixture.nativeElement.textContent).toContain('IGE · Instituto de Geociências');

      p.preencher('eMecCodigo', '999999');
      const put = await p.enviar(`${ESCRITA}/${oferta.id}`);
      expect(put.request.method).toBe('PUT');
      for (const campo of ['cursoId', 'localOfertaId', 'unidadeOfertanteOrigemId']) {
        expect(put.request.body[campo]).toBeUndefined();
      }
      expect(put.request.body.eMecCodigo).toBe('999999');
      put.flush(...sucesso());
      await p.recarregarCom([oferta]);
    });

    it('na edição os vínculos ainda não carregados não ganham um rótulo falso', async () => {
      p = await montarPagina([oferta], { cursos: [], locais: [] });
      await p.abrirEdicao('Não identificado · IGE · Não identificado · Regular · Matutino');
      const textos = [...p.fixture.nativeElement.querySelectorAll('.field > p')].map((item) =>
        (item as HTMLElement).textContent?.trim(),
      );
      expect(textos.slice(0, 2)).toEqual(['Não identificado', 'Não identificado']);
      expect(p.fixture.nativeElement.textContent).not.toContain('Vinculado');
    });

    it('edição de oferta Regular preserva o ato de autorização no corpo', async () => {
      const comAto = comMudancas({ atoAutorizacaoMec: 'Portaria SERES/MEC nº 270/2021' });
      p = await montarPagina([comAto]);
      await p.abrirEdicao();
      expect(p.campo('atoAutorizacaoMec').value).toBe('Portaria SERES/MEC nº 270/2021');

      p.preencher('eMecCodigo', '999999');
      const put = await p.enviar(`${ESCRITA}/${oferta.id}`);
      expect(put.request.body.atoAutorizacaoMec).toBe('Portaria SERES/MEC nº 270/2021');
      put.flush(...sucesso());
      await p.recarregarCom([comAto]);
    });

    it('mostra o contexto do curso, do local e da unidade abaixo dos selects', async () => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      const dicas = (nome: string): string =>
        p.campo(nome).closest('.field')?.querySelector('.field__hint')?.textContent?.trim() ?? '';

      expect(dicas('cursoId')).toBe('Bacharelado · Graduação');
      expect(dicas('localOfertaId')).toBe('Marabá · Campus sede');
      expect(dicas('unidadeOfertanteOrigemId')).toBe(
        'IGE · Instituto de Geociências e Engenharias · Instituto',
      );
    });

    it('os controles obrigatórios de entrada nativa são identificados para tecnologias assistivas', async () => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      p.preencher('programaDeOferta', 'PARFOR');
      await p.propagar();
      const obrigatorios = [
        'cursoId',
        'localOfertaId',
        'unidadeOfertanteOrigemId',
        'programaDeOferta',
        'formatoPedagogico',
        'regimeDeFuncionamento',
        'regimeDeTurno',
        'baseLegal',
      ];
      for (const nome of obrigatorios) {
        expect(p.campo(nome).getAttribute('aria-required'), nome).toBe('true');
      }
      for (const nome of [
        'eMecCodigo',
        'codigoSga',
        'atoAutorizacaoMec',
        'vagasAnuaisAutorizadas',
      ]) {
        expect(p.campo(nome).getAttribute('aria-required'), nome).toBeNull();
      }
    });
  });

  describe('turnos', () => {
    it('sob Integral um só turno não salva e a mensagem diz quantos faltam', async () => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      p.preencher('regimeDeTurno', 'INTEGRAL');
      await p.propagar();

      expect(p.edicao.regras().turnosExigidos).toBe(2);
      p.salvar().click();
      await p.propagar();
      p.http.expectNone(ESCRITA);
      expect(p.elemento('fieldset.cfg-oferta-turnos').textContent).toContain(
        'O regime INTEGRAL exige exatamente 2 turnos distintos.',
      );
      expect(p.turno('Matutino').getAttribute('aria-invalid')).toBe('true');
    });

    it('sem nenhum turno marcado o envio é barrado com a orientação', async () => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      p.turno('Matutino').click();
      await p.propagar();
      p.salvar().click();
      await p.propagar();

      p.http.expectNone(ESCRITA);
      expect(p.elemento('fieldset.cfg-oferta-turnos').textContent).toContain(
        'Marque ao menos um turno — nenhum formato pedagógico dispensa o turno.',
      );
    });

    it('voltar de Integral para Regular mantém o turno marcado por último', async () => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      p.preencher('regimeDeTurno', 'INTEGRAL');
      await p.propagar();
      p.turno('Vespertino').click();
      p.turno('Matutino').click();
      p.turno('Matutino').click();
      await p.propagar();
      expect(valoresDeTurno()).toEqual(['VESPERTINO', 'MATUTINO']);

      p.preencher('regimeDeTurno', 'REGULAR');
      await p.propagar();
      expect(valoresDeTurno()).toEqual(['MATUTINO']);
      expect(p.edicao.form.controls.turnos.valid).toBe(true);
    });

    it('sob Integral um terceiro turno descarta o mais antigo em vez de zerar a seleção', async () => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      p.preencher('regimeDeTurno', 'INTEGRAL');
      await p.propagar();
      p.turno('Vespertino').click();
      p.turno('Noturno').click();
      await p.propagar();

      expect(valoresDeTurno()).toEqual(['VESPERTINO', 'NOTURNO']);
      expect(p.turno('Matutino').checked).toBe(false);
    });

    it('sob Regular marcar outro turno substitui o anterior em vez de somar', async () => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      p.turno('Noturno').click();
      await p.propagar();

      expect(valoresDeTurno()).toEqual(['NOTURNO']);
    });

    it('envia os turnos em ordem canônica, qualquer que seja a ordem de marcação', async () => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      p.preencher('regimeDeTurno', 'INTEGRAL');
      await p.propagar();
      p.turno('Noturno').click();
      p.turno('Vespertino').click();
      await p.propagar();
      expect(valoresDeTurno()).toEqual(['NOTURNO', 'VESPERTINO']);

      const post = await enviarCriacao();
      expect(post.request.body).toMatchObject({
        regimeDeTurno: 'INTEGRAL',
        turnos: ['VESPERTINO', 'NOTURNO'],
      });
      await concluirCriacao(post);
    });

    it('editar uma oferta integral carrega os dois turnos marcados', async () => {
      const integral = comMudancas({
        regimeDeTurno: 'INTEGRAL',
        turnos: ['VESPERTINO', 'MATUTINO'],
      });
      p = await montarPagina([integral]);
      await abrirPrimeiraEdicao();

      expect(p.campo('regimeDeTurno').value).toBe('INTEGRAL');
      expect(valoresDeTurno()).toEqual(['MATUTINO', 'VESPERTINO']);
      expect([p.turno('Matutino').checked, p.turno('Vespertino').checked]).toEqual([true, true]);
      expect(p.turno('Noturno').checked).toBe(false);
    });
  });

  describe('valores que esta versão não conhece', () => {
    it('regime de turno desconhecido não trunca os turnos e ganha opção própria no seletor', async () => {
      const novo = comMudancas({ regimeDeTurno: 'ROTATIVO', turnos: ['MATUTINO', 'VESPERTINO'] });
      p = await montarPagina([novo]);
      await abrirPrimeiraEdicao();

      expect(p.edicao.regras().turnosExigidos).toBeNull();
      expect(valoresDeTurno()).toEqual(['MATUTINO', 'VESPERTINO']);
      expect(p.edicao.form.controls.turnos.valid).toBe(true);
      expect(opcoesDe('regimeDeTurno').map(([valor]) => valor)).toContain('ROTATIVO');
      expect(p.campo('regimeDeTurno').value).toBe('ROTATIVO');
      expect(p.elemento('.field__hint').textContent).toBeTruthy();
    });

    it('turno desconhecido aparece no grupo, marcado', async () => {
      const novo = comMudancas({
        regimeDeTurno: 'INTEGRAL',
        turnos: ['MATUTINO', 'MADRUGADA'],
      });
      p = await montarPagina([novo]);
      await abrirPrimeiraEdicao();

      expect(
        [...p.fixture.nativeElement.querySelectorAll('label.checkbox')].map((r) =>
          (r as HTMLElement).textContent?.trim(),
        ),
      ).toEqual([
        'Matutino',
        'Vespertino',
        'Noturno',
        'MADRUGADA — não reconhecido por esta versão',
      ]);
      expect(p.turno('MADRUGADA — não reconhecido por esta versão').checked).toBe(true);
    });

    it('oferta com valores conhecidos não ganha opção extra no seletor nem no grupo', async () => {
      p = await montarPagina();
      await p.abrirEdicao();

      expect(p.fixture.nativeElement.querySelectorAll('label.checkbox')).toHaveLength(3);
      expect(opcoesDe('regimeDeTurno').map(([valor]) => valor)).toEqual(['REGULAR', 'INTEGRAL']);
    });
  });
});
