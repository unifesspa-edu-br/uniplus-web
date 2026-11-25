import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HttpHeaders } from '@angular/common/http';
import { apiFailure } from '@uniplus/shared-core/http';
import { passarOTempo } from '@uniplus/shared-testing';
import { ESPERA_DA_CONSULTA_MS } from './avaliacao-da-inscricao.estado';
import {
  MEDICINA,
  DIREITO,
  ENGENHARIA,
  COM_MODALIDADES,
  inscricao,
  RESPONDIDA,
  botao,
  passos,
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

  describe('1ª e 2ª opção de curso', () => {
    const select2 = (tela: HTMLElement): HTMLSelectElement =>
      tela.querySelector('#inscricao-segunda-oferta') as HTMLSelectElement;
    const escolherSegunda = async (tela: HTMLElement, id: string): Promise<void> => {
      select2(tela).value = id;
      select2(tela).dispatchEvent(new Event('change'));
      cenario.fixture.detectChanges();
      await passarOTempo(0);
    };
    const idsDasOpcoes = (select: HTMLSelectElement): string[] =>
      [...select.options].map((o) => o.value).filter((v) => v !== '');
    const dosDoisCursos = (): void => {
      cenario.servico.ofertas = [MEDICINA, DIREITO, ENGENHARIA];
      cenario.servico.opcoes = 2;
    };
    const recusaDaSegunda = (codigo: string) =>
      apiFailure(
        {
          type: 'about:blank',
          title: 'Recusada',
          status: 422,
          code: codigo,
          traceId: '',
          errors: [{ field: 'ofertaCursoSegundaOpcaoId', code: codigo, message: '' }],
        },
        422,
        new HttpHeaders(),
      );

    it('com 2 opções, a 2ª fica desabilitada até a 1ª ser escolhida e não lista o curso da 1ª', async () => {
      dosDoisCursos();
      const tela = await cenario.abrir();

      expect(tela.querySelector('label[for="inscricao-oferta"]')?.textContent).toContain(
        '1ª opção',
      );
      expect(tela.querySelector('label[for="inscricao-segunda-oferta"]')?.textContent).toContain(
        '2ª opção (opcional)',
      );
      expect(select2(tela).disabled).toBe(true);

      await cenario.escolherCurso(tela, DIREITO.id);

      expect(select2(tela).disabled).toBe(false);
      expect(idsDasOpcoes(select2(tela))).toEqual([ENGENHARIA.id, MEDICINA.id]);
    });

    it('com 1 opção, o passo mostra um campo só, mesmo com vários cursos', async () => {
      cenario.servico.ofertas = [MEDICINA, DIREITO];
      cenario.servico.opcoes = 1;
      const tela = await cenario.abrir();

      expect(tela.querySelector('#inscricao-oferta')).not.toBeNull();
      expect(tela.querySelector('#inscricao-segunda-oferta')).toBeNull();
      await cenario.clicar(botao(tela, 'Salvar rascunho'));
      expect(cenario.servico.salvos[0].ofertaCursoSegundaOpcaoId).toBeNull();
    });

    it('trocar a 1ª para o curso da 2ª limpa a 2ª e avisa o candidato', async () => {
      dosDoisCursos();
      cenario.servico.inscricao = inscricao({
        ofertaCursoId: DIREITO.id,
        ofertaCursoSegundaOpcaoId: ENGENHARIA.id,
      });
      const tela = await cenario.abrir();
      expect(select2(tela).value).toBe(ENGENHARIA.id);

      await cenario.escolherCurso(tela, ENGENHARIA.id);

      expect(select2(tela).value).toBe('');
      expect(tela.querySelector('#inscricao-segunda-oferta-aviso')?.textContent).toContain(
        'A 2ª opção foi limpa',
      );
      expect(select2(tela).getAttribute('aria-describedby')).toContain(
        'inscricao-segunda-oferta-aviso',
      );
      await cenario.clicar(botao(tela, 'Salvar rascunho'));
      expect(cenario.servico.salvos[0].ofertaCursoId).toBe(ENGENHARIA.id);
      expect(cenario.servico.salvos[0].ofertaCursoSegundaOpcaoId).toBeNull();
    });

    it('a oferta que a versão nova retirou aparece sem seleção e sem aviso', async () => {
      dosDoisCursos();
      cenario.servico.inscricao = inscricao({
        ofertaCursoId: DIREITO.id,
        ofertaCursoSegundaOpcaoId: 'oferta-que-saiu',
      });
      const tela = await cenario.abrir();

      expect(select2(tela).value).toBe('');
      expect(tela.querySelector('#inscricao-segunda-oferta-aviso')).toBeNull();
    });

    it('trocar a 1ª para outro curso mantém a 2ª, e as duas vão no corpo do envio', async () => {
      dosDoisCursos();
      cenario.servico.inscricao = inscricao({
        ...RESPONDIDA,
        ofertaCursoId: DIREITO.id,
        ofertaCursoSegundaOpcaoId: ENGENHARIA.id,
      });
      const tela = await cenario.abrir();

      await cenario.escolherCurso(tela, MEDICINA.id);

      expect(select2(tela).value).toBe(ENGENHARIA.id);
      expect(tela.querySelector('#inscricao-segunda-oferta-aviso')).toBeNull();
      await cenario.clicar(botao(tela, 'Enviar inscrição'));
      expect(cenario.servico.enviados[0].ofertaCursoId).toBe(MEDICINA.id);
      expect(cenario.servico.enviados[0].ofertaCursoSegundaOpcaoId).toBe(ENGENHARIA.id);
    });

    it('a avaliação é pedida de novo com a 2ª opção quando só ela muda', async () => {
      dosDoisCursos();
      cenario.servico.formulario = COM_MODALIDADES;
      cenario.servico.inscricao = inscricao({ ofertaCursoId: DIREITO.id });
      const tela = await cenario.abrir();

      await escolherSegunda(tela, ENGENHARIA.id);
      await passarOTempo(ESPERA_DA_CONSULTA_MS);

      expect(cenario.servico.avaliacoes.map((a) => a.ofertaCursoSegundaOpcaoId)).toEqual([
        ENGENHARIA.id,
      ]);
    });

    it('a recusa da 2ª opção aparece junto do campo dela, com o foco nele', async () => {
      dosDoisCursos();
      cenario.servico.recusaDoEnvio = recusaDaSegunda(
        'uniplus.selecao.inscricao.segunda_opcao_igual_a_primeira',
      );
      cenario.servico.inscricao = inscricao({
        ...RESPONDIDA,
        ofertaCursoId: DIREITO.id,
        ofertaCursoSegundaOpcaoId: ENGENHARIA.id,
      });
      const tela = await cenario.abrir();
      await cenario.irAoPasso(tela, 'Dados pessoais');

      await cenario.clicar(botao(tela, 'Enviar inscrição'));

      expect(tela.querySelector('#inscricao-segunda-oferta-erro')?.textContent).toContain(
        'A 2ª opção tem de ser um curso diferente da 1ª.',
      );
      expect(tela.querySelector('#inscricao-oferta-erro')).toBeNull();
      expect(select2(tela).getAttribute('aria-invalid')).toBe('true');
      expect(select2(tela).getAttribute('aria-describedby')).toContain(
        'inscricao-segunda-oferta-erro',
      );
      expect(document.activeElement).toBe(select2(tela));
      expect(passos(tela)[0].textContent).toContain('(com resposta recusada)');

      await cenario.escolherCurso(tela, MEDICINA.id);

      expect(tela.querySelector('#inscricao-segunda-oferta-erro')).toBeNull();
      expect(select2(tela).getAttribute('aria-invalid')).toBeNull();
    });

    it('trocar a 1ª mantém a recusa da 2ª que não depende da 1ª', async () => {
      dosDoisCursos();
      cenario.servico.recusaDoEnvio = recusaDaSegunda(
        'uniplus.selecao.inscricao.nenhuma_modalidade',
      );
      cenario.servico.inscricao = inscricao({
        ...RESPONDIDA,
        ofertaCursoId: DIREITO.id,
        ofertaCursoSegundaOpcaoId: ENGENHARIA.id,
      });
      const tela = await cenario.abrir();

      await cenario.clicar(botao(tela, 'Enviar inscrição'));
      await cenario.escolherCurso(tela, MEDICINA.id);

      expect(tela.querySelector('#inscricao-segunda-oferta-erro')).not.toBeNull();
      expect(select2(tela).getAttribute('aria-invalid')).toBe('true');
    });

    it('a recusa de nenhuma modalidade na 2ª opção diz o que fazer com a opção', async () => {
      dosDoisCursos();
      cenario.servico.recusaDoEnvio = recusaDaSegunda(
        'uniplus.selecao.inscricao.nenhuma_modalidade',
      );
      cenario.servico.inscricao = inscricao({
        ...RESPONDIDA,
        ofertaCursoId: DIREITO.id,
        ofertaCursoSegundaOpcaoId: ENGENHARIA.id,
      });
      const tela = await cenario.abrir();

      await cenario.clicar(botao(tela, 'Enviar inscrição'));

      expect(tela.querySelector('#inscricao-segunda-oferta-erro')?.textContent).toContain(
        'retire a 2ª opção',
      );
    });

    it('a revisão mostra as duas opções, e a 2ª como não declarada quando fica vazia', async () => {
      dosDoisCursos();
      cenario.servico.inscricao = inscricao({
        ...RESPONDIDA,
        ofertaCursoId: DIREITO.id,
        ofertaCursoSegundaOpcaoId: ENGENHARIA.id,
      });
      let tela = await cenario.abrir();
      await cenario.irAoPasso(tela, 'Revisão e aceite');
      let revisao = tela.querySelector('insc-formulario-do-candidato')?.textContent ?? '';
      expect(revisao).toContain('1ª opção');
      expect(revisao).toContain(DIREITO.nome);
      expect(revisao).toContain('2ª opção');
      expect(revisao).toContain(ENGENHARIA.nome);

      cenario.servico.inscricao = inscricao({ ...RESPONDIDA, ofertaCursoId: DIREITO.id });
      tela = await cenario.abrir();
      await cenario.irAoPasso(tela, 'Revisão e aceite');
      revisao = tela.querySelector('insc-formulario-do-candidato')?.textContent ?? '';
      expect(revisao).toContain('Não declarada');
    });
  });
});
