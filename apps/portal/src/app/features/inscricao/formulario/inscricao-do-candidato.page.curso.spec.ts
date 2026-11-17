import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HttpHeaders } from '@angular/common/http';
import { apiFailure } from '@uniplus/shared-core/http';
import { passarOTempo } from '@uniplus/shared-testing';
import {
  MEDICINA,
  DIREITO,
  problema,
  inscricao,
  RESPONDIDA,
  botao,
  indisponivel,
  passos,
  CenarioDaInscricao,
} from './inscricao-do-candidato.page.testing';

describe('InscricaoDoCandidatoPage', () => {
  let cenario: CenarioDaInscricao;

  beforeEach(() => {
    cenario = CenarioDaInscricao.preparar();
  });

  afterEach(() => {
    cenario.encerrar();
  });

  it('sem curso escolhido o passo Curso não avança e mostra a recusa no campo', async () => {
    cenario.servico.ofertas = [MEDICINA, DIREITO];
    const tela = await cenario.abrir();

    await cenario.clicar(botao(tela, 'Próximo passo'));

    expect(passos(tela)[0].getAttribute('aria-current')).toBe('step');
    expect(tela.querySelector('#inscricao-oferta-erro')).not.toBeNull();

    await cenario.escolherCurso(tela, DIREITO.id);
    await cenario.clicar(botao(tela, 'Próximo passo'));
    expect(passos(tela)[1].getAttribute('aria-current')).toBe('step');
  });

  it('o seletor de curso só aparece quando o processo oferece mais de um', async () => {
    let tela = await cenario.abrir();
    expect(tela.querySelector('#inscricao-oferta')).toBeNull();
    await cenario.clicar(botao(tela, 'Salvar rascunho'));
    expect(cenario.servico.salvos[0].ofertaCursoId).toBe(MEDICINA.id);

    cenario.servico.ofertas = [MEDICINA, DIREITO];
    tela = await cenario.abrir();
    expect(tela.querySelector('#inscricao-oferta')).not.toBeNull();
  });

  it('o seletor da 1ª opção declara que o curso é obrigatório', async () => {
    cenario.servico.ofertas = [MEDICINA, DIREITO];
    const tela = await cenario.abrir();

    expect(tela.querySelector('#inscricao-oferta')?.getAttribute('aria-required')).toBe('true');
  });

  const recusaDaOferta = (codigo: string) =>
    apiFailure(
      {
        type: 'about:blank',
        title: 'Recusada',
        status: 422,
        code: codigo,
        traceId: '',
        errors: [{ field: 'ofertaCursoId', code: codigo, message: '' }],
      },
      422,
      new HttpHeaders(),
    );

  it('a recusa da oferta pela API marca o passo Curso, mostra a mensagem no campo e leva o foco até ele', async () => {
    cenario.servico.ofertas = [MEDICINA, DIREITO];
    cenario.servico.recusaDoEnvio = recusaDaOferta(
      'uniplus.selecao.inscricao.oferta_fora_do_processo',
    );
    cenario.servico.inscricao = inscricao(RESPONDIDA);
    const tela = await cenario.abrir();
    await cenario.escolherCurso(tela, DIREITO.id);
    await cenario.irAoPasso(tela, 'Dados pessoais');

    await cenario.clicar(botao(tela, 'Enviar inscrição'));

    const select = tela.querySelector('#inscricao-oferta') as HTMLSelectElement;
    expect(tela.querySelector('#inscricao-oferta-erro')?.textContent).toContain(
      'Este curso não é oferecido neste processo.',
    );
    expect(select.getAttribute('aria-describedby')).toBe('inscricao-oferta-erro');
    expect(document.activeElement).toBe(select);
    expect(passos(tela)[0].textContent).toContain('(com resposta recusada)');
  });

  it('enviar sem escolher o curso não envia e aponta o passo Curso', async () => {
    cenario.servico.ofertas = [MEDICINA, DIREITO];
    cenario.servico.inscricao = inscricao(RESPONDIDA);
    const tela = await cenario.abrir();
    await cenario.irAoPasso(tela, 'Dados pessoais');

    await cenario.clicar(botao(tela, 'Enviar inscrição'));

    expect(cenario.servico.enviados).toHaveLength(0);
    expect(tela.querySelector('#inscricao-oferta-erro')?.textContent).toContain(
      'Escolha a oferta de curso para enviar a inscrição.',
    );
    expect(passos(tela)[0].textContent).toContain('(com resposta recusada)');
    expect(passos(tela)[0].getAttribute('aria-current')).toBe('step');
  });

  it('a recusa do curso junto de outro campo mantém o candidato no passo Curso, com o foco no seletor', async () => {
    cenario.servico.ofertas = [MEDICINA, DIREITO];
    cenario.servico.recusaDoEnvio = apiFailure(
      {
        type: 'about:blank',
        title: 'Recusada',
        status: 422,
        code: 'uniplus.selecao.inscricao.oferta_fora_do_processo',
        traceId: '',
        errors: [
          { field: 'NOME', code: 'uniplus.selecao.inscricao.resposta_invalida', message: '' },
          {
            field: 'ofertaCursoId',
            code: 'uniplus.selecao.inscricao.oferta_fora_do_processo',
            message: '',
          },
        ],
      },
      422,
      new HttpHeaders(),
    );
    cenario.servico.inscricao = inscricao(RESPONDIDA);
    const tela = await cenario.abrir();
    await cenario.escolherCurso(tela, DIREITO.id);
    await cenario.irAoPasso(tela, 'Dados pessoais');

    await cenario.clicar(botao(tela, 'Enviar inscrição'));

    const select = tela.querySelector('#inscricao-oferta') as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(tela.querySelector('#inscricao-oferta-erro')).not.toBeNull();
    expect(document.activeElement).toBe(select);
    expect(passos(tela)[0].getAttribute('aria-current')).toBe('step');
    expect(passos(tela)[1].textContent).toContain('(com resposta recusada)');
  });

  it('o curso gravado que saiu das ofertas do processo não vale: o envio é barrado no passo Curso', async () => {
    cenario.servico.ofertas = [MEDICINA, DIREITO];
    cenario.servico.inscricao = inscricao({ ...RESPONDIDA, ofertaCursoId: 'oferta-que-saiu' });
    const tela = await cenario.abrir();
    await cenario.irAoPasso(tela, 'Dados pessoais');

    await cenario.clicar(botao(tela, 'Enviar inscrição'));

    expect(cenario.servico.enviados).toHaveLength(0);
    expect(tela.querySelector('#inscricao-oferta-erro')).not.toBeNull();
  });

  it('o rascunho salvo não leva o curso gravado que saiu das ofertas do processo', async () => {
    cenario.servico.ofertas = [MEDICINA, DIREITO];
    cenario.servico.inscricao = inscricao({ ofertaCursoId: 'oferta-que-saiu' });
    const tela = await cenario.abrir();

    await cenario.clicar(botao(tela, 'Salvar rascunho'));

    expect(cenario.servico.salvos[0].ofertaCursoId).toBeNull();
  });

  it('sem curso o envio fica inativo e o link do motivo leva o foco ao seletor do curso', async () => {
    cenario.servico.ofertas = [MEDICINA, DIREITO];
    cenario.servico.inscricao = inscricao(RESPONDIDA);
    const tela = await cenario.abrir();
    await cenario.clicar(passos(tela)[1]);

    expect(indisponivel(botao(tela, 'Enviar inscrição'))).toBe(true);
    expect(tela.querySelector('#inscricao-motivo-envio')?.textContent).toContain(
      'Escolha o curso.',
    );

    await cenario.clicar(botao(tela, 'Escolher o curso'));
    await passarOTempo(0);

    expect(cenario.servico.enviados).toHaveLength(0);
    expect(passos(tela)[0].getAttribute('aria-current')).toBe('step');
    expect(document.activeElement).toBe(tela.querySelector('#inscricao-oferta'));
  });

  it('o curso é o primeiro passo quando há mais de uma oferta e não há seletor fora do indicador', async () => {
    cenario.servico.ofertas = [MEDICINA, DIREITO];
    const tela = await cenario.abrir();

    expect(tela.querySelector('nav[aria-label="Passos da inscrição"]')).not.toBeNull();
    expect(passos(tela)[0].textContent).toContain('Curso');
    expect(passos(tela)[1].textContent).toContain('Dados pessoais');
    expect(passos(tela)[0].getAttribute('aria-current')).toBe('step');
    expect(tela.querySelector('ui-formulario-do-candidato #inscricao-oferta')).not.toBeNull();
    expect(tela.querySelector('ui-page-header ~ #inscricao-oferta')).toBeNull();
  });

  it('com uma oferta só, o curso gravado que saiu do processo cede lugar à oferta que resta', async () => {
    cenario.servico.inscricao = inscricao({ ...RESPONDIDA, ofertaCursoId: 'oferta-que-saiu' });
    const tela = await cenario.abrir();

    expect(tela.querySelector('.inscricao-curso')?.textContent).toContain(MEDICINA.nome);
    await cenario.clicar(botao(tela, 'Enviar inscrição'));

    expect(cenario.servico.enviados[0].ofertaCursoId).toBe(MEDICINA.id);
  });

  it('com uma oferta só não há passo Curso e o cabeçalho informa o curso', async () => {
    const tela = await cenario.abrir();

    expect(tela.querySelector('nav[aria-label="Seções do formulário"]')).not.toBeNull();
    expect(passos(tela)[0].textContent).toContain('Dados pessoais');
    expect(passos(tela).some((b) => b.textContent?.includes('Curso'))).toBe(false);
    expect(tela.querySelector('.inscricao-curso')?.textContent).toContain(MEDICINA.nome);
  });

  it('a revisão mostra o curso escolhido e volta ao passo Curso', async () => {
    cenario.servico.ofertas = [MEDICINA, DIREITO];
    cenario.servico.inscricao = inscricao({ ...RESPONDIDA, ofertaCursoId: DIREITO.id });
    const tela = await cenario.abrir();
    await cenario.clicar(passos(tela)[passos(tela).length - 1]);

    const revisao = tela.querySelector('.formulario-candidato__resumo') as HTMLElement;
    expect(revisao.textContent).toContain(DIREITO.nome);
    await cenario.clicar(revisao.querySelector('button') as HTMLElement);

    expect(passos(tela)[0].getAttribute('aria-current')).toBe('step');
    expect(document.activeElement?.textContent).toContain('Curso');
  });

  it('a releitura depois de uma falha sem resposta mantém o curso escolhido', async () => {
    cenario.servico.ofertas = [MEDICINA, DIREITO];
    cenario.servico.recusaDoEnvio = problema(0, 'uniplus.client.network_error');
    cenario.servico.inscricao = inscricao(RESPONDIDA);
    const tela = await cenario.abrir();
    await cenario.escolherCurso(tela, DIREITO.id);

    await cenario.clicar(botao(tela, 'Enviar inscrição'));
    cenario.servico.recusaDoEnvio = null;
    await cenario.clicar(botao(tela, 'Enviar inscrição'));

    expect(cenario.servico.enviados.map((r) => r.ofertaCursoId)).toEqual([DIREITO.id, DIREITO.id]);
  });
});
