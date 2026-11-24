import { afterEach, describe, expect, it, beforeAll } from 'vitest';
import {
  Pagina,
  montarPagina,
  sucesso,
  urlDoFato,
  compilarPaginaUmaVez,
} from './fatos-candidato.testing';
import {
  comDefinicao,
  comProtecao,
  corRaca,
  emManutencao,
  tipoTexto,
} from './fatos-candidato.fixtures';
import { type FatoCandidatoDto } from '@uniplus/shared-data/configuracao';
import {
  campo,
  DEFINICAO,
  agregadoDeRenda,
  recusa,
  ConducaoDaDefinicao,
} from './fatos-candidato.definicao.testing';

describe('FatosCandidatoPage — recusas e concorrência da definição do fato', () => {
  beforeAll(compilarPaginaUmaVez);
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
  const { enviar, definir, entregar } = new ConducaoDaDefinicao(() => p);

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
      const texto = comProtecao(
        comDefinicao(corRaca, {
          dominio: tipoTexto,
          formato: 'EMAIL',
          valores: { ...corRaca.definicao.valores, fonte: null },
        }),
        { classificacao: 'PESSOAL' },
      );
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
      const texto = comProtecao(
        comDefinicao(corRaca, {
          dominio: tipoTexto,
          formato: 'EMAIL',
          valores: { ...corRaca.definicao.valores, fonte: null },
        }),
        { classificacao: 'PESSOAL' },
      );
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
      p.http.expectOne(urlDoFato(outro)).flush(emManutencao(structuredClone(outro)));
      p.atenderApoios();
      await p.propagar();
      await enviar();

      const segundo = definir(outro);
      expect(segundo.request.headers.get('Idempotency-Key')).not.toBe(chave);
      segundo.flush(...sucesso());
      await p.recarregarOFato(outro);
    });
  });
});
