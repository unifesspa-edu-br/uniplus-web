import {
  AtorDoEventoDaContencaoCodigo,
  EtapaDaVersaoCodigo,
  OrigemDaRetomadaCodigo,
  TipoDoRegistroDoBloqueioCodigo,
} from '@uniplus/shared-data/autorizacao';
import type { RegistroDaContencaoDto } from '@uniplus/shared-data/autorizacao';

type Registro = RegistroDaContencaoDto;

export const ROTULO_DO_TIPO: Readonly<Record<TipoDoRegistroDoBloqueioCodigo, string>> = {
  [TipoDoRegistroDoBloqueioCodigo.SUSPENSAO]: 'Perfil suspenso',
  [TipoDoRegistroDoBloqueioCodigo.DECISAO_DA_RETOMADA]: 'Etapa da retomada decidida',
  [TipoDoRegistroDoBloqueioCodigo.RETOMADA]: 'Suspensão retomada',
  [TipoDoRegistroDoBloqueioCodigo.DESATIVACAO]: 'Perfil desativado',
  [TipoDoRegistroDoBloqueioCodigo.REATIVACAO]: 'Perfil reativado',
};

export const ROTULO_DA_ETAPA: Readonly<Record<EtapaDaVersaoCodigo, string>> = {
  [EtapaDaVersaoCodigo.GESTAO_DE_ACESSOS]: 'Gestão de acessos',
  [EtapaDaVersaoCodigo.PROTECAO_DE_DADOS]: 'Proteção de dados',
};

export const ROTULO_DA_ORIGEM: Readonly<Record<OrigemDaRetomadaCodigo, string>> = {
  [OrigemDaRetomadaCodigo.DECISAO_DA_ETAPA]: 'Decisão da última etapa exigida',
  [OrigemDaRetomadaCodigo.TROCA_DE_VIGENCIA]: 'Troca da versão em vigor',
  [OrigemDaRetomadaCodigo.RECLASSIFICACAO]: 'Reclassificação de uma permissão do perfil',
};

export const ROTULO_DO_ATOR_SISTEMA = 'Processo automático';

export function tipoDoRegistro(codigo: TipoDoRegistroDoBloqueioCodigo): Registro['tipo'] {
  return { codigo, rotulo: ROTULO_DO_TIPO[codigo] };
}

export function etapaDoRegistro(codigo: EtapaDaVersaoCodigo): NonNullable<Registro['etapa']> {
  return { codigo, rotulo: ROTULO_DA_ETAPA[codigo] };
}

export function origemDoRegistro(codigo: OrigemDaRetomadaCodigo): NonNullable<Registro['origem']> {
  return { codigo, rotulo: ROTULO_DA_ORIGEM[codigo] };
}

export function atorDoRegistro(codigo: AtorDoEventoDaContencaoCodigo): Registro['ator'] {
  return {
    codigo,
    rotulo: codigo === AtorDoEventoDaContencaoCodigo.HUMANO ? 'Pessoa' : ROTULO_DO_ATOR_SISTEMA,
  };
}
