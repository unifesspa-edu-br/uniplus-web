import { describe, expect, it } from 'vitest';

import { ATO_INDIVIDUAL } from '../../shared/deliberacao/regra-de-deliberacao.testing';
import { ID_AVALIACAO, ID_BANCA_HETERO } from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import {
  AjudantesDeRecusasDasFases,
  PAGINAS_DE_ERRO,
} from './cronograma-recusas-das-fases.testing';

const RECUSADA_NOS_CAMPOS =
  'A gravação do cronograma foi recusada. A mensagem de cada recusa está no campo a que ela se refere.';
const QUORUM = 'uniplus.selecao.banca.quorum_fora_do_intervalo';
const REGRA_OBRIGATORIA = 'uniplus.selecao.banca.regra_de_deliberacao_obrigatoria';
const CAMINHO = 'fases[0].bancasRequeridas[0].regraDeDeliberacao';
const REGRA = `fase-AVALIACAO-regra-${ID_BANCA_HETERO}`;
const NOTA = 'conferida de novo na próxima gravação';
const DO_QUORUM = {
  field: `${CAMINHO}.quorum`,
  code: QUORUM,
  message: 'O quórum fica entre 1 e o número de integrantes.',
};

describe('CronogramaPassoComponent: recusas da gravação à regra de deliberação das bancas da fase', () => {
  let nativo: ContextoDoCronograma['nativo'];
  let detectar: ContextoDoCronograma['detectar'];
  let comFases: ContextoDoCronograma['comFases'];
  let comUmaEtapa: ContextoDoCronograma['comUmaEtapa'];
  let proximoPasso: ContextoDoCronograma['proximoPasso'];
  let recusarFases: AjudantesDeRecusasDasFases['recusarFases'];
  let requererBanca: AjudantesDeRecusasDasFases['requererBanca'];
  let bloco: AjudantesDeRecusasDasFases['bloco'];

  usarCronograma((tela) => {
    ({ nativo, detectar, comFases, comUmaEtapa, proximoPasso } = tela);
    ({ recusarFases, requererBanca, bloco } = new AjudantesDeRecusasDasFases(tela));
  });

  const campo = (sufixo: string) => nativo.querySelector(`#${REGRA}-${sufixo}`);
  const comBanca = (regra?: Parameters<typeof requererBanca>[0]) => {
    comFases(ID_AVALIACAO);
    comUmaEtapa();
    requererBanca(regra);
  };

  it('mostra a recusa sob o Quórum, com mensagem, código e página, e marca só esse campo', async () => {
    comBanca();

    const resultado = await recusarFases([DO_QUORUM]);

    expect(bloco(`${REGRA}-quorum-recusas`)).toContain('O quórum fica entre 1 e o número');
    expect(bloco(`${REGRA}-quorum-recusas`)).toContain(QUORUM);
    expect(document.querySelector(`a[href="${PAGINAS_DE_ERRO}${QUORUM}"]`)).not.toBeNull();
    expect(campo('quorum')?.getAttribute('aria-invalid')).toBe('true');
    expect(campo('quorum')?.getAttribute('aria-describedby')).toContain(`${REGRA}-quorum-recusas`);
    expect(campo('criterio')?.getAttribute('aria-invalid')).toBeNull();
    expect(campo('quorum-erro')).toBeNull();
    expect(resultado.messages).toEqual([RECUSADA_NOS_CAMPOS]);
  });

  it('não repete no bloco "Quem julga" a recusa que está sob o Quórum', async () => {
    comBanca();

    await recusarFases([DO_QUORUM]);

    expect(bloco('fase-AVALIACAO-bancas-erro')).toBeNull();
  });

  it('mostra sob o modo a recusa à regra inteira da banca', async () => {
    comBanca();

    await recusarFases([{ field: CAMINHO, code: REGRA_OBRIGATORIA, message: 'Declare a regra.' }]);

    expect(bloco(`${REGRA}-modo-recusas`)).toContain('Declare a regra.');
    expect(campo('modo')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('mostra sob o modo a recusa ao campo que a tela não mostra para a regra de agora', async () => {
    comBanca(ATO_INDIVIDUAL);

    await recusarFases([DO_QUORUM]);

    expect(campo('quorum')).toBeNull();
    expect(bloco(`${REGRA}-modo-recusas`)).toContain('O quórum fica entre 1 e o número');
    expect(campo('modo')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('leva ao bloco das bancas a recusa à banca inteira e ao tipo dela', async () => {
    comBanca();

    await recusarFases([
      { field: 'fases[0].bancasRequeridas[0]', code: QUORUM, message: 'Banca inteira.' },
      { field: 'fases[0].bancasRequeridas[0].tipoBancaId', code: QUORUM, message: 'Tipo.' },
    ]);

    expect(bloco('fase-AVALIACAO-bancas-erro')).toContain('Banca inteira.');
    expect(bloco('fase-AVALIACAO-bancas-erro')).toContain('Tipo.');
    expect(campo('quorum')?.getAttribute('aria-invalid')).toBeNull();
  });

  it('leva ao bloco das bancas a recusa a uma banca que a fase enviada não tinha', async () => {
    comBanca();

    await recusarFases([
      {
        field: 'fases[0].bancasRequeridas[4].regraDeDeliberacao.quorum',
        code: QUORUM,
        message: 'Sem banca.',
      },
    ]);

    expect(bloco('fase-AVALIACAO-bancas-erro')).toContain('Sem banca.');
    expect(campo('quorum')?.getAttribute('aria-invalid')).toBeNull();
  });

  it('sobe para o bloco das bancas, com a nota, a recusa a conferir de novo e a tira de sob o campo', async () => {
    comBanca();
    await recusarFases([DO_QUORUM]);

    const caixa = nativo.querySelector<HTMLInputElement>(
      '#fase-AVALIACAO-tipos-de-decisao-GABARITO_DA_PROVA',
    ) as HTMLInputElement;
    caixa.checked = true;
    caixa.dispatchEvent(new Event('change'));
    detectar();

    expect(bloco('fase-AVALIACAO-bancas-erro')).toContain('O quórum fica entre 1 e o número');
    expect(bloco('fase-AVALIACAO-bancas-erro')).toContain(NOTA);
    expect(bloco(`${REGRA}-quorum-recusas`)).toBeNull();
    expect(campo('quorum')?.getAttribute('aria-invalid')).toBeNull();
  });

  it('leva o foco ao Quórum quando a recusa a ele é a primeira do passo', async () => {
    comBanca();
    await recusarFases([DO_QUORUM]);

    await proximoPasso();
    detectar();

    expect(document.activeElement?.id).toBe(`${REGRA}-quorum`);
  });

  it('leva o foco ao bloco do modo quando a recusa é a um campo que a tela não mostra', async () => {
    comBanca(ATO_INDIVIDUAL);
    await recusarFases([DO_QUORUM]);

    await proximoPasso();
    detectar();

    expect(document.activeElement?.id).toBe(`${REGRA}-modo-recusas`);
  });
});
