import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpHeaders } from '@angular/common/http';
import { of } from 'rxjs';
import { apiFailure } from '@uniplus/shared-core/http';
import { type FormularioRenderizavelDto, SituacaoInscricao } from '@uniplus/shared-data/selecao';
import { FORMULARIO_DE_INSCRICAO_MOCK } from './inscricao-do-candidato.testing';
import {
  CPF_DA_CONTA,
  NOME_DA_CONTA,
  ok,
  COM_NOME_SOCIAL,
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

  it('o CPF da conta entra na resposta, aparece mascarado e não se edita', async () => {
    const tela = await cenario.abrir();

    const cpf = campoDe(tela, 'CPF');
    expect(cpf.readOnly).toBe(true);
    expect(cpf.value).toBe('***.598.363-**');

    await cenario.clicar(botao(tela, 'Salvar rascunho'));
    expect(cenario.servico.salvos[0].respostas?.['CPF']).toBe(CPF_DA_CONTA);
  });

  it('o nome da conta entra na resposta e não se edita', async () => {
    cenario.conta.update((c) => ({ ...c, nomeCivil: NOME_DA_CONTA }));
    const tela = await cenario.abrir();

    const nome = campoDe(tela, 'NOME');
    expect(nome.readOnly).toBe(true);
    expect(nome.value).toBe(NOME_DA_CONTA);

    await cenario.clicar(botao(tela, 'Salvar rascunho'));
    expect(cenario.servico.salvos[0].respostas?.['NOME']).toBe(NOME_DA_CONTA);
  });

  /** O formulário de teste que também coleta o município de nascimento. */
  const COM_MUNICIPIO: FormularioRenderizavelDto = {
    ...FORMULARIO_DE_INSCRICAO_MOCK,
    fatosColetados: [
      ...FORMULARIO_DE_INSCRICAO_MOCK.fatosColetados,
      {
        ...FORMULARIO_DE_INSCRICAO_MOCK.fatosColetados[0],
        fatoCodigo: 'NATURALIDADE_MUNICIPIO',
        ordem: 8,
        rotulo: 'Município de nascimento',
        tipoRenderizacao: 'MUNICIPIO',
        formato: null,
      },
    ],
    regras: {
      ...FORMULARIO_DE_INSCRICAO_MOCK.regras,
      etapas: FORMULARIO_DE_INSCRICAO_MOCK.regras.etapas.map((e, i) =>
        i === 0
          ? {
              ...e,
              itens: [
                ...e.itens,
                { ...e.itens[0], fatoCodigo: 'NATURALIDADE_MUNICIPIO', formato: null },
              ],
            }
          : e,
      ),
    },
  };
  const SALVADOR = { codigoIbge: '2927408', nome: 'Salvador', uf: 'BA' };
  const NAO_ENCONTRADO = apiFailure(
    { type: 'about:blank', title: 'Falha', status: 503, code: 'falha', traceId: '' },
    503,
    new HttpHeaders(),
  );

  it('reabre a inscrição enviada com o nome gravado do município e reenvia só o código', async () => {
    cenario.servico.formulario = COM_MUNICIPIO;
    cenario.servico.inscricao = inscricao({
      ...RESPONDIDA,
      situacao: SituacaoInscricao.submetida,
      respostas: {
        ...RESPONDIDA.respostas,
        NATURALIDADE_MUNICIPIO: { codigo: '2927408', rotulo: 'Salvador' },
      },
    });
    const tela = await cenario.abrir();

    expect(campoDe(tela, 'NATURALIDADE_MUNICIPIO').value).toBe('Salvador (BA)');
    expect(cenario.leituraDeMunicipio).not.toHaveBeenCalled();

    await cenario.clicar(botao(tela, 'Enviar inscrição'));
    expect(cenario.servico.enviados[0].respostas?.['NATURALIDADE_MUNICIPIO']).toBe('2927408');
  });

  it('dá nome ao município do rascunho lendo o código uma só vez', async () => {
    cenario.leituraDeMunicipio.mockReturnValue(ok(SALVADOR));
    cenario.servico.formulario = COM_MUNICIPIO;
    cenario.servico.inscricao = inscricao({ respostas: { NATURALIDADE_MUNICIPIO: '2927408' } });
    const tela = await cenario.abrir();

    expect(campoDe(tela, 'NATURALIDADE_MUNICIPIO').value).toBe('Salvador (BA)');
    expect(cenario.leituraDeMunicipio).toHaveBeenCalledTimes(1);
    expect(cenario.leituraDeMunicipio).toHaveBeenCalledWith('2927408');
  });

  it('com o Geo fora do ar, o rascunho diz que o nome não foi carregado e mantém o código', async () => {
    cenario.leituraDeMunicipio.mockReturnValue(of(NAO_ENCONTRADO));
    cenario.servico.formulario = COM_MUNICIPIO;
    cenario.servico.inscricao = inscricao({ respostas: { NATURALIDADE_MUNICIPIO: '2927408' } });
    const tela = await cenario.abrir();

    expect(campoDe(tela, 'NATURALIDADE_MUNICIPIO').value).toBe(
      'Nome do município não carregado (código IBGE 2927408)',
    );
    await cenario.clicar(botao(tela, 'Salvar rascunho'));
    expect(cenario.servico.salvos[0].respostas?.['NATURALIDADE_MUNICIPIO']).toBe('2927408');
  });

  const desejaDe = (tela: HTMLElement): HTMLInputElement[] =>
    Array.from(tela.querySelectorAll<HTMLInputElement>('[data-campo="DESEJA_NOME_SOCIAL"] input'));

  it('o nome social da conta entra na resposta e não se edita', async () => {
    cenario.conta.update((c) => ({ ...c, nomeSocial: 'Ariel Drumond' }));
    cenario.servico.formulario = COM_NOME_SOCIAL;
    cenario.servico.inscricao = inscricao({ respostas: { DESEJA_NOME_SOCIAL: true } });
    const tela = await cenario.abrir();

    const social = campoDe(tela, 'NOME_SOCIAL');
    expect(social.readOnly).toBe(true);
    expect(social.value).toBe('Ariel Drumond');
    await cenario.clicar(botao(tela, 'Salvar rascunho'));
    expect(cenario.servico.salvos[0].respostas?.['NOME_SOCIAL']).toBe('Ariel Drumond');
  });

  it('a conta sem nome social deixa o campo vazio e travado, sem enviar valor', async () => {
    cenario.servico.formulario = COM_NOME_SOCIAL;
    cenario.servico.inscricao = inscricao({ respostas: { DESEJA_NOME_SOCIAL: true } });
    const tela = await cenario.abrir();

    const social = campoDe(tela, 'NOME_SOCIAL');
    expect(social.readOnly).toBe(true);
    expect(social.value).toBe('');
    await cenario.clicar(botao(tela, 'Salvar rascunho'));
    expect(cenario.servico.salvos[0].respostas?.['NOME_SOCIAL']).toBeNull();
  });

  it('na inscrição retomada, o nome social da conta substitui o gravado no rascunho', async () => {
    cenario.conta.update((c) => ({ ...c, nomeSocial: 'Ariel Drumond' }));
    cenario.servico.formulario = COM_NOME_SOCIAL;
    cenario.servico.inscricao = inscricao({
      respostas: { DESEJA_NOME_SOCIAL: true, NOME_SOCIAL: 'Outro Nome Gravado' },
    });
    const tela = await cenario.abrir();

    expect(campoDe(tela, 'NOME_SOCIAL').value).toBe('Ariel Drumond');
    await cenario.clicar(botao(tela, 'Salvar rascunho'));
    expect(cenario.servico.salvos[0].respostas?.['NOME_SOCIAL']).toBe('Ariel Drumond');
  });

  it('a conta com nome social abre "deseja usar nome social" como sim quando nada foi gravado', async () => {
    cenario.conta.update((c) => ({ ...c, nomeSocial: 'Ariel Drumond' }));
    cenario.servico.formulario = COM_NOME_SOCIAL;
    const tela = await cenario.abrir();

    await cenario.clicar(botao(tela, 'Salvar rascunho'));
    expect(cenario.servico.salvos[0].respostas?.['DESEJA_NOME_SOCIAL']).toBe(true);
    expect(desejaDe(tela).some((r) => r.checked)).toBe(true);
  });

  it('a conta sem nome social não marca "deseja usar nome social"', async () => {
    cenario.servico.formulario = COM_NOME_SOCIAL;
    const tela = await cenario.abrir();

    await cenario.clicar(botao(tela, 'Salvar rascunho'));
    expect(cenario.servico.salvos[0].respostas?.['DESEJA_NOME_SOCIAL']).toBeUndefined();
  });

  it('a desistência do nome social gravada prevalece sobre o da conta, e o nome da conta não vai', async () => {
    cenario.conta.update((c) => ({ ...c, nomeSocial: 'Ariel Drumond' }));
    cenario.servico.formulario = COM_NOME_SOCIAL;
    cenario.servico.inscricao = inscricao({
      respostas: { DESEJA_NOME_SOCIAL: false },
    });
    const tela = await cenario.abrir();

    await cenario.clicar(botao(tela, 'Salvar rascunho'));
    expect(cenario.servico.salvos[0].respostas?.['DESEJA_NOME_SOCIAL']).toBe(false);
    expect(cenario.servico.salvos[0].respostas?.['NOME_SOCIAL']).toBeNull();
  });

  it('a recusa do envio sem nome social na conta aparece no campo travado, com a orientação', async () => {
    const mensagem =
      'Você marcou que deseja usar nome social, mas sua conta não tem nome social cadastrado. Cadastre o nome social em Meu perfil ou desmarque a opção.';
    cenario.servico.formulario = {
      ...COM_NOME_SOCIAL,
      fatosColetados: COM_NOME_SOCIAL.fatosColetados.map((c) =>
        c.fatoCodigo === 'NOME_SOCIAL'
          ? { ...c, ajuda: 'Cadastre o nome social em Meu perfil.' }
          : c,
      ),
    };
    cenario.servico.recusaDoEnvio = apiFailure(
      {
        type: 'about:blank',
        title: 'Recusada',
        status: 422,
        code: 'uniplus.selecao.inscricao.nome_social_ausente_na_conta',
        traceId: '',
        errors: [
          {
            field: 'NOME_SOCIAL',
            code: 'uniplus.selecao.inscricao.nome_social_ausente_na_conta',
            message: mensagem,
          },
        ],
      },
      422,
      new HttpHeaders(),
    );
    cenario.servico.inscricao = inscricao({
      ...RESPONDIDA,
      respostas: { ...RESPONDIDA.respostas, DESEJA_NOME_SOCIAL: true },
    });
    const tela = await cenario.abrir();

    await cenario.clicar(botao(tela, 'Enviar inscrição'));

    const social = tela.querySelector('[data-campo="NOME_SOCIAL"]');
    expect(social?.querySelector('.field__error')?.textContent).toContain(mensagem);
    expect(social?.querySelector('.field__error')?.textContent).not.toContain('Responda');
    expect(social?.querySelector('.field__hint')?.textContent).toContain('Meu perfil');
    expect(campoDe(tela, 'NOME_SOCIAL').readOnly).toBe(true);
  });

  it('o titular revela o CPF da conta para conferir, sem nova consulta', async () => {
    const tela = await cenario.abrir();
    const consultas = (['iniciar', 'obter', 'salvar', 'submeter'] as const).map((metodo) =>
      vi.spyOn(cenario.servico, metodo),
    );

    await cenario.clicar(
      tela.querySelector('[data-campo="CPF"] button[aria-label="Mostrar CPF"]') as HTMLElement,
    );

    expect(campoDe(tela, 'CPF').value).toBe('699.598.363-71');
    for (const consulta of consultas) expect(consulta).not.toHaveBeenCalled();
  });
});
