import http from "http";
import { AddressInfo } from "net";
import express from "express";
import { errorMessage, log } from "./logger";

export interface ServerRuntime {
  getListeningPort(): number;
  bindListenPort(port: number): Promise<void>;
  rollbackListenPort(): void;
  commitListenPort(): void;
}

export interface AppHost extends ServerRuntime {
  listen(app: express.Express, ports: number[]): Promise<void>;
}

function bind(app: express.Express, port: number): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    const onError = (error: Error) => {
      server.close();
      reject(error);
    };
    server.once("error", onError);
    server.listen(port, () => {
      server.removeListener("error", onError);
      server.on("error", (listenError: Error) => {
        log(`Server error: ${errorMessage(listenError)}`);
      });
      resolve(server);
    });
  });
}

function portOf(server: http.Server, fallback: number): number {
  const address = server.address() as AddressInfo | string | null;
  return typeof address === "object" && address ? address.port : fallback;
}

export function createAppHost(): AppHost {
  let app: express.Express | null = null;
  let current: http.Server | null = null;
  let replaced: http.Server | null = null;
  let listeningPort = 0;

  return {
    getListeningPort() {
      return listeningPort;
    },
    async listen(expressApp, ports) {
      app = expressApp;
      let lastError: unknown = null;
      for (const port of ports) {
        try {
          current = await bind(expressApp, port);
          listeningPort = portOf(current, port);
          log(`Listening on http://localhost:${listeningPort}`);
          return;
        } catch (error) {
          lastError = error;
          log(`Error: cannot listen on port ${port}: ${errorMessage(error)}`);
        }
      }
      log(`Error: HTTP server is not listening (${errorMessage(lastError)})`);
    },
    async bindListenPort(port) {
      if (!app) throw new Error("HTTP server is not running");
      const server = await bind(app, port);
      replaced = current;
      current = server;
      listeningPort = portOf(server, port);
      log(`Listening on http://localhost:${listeningPort}`);
    },
    rollbackListenPort() {
      const failed = current;
      current = replaced;
      replaced = null;
      if (current) listeningPort = portOf(current, listeningPort);
      failed?.close();
    },
    commitListenPort() {
      const old = replaced;
      replaced = null;
      old?.close();
    },
  };
}
