import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { of } from 'rxjs';
import { passarOTempo } from '@uniplus/shared-testing';
import { ESPERA_DA_CONSULTA_MS } from './avaliacao-da-inscricao.estado';
import {
  MEDICINA,
  DIREITO,
  ok,
  problema,
  concorrendoEm,
  COM_MODALIDADES,
  inscricao,
  RESPONDIDA,
  botao,
  campoDe,
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

  const irAsModalidades = async (tela: HTMLElement): Promise<void> =>
    cenario.clicar(
      [...tela.querySelectorAll<HTMLButtonElement>('nav button')].find((b) =>
        b.textContent?.includes('Modalidades de concorrência'),
      ) as HTMLButtonElement,
    );

  it('mostra as modalidades que vieram com a inscrição, sem consultar a API ao abrir', async () => {
    cenario.servico.formulario = COM_MODALIDADES;
    cenario.servico.inscricao = inscricao({
      ...RESPONDIDA,
      avaliacao: concorrendoEm('Ampla concorrência'),
    });
    const tela = await cenario.abrir();
    await irAsModalidades(tela);

    expect(tela.querySelector('insc-modalidades-da-inscricao')?.textContent).toContain(
      'Ampla concorrência',
    );
    expect(cenario.servico.avaliacoes).toHaveLength(0);
  });

  it('responder o que decide as modalidades consulta a avaliação com as respostas da tela', async () => {
    cenario.servico.formulario = COM_MODALIDADES;
    const tela = await cenario.abrir();

    const nome = campoDe(tela, 'NOME');
    nome.value = 'Ariel Drumond';
    nome.dispatchEvent(new Event('input'));
    cenario.fixture.detectChanges();
    await passarOTempo(ESPERA_DA_CONSULTA_MS);

    expect(cenario.servico.avaliacoes.map((a) => a.respostas?.['NOME'])).toEqual(['Ariel Drumond']);
  });

  it('a consulta de avaliação espera o intervalo inteiro depois da última resposta, nem um milissegundo menos', async () => {
    cenario.servico.formulario = COM_MODALIDADES;
    const tela = await cenario.abrir();

    const nome = campoDe(tela, 'NOME');
    nome.value = 'Ariel Drumond';
    nome.dispatchEvent(new Event('input'));
    cenario.fixture.detectChanges();
    await passarOTempo(ESPERA_DA_CONSULTA_MS - 1);
    expect(cenario.servico.avaliacoes).toHaveLength(0);

    await passarOTempo(1);
    expect(cenario.servico.avaliacoes).toHaveLength(1);
  });

  it('a consulta de avaliação leva a oferta escolhida na tela, ou null quando não há escolha', async () => {
    cenario.servico.formulario = COM_MODALIDADES;
    cenario.servico.ofertas = [MEDICINA, DIREITO];
    cenario.servico.inscricao = inscricao({ ofertaCursoId: DIREITO.id });
    const tela = await cenario.abrir();
    const digitar = async (nome: string): Promise<void> => {
      const campo = campoDe(tela, 'NOME');
      campo.value = nome;
      campo.dispatchEvent(new Event('input'));
      cenario.fixture.detectChanges();
      await passarOTempo(ESPERA_DA_CONSULTA_MS);
    };

    await cenario.irAoPasso(tela, 'Dados pessoais');
    await digitar('Ariel Drumond');
    await cenario.irAoPasso(tela, 'Curso');
    await cenario.escolherCurso(tela, '');
    await passarOTempo(ESPERA_DA_CONSULTA_MS);

    expect(cenario.servico.avaliacoes.map((a) => a.ofertaCursoId)).toEqual([DIREITO.id, null]);
  });

  it('trocar a oferta no seletor consulta a avaliação de novo com a oferta nova e as respostas gravadas', async () => {
    cenario.servico.formulario = COM_MODALIDADES;
    cenario.servico.ofertas = [MEDICINA, DIREITO];
    cenario.servico.inscricao = inscricao({
      ofertaCursoId: MEDICINA.id,
      respostas: { NOME: 'Ariel Drumond' },
    });
    const tela = await cenario.abrir();

    await cenario.escolherCurso(tela, DIREITO.id);
    await passarOTempo(ESPERA_DA_CONSULTA_MS);

    expect(cenario.servico.avaliacoes).toHaveLength(1);
    expect(cenario.servico.avaliacoes[0].ofertaCursoId).toBe(DIREITO.id);
    expect(cenario.servico.avaliacoes[0].respostas?.['NOME']).toBe('Ariel Drumond');
  });

  it('a avaliação que volta do rascunho salvo passa a ser a mostrada', async () => {
    cenario.servico.formulario = COM_MODALIDADES;
    cenario.servico.inscricao = inscricao({
      ...RESPONDIDA,
      avaliacao: concorrendoEm('Ampla concorrência'),
    });
    const tela = await cenario.abrir();
    cenario.servico.inscricao = inscricao({
      avaliacao: concorrendoEm('Ampla concorrência', 'Cotas'),
    });

    await cenario.clicar(botao(tela, 'Salvar rascunho'));
    await irAsModalidades(tela);

    expect(tela.querySelector('insc-modalidades-da-inscricao')?.textContent).toContain('Cotas');
  });

  it('a releitura sem gravação, depois da falha sem resposta, mantém a avaliação das respostas da tela', async () => {
    cenario.servico.formulario = COM_MODALIDADES;
    cenario.servico.inscricao = inscricao({
      ...RESPONDIDA,
      avaliacao: concorrendoEm('Ampla concorrência'),
    });
    cenario.servico.avaliar = () => ok(concorrendoEm('Cotas da tela'));
    const tela = await cenario.abrir();
    const nome = campoDe(tela, 'NOME');
    nome.value = 'Ariel Drumond';
    nome.dispatchEvent(new Event('input'));
    cenario.fixture.detectChanges();
    await passarOTempo(ESPERA_DA_CONSULTA_MS);
    cenario.servico.salvar = () => of(problema(503, 'uniplus.teste'));
    cenario.servico.inscricao = inscricao({ avaliacao: concorrendoEm('Gravada antiga') });

    await cenario.clicar(botao(tela, 'Salvar rascunho'));
    await irAsModalidades(tela);

    const modalidades = tela.querySelector('insc-modalidades-da-inscricao')?.textContent;
    expect(modalidades).toContain('Cotas da tela');
    expect(modalidades).not.toContain('Gravada antiga');
    expect(tela.textContent).toContain('Não conseguimos confirmar a gravação');
  });
});
