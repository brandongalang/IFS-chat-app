import pino from 'pino';

const pinoConfig = process.env.NODE_ENV === 'production'
  ? {}
  : {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
        translateTime: 'SYS:standard',
      },
    },
  };

const logger = pino(pinoConfig);

export default logger;
