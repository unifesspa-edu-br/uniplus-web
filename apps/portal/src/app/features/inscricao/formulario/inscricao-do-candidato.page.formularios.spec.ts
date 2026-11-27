import { HttpHeaders } from '@angular/common/http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiFailure } from '@uniplus/shared-core/http';
import type { AvaliacaoDaInscricaoDto } from '@uniplus/shared-data/selecao';

import {
  DOIS_FORMULARIOS,
  FORMULARIO_ACADEMICO,
  RESPONDIDA_NOS_DOIS,
  TERMO_ACADEMICO,
} from './formularios-da-inscricao.testing';
import {
  CenarioDaInscricao,
  COM_MODALIDADES,
  RESPONDIDA,
  SEM_DOCUMENTOS,
  botao,
  campoDe,
  DIREITO,
  indisponivel,
  MEDICINA,
  inscricao,
} from './inscricao-do-candidato.page.testing';

const ESCOLHA_DE_FORMULARIO = 'nav[aria-label="Formulários da inscrição"]';
const TITULO_ACADEMICO = '#inscricao-DADOS_ACADEMICOS-formulario';

const FALTA_A_INSTITUICAO: AvaliacaoDaInscricaoDto = {
  modalidades: {
    derivada: true,
    situacao: {
      codigo: 'FALTA_RESPONDER' as NonNullable<
        AvaliacaoDaInscricaoDto['modalidades']['situacao']
      >['codigo'],
      rotulo: 'Falta responder',
    },
    itens: [],
    pendencias: [
      {
        fatoCodigo: 'INSTITUICAO_DE_ORIGEM',
        rotulo: 'Instituição de origem',
        secaoCodigo: 'DADOS_ACADEMICOS:ESCOLARIDADE',
      },
    ],
  },
  documentos: SEM_DOCUMENTOS,
};

function recusaDoCursoEDoCampo(campo: string, ordem: 'campo' | 'curso') {
  const doCampo = { field: campo, code: 'x.resposta_invalida', message: 'Instituição não aceita.' };
  const doCurso = {
    field: 'ofertaCursoId',
    code: 'x.oferta_fora_do_processo',
    message: 'Este curso não é oferecido neste processo.',
  };
  return apiFailure(
    {
      type: 'about:blank',
      title: 'Recusada',
      status: 422,
      code: 'x.recusada',
      traceId: '',
      errors: ordem === 'campo' ? [doCampo, doCurso] : [doCurso, doCampo],
    },
    422,
    new HttpHeaders(),
  );
}

function recusaDoEnvio(campo: string, mensagem: string) {
  return apiFailure(
    {
      type: 'about:blank',
      title: 'Recusada',
      status: 422,
      code: 'uniplus.selecao.inscricao.item_obrigatorio_ausente',
      traceId: '',
      errors: [
        {
          field: campo,
          code: 'uniplus.selecao.inscricao.item_obrigatorio_ausente',
          message: mensagem,
        },
      ],
    },
    422,
    new HttpHeaders(),
  );
}

describe('InscricaoDoCandidatoPage: dois formulários obrigatórios', () => {
  let cenario: CenarioDaInscricao;

  beforeEach(() => {
    cenario = CenarioDaInscricao.preparar();
    cenario.servico.formularios = DOIS_FORMULARIOS;
  });

  afterEach(() => {
    cenario.encerrar();
  });

  const aberto = (tela: HTMLElement, titulo: string): boolean =>
    tela.querySelector(titulo)?.closest('[hidden]') === null;

  const escolher = (tela: HTMLElement, posicao: number) =>
    cenario.clicar(tela.querySelectorAll<HTMLElement>(`${ESCOLHA_DE_FORMULARIO} button`)[posicao]);

  it('mostra um formulário por vez, na ordem recebida, com a posição entre os formulários', async () => {
    const tela = await cenario.abrir();

    const escolhas = [...tela.querySelectorAll(`${ESCOLHA_DE_FORMULARIO} button`)];
    expect(escolhas.map((e) => e.textContent?.trim())).toEqual([
      expect.stringContaining('Formulário 1 de 2: Inscrição'),
      expect.stringContaining('Formulário 2 de 2: Dados acadêmicos'),
    ]);
    expect(escolhas[0].getAttribute('aria-current')).toBe('step');
    expect(aberto(tela, '#inscricao-INSCRICAO-formulario')).toBe(true);
    expect(aberto(tela, TITULO_ACADEMICO)).toBe(false);
  });

  it('o título de cada formulário é um título de segundo nível', async () => {
    const tela = await cenario.abrir();

    expect(tela.querySelector(TITULO_ACADEMICO)?.tagName).toBe('H2');
  });

  it('ao trocar de formulário, o foco vai ao título dele e a posição é anunciada', async () => {
    const tela = await cenario.abrir();

    await escolher(tela, 1);

    expect(aberto(tela, TITULO_ACADEMICO)).toBe(true);
    expect(document.activeElement).toBe(tela.querySelector(TITULO_ACADEMICO));
    expect(tela.querySelector('p.sr-only[aria-live="polite"]')?.textContent).toBe(
      'Formulário 2 de 2: Dados acadêmicos.',
    );
  });

  it('ao voltar ao formulário anterior, as respostas dele continuam preenchidas', async () => {
    cenario.servico.inscricao = inscricao(RESPONDIDA_NOS_DOIS);
    const tela = await cenario.abrir();
    const instituicao = campoDe(tela, 'INSTITUICAO_DE_ORIGEM');
    instituicao.value = 'Escola Municipal Cora Coralina';
    instituicao.dispatchEvent(new Event('input'));

    await escolher(tela, 0);
    await escolher(tela, 1);

    expect(campoDe(tela, 'INSTITUICAO_DE_ORIGEM').value).toBe('Escola Municipal Cora Coralina');
    expect(campoDe(tela, 'NOME').value).toBe('Fernanda Laura Nicole Drumond');
  });

  it('o envio é único: leva as respostas dos dois formulários e um aceite por termo, com o formulário dele', async () => {
    cenario.servico.inscricao = inscricao(RESPONDIDA_NOS_DOIS);
    const tela = await cenario.abrir();

    await cenario.clicar(botao(tela, 'Enviar inscrição'));

    expect(cenario.servico.enviados).toHaveLength(1);
    const [envio] = cenario.servico.enviados;
    expect(envio.respostas).toMatchObject({
      NOME: 'Fernanda Laura Nicole Drumond',
      INSTITUICAO_DE_ORIGEM: 'Escola Estadual Tancredo Neves',
    });
    expect(envio.aceites?.map((a) => [a.formularioCodigo, a.codigo])).toEqual([
      ['INSCRICAO', 'VERACIDADE'],
      ['DADOS_ACADEMICOS', 'DECLARACAO_ACADEMICA'],
    ]);
  });

  it('o rascunho reenvia os aceites de todos os formulários, e não só os do formulário aberto', async () => {
    cenario.servico.inscricao = inscricao(RESPONDIDA_NOS_DOIS);
    const tela = await cenario.abrir();
    await escolher(tela, 1);

    await cenario.clicar(botao(tela, 'Salvar rascunho'));

    expect(cenario.servico.salvos[0].aceites?.map((a) => a.formularioCodigo)).toEqual([
      'INSCRICAO',
      'DADOS_ACADEMICOS',
    ]);
  });

  it('com o segundo formulário incompleto o envio é impedido e o resumo diz qual formulário falta', async () => {
    cenario.servico.inscricao = inscricao(RESPONDIDA);
    const tela = await cenario.abrir();

    expect(indisponivel(botao(tela, 'Enviar inscrição'))).toBe(true);
    const motivo = tela.querySelector('#inscricao-motivo-envio');
    expect(motivo?.textContent).toContain('Dados acadêmicos');
    expect(motivo?.textContent).not.toContain('Inscrição —');

    await cenario.clicar(motivo?.querySelector('li button') as HTMLElement);

    expect(aberto(tela, TITULO_ACADEMICO)).toBe(true);
    expect(cenario.servico.enviados).toEqual([]);
  });

  it('a recusa de um campo do segundo formulário abre esse formulário, leva o foco ao campo e guarda as respostas', async () => {
    cenario.servico.inscricao = inscricao(RESPONDIDA_NOS_DOIS);
    cenario.servico.recusaDoEnvio = recusaDoEnvio(
      'INSTITUICAO_DE_ORIGEM',
      'Instituição não aceita.',
    );
    const tela = await cenario.abrir();

    await cenario.clicar(botao(tela, 'Enviar inscrição'));

    expect(aberto(tela, TITULO_ACADEMICO)).toBe(true);
    expect(document.activeElement).toBe(campoDe(tela, 'INSTITUICAO_DE_ORIGEM'));
    expect(campoDe(tela, 'NOME').value).toBe('Fernanda Laura Nicole Drumond');
    const resumo = tela.querySelector('#inscricao-recusas-titulo')?.closest('section');
    expect(resumo?.textContent).toContain('Dados acadêmicos');
    expect(resumo?.textContent).toContain('Instituição de origem');
    expect(resumo?.textContent).toContain('Instituição não aceita.');
    const botaoDaRecusa = resumo?.querySelector('button')?.textContent ?? '';
    expect(botaoDaRecusa).toContain('Dados acadêmicos');
    expect(botaoDaRecusa).toContain('Instituição de origem');
    expect(botaoDaRecusa).toContain('Instituição não aceita.');
  });

  it.each(['campo', 'curso'] as const)(
    'a recusa do curso vem antes da de campo do segundo formulário, qualquer que seja a ordem da API (%s primeiro)',
    async (ordem) => {
      cenario.servico.ofertas = [MEDICINA, DIREITO];
      cenario.servico.inscricao = inscricao(RESPONDIDA_NOS_DOIS);
      cenario.servico.recusaDoEnvio = recusaDoCursoEDoCampo('INSTITUICAO_DE_ORIGEM', ordem);
      const tela = await cenario.abrir();
      await cenario.escolherCurso(tela, DIREITO.id);

      await cenario.clicar(botao(tela, 'Enviar inscrição'));

      expect(aberto(tela, TITULO_ACADEMICO)).toBe(false);
      expect(document.activeElement).toBe(tela.querySelector('#inscricao-oferta'));
      const resumo = tela.querySelector('#inscricao-recusas-titulo')?.closest('section');
      expect(resumo?.textContent).toContain('Instituição não aceita.');
      await escolher(tela, 1);
      expect(
        tela.querySelector('#inscricao-DADOS_ACADEMICOS-INSTITUICAO_DE_ORIGEM-erro'),
      ).not.toBeNull();
    },
  );

  it('corrigir a resposta recusada tira a recusa do resumo e do indicador do formulário', async () => {
    cenario.servico.inscricao = inscricao(RESPONDIDA_NOS_DOIS);
    cenario.servico.recusaDoEnvio = recusaDoEnvio(
      'INSTITUICAO_DE_ORIGEM',
      'Instituição não aceita.',
    );
    const tela = await cenario.abrir();
    await cenario.clicar(botao(tela, 'Enviar inscrição'));
    const escolha = (): Element | null | undefined =>
      tela.querySelectorAll(`${ESCOLHA_DE_FORMULARIO} li`)[1];
    expect(escolha()?.classList).toContain('is-error');

    const instituicao = campoDe(tela, 'INSTITUICAO_DE_ORIGEM');
    instituicao.value = 'Escola Municipal Cora Coralina';
    instituicao.dispatchEvent(new Event('input'));
    await cenario.atenderOFormulario();

    expect(tela.querySelector('#inscricao-recusas-titulo')).toBeNull();
    expect(escolha()?.classList).not.toContain('is-error');
  });

  it('o erro do resumo leva ao formulário e ao campo, mesmo com outro formulário aberto', async () => {
    cenario.servico.inscricao = inscricao(RESPONDIDA_NOS_DOIS);
    cenario.servico.recusaDoEnvio = recusaDoEnvio(
      'INSTITUICAO_DE_ORIGEM',
      'Instituição não aceita.',
    );
    const tela = await cenario.abrir();
    await cenario.clicar(botao(tela, 'Enviar inscrição'));
    await escolher(tela, 0);

    const erro = tela.querySelector('#inscricao-recusas-titulo')?.closest('section');
    await cenario.clicar(erro?.querySelector('li button') as HTMLElement);

    expect(aberto(tela, TITULO_ACADEMICO)).toBe(true);
    expect(document.activeElement).toBe(campoDe(tela, 'INSTITUICAO_DE_ORIGEM'));
  });

  it('o atalho da avaliação leva ao formulário dono do campo e ao campo', async () => {
    cenario.servico.formularios = [COM_MODALIDADES, FORMULARIO_ACADEMICO];
    cenario.servico.inscricao = inscricao({
      ...RESPONDIDA_NOS_DOIS,
      avaliacao: FALTA_A_INSTITUICAO,
    });
    const tela = await cenario.abrir();
    const passos = [
      ...tela.querySelectorAll<HTMLElement>('insc-formulario-do-candidato nav button'),
    ];
    await cenario.clicar(passos.find((b) => b.textContent?.includes('Modalidades')) as HTMLElement);

    await cenario.clicar(botao(tela, 'Instituição de origem'));

    expect(aberto(tela, TITULO_ACADEMICO)).toBe(true);
    expect(document.activeElement).toBe(campoDe(tela, 'INSTITUICAO_DE_ORIGEM'));
  });

  it('a recusa de termo, citada por formulário e termo, aparece no termo do formulário certo', async () => {
    cenario.servico.inscricao = inscricao(RESPONDIDA_NOS_DOIS);
    cenario.servico.recusaDoEnvio = recusaDoEnvio(TERMO_ACADEMICO, 'Aceite o termo vigente.');
    const tela = await cenario.abrir();

    await cenario.clicar(botao(tela, 'Enviar inscrição'));

    const termo = tela.querySelector(`[data-campo="${TERMO_ACADEMICO}"]`);
    expect(aberto(tela, TITULO_ACADEMICO)).toBe(true);
    expect(termo?.querySelector('.field__error')?.textContent).toContain('Aceite o termo vigente.');
    expect(document.activeElement).toBe(termo?.querySelector('input'));
  });

  it('ao fim da última seção de um formulário que não é o último, continua para o próximo', async () => {
    cenario.servico.inscricao = inscricao(RESPONDIDA_NOS_DOIS);
    const tela = await cenario.abrir();
    expect(botao(tela, 'Continuar para o próximo formulário')).toBeUndefined();
    const secoes = tela.querySelectorAll<HTMLElement>('insc-formulario-do-candidato nav button');
    await cenario.clicar(secoes[2]);

    await cenario.clicar(botao(tela, 'Continuar para o próximo formulário'));

    expect(aberto(tela, TITULO_ACADEMICO)).toBe(true);
    expect(document.activeElement).toBe(tela.querySelector(TITULO_ACADEMICO));
  });
});

describe('InscricaoDoCandidatoPage: um formulário obrigatório', () => {
  let cenario: CenarioDaInscricao;

  beforeEach(() => {
    cenario = CenarioDaInscricao.preparar();
  });

  afterEach(() => {
    cenario.encerrar();
  });

  it('não oferece a escolha de formulário nem a indicação de posição', async () => {
    const tela = await cenario.abrir();

    expect(tela.querySelector(ESCOLHA_DE_FORMULARIO)).toBeNull();
    expect(tela.querySelector('#inscricao-motivo-envio')?.textContent).not.toContain('Inscrição —');
  });

  it('o resumo de recusas não cita o formulário de origem', async () => {
    cenario.servico.inscricao = inscricao(RESPONDIDA);
    cenario.servico.recusaDoEnvio = recusaDoEnvio('NOME', 'Nome não aceito.');
    const tela = await cenario.abrir();

    await cenario.clicar(botao(tela, 'Enviar inscrição'));

    const resumo = tela.querySelector('#inscricao-recusas-titulo')?.closest('section');
    const botaoDaRecusa = resumo?.querySelector('button')?.textContent;
    expect(botaoDaRecusa).toContain('Nome não aceito.');
    expect(botaoDaRecusa).not.toContain('—');
  });
});
