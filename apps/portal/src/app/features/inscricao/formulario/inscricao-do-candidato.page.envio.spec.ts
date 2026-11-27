import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HttpHeaders } from '@angular/common/http';
import { of, Subject } from 'rxjs';
import { type ApiResult, apiFailure, apiOk } from '@uniplus/shared-core/http';
import {
  type InscricaoDto,
  type InscricaoRequest,
  SituacaoInscricaoCodigo,
} from '@uniplus/shared-data/selecao';
import { FORMULARIO_DE_INSCRICAO_MOCK } from './inscricao-do-candidato.testing';
import {
  ok,
  problema,
  RECIBO,
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

  it('a correção depois do envio é um novo envio, com o ETag da inscrição relida', async () => {
    cenario.servico.inscricao = inscricao(RESPONDIDA);
    const tela = await cenario.abrir();
    cenario.servico.inscricao = inscricao({
      ...RESPONDIDA,
      situacao: { codigo: SituacaoInscricaoCodigo.ENVIADA, rotulo: 'Situação de teste' },
      eTag: '"inscricao-1:2"',
    });
    await cenario.clicar(botao(tela, 'Enviar inscrição'));

    const eTags: string[] = [];
    cenario.servico.submeter = (_: string, request: InscricaoRequest, eTag?: string) => {
      eTags.push(eTag ?? '');
      cenario.servico.enviados.push(request);
      return ok(RECIBO);
    };
    await cenario.clicar(botao(tela, 'Enviar inscrição'));

    expect(eTags).toEqual(['"inscricao-1:2"']);
  });

  it('com pendência o botão de enviar fica inativo, com o motivo e as seções ao lado, e não envia', async () => {
    const tela = await cenario.abrir();

    const enviar = botao(tela, 'Enviar inscrição');
    expect(indisponivel(enviar)).toBe(true);
    const motivo = tela.querySelector('#inscricao-motivo-envio');
    expect(motivo?.textContent).toMatch(/Falt(a|am) corrigir \d+ itens?\./);
    expect(motivo?.querySelectorAll('li button').length).toBeGreaterThan(0);
    expect(enviar.getAttribute('aria-describedby')).toBe('inscricao-motivo-envio');

    await cenario.clicar(enviar);
    expect(cenario.servico.enviados).toEqual([]);
  });

  it('com o formulário válido o envio fica ativo e sem motivo', async () => {
    cenario.servico.inscricao = inscricao(RESPONDIDA);
    const tela = await cenario.abrir();

    expect(indisponivel(botao(tela, 'Enviar inscrição'))).toBe(false);
    expect(tela.querySelector('#inscricao-motivo-envio')).toBeNull();
  });

  it('a inscrição enviada não oferece rascunho: o aviso diz que corrigir é enviar de novo', async () => {
    cenario.servico.inscricao = inscricao({
      ...RESPONDIDA,
      situacao: { codigo: SituacaoInscricaoCodigo.ENVIADA, rotulo: 'Situação de teste' },
    });
    const tela = await cenario.abrir();

    expect(botao(tela, 'Salvar rascunho')).toBeUndefined();
    const aviso = tela.querySelector('#inscricao-correcao');
    expect(aviso?.textContent).toContain('envie de novo: cada envio gera um novo comprovante');
    expect(botao(tela, 'Enviar inscrição').getAttribute('aria-describedby')).toBe(
      'inscricao-correcao',
    );
  });

  it('o rascunho deixa de ser oferecido logo depois do primeiro envio', async () => {
    cenario.servico.inscricao = inscricao(RESPONDIDA);
    const tela = await cenario.abrir();
    expect(botao(tela, 'Salvar rascunho')).toBeDefined();

    await cenario.clicar(botao(tela, 'Enviar inscrição'));

    expect(botao(tela, 'Salvar rascunho')).toBeUndefined();
  });

  it('o aceite leva a versão e o hash do termo da versão fixada', async () => {
    cenario.servico.inscricao = inscricao(RESPONDIDA);
    const tela = await cenario.abrir();

    await cenario.clicar(botao(tela, 'Enviar inscrição'));

    const termo = FORMULARIO_DE_INSCRICAO_MOCK.formulario.termos[0];
    expect(cenario.servico.enviados[0].aceites).toEqual([
      {
        formularioCodigo: 'INSCRICAO',
        codigo: 'VERACIDADE',
        versaoId: termo.versaoId,
        hashVersao: termo.conteudo.hashVersao,
      },
    ]);
  });

  it('o envio leva o termo marcado antes dele', async () => {
    cenario.servico.inscricao = inscricao({ respostas: RESPONDIDA.respostas });
    const tela = await cenario.abrir();
    const secoes = tela.querySelectorAll<HTMLButtonElement>(
      'nav[aria-label="Seções do formulário"] button',
    );
    await cenario.clicar(secoes[secoes.length - 1]);

    await cenario.clicar(
      tela.querySelector(
        '[data-campo="Inscricao:VERACIDADE"] input[type="checkbox"]',
      ) as HTMLElement,
    );
    await cenario.clicar(botao(tela, 'Enviar inscrição'));

    expect(cenario.servico.enviados[0].aceites?.map((a) => a.codigo)).toEqual(['VERACIDADE']);
  });

  it('a recusa por campo do envio aparece no campo e no resumo, com a mensagem da API', async () => {
    cenario.servico.recusaDoEnvio = apiFailure(
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
    );
    cenario.servico.inscricao = inscricao(RESPONDIDA);
    const tela = await cenario.abrir();

    await cenario.clicar(botao(tela, 'Enviar inscrição'));

    const nome = tela.querySelector('[data-campo="NOME"]');
    const mensagem = "O item 'NOME' é obrigatório e está sem resposta.";
    expect(nome?.querySelector('.field__error')?.textContent).toContain(mensagem);
    const resumo = tela.querySelector('#inscricao-recusas-titulo')?.closest('section');
    expect(resumo?.textContent).toContain('Nome completo');
    expect(resumo?.textContent).toContain(mensagem);
    const topo = tela.querySelector('.formulario-candidato__secao ui-alert');
    expect(topo?.textContent).toContain('O servidor recusou 1 resposta desta seção');
    expect(document.activeElement).toBe(campoDe(tela, 'NOME'));
  });

  it('o envio feito mostra o número do recibo e leva ao comprovante emitido', async () => {
    cenario.servico.inscricao = inscricao(RESPONDIDA);
    const tela = await cenario.abrir();

    await cenario.clicar(botao(tela, 'Enviar inscrição'));

    expect(tela.textContent).toContain('Sua inscrição recebeu o número 2027-000001');
    expect(tela.querySelector('[aria-live]')?.textContent).toBe(
      'Inscrição enviada. Número 2027-000001.',
    );
    const link = Array.from(tela.querySelectorAll('a')).find(
      (a) => a.textContent?.trim() === 'Ver o comprovante',
    );
    expect(link?.getAttribute('href')).toBe(`/inscricao/comprovante/${RECIBO.inscricaoId}/2`);
  });

  it('a falha sem resposta cujo envio o servidor gravou não diz que a inscrição não foi gravada', async () => {
    cenario.servico.inscricao = inscricao(RESPONDIDA);
    const tela = await cenario.abrir();
    cenario.servico.recusaDoEnvio = problema(503, 'uniplus.teste');
    cenario.servico.inscricao = inscricao({
      ...RESPONDIDA,
      situacao: { codigo: SituacaoInscricaoCodigo.ENVIADA, rotulo: 'Situação de teste' },
      numeroInscricao: '2027-000001',
      eTag: '"inscricao-1:2"',
    });

    await cenario.clicar(botao(tela, 'Enviar inscrição'));

    expect(tela.querySelector('[aria-live]')?.textContent).toBe(
      'Inscrição enviada. Número 2027-000001.',
    );
    expect(tela.textContent).toContain('Sua inscrição já foi enviada');
    expect(tela.textContent).not.toContain('não foi gravada');
    expect(tela.textContent).not.toContain('Não conseguimos confirmar a gravação');
  });

  it('o envio que fica sem resposta relê a inscrição, e o reenvio sai com o ETag gravado', async () => {
    cenario.servico.inscricao = inscricao(RESPONDIDA);
    const tela = await cenario.abrir();
    cenario.servico.recusaDoEnvio = problema(0, 'uniplus.client.network_error');
    cenario.servico.inscricao = inscricao({
      ...RESPONDIDA,
      situacao: { codigo: SituacaoInscricaoCodigo.ENVIADA, rotulo: 'Situação de teste' },
      eTag: '"inscricao-1:2"',
    });
    await cenario.clicar(botao(tela, 'Enviar inscrição'));

    const eTags: string[] = [];
    cenario.servico.submeter = (_: string, request: InscricaoRequest, eTag?: string) => {
      eTags.push(eTag ?? '');
      cenario.servico.enviados.push(request);
      return ok(RECIBO);
    };
    await cenario.clicar(botao(tela, 'Enviar inscrição'));

    expect(eTags).toEqual(['"inscricao-1:2"']);
  });

  it('depois do envio, o formulário segue ocupado até a releitura do ETag terminar', async () => {
    cenario.servico.inscricao = inscricao(RESPONDIDA);
    const tela = await cenario.abrir();
    const releitura = new Subject<ApiResult<InscricaoDto>>();
    cenario.servico.obter = () => releitura;

    await cenario.clicar(botao(tela, 'Enviar inscrição'));
    expect(indisponivel(botao(tela, 'Enviando'))).toBe(true);
    expect(botao(tela, 'Enviando').getAttribute('aria-busy')).toBe('true');

    releitura.next(
      apiOk(inscricao({ ...RESPONDIDA, eTag: '"inscricao-1:2"' }), 200, new HttpHeaders()),
    );
    cenario.fixture.detectChanges();

    expect(indisponivel(botao(tela, 'Enviar inscrição'))).toBe(false);
  });

  it('a releitura que falha depois do envio manda recarregar a página e não deixa enviar com o ETag velho', async () => {
    cenario.servico.inscricao = inscricao(RESPONDIDA);
    const tela = await cenario.abrir();
    cenario.servico.obter = () => of(problema(503, 'uniplus.teste'));

    await cenario.clicar(botao(tela, 'Enviar inscrição'));

    expect(tela.textContent).toContain('Recarregue a página antes de corrigir');
    expect(indisponivel(botao(tela, 'Enviar inscrição'))).toBe(true);
    botao(tela, 'Enviar inscrição').click();
    expect(cenario.servico.enviados).toHaveLength(1);
  });

  it('a falha sem resposta mantém o formulário ocupado até a releitura do ETag terminar', async () => {
    cenario.servico.inscricao = inscricao(RESPONDIDA);
    const tela = await cenario.abrir();
    cenario.servico.recusaDoEnvio = problema(0, 'uniplus.client.network_error');
    const releitura = new Subject<ApiResult<InscricaoDto>>();
    cenario.servico.obter = () => releitura;

    await cenario.clicar(botao(tela, 'Enviar inscrição'));
    expect(indisponivel(botao(tela, 'Enviando'))).toBe(true);
    expect(botao(tela, 'Enviando').getAttribute('aria-busy')).toBe('true');

    releitura.next(
      apiOk(inscricao({ ...RESPONDIDA, eTag: '"inscricao-1:2"' }), 200, new HttpHeaders()),
    );
    cenario.fixture.detectChanges();

    expect(indisponivel(botao(tela, 'Enviar inscrição'))).toBe(false);
  });

  it('a releitura que falha depois de uma falha sem resposta manda recarregar a página', async () => {
    cenario.servico.inscricao = inscricao(RESPONDIDA);
    const tela = await cenario.abrir();
    cenario.servico.recusaDoEnvio = problema(503, 'uniplus.teste');
    cenario.servico.obter = () => of(problema(503, 'uniplus.teste'));

    await cenario.clicar(botao(tela, 'Enviar inscrição'));

    expect(tela.textContent).toContain('Não conseguimos confirmar se a inscrição foi gravada');
    expect(tela.textContent).not.toContain('foi enviada');
    expect(tela.textContent).not.toContain('A inscrição não foi gravada');
    expect(indisponivel(botao(tela, 'Enviar inscrição'))).toBe(true);
  });
});
