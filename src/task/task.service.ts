import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { GetDTO } from '../common/dto/params-dto';
import { Prisma } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WhatsappGateway } from '../whatsapp/websockets/socket.gateaway';

const dayjs = require('dayjs');

@Injectable()
export class TaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappGateway: WhatsappGateway,
  ) {}
  private readonly logger = new Logger(TaskService.name);

  @Cron(CronExpression.EVERY_10_SECONDS)
  handleCron() {
    const date = dayjs().format('YYYY-MM-DD HH:mm');
    this.whatsappGateway.emitEvent('calendarJob', 'Task running at ' + date);
    this.logger.debug('Task running at ' + date);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  InProgressTask() {
    const date = dayjs().format('YYYY-MM-DD');
    const minute = dayjs().format('HH:mm');
    this.findTaskCalendar(date, minute);
    this.logger.debug('Search Task ' + date);
  }

  async findTaskCalendar(date: string, hour: string) {
    const calendar = await this.prisma.calendar.findFirst({
      where: {
        deleted: false,
        category: 'Programación',
        status: {
          not: 'Finalizado',
        },
        startDate: new Date(date),
        timeStart: hour,
      },
      select: {
        id: true,
        userId: true,
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
    });

    if (!calendar) {
      return;
    }

    await this.prisma.calendar.update({
      where: {
        id: calendar.id,
      },
      data: {
        status: 'En Proceso',
      },
    });

    await this.prisma.notify.create({
      data: {
        title: `Envio de Mensajes a ${calendar._count.HistorySending} pacientes`,
        message: `Se ha iniciado el envio de mensajes a las ${hour} del ${date} con la plantilla ${calendar.template.name}`,
        status: 'En Proceso',
        type: 'Mensajes Programados',
        userId: calendar.userId,
      },
    });
  }

  async executeTaskCalendar(date: string, hour: string) {
    const calendar = await this.prisma.calendar.findFirst({
      where: {
        status: {
          not: 'En Proceso',
        },
        deleted: false,
      },
      select: {
        id: true,
        status: true,
        template: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const patients = await this.prisma.historySending.findMany({
      where: {
        calendarId: calendar.id,
      },
      select: {
        id: true,
        namePatient: true,
        phone: true,
        patientId: true,
        status: true,
      },
    });
  }
}
