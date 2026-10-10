import { HttpHeaders } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, type Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import { type ApiResult, apiFailure, apiOk } from '@uniplus/shared-core/http';
import {
  type ComprovanteInscricaoDto,
  type FormularioRenderizavelDto,
  type InscricaoDto,
  type InscricaoRequest,
  SituacaoInscricao,
} from '@uniplus/shared-data/selecao';
import { BUSCA_DE_CEP, BUSCA_DE_MUNICIPIOS } from '@uniplus/shared-ui/components';

import { FORMULARIO_DE_INSCRICAO_MOCK } from './inscricao-do-candidato.mock';
import { InscricaoDoCandidatoPage } from './inscricao-do-candidato.page';
import {
  InscricaoDoCandidatoService,
  type OfertaDaInscricao,
} from './inscricao-do-candidato.service';

/** Fernanda Drumond, persona fictícia do portal de documentação. */
const CPF_DA_CONTA = '69959836371';
const PROCESSO = '0199e000-0000-7000-8000-0000000000d1';

const MEDICINA: OfertaDaInscricao = { id: 'oferta-1', nome: 'Medicina — Marabá' };
const DIREITO: OfertaDaInscricao = { id: 'oferta-2', nome: 'Direito — Marabá' };

const ok = <T>(data: T): Observable<ApiResult<T>> => of(apiOk(data, 200, new HttpHeaders()));

function inscricao(outros: Partial<InscricaoDto> = {}): InscricaoDto {
  return {
    id: 'inscricao-1',
    processoSeletivoId: PROCESSO,
    situacao: SituacaoInscricao.rascunho,
    numeroInscricao: null,
    versaoFormularioId: 'versao-1',
    ofertaCursoId: null,
    respostas: {},
    derivados: {},
    grupos: {},
    aceites: [],
    eTag: '"inscricao-1:1"',
    ...outros,
  };
}

class ServicoDublê extends InscricaoDoCandidatoService {
  inscricao = inscricao();
  formulario: FormularioRenderizavelDto = FORMULARIO_DE_INSCRICAO_MOCK;
  ofertas: readonly OfertaDaInscricao[] = [MEDICINA];
  readonly salvos: InscricaoRequest[] = [];
  readonly enviados: InscricaoRequest[] = [];
  recusaDoEnvio: ApiResult<ComprovanteInscricaoDto> | null = null;

  iniciar = () => ok(this.inscricao);
  obter = () => ok(this.inscricao);
  obterFormulario = () => ok(this.formulario);
  obterOfertas = () => ok(this.ofertas);
  salvar = (_: string, request: InscricaoRequest) => {
    this.salvos.push(request);
    return ok(this.inscricao);
  };
  submeter = (_: string, request: InscricaoRequest) => {
    this.enviados.push(request);
    return this.recusaDoEnvio ? of(this.recusaDoEnvio) : ok({} as ComprovanteInscricaoDto);
  };
}

describe('InscricaoDoCandidatoPage', () => {
  let fixture: ComponentFixture<InscricaoDoCandidatoPage>;
  let servico: ServicoDublê;

  beforeEach(() => {
    servico = new ServicoDublê();
    TestBed.configureTestingModule({
      imports: [InscricaoDoCandidatoPage],
      providers: [
        provideRouter([]),
        { provide: InscricaoDoCandidatoService, useValue: servico },
        { provide: UserContextService, useValue: { user: signal({ cpf: CPF_DA_CONTA }) } },
        { provide: BUSCA_DE_CEP, useValue: () => of({ ok: false }) },
        { provide: BUSCA_DE_MUNICIPIOS, useValue: () => of({ ok: true, data: [] }) },
      ],
    });
  });

  afterEach(() => vi.restoreAllMocks());

  const abrir = async (): Promise<HTMLElement> => {
    fixture = TestBed.createComponent(InscricaoDoCandidatoPage);
    fixture.componentRef.setInput('processoId', PROCESSO);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };
  const botao = (tela: HTMLElement, texto: string): HTMLButtonElement =>
    [...tela.querySelectorAll('button')].find((b) =>
      b.textContent?.trim().startsWith(texto),
    ) as HTMLButtonElement;
  const clicar = async (elemento: HTMLElement): Promise<void> => {
    elemento.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const campoDe = (tela: HTMLElement, fato: string): HTMLInputElement =>
    tela.querySelector(`[data-campo="${fato}"] input`) as HTMLInputElement;

  it('o CPF da conta entra na resposta, aparece mascarado e não se edita', async () => {
    const tela = await abrir();

    const cpf = campoDe(tela, 'CPF');
    expect(cpf.readOnly).toBe(true);
    expect(cpf.value).toBe('***.598.363-**');

    await clicar(botao(tela, 'Salvar rascunho'));
    expect(servico.salvos[0].respostas?.['CPF']).toBe(CPF_DA_CONTA);
  });

  /** O aviso só promete o que o edital diz: a fase em que cada documento é pedido não é publicada. */
  it('a seção de documentos sem exigência na inscrição diz que nada se envia nesta etapa', async () => {
    servico.formulario = {
      ...FORMULARIO_DE_INSCRICAO_MOCK,
      comprovacaoDocumental: [],
      etapas: [
        ...FORMULARIO_DE_INSCRICAO_MOCK.etapas,
        {
          codigo: 'DOCUMENTOS',
          codigoNasRegras: null,
          ordem: 3,
          tipo: 'BLOCO',
          bloco: 'COMPROVACAO_DOCUMENTAL',
          titulo: 'Documentos',
          descricao: null,
          aviso: null,
        },
      ],
    };
    const tela = await abrir();

    const secao = [...tela.querySelectorAll<HTMLButtonElement>('nav button')].find((b) =>
      b.textContent?.includes('Documentos'),
    ) as HTMLButtonElement;
    await clicar(secao);

    expect(tela.querySelector('.formulario-candidato__secao')?.textContent).toContain(
      'Você não envia documentos nesta etapa.',
    );
  });

  it('a correção depois do envio é um novo envio, com o ETag da inscrição relida', async () => {
    const tela = await abrir();
    servico.inscricao = inscricao({
      situacao: SituacaoInscricao.submetida,
      eTag: '"inscricao-1:2"',
    });
    await clicar(botao(tela, 'Enviar inscrição'));

    const eTags: string[] = [];
    servico.submeter = (_: string, request: InscricaoRequest, eTag?: string) => {
      eTags.push(eTag ?? '');
      servico.enviados.push(request);
      return ok({} as ComprovanteInscricaoDto);
    };
    await clicar(botao(tela, 'Enviar inscrição'));

    expect(eTags).toEqual(['"inscricao-1:2"']);
  });

  it('a inscrição enviada não oferece rascunho: o aviso diz que corrigir é enviar de novo', async () => {
    servico.inscricao = inscricao({ situacao: SituacaoInscricao.submetida });
    const tela = await abrir();

    expect(botao(tela, 'Salvar rascunho')).toBeUndefined();
    const aviso = tela.querySelector('#inscricao-correcao');
    expect(aviso?.textContent).toContain('envie de novo: cada envio gera um novo comprovante');
    expect(botao(tela, 'Enviar inscrição').getAttribute('aria-describedby')).toBe(
      'inscricao-correcao',
    );
  });

  it('o rascunho deixa de ser oferecido logo depois do primeiro envio', async () => {
    const tela = await abrir();
    expect(botao(tela, 'Salvar rascunho')).toBeDefined();

    await clicar(botao(tela, 'Enviar inscrição'));

    expect(botao(tela, 'Salvar rascunho')).toBeUndefined();
  });

  it('a retomada volta com as respostas e os aceites gravados', async () => {
    servico.inscricao = inscricao({
      respostas: { NOME: 'Fernanda Laura Nicole Drumond' },
      aceites: [{ codigo: 'VERACIDADE', versaoId: 'v1', hashVersao: 'h1' }],
    });
    const tela = await abrir();

    expect(campoDe(tela, 'NOME').value).toBe('Fernanda Laura Nicole Drumond');
    await clicar(botao(tela, 'Salvar rascunho'));
    expect(servico.salvos[0].aceites?.map((a) => a.codigo)).toEqual(['VERACIDADE']);
  });

  it('a resposta apagada vai como nulo, para o servidor não manter a gravada', async () => {
    servico.inscricao = inscricao({ respostas: { NOME: 'Fernanda Laura Nicole Drumond' } });
    const tela = await abrir();
    const nome = campoDe(tela, 'NOME');
    nome.value = '';
    nome.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    await clicar(botao(tela, 'Salvar rascunho'));

    expect(servico.salvos[0].respostas).toHaveProperty('NOME', null);
  });

  it('o aceite leva a versão e o hash do termo da versão fixada', async () => {
    servico.inscricao = inscricao({
      aceites: [{ codigo: 'VERACIDADE', versaoId: 'v1', hashVersao: 'h1' }],
    });
    const tela = await abrir();

    await clicar(botao(tela, 'Enviar inscrição'));

    const termo = FORMULARIO_DE_INSCRICAO_MOCK.termos[0];
    expect(servico.enviados[0].aceites).toEqual([
      { codigo: 'VERACIDADE', versaoId: termo.versaoId, hashVersao: termo.hashVersao },
    ]);
  });

  it('o envio leva o termo marcado logo antes, sem esperar a próxima emissão do formulário', async () => {
    const tela = await abrir();
    const secoes = tela.querySelectorAll<HTMLButtonElement>(
      'nav[aria-label="Seções do formulário"] button',
    );
    await clicar(secoes[secoes.length - 1]);

    (
      tela.querySelector('[data-campo="VERACIDADE"] input[type="checkbox"]') as HTMLInputElement
    ).click();
    botao(tela, 'Enviar inscrição').click();

    expect(servico.enviados[0].aceites?.map((a) => a.codigo)).toEqual(['VERACIDADE']);
  });

  it('a recusa por campo do envio aparece no campo, com a mensagem para o candidato', async () => {
    servico.recusaDoEnvio = apiFailure(
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
    const tela = await abrir();

    await clicar(botao(tela, 'Enviar inscrição'));

    const nome = tela.querySelector('[data-campo="NOME"]');
    expect(nome?.querySelector('.field__error')?.textContent).toContain('Responda este campo.');
    expect(tela.textContent).not.toContain("O item 'NOME'");
  });

  const problema = (status: number, code: string) =>
    apiFailure(
      { type: 'about:blank', title: 'Recusa', status, code, traceId: '' },
      status,
      new HttpHeaders(),
    );

  it('gravar sobre uma revisão que outra janela mudou recarrega a inscrição e avisa', async () => {
    const tela = await abrir();
    servico.salvar = () => of(problema(412, 'uniplus.selecao.inscricao.precondicao_falhou'));
    servico.inscricao = inscricao({ respostas: { NOME: 'Fernanda Laura Nicole Drumond' } });

    await clicar(botao(tela, 'Salvar rascunho'));

    expect(tela.textContent).toContain('A inscrição mudou em outra janela');
    expect(campoDe(tela, 'NOME').value).toBe('Fernanda Laura Nicole Drumond');
  });

  it('o rascunho recusado porque outra janela já enviou a inscrição relê a inscrição e troca o rascunho pela correção', async () => {
    const tela = await abrir();
    servico.salvar = () => of(problema(422, 'uniplus.selecao.inscricao.rascunho_so_antes_do_envio'));
    servico.inscricao = inscricao({ situacao: SituacaoInscricao.submetida });

    await clicar(botao(tela, 'Salvar rascunho'));

    expect(botao(tela, 'Salvar rascunho')).toBeUndefined();
    expect(tela.querySelector('#inscricao-correcao')).not.toBeNull();
  });

  it('o envio que fica sem resposta relê a inscrição, e o reenvio sai com o ETag gravado', async () => {
    const tela = await abrir();
    servico.recusaDoEnvio = problema(0, 'uniplus.client.network_error');
    servico.inscricao = inscricao({
      situacao: SituacaoInscricao.submetida,
      eTag: '"inscricao-1:2"',
    });
    await clicar(botao(tela, 'Enviar inscrição'));

    const eTags: string[] = [];
    servico.submeter = (_: string, request: InscricaoRequest, eTag?: string) => {
      eTags.push(eTag ?? '');
      servico.enviados.push(request);
      return ok({} as ComprovanteInscricaoDto);
    };
    await clicar(botao(tela, 'Enviar inscrição'));

    expect(eTags).toEqual(['"inscricao-1:2"']);
  });

  it('o seletor de curso só aparece quando o processo oferece mais de um', async () => {
    let tela = await abrir();
    expect(tela.querySelector('#inscricao-oferta')).toBeNull();
    await clicar(botao(tela, 'Salvar rascunho'));
    expect(servico.salvos[0].ofertaCursoId).toBe(MEDICINA.id);

    servico.ofertas = [MEDICINA, DIREITO];
    tela = await abrir();
    expect(tela.querySelector('#inscricao-oferta')).not.toBeNull();
  });

  const escolherCurso = async (tela: HTMLElement, id: string): Promise<void> => {
    const select = tela.querySelector('#inscricao-oferta') as HTMLSelectElement;
    select.value = id;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
  };

  it('a recusa da oferta aparece no seletor de curso e leva o foco até ele', async () => {
    servico.ofertas = [MEDICINA, DIREITO];
    servico.recusaDoEnvio = apiFailure(
      {
        type: 'about:blank',
        title: 'Recusada',
        status: 422,
        code: 'uniplus.selecao.inscricao.oferta_obrigatoria',
        traceId: '',
        errors: [
          {
            field: 'ofertaCursoId',
            code: 'uniplus.selecao.inscricao.oferta_obrigatoria',
            message: '',
          },
        ],
      },
      422,
      new HttpHeaders(),
    );
    const tela = await abrir();

    await clicar(botao(tela, 'Enviar inscrição'));

    const select = tela.querySelector('#inscricao-oferta') as HTMLSelectElement;
    expect(tela.querySelector('#inscricao-oferta-erro')?.textContent).toContain('Escolha o curso.');
    expect(select.getAttribute('aria-describedby')).toBe('inscricao-oferta-erro');
    expect(document.activeElement).toBe(select);
  });

  it('a releitura depois de uma falha sem resposta mantém o curso escolhido', async () => {
    servico.ofertas = [MEDICINA, DIREITO];
    servico.recusaDoEnvio = problema(0, 'uniplus.client.network_error');
    const tela = await abrir();
    await escolherCurso(tela, DIREITO.id);

    await clicar(botao(tela, 'Enviar inscrição'));
    servico.recusaDoEnvio = null;
    await clicar(botao(tela, 'Enviar inscrição'));

    expect(servico.enviados.map((r) => r.ofertaCursoId)).toEqual([DIREITO.id, DIREITO.id]);
  });

  it('o rascunho não vai para o armazenamento do navegador', async () => {
    const gravacao = vi.spyOn(Storage.prototype, 'setItem');
    const tela = await abrir();

    await clicar(botao(tela, 'Salvar rascunho'));

    expect(gravacao).not.toHaveBeenCalled();
  });
});
