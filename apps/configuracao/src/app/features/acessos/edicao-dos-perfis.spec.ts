import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  PerfisApi,
  VersoesDoPerfilApi,
  type EnvioDoDocumentoDto,
  type PerfilDto,
} from '@uniplus/shared-data/autorizacao';
import { EdicaoDosPerfis } from './edicao-dos-perfis';
import { provideMensagensDeAcesso } from './mensagens-de-acesso';
import { ok, recusa } from './testes';
import { CatalogoDePermissoesStore } from './versoes/catalogo-de-permissoes.store';
import { DocumentoDaVersaoService } from './versoes/documento-da-versao.service';
import { EnvioDaVersao } from './versoes/envio-da-versao';
import { EscritaDoPerfil } from './versoes/escrita-do-perfil';
import { LeituraDosPerfis } from './versoes/leitura-dos-perfis';

const LEITE = 'selecao:processos:consultar';
const ESCREVER = 'selecao:processos:configurar';
const APROVAR = 'selecao:processos:aprovar';
const PDF = new File(['%PDF'], 'portaria.pdf', { type: 'application/pdf' });
const ENVIO = {
  perfilId: 'p1',
  versaoId: 'v-nova',
  urlDeEnvio: 'https://armazenamento.test/envio',
} as EnvioDoDocumentoDto;

function perfil(permissoes: readonly string[]): PerfilDto {
  return {
    id: 'p1',
    nome: 'Operador de inscrições',
    descricao: 'Opera as inscrições.',
    ativo: true,
    governanca: null,
    sensibilidade: 'interno',
    composicaoEmVigor: {
      numero: 1,
      permissoes: permissoes.map((codigo) => ({ codigo, nome: codigo, sensibilidade: 'interno' })),
    },
    versaoPendente: null,
    ultimaVersaoEncerradaSemVigor: null,
  } as unknown as PerfilDto;
}

describe('EdicaoDosPerfis', () => {
  const perfis = { criar: vi.fn(), remover: vi.fn() };
  const versoes = { propor: vi.fn() };
  const documento = { enviar: vi.fn() };
  const notificacoes = { success: vi.fn(), errorFromProblem: vi.fn() };
  const leitura = { carregando: signal(false), mensagemDeErro: signal(null), recarregar: vi.fn() };
  const catalogo = { carregar: vi.fn() };
  let edicao: EdicaoDosPerfis;
  let escrita: EscritaDoPerfil;

  function preencher(parcial: Partial<Record<keyof typeof edicao.form.controls, string>>): void {
    edicao.form.patchValue(parcial);
    TestBed.tick();
  }

  beforeEach(() => {
    vi.resetAllMocks();
    leitura.carregando.set(false);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideMensagensDeAcesso(),
        EdicaoDosPerfis,
        EnvioDaVersao,
        EscritaDoPerfil,
        { provide: LeituraDosPerfis, useValue: leitura },
        { provide: PerfisApi, useValue: perfis },
        { provide: VersoesDoPerfilApi, useValue: versoes },
        { provide: DocumentoDaVersaoService, useValue: documento },
        { provide: CatalogoDePermissoesStore, useValue: catalogo },
        { provide: NotificationService, useValue: notificacoes },
      ],
    });
    edicao = TestBed.inject(EdicaoDosPerfis);
    escrita = TestBed.inject(EscritaDoPerfil);
    documento.enviar.mockResolvedValue({ ok: true });
  });

  describe('perfil novo', () => {
    beforeEach(() => {
      edicao.abrirCriacao();
      TestBed.tick();
    });

    it('carrega o catálogo e abre o formulário', () => {
      expect(catalogo.carregar).toHaveBeenCalled();
      expect(edicao.formAberto()).toBe(true);
      expect(edicao.exigeDocumento()).toBe(true);
    });

    it('não envia sem nome, permissão, protocolo e documento, e aponta cada falta', async () => {
      await edicao.salvar();

      expect(perfis.criar).not.toHaveBeenCalled();
      expect(edicao.erroDasPermissoes()).toBe('Marque ao menos uma permissão.');
      expect(edicao.erroDoDocumento()).toBe('Anexe o PDF do documento instituidor.');
      expect(edicao.form.controls.nome.touched).toBe(true);
      expect(edicao.form.controls.protocolo.invalid).toBe(true);
    });

    it('cria o perfil, envia o PDF, avisa, fecha e relê a lista', async () => {
      preencher({ nome: ' Operador ', descricao: 'Opera.', protocolo: 'P-1/2026' });
      edicao.alternar(ESCREVER);
      edicao.documento.set(PDF);
      perfis.criar.mockReturnValue(of(ok(ENVIO)));

      await edicao.salvar();

      expect(perfis.criar).toHaveBeenCalledWith(
        {
          nome: 'Operador',
          descricao: 'Opera.',
          permissoes: [ESCREVER],
          protocolo: 'P-1/2026',
          tamanhoDoDocumento: PDF.size,
        },
        expect.anything(),
      );
      expect(documento.enviar).toHaveBeenCalledWith(ENVIO, PDF, expect.any(Function));
      expect(notificacoes.success).toHaveBeenCalledWith('Perfil criado');
      expect(edicao.formAberto()).toBe(false);
      expect(leitura.recarregar).toHaveBeenCalled();
    });

    it('marca o nome já existente no campo e mantém o formulário aberto', async () => {
      preencher({ nome: 'Operador', descricao: 'Opera.', protocolo: 'P-1' });
      edicao.alternar(ESCREVER);
      edicao.documento.set(PDF);
      perfis.criar.mockReturnValue(
        of(recusa('uniplus.autorizacao.perfil.nome_duplicado', 409)),
      );

      await edicao.salvar();

      expect(edicao.form.controls.nome.errors).not.toBeNull();
      expect(edicao.formAberto()).toBe(true);
      expect(edicao.erroDoForm()).toBeNull();
    });

    it('registra a versão mesmo quando o PDF não sobe, e manda enviar o documento depois', async () => {
      preencher({ nome: 'Operador', descricao: 'Opera.', protocolo: 'P-1' });
      edicao.alternar(ESCREVER);
      edicao.documento.set(PDF);
      perfis.criar.mockReturnValue(of(ok(ENVIO)));
      documento.enviar.mockResolvedValue({ ok: false, mensagem: 'Falha ao enviar o arquivo.' });

      await edicao.salvar();

      expect(escrita.erroDaAcao()).toContain('Abra o perfil e envie o documento.');
      expect(notificacoes.success).not.toHaveBeenCalled();
      expect(edicao.formAberto()).toBe(false);
    });

    it('depois de falha sem desfecho conhecido, repete o mesmo envio', async () => {
      preencher({ nome: 'Operador', descricao: 'Opera.', protocolo: 'P-1' });
      edicao.alternar(ESCREVER);
      edicao.documento.set(PDF);
      perfis.criar.mockReturnValueOnce(of(recusa('uniplus.erro', 503)));
      perfis.criar.mockReturnValueOnce(of(ok(ENVIO)));

      await edicao.salvar();
      expect(edicao.envioEmAberto()).toBe(true);
      expect(edicao.erroDoForm()).toContain('Não foi possível saber se o perfil foi criado.');

      preencher({ nome: 'Outro nome' });
      await edicao.salvar();

      const [primeira, segunda] = perfis.criar.mock.calls.map(([corpo]) => corpo);
      expect(segunda).toEqual(primeira);
      expect(edicao.envioEmAberto()).toBe(false);
    });
  });

  describe('versão nova de um perfil que existe', () => {
    beforeEach(() => {
      edicao.abrirProposta(perfil([LEITE, ESCREVER]));
      TestBed.tick();
    });

    it('parte das permissões em vigor e não propõe nada enquanto nada muda', async () => {
      expect([...edicao.marcadas()].sort()).toEqual([ESCREVER, LEITE]);
      expect(edicao.destino()).toBe('nada');

      await edicao.salvar();

      expect(edicao.erroDoForm()).toBe('Nada mudou. Altere o nome, a descrição, as permissões ou o documento para enviar.');
      expect(versoes.propor).not.toHaveBeenCalled();
    });

    it('propõe versão quando só o protocolo ou o documento mudam, sem mexer nas permissões', async () => {
      preencher({ protocolo: 'P-9/2026' });
      expect(edicao.destino()).toBe('versao');
      expect(edicao.diferenca()).toEqual({ acrescimo: [], remocao: [] });

      edicao.documento.set(PDF);
      versoes.propor.mockReturnValue(of(ok(ENVIO)));
      await edicao.salvar();

      expect(versoes.propor).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ protocolo: 'P-9/2026', permissoes: [ESCREVER, LEITE].sort() }),
        expect.anything(),
      );
    });

    it('com o documento escolhido e sem protocolo, aponta o campo em vez de dizer que nada mudou', async () => {
      edicao.documento.set(PDF);
      TestBed.tick();

      await edicao.salvar();

      expect(edicao.destino()).toBe('versao');
      expect(edicao.erroDoForm()).toBeNull();
      expect(edicao.form.controls.protocolo.invalid).toBe(true);
      expect(versoes.propor).not.toHaveBeenCalled();
    });

    it('destaca o que foi acrescentado e o que foi removido', () => {
      edicao.alternar(APROVAR);
      edicao.alternar(LEITE);

      expect(edicao.diferenca()).toEqual({ acrescimo: [APROVAR], remocao: [LEITE] });
    });

    it('com acréscimo, pede o documento e propõe a versão sem remoção', async () => {
      edicao.alternar(APROVAR);
      preencher({ protocolo: 'P-2' });
      edicao.documento.set(PDF);
      versoes.propor.mockReturnValue(of(ok(ENVIO)));

      await edicao.salvar();

      expect(versoes.propor).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({
          permissoes: [APROVAR, ESCREVER, LEITE].sort(),
          protocolo: 'P-2',
          motivoDaRemocao: null,
          categoriaDaRemocao: null,
        }),
        expect.anything(),
      );
      expect(notificacoes.success).toHaveBeenCalledWith('Versão proposta');
    });

    it('com acréscimo e remoção juntos, exige motivo e categoria da remoção', async () => {
      edicao.alternar(APROVAR);
      edicao.alternar(LEITE);
      preencher({ protocolo: 'P-2' });
      edicao.documento.set(PDF);

      await edicao.salvar();

      expect(edicao.exigeRemocao()).toBe(true);
      expect(versoes.propor).not.toHaveBeenCalled();
      expect(edicao.form.controls.motivoDaRemocao.invalid).toBe(true);
      expect(edicao.form.controls.categoriaDaRemocao.invalid).toBe(true);

      preencher({ motivoDaRemocao: ' Excesso de acesso. ', categoriaDaRemocao: 'mudanca_de_funcao' });
      versoes.propor.mockReturnValue(of(ok(ENVIO)));
      await edicao.salvar();

      expect(versoes.propor).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({
          motivoDaRemocao: 'Excesso de acesso.',
          categoriaDaRemocao: 'mudanca_de_funcao',
        }),
        expect.anything(),
      );
    });

    it('só removendo, vale na hora e dispensa o documento', async () => {
      edicao.alternar(LEITE);
      preencher({ motivoDaRemocao: 'Excesso de acesso.', categoriaDaRemocao: 'incidente' });
      perfis.remover.mockReturnValue(of(ok(perfil([ESCREVER]))));

      expect(edicao.exigeDocumento()).toBe(false);
      await edicao.salvar();

      expect(perfis.remover).toHaveBeenCalledWith(
        'p1',
        { permissoes: [LEITE], motivo: 'Excesso de acesso.', categoria: 'incidente' },
        expect.anything(),
      );
      expect(versoes.propor).not.toHaveBeenCalled();
      expect(notificacoes.success).toHaveBeenCalledWith('Permissões removidas');
    });

    it('trocar só o texto também é uma versão e pede o documento', async () => {
      preencher({ descricao: 'Nova descrição.' });

      expect(edicao.destino()).toBe('versao');
      await edicao.salvar();

      expect(edicao.erroDoDocumento()).toBe('Anexe o PDF do documento instituidor.');
    });

    it('mostra no formulário a recusa de haver versão pendente', async () => {
      edicao.alternar(APROVAR);
      preencher({ protocolo: 'P-2' });
      edicao.documento.set(PDF);
      versoes.propor.mockReturnValue(
        of(recusa('uniplus.autorizacao.perfil.versao_pendente_existente', 409)),
      );

      await edicao.salvar();

      expect(edicao.erroDoForm()).toContain('O perfil já tem uma versão aguardando aprovação.');
      expect(edicao.formAberto()).toBe(true);
    });
  });
});
