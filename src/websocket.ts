import * as websocket from "ws";
import { Server } from 'http';
import * as handler from "./class/websockethandler";

// ★ 追加：接続中のクライアントを管理するリスト
let clients: any[] = [];

export default class WSSignaling {
  server: Server;
  wss: websocket.Server;

  constructor(server: Server, mode: string) {
    this.server = server;
    this.wss = new websocket.Server({ server });
    handler.reset(mode);

    this.wss.on('connection', (ws: WebSocket) => {

      // ==========================================
      // ★ ここから追加：Host/Guestの交通整理
      // ==========================================
      if (clients.length >= 2) {
        ws.send(JSON.stringify({ type: 'full', message: '部屋がいっぱいです' }));
        ws.close();
        return;
      }

      clients.push(ws);
      console.log(`Current clients connected: ${clients.length}`);

      if (clients.length === 1) {
        // 1人目：ホスト（Offerを出す係）
        ws.send(JSON.stringify({ type: 'role', role: 'host' }));
      } else if (clients.length === 2) {
        // 2人目：ゲスト（待つ係）
        ws.send(JSON.stringify({ type: 'role', role: 'guest' }));
        // 1人目に「相手が来たからOffer出して！」と合図を送る
        clients[0].send(JSON.stringify({ type: 'ready' }));
      }
      // ==========================================

      handler.add(ws);

      ws.onclose = (): void => {
        // ★ 追加：切断されたらリストから消し、残った相手に伝える
        clients = clients.filter(client => client !== ws);
        clients.forEach(c => c.send(JSON.stringify({ type: 'disconnected' })));
        
        handler.remove(ws);
      };

      ws.onmessage = (event: MessageEvent): void => {

        // type: connect, disconnect JSON Schema
        // connectionId: connect or disconnect connectionId

        // type: offer, answer, candidate JSON Schema
        // from: from connection id
        // to: to connection id
        // data: any message data structure

        const msg = JSON.parse(event.data);
        if (!msg || !this) {
          return;
        }

        console.log(msg);

        switch (msg.type) {
          case "connect":
            handler.onConnect(ws, msg.connectionId);
            break;
          case "disconnect":
            handler.onDisconnect(ws, msg.connectionId);
            break;
          case "offer":
            handler.onOffer(ws, msg.data);
            break;
          case "answer":
            handler.onAnswer(ws, msg.data);
            break;
          case "candidate":
            handler.onCandidate(ws, msg.data);
            break;
          default:
            break;
        }
      };
    });
  }
}
