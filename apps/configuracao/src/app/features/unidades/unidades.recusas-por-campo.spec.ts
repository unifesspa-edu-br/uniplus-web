import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TipoUnidadeCodigo } from '@uniplus/shared-data/organizacao';
import {
  CenarioDaPaginaDeUnidades,
  ESCRITA,
  codigoDaUnidade,
  criado,
  recusaDeCampo,
  reitoria,
  sucesso,
} from './unidades.testing';

const CODIGO_DE_REGRA = 'uniplus.validacao.regra';

/** Sem código próprio no domínio, o campo recusa com o da regra genérica. */
const CAMPOS_RECUSAVEIS = [
  [
    'sigla',
    {
      seletor: '[formcontrolname="sigla"]',
      idDoErro: 'cfg-unidade-sigla-erro',
      modo: 'criar',
      codigo: codigoDaUnidade('sigla_tamanho'),
    },
  ],
  [
    'slug',
    {
      seletor: '[formcontrolname="slug"]',
      idDoErro: 'cfg-unidade-slug-erro',
      modo: 'criar',
      codigo: codigoDaUnidade('slug_tamanho'),
    },
  ],
  [
    'codigo',
    {
      seletor: '[formcontrolname="codigo"]',
      idDoErro: 'cfg-unidade-codigo-erro',
      modo: 'criar',
      codigo: codigoDaUnidade('codigo_tamanho'),
    },
  ],
  [
    'alias',
    {
      seletor: '[formcontrolname="alias"]',
      idDoErro: 'cfg-unidade-alias-erro',
      modo: 'criar',
      codigo: codigoDaUnidade('alias_tamanho'),
    },
  ],
  [
    'nome',
    {
      seletor: '[formcontrolname="nome"]',
      idDoErro: 'cfg-unidade-nome-erro',
      modo: 'criar',
      codigo: codigoDaUnidade('nome_tamanho'),
    },
  ],
  [
    'tipo',
    {
      seletor: '[formcontrolname="tipo"]',
      idDoErro: 'cfg-unidade-tipo-erro',
      modo: 'criar',
      codigo: codigoDaUnidade('tipo_invalido'),
    },
  ],
  [
    'unidadeSuperiorId',
    {
      seletor: '#cfg-unidade-superior',
      idDoErro: 'cfg-unidade-superior-erro',
      modo: 'criar',
      codigo: CODIGO_DE_REGRA,
    },
  ],
  [
    'unidadeAcademica',
    {
      seletor: '[formcontrolname="unidadeAcademica"]',
      idDoErro: 'cfg-unidade-academica-erro',
      modo: 'criar',
      codigo: CODIGO_DE_REGRA,
    },
  ],
  [
    'vigenciaInicio',
    {
      seletor: '[formcontrolname="vigenciaInicio"]',
      idDoErro: 'cfg-unidade-inicio-erro',
      modo: 'criar',
      codigo: CODIGO_DE_REGRA,
    },
  ],
  [
    'vigenciaFim',
    {
      seletor: '[formcontrolname="vigenciaFim"]',
      idDoErro: 'cfg-unidade-fim-erro',
      modo: 'criar',
      codigo: codigoDaUnidade('vigencia_fim_anterior_ao_inicio'),
    },
  ],
  [
    'motivoMudancaIdentificador',
    {
      seletor: '[formcontrolname="motivoMudancaIdentificador"]',
      idDoErro: 'cfg-unidade-motivo-erro',
      modo: 'editar',
      codigo: CODIGO_DE_REGRA,
    },
  ],
] as const;

const LIMITES_DE_TAMANHO = [
  ['nome', 250, 'criar', 'cfg-unidade-nome-erro'],
  ['alias', 100, 'criar', 'cfg-unidade-alias-erro'],
  ['sigla', 50, 'criar', 'cfg-unidade-sigla-erro'],
  ['codigo', 50, 'criar', 'cfg-unidade-codigo-erro'],
  ['motivoMudancaIdentificador', 500, 'editar', 'cfg-unidade-motivo-erro'],
] as const;

describe('UnidadesPage — recusas do servidor', () => {
  let p: CenarioDaPaginaDeUnidades;

  beforeEach(async () => {
    p = await CenarioDaPaginaDeUnidades.abrir();
  });
  afterEach(() => p.http.verify());

  describe('ao salvar, por campo', () => {
    it.each(CAMPOS_RECUSAVEIS)(
      'mapeia a recusa de %s ao campo, associada e focada (prova o mapeamento do campo, não o código do domínio)',
      async (campo, { seletor, idDoErro, modo, codigo }) => {
        if (modo === 'criar') await p.abrirCadastro();
        else await p.abrirEdicao(reitoria);
        const url = modo === 'criar' ? ESCRITA : `${ESCRITA}/${reitoria.id}`;
        (await p.enviar(url)).flush(...recusaDeCampo(campo, 'Valor recusado.', codigo));
        await p.propagar();
        await p.propagar();

        const controle = p.elemento<HTMLElement>(seletor);
        expect(controle.getAttribute('aria-invalid')).toBe('true');
        expect(controle.getAttribute('aria-describedby')?.split(' ')).toContain(idDoErro);
        expect(p.elemento(`#${idDoErro}`).textContent?.trim()).toBe('Valor recusado.');
        expect(document.activeElement).toBe(controle);
        expect(p.elemento('ui-drawer [role="status"]').textContent).toContain('Revise os campos');
        expect(p.erros).not.toHaveBeenCalled();
      },
    );

    it('o nome do servidor em PascalCase com caminho e índice chega ao campo', async () => {
      await p.abrirCadastro();
      (await p.enviar()).flush(
        ...recusaDeCampo(
          'Comando.Itens[0].Sigla',
          'Sigla recusada.',
          codigoDaUnidade('sigla_tamanho'),
        ),
      );
      await p.propagar();

      expect(p.elemento('#cfg-unidade-sigla-erro').textContent).toContain('Sigla recusada.');
    });

    it('campo desconhecido vai ao alerta do drawer', async () => {
      await p.abrirCadastro();
      (await p.enviar()).flush(...recusaDeCampo('inexistente', 'Algo recusado.', CODIGO_DE_REGRA));
      await p.propagar();

      expect(p.alertaDoDrawer().textContent).toContain('Não foi possível mapear');
    });

    it('recusa corrigida em outro campo: o reenvio descarta a recusa antiga sem emitir valores', async () => {
      await p.abrirCadastro();
      (await p.enviar()).flush(
        ...recusaDeCampo('sigla', 'Sigla recusada.', codigoDaUnidade('sigla_tamanho')),
      );
      await p.propagar();
      expect(p.edicao.form.controls.sigla.hasError('backend')).toBe(true);

      p.preencher('nome', 'Núcleo revisado');
      let emissoes = 0;
      const inscricao = p.edicao.form.valueChanges.subscribe(() => (emissoes += 1));
      p.edicao.salvar();

      expect(emissoes).toBe(0);
      expect(p.edicao.form.controls.sigla.hasError('backend')).toBe(false);
      inscricao.unsubscribe();
      p.http.expectOne(ESCRITA).flush(...criado());
      await p.responderAConsultaDasUnidades([reitoria]);
    });
  });

  describe('validação local', () => {
    it('envio barrado leva o foco ao primeiro campo inválido', async () => {
      await p.abrirCadastro();
      p.preencher('sigla', '');
      p.preencher('codigo', '');
      p.salvar().focus();
      p.submeterOFormulario();
      await p.propagar();
      await p.propagar();

      p.http.expectNone(ESCRITA);
      expect(document.activeElement).toBe(p.campo('sigla'));
      expect(p.campo('sigla').getAttribute('aria-invalid')).toBe('true');
      expect(p.campo('codigo').getAttribute('aria-invalid')).toBe('true');
      expect(p.elemento('#cfg-unidade-sigla-erro').textContent).toContain('Campo obrigatório.');
    });

    it('os obrigatórios declaram aria-required', async () => {
      await p.abrirCadastro();

      for (const nome of ['sigla', 'slug', 'codigo', 'nome', 'tipo', 'vigenciaInicio']) {
        expect(p.campo(nome).getAttribute('aria-required'), nome).toBe('true');
      }
      expect(p.campo('alias').getAttribute('aria-required')).toBeNull();
    });

    it.each(LIMITES_DE_TAMANHO)(
      'recusa %s acima de %i caracteres, marcando o campo e sem enviar',
      async (nome, limite, modo, idDoErro) => {
        const abrir = async (): Promise<string> => {
          if (modo === 'criar') {
            await p.abrirCadastro();
            return ESCRITA;
          }
          await p.abrirEdicao(reitoria);
          return `${ESCRITA}/${reitoria.id}`;
        };
        const url = await abrir();
        p.preencher(nome, 'x'.repeat(limite));
        p.submeterOFormulario();
        await p.propagar();
        const aceite = p.http.expectOne(url);
        if (modo === 'criar') aceite.flush(...criado());
        else aceite.flush(...sucesso());
        await p.responderAConsultaDasUnidades([reitoria]);

        await abrir();
        p.preencher(nome, 'x'.repeat(limite + 1));
        p.submeterOFormulario();
        await p.propagar();
        await p.propagar();

        p.http.expectNone(url);
        expect(p.campo(nome).getAttribute('aria-invalid')).toBe('true');
        expect(p.elemento(`#${idDoErro}`).textContent).toContain(
          `Informe no máximo ${limite} caracteres.`,
        );
      },
    );

    it('o nome com menos de 2 caracteres diz quantos faltam', async () => {
      await p.abrirCadastro();
      p.preencher('nome', 'N');
      p.submeterOFormulario();
      await p.propagar();

      expect(p.elemento('#cfg-unidade-nome-erro').textContent).toContain(
        'Informe ao menos 2 caracteres.',
      );
    });

    it('o tipo que o servidor devolveu e a tela não conhece bloqueia o envio e diz por quê', async () => {
      const desconhecida = { ...reitoria, tipo: 'TipoInexistente' as TipoUnidadeCodigo };
      p = await p.reabrirCom([desconhecida]);
      await p.abrirEdicao(desconhecida);

      expect(p.edicao.tipoNaoReconhecido()).toBe(true);
      expect(p.edicao.form.invalid).toBe(true);
      p.salvar().click();
      await p.propagar();
      await p.propagar();

      p.http.expectNone(ESCRITA);
      expect(p.elemento('#cfg-unidade-tipo-erro').textContent).toContain('não reconhecido');
      expect(p.campo('tipo').getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(p.campo('tipo'));
    });

    it('o código do tipo é reconhecido e preservado', async () => {
      const proReitoria = {
        ...reitoria,
        id: 'u-9',
        sigla: 'PROEG',
        tipo: TipoUnidadeCodigo.PRO_REITORIA,
      };
      p = await p.reabrirCom([proReitoria]);
      await p.abrirEdicao(proReitoria);

      expect(p.edicao.tipoNaoReconhecido()).toBe(false);
      expect(p.campo('tipo').value).toBe(TipoUnidadeCodigo.PRO_REITORIA);
    });
  });
});
