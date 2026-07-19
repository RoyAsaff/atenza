import { PrismaClient } from '@prisma/client';
import { Usuario } from '../../domain/entidades/usuario';
import {
  DatosNuevoUsuario,
  UsuarioRepositorio,
} from '../../domain/repositorios/usuario-repositorio';

type UsuarioConRol = {
  id: number;
  nombres: string;
  apellidos: string;
  email: string;
  password: string;
  whatsapp: string | null;
  rol_id: number;
  activo: boolean;
  email_verificado: boolean;
  trial_inicio: Date;
  plan_id: number | null;
  rol: { nombre_rol: 'admin' | 'docente_estudiante' };
};

function aDominio(u: UsuarioConRol): Usuario {
  return {
    id: u.id,
    nombres: u.nombres,
    apellidos: u.apellidos,
    email: u.email,
    password: u.password,
    whatsapp: u.whatsapp,
    rol_id: u.rol_id,
    rol_nombre: u.rol.nombre_rol,
    activo: u.activo,
    email_verificado: u.email_verificado,
    trial_inicio: u.trial_inicio,
    plan_id: u.plan_id,
  };
}

export class PrismaUsuarioRepositorio implements UsuarioRepositorio {
  constructor(private readonly prisma: PrismaClient) {}

  async buscarPorEmail(email: string): Promise<Usuario | null> {
    const u = await this.prisma.usuario.findUnique({
      where: { email },
      include: { rol: true },
    });
    return u ? aDominio(u) : null;
  }

  async buscarPorId(id: number): Promise<Usuario | null> {
    const u = await this.prisma.usuario.findUnique({
      where: { id },
      include: { rol: true },
    });
    return u ? aDominio(u) : null;
  }

  async crear(datos: DatosNuevoUsuario): Promise<Usuario> {
    const u = await this.prisma.usuario.create({
      data: {
        nombres: datos.nombres,
        apellidos: datos.apellidos,
        email: datos.email,
        password: datos.passwordHash,
        whatsapp: datos.whatsapp ?? null,
        rol: { connect: { nombre_rol: datos.rol_nombre } },
        plan: datos.plan_id ? { connect: { id: datos.plan_id } } : undefined,
      },
      include: { rol: true },
    });
    return aDominio(u);
  }

  async marcarEmailVerificado(id: number): Promise<void> {
    await this.prisma.usuario.update({
      where: { id },
      data: { email_verificado: true },
    });
  }

  async actualizarPassword(id: number, passwordHash: string): Promise<void> {
    await this.prisma.usuario.update({
      where: { id },
      data: { password: passwordHash },
    });
  }

  async actualizarPlan(id: number, plan_id: number): Promise<void> {
    await this.prisma.usuario.update({ where: { id }, data: { plan_id } });
  }

  async listar(buscar?: string): Promise<Usuario[]> {
    const usuarios = await this.prisma.usuario.findMany({
      where: buscar
        ? {
            OR: [
              { nombres: { contains: buscar, mode: 'insensitive' } },
              { apellidos: { contains: buscar, mode: 'insensitive' } },
              { email: { contains: buscar, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: { rol: true },
      orderBy: { apellidos: 'asc' },
    });
    return usuarios.map(aDominio);
  }
}
