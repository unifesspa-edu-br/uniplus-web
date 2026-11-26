import { seletorDoCampo } from './seletor-do-campo.testing';
import { codigoComRotulo } from './fatos-candidato.fixtures';
import {
  ClassificacaoDeProtecaoCodigo,
  HipoteseLegalTratamentoCodigo,
} from '@uniplus/shared-data/configuracao';
import { type FatoCandidatoDto } from '@uniplus/shared-data/configuracao';
import { type Pagina, problema, sucesso, urlDoFato } from './fatos-candidato.testing';
import {
  comDefinicao,
  comResolucao,
  corRaca,
  origemCalculada,
  tipoSimOuNao,
} from './fatos-candidato.fixtures';

export const DEFINICAO = '#cfg-fato-definicao';
export const campo = (nome: string): string => seletorDoCampo(nome, DEFINICAO);
export const derivadoBooleano: FatoCandidatoDto = {
  ...comResolucao(
    comDefinicao(corRaca, {
      dominio: tipoSimOuNao,
      valores: { fonte: null, declarados: [] },
      protecao: {
        ...corRaca.definicao.protecao,
        classificacao: codigoComRotulo(ClassificacaoDeProtecaoCodigo.PESSOAL, 'Pessoal'),
        hipoteseLegal: codigoComRotulo(
          HipoteseLegalTratamentoCodigo.CUMPRIMENTO_OBRIGACAO_LEGAL,
          'Cumprimento de obrigação legal',
        ),
      },
    }),
    { origem: origemCalculada, binding: 'REGRA_DERIVACAO:PERFIL' },
  ),
  codigo: 'PERFIL',
};
export const agregadoDeRenda: FatoCandidatoDto = {
  ...comResolucao(derivadoBooleano, { binding: 'AGREGACAO_GRUPO:RENDA' }),
  codigo: 'PERFIL_FAMILIAR',
};

export const recusa = (status: number, corpo: object) =>
  problema(status, { title: 'Problema', ...corpo });

/** Conduz o envio da definição como a pessoa faz, sobre a página que o teste montou. */
export class ConducaoDaDefinicao {
  constructor(private readonly pagina: () => Pagina) {}

  readonly enviar = async (): Promise<void> => {
    const p = this.pagina();
    p.submeter(DEFINICAO);
    await p.propagar();
  };

  readonly definir = (fato: FatoCandidatoDto) =>
    this.pagina().http.expectOne(
      (r) => r.method === 'PUT' && r.url === `${urlDoFato(fato)}/definicao`,
    );

  readonly entregar = async (
    fato: FatoCandidatoDto,
    pedido = this.definir(fato),
  ): Promise<void> => {
    pedido.flush(...sucesso());
    await this.pagina().recarregarOFato(fato);
  };
}
