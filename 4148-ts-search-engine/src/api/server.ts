// @ts-ignore
import Koa from 'koa';
// @ts-ignore
import Router from '@koa/router';
// @ts-ignore
import bodyParser from 'koa-bodyparser';
import { SearchEngineFacade } from '../search-engine-facade';
import { Document, SearchRequest } from '../core/types';

export class SearchEngineAPI {
  private facade: SearchEngineFacade;
  private app: any;
  private router: any;
  private port: number;
  private host: string;
  private server: any;

  constructor(facade: SearchEngineFacade, port: number, host: string) {
    this.facade = facade;
    this.port = port;
    this.host = host;
    this.app = new Koa();
    this.router = new Router();
    this.server = null;
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(bodyParser());
    this.app.use(async (ctx: any, next: any) => {
      try {
        await next();
      } catch (err: any) {
        ctx.status = err.statusCode || err.status || 500;
        ctx.body = { error: err.message };
      }
    });
  }

  private setupRoutes(): void {
    this.router.get('/health', async (ctx: any) => {
      ctx.body = await this.facade.getHealth();
    });

    this.router.get('/stats', async (ctx: any) => {
      ctx.body = await this.facade.getStats();
    });

    this.router.post('/search', async (ctx: any) => {
      const body = ctx.request.body as any;
      const request: SearchRequest | string = body.query || body;
      ctx.body = await this.facade.search(request);
    });

    this.router.get('/suggest', async (ctx: any) => {
      const prefix = (ctx.query as any).prefix as string;
      const limit = parseInt((ctx.query as any).limit, 10);
      ctx.body = await this.facade.suggest(prefix, limit);
    });

    this.router.get('/correct', async (ctx: any) => {
      const query = (ctx.query as any).query as string;
      ctx.body = await this.facade.correct(query);
    });

    this.router.get('/pinyin-search', async (ctx: any) => {
      const query = (ctx.query as any).query as string;
      const limit = parseInt((ctx.query as any).limit, 10);
      ctx.body = await this.facade.pinyinSearch(query, limit);
    });

    this.router.get('/history', async (ctx: any) => {
      const limit = parseInt((ctx.query as any).limit, 10);
      ctx.body = await this.facade.getHistory(limit);
    });

    this.router.get('/hot-words', async (ctx: any) => {
      const limit = parseInt((ctx.query as any).limit, 10);
      ctx.body = await this.facade.getHotWords(limit);
    });

    this.router.post('/documents', async (ctx: any) => {
      const body = ctx.request.body as any;
      if (Array.isArray(body)) {
        ctx.body = await this.facade.addDocuments(body as Document[]);
      } else {
        await this.facade.addDocument(body as Document);
        ctx.body = { success: true };
      }
    });

    this.router.put('/documents/:id', async (ctx: any) => {
      const doc = ctx.request.body as Document;
      doc.id = (ctx.params as any).id;
      await this.facade.updateDocument(doc);
      ctx.body = { success: true };
    });

    this.router.delete('/documents/:id', async (ctx: any) => {
      const docId = (ctx.params as any).id;
      const removed = await this.facade.removeDocument(docId);
      ctx.body = { success: removed };
    });

    this.router.post('/save', async (ctx: any) => {
      await this.facade.save();
      ctx.body = { success: true };
    });

    this.router.post('/load', async (ctx: any) => {
      await this.facade.load();
      ctx.body = { success: true };
    });

    this.app.use(this.router.routes());
    this.app.use(this.router.allowedMethods());
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, this.host, () => {
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
