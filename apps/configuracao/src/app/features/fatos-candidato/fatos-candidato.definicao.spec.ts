import { afterEach, describe, expect, it } from 'vitest';
import {
  Pagina,
  comAprovacao,
  corRaca,
  montarPagina,
  problema,
  sucesso,
  urlDoFato,
} from './fatos-candidato.testing';
import type { FatoCandidatoDto } from '@uniplus/shared-data/configuracao';

const DEFINICAO = '#cfg-fato-definicao';
const campo = (nome: string): string => `${DEFINICAO} [formcontrolname="${nome}"]`;
const derivadoBooleano: FatoCandidatoDto = {
  ...corRaca,
  codigo: 'PERFIL',
  origem: 'DERIVADO',
  dominio: 'BOOLEANO',
  fonteValores: null,
  classificacaoProtecao: 'PESSOAL',
  hipoteseLegal: 'CUMPRIMENTO_OBRIGACAO_LEGAL',
  binding: 'REGRA_DERIVACAO:PERFIL',
  valores: [],
};
const agregadoDeRenda: FatoCandidatoDto = {
  ...derivadoBooleano,
  codigo: 'PERFIL_FAMILIAR',
  binding: 'AGREGACAO_GRUPO:RENDA',
};

describe('FatosCandidatoPage — definição do fato', () => {
  let p: Pagina;
  afterEach(() => {
    p.atenderApoios();
    p.atenderPendencias();
    p.http.verify();
  });

  const abrir = async (fato: FatoCandidatoDto): Promise<void> => {
    p = await montarPagina([fato]);
    await p.abrirEdicao(fato);
  };
  const enviar = async (): Promise<void> => {
    p.submeter(DEFINICAO);
    await p.propagar();
  };
  const definir = (fato: FatoCandidatoDto) =>
    p.http.expectOne((r) => r.method === 'PUT' && r.url === `${urlDoFato(fato)}/definicao`);
  const entregar = async (fato: FatoCandidatoDto, pedido = definir(fato)): Promise<void> => {
    pedido.flush(...sucesso());
    await p.recarregarOFato(fato);
  };
  const recusa = (status: number, corpo: object) =>
    problema(status, { title: 'Problema', ...corpo });

  describe('o que cada tipo de fato envia', () => {
    it('o declarado envia todos os eixos que o tipo de dado aceita, com chave própria', async () => {
      await abrir(corRaca);
      await enviar();

      const pedido = definir(corRaca);
      expect(pedido.request.headers.has('Idempotency-Key')).toBe(true);
      expect(pedido.request.body).toEqual({
        pontoResolucao: 'INSCRICAO',
        classificacaoProtecao: 'SENSIVEL',
        finalidadeTratamento: 'Reserva de vagas.',
        hipoteseLegal: 'CUMPRIMENTO_OBRIGACAO_LEGAL',
        dominio: 'CATEGORICO',
        escopo: 'CANDIDATO',
        cardinalidade: 'ESCALAR',
        fonteValores: 'GLOBAL',
        formato: null,
      });
      await entregar(corRaca, pedido);
    });

    it('o derivado por regra envia o tipo de dado e o escopo, sem cardinalidade, fonte nem formato', async () => {
      await abrir(derivadoBooleano);
      await enviar();

      const pedido = definir(derivadoBooleano);
      expect(Object.keys(pedido.request.body as object).sort()).toEqual([
        'classificacaoProtecao',
        'dominio',
        'escopo',
        'finalidadeTratamento',
        'hipoteseLegal',
        'pontoResolucao',
      ]);
      await entregar(derivadoBooleano, pedido);
    });

    it('o agregado envia só o ponto de resolução e a proteção, e mostra o fato de membro sem edição', async () => {
      await abrir(agregadoDeRenda);
      await enviar();

      const pedido = definir(agregadoDeRenda);
      expect(Object.keys(pedido.request.body as object).sort()).toEqual([
        'classificacaoProtecao',
        'finalidadeTratamento',
        'hipoteseLegal',
        'pontoResolucao',
      ]);
      const rotulos = [...p.raiz().querySelectorAll('dt')];
      const membro = rotulos.find((dt) => dt.textContent?.trim() === 'Fato de membro resumido');
      expect(membro?.nextElementSibling?.textContent?.trim()).toBe('RENDA');
      expect(p.existe(campo('dominio'))).toBe(false);
      await entregar(agregadoDeRenda, pedido);
    });

    it('o fato de sistema trava a definição e envia só o ponto de resolução atual e a proteção', async () => {
      const sistema = { ...corRaca, sistema: true };
      await abrir(sistema);
      expect(p.texto()).toContain('Fato de sistema');
      expect(p.existe(campo('classificacaoProtecao'))).toBe(true);
      expect(p.existe(campo('dominio'))).toBe(false);
      expect(p.existe(campo('pontoResolucao'))).toBe(false);
      expect(p.texto()).toContain('Conhecido a partir da fase');
      p.digitar(campo('classificacaoProtecao'), 'PESSOAL');
      p.digitar(campo('hipoteseLegal'), 'EXECUCAO_POLITICAS_PUBLICAS');

      await enviar();

      const pedido = definir(sistema);
      expect(pedido.request.body).toEqual({
        pontoResolucao: 'INSCRICAO',
        classificacaoProtecao: 'PESSOAL',
        finalidadeTratamento: 'Reserva de vagas.',
        hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
      });
      await entregar(sistema, pedido);
    });
  });

  describe('os eixos só para leitura', () => {
    it('o agregado mostra o que o tipo não edita, com a origem do valor', async () => {
      await abrir(agregadoDeRenda);

      const lista = p.texto('#cfg-fato-def-derivados');
      expect(lista).toContain('Tipo de dado');
      expect(lista).toContain('De quem é o dado');
      expect(lista).toContain('vem do fato de membro');
      expect(p.existe(campo('dominio'))).toBe(false);
    });

    it('o derivado mostra só para leitura o que sai do tipo de dado', async () => {
      await abrir(derivadoBooleano);

      const lista = p.texto('#cfg-fato-def-derivados');
      expect(lista).toContain('Quantos valores');
      expect(lista).toContain('vem do tipo de dado');
      expect(lista).not.toContain('De quem é o dado');
    });
  });

  describe('as recusas', () => {
    it('a recusa de campo aparece junto do eixo, ligada por aria-describedby, e o foco vai a ele', async () => {
      await abrir(corRaca);
      await enviar();

      definir(corRaca).flush(
        ...recusa(422, {
          code: 'uniplus.validation_failed',
          errors: [
            {
              field: 'classificacaoProtecao',
              code: 'x',
              message: 'Classificação fora do tipo de dado.',
            },
          ],
        }),
      );
      await p.propagar();

      expect(p.texto('#cfg-fato-def-classificacaoProtecao-erro')).toContain(
        'Classificação fora do tipo de dado.',
      );
      const eixo = p.elemento(campo('classificacaoProtecao'));
      expect(eixo.getAttribute('aria-describedby')).toBe('cfg-fato-def-classificacaoProtecao-erro');
      expect(eixo.getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(eixo);
      expect(p.erros).not.toHaveBeenCalled();
    });

    it('a recusa de um eixo que o tipo não edita aparece no alerta da definição, com o nome do eixo e o foco', async () => {
      await abrir(agregadoDeRenda);
      await enviar();

      definir(agregadoDeRenda).flush(
        ...recusa(422, {
          code: 'uniplus.validation_failed',
          errors: [{ field: 'dominio', code: 'x', message: 'Não pode mudar o tipo de dado.' }],
        }),
      );
      await p.propagar();

      const alerta = p.elemento('#cfg-fato-def-recusa');
      expect(alerta.getAttribute('role')).toBe('alert');
      expect(alerta.textContent).toContain('Tipo de dado: Não pode mudar o tipo de dado.');
      expect(document.activeElement).toBe(alerta);
    });

    it('o erro de campo que a tela não conhece vai ao alerta, mesmo quando outro erro coube num campo', async () => {
      await abrir(corRaca);
      await enviar();

      definir(corRaca).flush(
        ...recusa(422, {
          code: 'uniplus.validation_failed',
          errors: [
            {
              field: 'classificacaoProtecao',
              code: 'x',
              message: 'Classificação fora do tipo de dado.',
            },
            { field: 'campoDesconhecido', code: 'x', message: 'Algo que a tela não mostra.' },
          ],
        }),
      );
      await p.propagar();

      expect(p.texto('#cfg-fato-def-classificacaoProtecao-erro')).toContain('Classificação fora');
      expect(p.texto('#cfg-fato-def-recusa')).toContain('Algo que a tela não mostra.');
    });

    it('a citação que deixaria de valer é listada por tipo, com o foco nela, e nenhum campo leva a recusa', async () => {
      await abrir(corRaca);
      await enviar();

      definir(corRaca).flush(
        ...recusa(422, {
          code: 'uniplus.configuracao.fato_candidato.alteracao_quebra_modelo_de_formulario',
          errors: [
            {
              field: 'citacoes.modelos.MODELO_MEDICINA',
              code: 'x',
              message: 'O campo deixaria de aceitar a lista de valores.',
            },
            {
              field: 'citacoes.regrasPadrao.PERFIL',
              code: 'x',
              message: 'A condição deixaria de valer.',
            },
            {
              field: 'citacoes.agregados.escopo',
              code: 'x',
              message: 'O resumo deixaria de valer.',
            },
          ],
        }),
      );
      await p.propagar();

      const lista = p.elemento('#cfg-fato-def-citacoes');
      for (const esperado of [
        'Regras padrão de outros fatos',
        'Modelos de formulário',
        'MODELO_MEDICINA',
        'O campo deixaria de aceitar a lista de valores.',
      ]) {
        expect(lista.textContent).toContain(esperado);
      }
      expect(p.existe(`${DEFINICAO} .field__error`)).toBe(false);
      expect(document.activeElement).toBe(lista);
    });

    it('a falha do servidor (5xx) avisa por toast e a 403 não', async () => {
      await abrir(corRaca);
      await enviar();
      definir(corRaca).flush(...recusa(500, { code: 'uniplus.internal.unexpected' }));
      await p.propagar();
      expect(p.erros).toHaveBeenCalledTimes(1);

      await enviar();
      definir(corRaca).flush(...recusa(403, { code: 'uniplus.auth.forbidden' }));
      await p.propagar();
      expect(p.erros).toHaveBeenCalledTimes(1);
    });

    it('a recusa do servidor num controle não some quando outro campo muda', async () => {
      const texto = {
        ...corRaca,
        dominio: 'TEXTO',
        fonteValores: null,
        formato: 'EMAIL',
        classificacaoProtecao: 'PESSOAL',
      };
      await abrir(texto);
      await enviar();
      definir(texto).flush(
        ...recusa(422, {
          code: 'uniplus.validation_failed',
          errors: [{ field: 'formato', code: 'x', message: 'Formato não aceito.' }],
        }),
      );
      await p.propagar();

      p.digitar(campo('classificacaoProtecao'), 'SENSIVEL');
      await p.propagar();

      expect(p.texto('#cfg-fato-def-formato-erro')).toContain('Formato não aceito.');
    });

    it('depois da recusa num eixo, corrigir outro e salvar de novo envia: quem reconfere é a API', async () => {
      const texto = {
        ...corRaca,
        dominio: 'TEXTO',
        fonteValores: null,
        formato: 'EMAIL',
        classificacaoProtecao: 'PESSOAL',
      };
      await abrir(texto);
      await enviar();
      definir(texto).flush(
        ...recusa(422, {
          code: 'uniplus.validation_failed',
          errors: [{ field: 'formato', code: 'x', message: 'Formato não aceito.' }],
        }),
      );
      await p.propagar();
      p.digitar(campo('classificacaoProtecao'), 'SENSIVEL');

      await enviar();

      await entregar(texto);
    });
  });

  describe('concorrência e chaves', () => {
    it('a perda para outra escrita recarrega o fato, orienta a refazer e leva o foco ao botão', async () => {
      await abrir(corRaca);
      await enviar();

      definir(corRaca).flush(...recusa(409, { code: 'uniplus.concorrencia.conflito' }));
      await p.recarregarOFato(corRaca, false);

      expect(p.texto()).toContain('Outra pessoa alterou');
      expect(document.activeElement?.id).toBe('cfg-fato-def-salvar');
    });

    it('o mesmo corpo noutro fato, depois de um 5xx, vai com outra chave de idempotência', async () => {
      const outro = { ...corRaca, id: 'outro-fato', codigo: 'OUTRO', nome: 'Outro' };
      p = await montarPagina([corRaca, outro]);
      await p.abrirEdicao(corRaca);
      await enviar();
      const primeira = definir(corRaca);
      const chave = primeira.request.headers.get('Idempotency-Key');
      primeira.flush(...recusa(503, { code: 'uniplus.internal.unexpected' }));
      await p.propagar();

      p.edicao.abrirEdicao(outro.id);
      await p.propagar();
      p.http.expectOne(urlDoFato(outro)).flush(structuredClone(outro));
      p.atenderApoios();
      await p.propagar();
      await enviar();

      const segundo = definir(outro);
      expect(segundo.request.headers.get('Idempotency-Key')).not.toBe(chave);
      segundo.flush(...sucesso());
      await p.recarregarOFato(outro);
    });
  });

  describe('os apoios e as dependências entre campos', () => {
    it('o agregado mantém o tipo de dado do servidor e calcula as classificações por ele', async () => {
      const texto = {
        ...agregadoDeRenda,
        dominio: 'TEXTO',
        classificacaoProtecao: 'IDENTIFICADOR',
      };
      await abrir(texto);

      p.digitar(campo('finalidadeTratamento'), 'Outra finalidade.');
      await p.propagar();

      expect(p.elemento<HTMLSelectElement>(campo('classificacaoProtecao')).value).toBe(
        'IDENTIFICADOR',
      );
      const opcoes = [
        ...p.raiz().querySelectorAll<HTMLOptionElement>(`${campo('classificacaoProtecao')} option`),
      ];
      expect(opcoes.map((o) => o.value)).not.toContain('PUBLICO');
    });

    it('sem a lista de fases, avisa e, na nova tentativa que dá certo, o foco vai ao campo da fase', async () => {
      p = await montarPagina([derivadoBooleano]);
      await p.acionar(p.editar(derivadoBooleano));
      p.http.expectOne(urlDoFato(derivadoBooleano)).flush(structuredClone(derivadoBooleano));
      await p.propagar();
      for (const req of p.http.match((r) => r.url.endsWith('/fases-canonicas'))) {
        req.flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
      }
      p.atenderApoios();
      await p.propagar();

      await p.acionar(p.botaoPeloTexto('Definição', p.drawerDoFato()) as HTMLButtonElement);
      expect(p.texto()).toContain('Fases não carregadas');
      await p.acionar(p.botaoPeloTexto('Tentar novamente', p.drawerDoFato()) as HTMLButtonElement);
      p.atenderApoios();
      await p.propagar();
      await p.propagar();
      expect(p.texto()).not.toContain('Fases não carregadas');
      expect(document.activeElement).toBe(p.elemento('#cfg-fato-def-pontoResolucao'));
    });
  });

  describe('a aprovação da proteção de dados', () => {
    it('ao abrir, não apaga a proteção que o servidor tem, ainda que a regra do domínio hoje não a admita', async () => {
      const sistema = {
        ...corRaca,
        sistema: true,
        dominio: 'TEXTO',
        classificacaoProtecao: 'INTERNO',
        hipoteseLegal: 'INTERESSE_LEGITIMO',
      };
      await abrir(sistema);

      expect(p.editor.definicao.controls.classificacaoProtecao.value).toBe('INTERNO');
      expect(p.editor.definicao.controls.hipoteseLegal.value).toBe('INTERESSE_LEGITIMO');
    });

    it('esvazia a hipótese que a pessoa tornou incompatível ao trocar a classificação', async () => {
      const sistema = {
        ...corRaca,
        sistema: true,
        dominio: 'BOOLEANO',
        classificacaoProtecao: 'PESSOAL',
        hipoteseLegal: 'INTERESSE_LEGITIMO',
      };
      await abrir(sistema);

      p.digitar(campo('classificacaoProtecao'), 'SENSIVEL');
      await p.propagar();

      expect(p.elemento<HTMLSelectElement>(campo('hipoteseLegal')).value).toBe('');
    });

    it('avisa que o fato aprovado volta a pendente ao mudar a classificação, e não ao mudar o nome', async () => {
      await abrir(comAprovacao(corRaca, 'APROVADA'));

      p.digitar('#cfg-fato-descritivo [formcontrolname="nome"]', 'Cor ou raça declarada');
      await p.propagar();
      expect(p.texto()).not.toContain('O item volta a pendente');

      p.digitar(campo('classificacaoProtecao'), 'PESSOAL');
      p.digitar(campo('hipoteseLegal'), 'EXECUCAO_POLITICAS_PUBLICAS');
      await p.propagar();
      expect(p.texto()).toContain('O item volta a pendente');
    });

    it('não avisa quando o fato já está pendente', async () => {
      await abrir(comAprovacao({ ...corRaca, sistema: true }, 'PENDENTE'));

      p.digitar(campo('classificacaoProtecao'), 'PESSOAL');
      await p.propagar();

      expect(p.texto()).not.toContain('O item volta a pendente');
    });

    it('mostra a situação como texto e a classificação que a proteção de dados recomendou', async () => {
      await abrir(
        comAprovacao({ ...corRaca, sistema: true }, 'AJUSTE_RECOMENDADO', 'IDENTIFICADOR'),
      );

      expect(p.texto()).toContain('Ajuste recomendado');
      expect(p.texto()).toContain('Classificação recomendada: Identificador');
    });
  });

  describe('trocar o tipo de dado do derivado', () => {
    const categorico: FatoCandidatoDto = {
      ...derivadoBooleano,
      dominio: 'CATEGORICO',
      fonteValores: 'GLOBAL',
      valores: [{ codigo: 'A', descricao: null, ordem: 0, ativo: true, orientacao: null }],
      regrasPadrao: [
        { contribui: 'A', quando: [[{ fato: 'QUILOMBOLA', operador: 'IGUAL', valor: true }]] },
      ],
    };

    it('trocar o tipo de dado limpa as marcas das contribuições e das condições', async () => {
      const comRegraIncompleta = {
        ...categorico,
        regrasPadrao: [{ contribui: 'A', quando: [] }],
      };
      await abrir(comRegraIncompleta);
      const select = p.elemento<HTMLSelectElement>('cfg-fato-regras select');
      select.value = '';
      select.dispatchEvent(new Event('change'));
      await p.acionar(p.botaoPeloTexto('Acrescentar regra', p.drawerDoFato()) as HTMLButtonElement);
      await p.acionar(p.botaoPeloTexto('Salvar regras', p.drawerDoFato()) as HTMLButtonElement);
      expect(p.texto('#cfg-fato-regra-0-erro')).not.toBe('');

      p.digitar(campo('dominio'), 'BOOLEANO');
      await enviar();
      definir(categorico).flush(...sucesso());
      await p.propagar();
      p.http.expectOne(urlDoFato(categorico)).flush({
        ...categorico,
        dominio: 'BOOLEANO',
        fonteValores: null,
        valores: [],
        regrasPadrao: [{ contribui: null, quando: categorico.regrasPadrao[0].quando }],
      });
      p.pedidoDaLista().flush([categorico]);
      await p.propagar();
      p.atenderPendencias();
      await p.propagar();

      expect(p.existe('#cfg-fato-regra-0-erro')).toBe(false);
      expect(p.drawerDoFato().querySelector('cfg-fato-regras [aria-invalid="true"]')).toBeNull();
    });

    it('as regras em tela só voltam a salvar quando chegam as do servidor', async () => {
      await abrir(categorico);
      p.digitar(campo('dominio'), 'BOOLEANO');
      await enviar();
      definir(categorico).flush(...sucesso());
      await p.propagar();

      const salvar = p.botaoPeloTexto('Salvar regras', p.drawerDoFato()) as HTMLButtonElement;
      expect(salvar.getAttribute('aria-disabled')).toBe('true');
      salvar.click();
      p.http.expectNone(`${urlDoFato(categorico)}/regras-padrao`);

      p.http.expectOne(urlDoFato(categorico)).flush({
        ...categorico,
        dominio: 'BOOLEANO',
        fonteValores: null,
        valores: [],
        regrasPadrao: [{ contribui: null, quando: categorico.regrasPadrao[0].quando }],
      });
      p.pedidoDaLista().flush([categorico]);
      await p.propagar();
      p.atenderPendencias();
      await p.propagar();

      expect(p.drawerDoFato().querySelectorAll('ui-editor-de-condicoes')).toHaveLength(1);
    });
  });
});
