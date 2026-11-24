import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpHeaders } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { type ApiResult, apiFailure, apiOk } from '@uniplus/shared-core/http';
import { passarOTempo } from '@uniplus/shared-testing';
import {
  TipoObrigatoriedadeCodigo,
  type InscricaoDto,
  type InscricaoRequest,
  SituacaoInscricaoCodigo,
  TipoRenderizacaoCodigo,
} from '@uniplus/shared-data/selecao';
import {
  DADOS,
  FORMULARIO_DE_INSCRICAO_MOCK,
  campoColetado,
  comFormulario,
  item,
} from './inscricao-do-candidato.testing';
import {
  problema,
  COM_NOME_SOCIAL,
  inscricao,
  RESPONDIDA,
  botao,
  indisponivel,
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

  it('a retomada volta com as respostas e os aceites gravados', async () => {
    cenario.servico.inscricao = inscricao({
      respostas: { NOME: 'Fernanda Laura Nicole Drumond' },
      aceites: [{ codigo: 'VERACIDADE', versaoId: 'v1', hashVersao: 'h1' }],
    });
    const tela = await cenario.abrir();

    expect(campoDe(tela, 'NOME').value).toBe('Fernanda Laura Nicole Drumond');
    await cenario.clicar(botao(tela, 'Salvar rascunho'));
    expect(cenario.servico.salvos[0].aceites?.map((a) => a.codigo)).toEqual(['VERACIDADE']);
  });

  it('a resposta apagada vai como nulo, para o servidor não manter a gravada', async () => {
    cenario.servico.inscricao = inscricao({ respostas: { NOME: 'Fernanda Laura Nicole Drumond' } });
    const tela = await cenario.abrir();
    const nome = campoDe(tela, 'NOME');
    nome.value = '';
    nome.dispatchEvent(new Event('input'));
    cenario.fixture.detectChanges();

    await cenario.clicar(botao(tela, 'Salvar rascunho'));

    expect(cenario.servico.salvos[0].respostas).toHaveProperty('NOME', null);
  });

  it('o grupo que o candidato removeu vai como lista vazia, para o servidor não manter as ocorrências gravadas', async () => {
    const { coleta, regras } = FORMULARIO_DE_INSCRICAO_MOCK.formulario;
    const ocorrencias = { minimo: 0, maximo: null, incluiCandidato: false };
    cenario.servico.formulario = comFormulario(FORMULARIO_DE_INSCRICAO_MOCK, {
      coleta: {
        ...coleta,
        grupos: [
          {
            codigo: 'FAMILIA',
            ordem: 0,
            etapaCodigo: DADOS,
            rotulo: 'Integrante',
            ocorrencias,
            subitens: [campoColetado('RENDA', 'Renda', TipoRenderizacaoCodigo.NUMERO)],
          },
        ],
      },
      regras: {
        ...regras,
        etapas: regras.etapas.map((etapa, posicao) =>
          posicao > 0
            ? etapa
            : {
                ...etapa,
                grupos: [
                  {
                    codigo: 'FAMILIA',
                    ocorrencias,
                    regras: {
                      exibicao: null,
                      obrigatoriedade: { tipo: TipoObrigatoriedadeCodigo.SEMPRE, predicado: null },
                    },
                    subitens: [item('RENDA')],
                  },
                ],
              },
        ),
      },
    });
    cenario.servico.inscricao = inscricao({
      grupos: { FAMILIA: [{ id: 'ocorrencia-1', respostas: { RENDA: 1500 } }] },
    });
    const tela = await cenario.abrir();
    await cenario.clicar(botao(tela, 'Remover'));

    await cenario.clicar(botao(tela, 'Salvar rascunho'));

    expect(cenario.servico.salvos[0].grupos).toHaveProperty('FAMILIA', []);
  });

  it('gravar sobre uma revisão defasada relê a inscrição e o formulário e avisa que foi atualizada', async () => {
    const tela = await cenario.abrir();
    expect(tela.querySelector('[data-campo="DESEJA_NOME_SOCIAL"]')).toBeNull();
    cenario.servico.salvar = () =>
      of(problema(412, 'uniplus.selecao.inscricao.precondicao_falhou'));
    cenario.servico.formulario = COM_NOME_SOCIAL;
    cenario.servico.inscricao = inscricao({ respostas: { NOME: 'Fernanda Laura Nicole Drumond' } });

    await cenario.clicar(botao(tela, 'Salvar rascunho'));

    expect(tela.textContent).toContain('A inscrição foi atualizada');
    expect(tela.querySelector('[data-campo="DESEJA_NOME_SOCIAL"]')).not.toBeNull();
    expect(campoDe(tela, 'NOME').value).toBe('Fernanda Laura Nicole Drumond');
  });

  it('o rascunho recusado porque outra janela já enviou a inscrição relê a inscrição e troca o rascunho pela correção', async () => {
    const tela = await cenario.abrir();
    cenario.servico.salvar = () =>
      of(problema(422, 'uniplus.selecao.inscricao.rascunho_so_antes_do_envio'));
    cenario.servico.inscricao = inscricao({
      situacao: { codigo: SituacaoInscricaoCodigo.SUBMETIDA, rotulo: 'Situação de teste' },
    });

    await cenario.clicar(botao(tela, 'Salvar rascunho'));

    expect(botao(tela, 'Salvar rascunho')).toBeUndefined();
    expect(tela.querySelector('#inscricao-correcao')).not.toBeNull();
  });

  it('o rascunho que o servidor gravou apesar da falha sem resposta é confirmado no aviso', async () => {
    const tela = await cenario.abrir();
    cenario.servico.salvar = () => of(problema(503, 'uniplus.teste'));
    cenario.servico.inscricao = inscricao({ eTag: '"inscricao-1:2"' });

    await cenario.clicar(botao(tela, 'Salvar rascunho'));

    expect(tela.querySelector('[aria-live]')?.textContent).toBe('Rascunho salvo.');
    expect(tela.textContent).not.toContain('Não conseguimos confirmar a gravação');
  });

  describe('leituras que se cruzam', () => {
    it('o início que responde depois de uma leitura mais nova não a substitui', async () => {
      const primeira = new Subject<ApiResult<InscricaoDto>>();
      const original = cenario.servico.iniciar;
      let chamadas = 0;
      cenario.servico.iniciar = () => (chamadas++ === 0 ? primeira : original());
      const leitura = cenario.abrirSemAtender();

      cenario.servico.inscricao = inscricao({ eTag: '"novo"' });
      leitura.recarregar();
      await cenario.atenderOFormulario();
      expect(leitura.inscricao()?.eTag).toBe('"novo"');

      primeira.next(apiOk(inscricao({ eTag: '"velho"' }), 200, new HttpHeaders()));
      await cenario.atenderOFormulario();

      expect(leitura.inscricao()?.eTag).toBe('"novo"');
      expect(leitura.estado()).toBe('pronto');
    });

    it('a leitura do formulário que ficou para trás é cancelada pela nova', async () => {
      const http = TestBed.inject(HttpTestingController);
      const leitura = cenario.abrirSemAtender();
      await Promise.resolve();
      cenario.fixture.detectChanges();
      const antiga = http.expectOne((r) => r.url.endsWith('/inscricao/formulario'));

      cenario.servico.inscricao = inscricao({ eTag: '"novo"' });
      leitura.recarregar();
      await cenario.atenderOFormulario();

      expect(antiga.cancelled).toBe(true);
      expect(leitura.inscricao()?.eTag).toBe('"novo"');
    });
  });

  describe('gravação em curso', () => {
    const emCurso = async (): Promise<{
      tela: HTMLElement;
      salvar: HTMLButtonElement;
      resposta: Subject<ApiResult<InscricaoDto>>;
    }> => {
      cenario.servico.inscricao = inscricao(RESPONDIDA);
      const tela = await cenario.abrir();
      const resposta = new Subject<ApiResult<InscricaoDto>>();
      cenario.servico.salvar = (_: string, request: InscricaoRequest) => {
        cenario.servico.salvos.push(request);
        return resposta;
      };
      const salvar = botao(tela, 'Salvar rascunho');
      salvar.focus();
      await cenario.clicar(salvar);
      return { tela, salvar, resposta };
    };

    it('deixa o formulário somente leitura, sem tirar o foco nem os valores', async () => {
      const { tela, salvar } = await emCurso();

      expect(campoDe(tela, 'NOME').closest('fieldset')?.disabled).toBe(true);
      expect(campoDe(tela, 'NOME').matches(':disabled')).toBe(true);
      expect(campoDe(tela, 'NOME').value).not.toBe('');
      expect(salvar.textContent?.trim()).toBe('Salvando…');
      expect(salvar.getAttribute('aria-busy')).toBe('true');
      expect(indisponivel(salvar)).toBe(true);
      expect(document.activeElement).toBe(salvar);
    });

    it('não parte outra gravação por clique, nem em Salvar nem em Enviar', async () => {
      const { tela, salvar } = await emCurso();

      salvar.click();
      botao(tela, 'Enviar inscrição').click();
      cenario.fixture.detectChanges();

      expect(cenario.servico.salvos).toHaveLength(1);
      expect(cenario.servico.enviados).toHaveLength(0);
    });

    it('devolve o formulário ao fim e anuncia o rascunho salvo', async () => {
      const { tela, salvar, resposta } = await emCurso();

      resposta.next(apiOk(inscricao(RESPONDIDA), 200, new HttpHeaders()));
      cenario.fixture.detectChanges();

      expect(campoDe(tela, 'NOME').closest('fieldset')?.disabled).toBe(false);
      expect(salvar.textContent?.trim()).toBe('Salvar rascunho');
      expect(salvar.getAttribute('aria-busy')).toBeNull();
      expect(tela.querySelector('[aria-live="polite"].sr-only')?.textContent).toBe(
        'Rascunho salvo.',
      );
      expect(document.activeElement).toBe(salvar);
    });

    it('reabilita o formulário ao receber a recusa, para o foco chegar ao campo recusado', async () => {
      const { tela, resposta } = await emCurso();

      resposta.next(
        apiFailure(
          {
            type: 'about:blank',
            title: 'Recusada',
            status: 422,
            code: 'uniplus.selecao.inscricao.item_obrigatorio_ausente',
            traceId: '',
            errors: [
              {
                field: 'NOME',
                code: 'uniplus.selecao.inscricao.item_obrigatorio_ausente',
                message: "O item 'NOME' é obrigatório e está sem resposta.",
              },
            ],
          },
          422,
          new HttpHeaders(),
        ),
      );
      cenario.fixture.detectChanges();
      await passarOTempo(0);
      cenario.fixture.detectChanges();

      expect(campoDe(tela, 'NOME').closest('fieldset')?.disabled).toBe(false);
      expect(document.activeElement).toBe(campoDe(tela, 'NOME'));
    });
  });

  it('o rascunho não vai para o armazenamento do navegador', async () => {
    const gravacao = vi.spyOn(Storage.prototype, 'setItem');
    const tela = await cenario.abrir();

    await cenario.clicar(botao(tela, 'Salvar rascunho'));

    expect(gravacao).not.toHaveBeenCalled();
  });
});
