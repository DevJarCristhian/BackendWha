import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { GetDTO } from '../common/dto/params-dto';
import { Prisma } from '@prisma/client';
import { UpdateCalendarDto } from './dto/update-calendar.dto';
import { StoreCalendarDto } from './dto/store-calendar.dto';
const dayjs = require('dayjs');

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const query = await this.prisma.calendar.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        startDate: true,
        endDate: true,
        category: true,
        timeStart: true,
        timeEnd: true,
        status: true,
        createdAt: true,
        templateId: true,
        user: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            HistorySending: true,
          },
        },
        template: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      where: {
        status: { not: 'Eliminado' },
      },
    });

    const estados = ['Pendiente', 'Enviado', 'No enviado'];
    const totalsW = await Promise.all(
      estados.map((estado) =>
        this.prisma.historySending
          .groupBy({
            by: ['calendarId'],
            where: { status: estado },
            _count: { calendarId: true },
          })
          .then((res) => ({ estado, data: res })),
      ),
    );

    const sending = totalsW.find((group) => group.estado === 'Enviado').data;
    const pending = totalsW.find((group) => group.estado === 'Pendiente').data;
    const notSending = totalsW.find(
      (group) => group.estado === 'No enviado',
    ).data;

    const data = query.map((row) => ({
      id: row.id,
      title: row.title,
      start: dayjs.utc(row.startDate).format('YYYY-MM-DD') + ' 00:00:00',
      end: dayjs.utc(row.endDate).format('YYYY-MM-DD') + ' 23:59:59',
      extendedProps: {
        description: row.description,
        calendar: row.category,
        timeStart: row.timeStart,
        timeEnd: row.timeEnd,
        userCreated: row.user.name,
        status: row.status,
        createdDate: dayjs(row.createdAt).format('DD/MM/YYYY HH:mm'),
        templateId: row.templateId,
        template: row.template?.name ?? null,
        totalPatients: row._count.HistorySending ?? 0,
        totalSending:
          sending.length > 0 && row.templateId
            ? sending.find((item) => item.calendarId === row.id)._count
                .calendarId
            : 0,
        totalPending:
          pending.length > 0 && row.templateId
            ? pending.find((item) => item.calendarId === row.id)._count
                .calendarId
            : 0,
        totalNot:
          notSending.length > 0 && row.templateId
            ? notSending.find((item) => item.calendarId === row.id)._count
                .calendarId
            : 0,
        istart: dayjs.utc(row.startDate).format('YYYY-MM-DD'),
        iend: dayjs.utc(row.endDate).format('YYYY-MM-DD'),
      },
    }));

    const totalQuery = Prisma.sql` SELECT COUNT(*) AS total  FROM calendar`;

    const totalResult = await this.prisma.$queryRaw(totalQuery);
    const total = Number(totalResult[0].total);

    return {
      data,
      total,
    };
  }

  async storeCalendar(user: number, dto: StoreCalendarDto) {
    const newCalendar = await this.prisma.calendar.create({
      data: {
        title: dto.title,
        description: dto.description,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        category: dto.category,
        timeStart: dto.timeStart,
        timeEnd: dto.timeEnd,
        userId: user,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'Pendiente',
        templateId: dto.templateId ?? null,
      },
    });

    if (newCalendar.id && dto.patients && dto.patients.length > 0) {
      await this.prisma.historySending.createMany({
        data: dto.patients.map((pa) => ({
          namePatient: pa.namePatient,
          patientId: pa.patientId,
          phone: pa.phone,
          status: 'Pendiente',
          createdAt: newCalendar.createdAt,
          calendarId: newCalendar.id,
        })),
      });
    }

    return 'Calendario Creado correctamente';
  }

  async updateCalendar(user: number, id: number, dto: UpdateCalendarDto) {
    const updateCalendar = await this.prisma.calendar.update({
      where: {
        id: id,
      },
      data: {
        title: dto.title,
        description: dto.description,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        category: dto.category,
        timeStart: dto.timeStart,
        timeEnd: dto.timeEnd,
        userId: user,
        updatedAt: new Date(),
        status: 'Pendiente',
        templateId: dto.templateId ?? null,
      },
    });

    if (dto.patients && dto.patients.length > 0) {
      await this.prisma.historySending.createMany({
        data: dto.patients.map((pa) => ({
          namePatient: pa.namePatient,
          patientId: pa.patientId,
          phone: pa.phone,
          status: 'Pendiente',
          createdAt: updateCalendar.createdAt,
          calendarId: id,
        })),
      });
    }

    return 'Caldendario actualizado correctamente';
  }

  async getPatientCalendarId(id: number) {
    const query = await this.prisma.historySending.findMany({
      select: {
        id: true,
        namePatient: true,
        patientId: true,
        phone: true,
        status: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      where: {
        calendarId: id,
      },
    });

    return query;
  }

  async getNotifications() {
    const query = await this.prisma.notify.findMany({
      select: {
        id: true,
        title: true,
        message: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const data = query.map((row) => ({
      id: row.id,
      title: row.title,
      message: row.message,
      status: row.status,
      user: row.user.name,
      createdAt: dayjs.utc(row.createdAt).format('DD/MM/YYYY HH:mm'),
    }));

    return data;
  }
}
