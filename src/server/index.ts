import WebSocket, { WebSocketServer } from "ws";

interface CalculationClient {
  ws: WebSocket;
  busy: boolean;
  queue: CalculationRequest[];
}

interface CalculationRequest {
  ws: WebSocket;
  data: {
    x: number;
    y: number;
    maxIter: number;
    magnification: number;
  };
}

const MAX_QUEUE_SIZE = 10;
const wss = new WebSocketServer({ port: 8080 });

let calculationClients: CalculationClient[] = [];

// クライアント接続時
wss.on("connection", (ws: WebSocket) => {
  ws.on("message", (message: string) => {
    const data = JSON.parse(message);

    if (data.type === "calculation_client") {
      // 計算を行うクライアントとして登録
      const newClient: CalculationClient = { ws: ws, busy: false, queue: [] };
      calculationClients.push(newClient);
      ws.send(JSON.stringify({ message: "Connected as calculation client" }));

      // クライアント切断時にキュー内のリクエストにエラーメッセージを送る
      ws.on("close", () => {
        handleClientDisconnection(newClient);
      });
    } else if (data.type === "request_client") {
      // 計算要求クライアントからのリクエスト
      handleRequestClient(ws, data);
    }
  });
});

function handleRequestClient(ws: WebSocket, data: any) {
  const availableClient = calculationClients.find(
    (client) => !client.busy || client.queue.length < MAX_QUEUE_SIZE,
  );

  if (availableClient) {
    if (availableClient.busy) {
      // 計算クライアントがビジーだがキューに空きがある場合、キューに追加
      availableClient.queue.push({ ws: ws, data: data });
    } else {
      // クライアントが空いている場合、即座に計算を実行
      availableClient.busy = true;
      sendCalculationRequest(availableClient, ws, data);
    }
  } else {
    // 全クライアントのキューが満杯の場合、エラーメッセージを返す
    ws.send(
      JSON.stringify({
        error:
          "All calculation clients are busy and queue is full. Please fallback to local calculation.",
      }),
    );
  }
}

function sendCalculationRequest(
  client: CalculationClient,
  requestWs: WebSocket,
  data: any,
) {
  client.ws.send(
    JSON.stringify({
      x: data.x,
      y: data.y,
      maxIter: data.maxIter,
      magnification: data.magnification,
    }),
  );

  client.ws.once("message", (result: string) => {
    // 計算結果を受信して要求クライアントに転送
    requestWs.send(result);

    // クライアントを再び利用可能に
    if (client.queue.length > 0) {
      // キューにリクエストがあれば次を処理
      const nextRequest = client.queue.shift()!;
      sendCalculationRequest(client, nextRequest.ws, nextRequest.data);
    } else {
      client.busy = false;
    }
  });
}

function handleClientDisconnection(client: CalculationClient) {
  // クライアントのキューに残っている全てのリクエストにエラーメッセージを送信
  client.queue.forEach((request) => {
    request.ws.send(
      JSON.stringify({
        error:
          "The calculation client has disconnected. Further waiting is futile.",
      }),
    );
  });

  // 計算クライアントのリストから削除
  calculationClients = calculationClients.filter((c) => c !== client);
}
