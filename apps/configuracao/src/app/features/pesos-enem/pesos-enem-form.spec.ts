import { describe, expect, it } from 'vitest';
import {
  comandoDeAtualizacao,
  comandoDeCriacao,
  criarFormularioDeResolucao,
  criarGrupoDeCriacao,
  criarGrupoDeEdicao,
} from './pesos-enem-form';
import { AREAS, grupo, linha } from './pesos-enem.testing';

describe('formulário de pesos do ENEM', () => {
  it('cria um grupo com uma área por item da lista, na ordem dela, com peso zero e sem corte', () => {
    const criado = criarGrupoDeCriacao(grupo('TECNOLOGICA'), AREAS);

    expect(criado.controls.areas.controls.map((a) => a.controls.codigo.value)).toEqual(
      AREAS.map((a) => a.codigo),
    );
    expect(criado.controls.areas.controls.every((a) => a.controls.peso.value === 0)).toBe(true);
    expect(criado.controls.areas.controls.every((a) => a.controls.corte.value === null)).toBe(true);
  });

  it('a edição segue a ordem das áreas da API e completa a área que a linha não traz', () => {
    const embaralhada = linha({
      id: 'l1',
      resolucao: 'R',
      grupoCurso: grupo('TECNOLOGICA'),
      areas: [
        { codigo: 'MATEMATICA', rotulo: 'x', peso: 3, corte: 450 },
        { codigo: 'REDACAO', rotulo: 'x', peso: 2, corte: null },
      ],
    });

    const editado = criarGrupoDeEdicao(embaralhada, AREAS).getRawValue();

    expect(editado.areas.map((a) => a.codigo)).toEqual(AREAS.map((a) => a.codigo));
    expect(editado.areas.find((a) => a.codigo === 'MATEMATICA')).toMatchObject({
      peso: 3,
      corte: 450,
    });
    expect(editado.areas.find((a) => a.codigo === 'LINGUAGENS')).toMatchObject({
      peso: 0,
      corte: null,
    });
  });

  it('o comando de criação leva o código do grupo, a resolução aparada e só código, peso e corte das áreas', () => {
    const criado = criarGrupoDeCriacao(grupo('HUMANISTICA_I'), AREAS);
    criado.controls.baseLegal.setValue('  Anexo I  ');
    criado.controls.areas.at(4).controls.corte.setValue(450);

    const comando = comandoDeCriacao(criado.getRawValue(), 'Res. 900/2026');

    expect(comando.resolucao).toBe('Res. 900/2026');
    expect(comando.grupoCurso).toBe('HUMANISTICA_I');
    expect(comando.baseLegal).toBe('Anexo I');
    expect(comando.areas?.[4]).toEqual({ codigo: 'MATEMATICA', peso: 0, corte: 450 });
    expect(Object.keys(comando.areas?.[0] ?? {}).sort()).toEqual(['codigo', 'corte', 'peso']);
  });

  it('texto em branco viaja como nulo e o comando de atualização leva o id da linha', () => {
    const editado = criarGrupoDeEdicao(
      linha({ id: 'l1', resolucao: 'R', grupoCurso: grupo('TECNOLOGICA'), baseLegal: '   ' }),
      AREAS,
    );

    const comando = comandoDeAtualizacao(editado.getRawValue());

    expect(comando.id).toBe('l1');
    expect(comando.baseLegal).toBeNull();
    expect(
      comandoDeCriacao(criarGrupoDeCriacao(grupo('TECNOLOGICA'), AREAS).getRawValue(), '  ')
        .resolucao,
    ).toBeNull();
  });

  describe('tamanho máximo de cada campo de texto', () => {
    const cenarios = [
      {
        campo: 'resolução',
        limite: 40,
        obter: (f: ReturnType<typeof criarFormularioDeResolucao>) => f.controls.resolucao,
      },
      {
        campo: 'base legal global',
        limite: 500,
        obter: (f: ReturnType<typeof criarFormularioDeResolucao>) => f.controls.baseLegalGlobal,
      },
      {
        campo: 'base legal do grupo',
        limite: 500,
        obter: (f: ReturnType<typeof criarFormularioDeResolucao>) => {
          f.controls.grupos.push(criarGrupoDeCriacao(grupo('TECNOLOGICA'), AREAS));
          return f.controls.grupos.at(0).controls.baseLegal;
        },
      },
    ];

    it.each(cenarios)(
      '$campo aceita $limite caracteres e recusa um a mais',
      ({ limite, obter }) => {
        const controle = obter(criarFormularioDeResolucao());

        controle.setValue('a'.repeat(limite));
        expect(controle.hasError('maxlength')).toBe(false);
        controle.setValue('a'.repeat(limite + 1));
        expect(controle.hasError('maxlength')).toBe(true);
      },
    );
  });
});
