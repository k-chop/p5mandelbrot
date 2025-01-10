import { WebSocketServer, type WebSocket } from "ws";

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
  };
}

const MAX_QUEUE_SIZE = 10;
const CALCULATION_RESULT = 0x03 as const;

const wss = new WebSocketServer({ port: 8080 });

let calculationClients: CalculationClient[] = [];

wss.on("connection", (ws: WebSocket) => {
  console.log("New client connected");

  ws.on("message", (message, isBinary) => {
    let data: any;
    if (isBinary && message instanceof Buffer) {
      const type = message[0];

      if (type === CALCULATION_RESULT) {
        // ここでは何もしない
      } else {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Invalid binary message",
          }),
        );
      }
      return;
    } else {
      try {
        data = JSON.parse(message as any);
      } catch {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Invalid JSON",
          }),
        );
        return;
      }

      if (data.type === "register_calculation_client") {
        // 計算を行うクライアントとして登録
        const newClient: CalculationClient = { ws: ws, busy: false, queue: [] };
        calculationClients.push(newClient);
        console.log("Connected as calculation client");

        ws.send(
          JSON.stringify({
            type: "connection_confirmation",
            message: "Connected as calculation client",
          }),
        );

        // クライアント切断時の処理
        ws.on("close", () => {
          handleClientDisconnection(newClient);
          console.log(
            `Calculation client disconnected. ${calculationClients.length} clients remaining`,
          );
        });
      } else if (data.type === "calculation_request") {
        // 計算要求クライアントからのリクエスト処理
        handleRequestClient(ws, data);
      }
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

const validateCalculationRequest = (data: any) => {
  return (
    typeof data.x === "string" &&
    typeof data.y === "string" &&
    typeof data.maxIter === "number"
  );
};

function handleRequestClient(ws: WebSocket, data: any) {
  if (!validateCalculationRequest(data)) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Invalid calculation request data",
      }),
    );
    return;
  }

  const availableClient = calculationClients.find(
    (client) => !client.busy || client.queue.length < MAX_QUEUE_SIZE,
  );

  if (availableClient) {
    if (availableClient.busy) {
      availableClient.queue.push({ ws: ws, data: data });
    } else {
      availableClient.busy = true;
      sendCalculationRequest(availableClient, ws, data);
    }
  } else {
    ws.send(
      JSON.stringify({
        type: "error",
        message:
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
      type: "calculation_request",
      x: data.x,
      y: data.y,
      max_iter: data.maxIter,
    }),
  );

  client.ws.once("message", (result: string) => {
    requestWs.send(result);

    if (client.queue.length > 0) {
      const nextRequest = client.queue.shift()!;
      sendCalculationRequest(client, nextRequest.ws, nextRequest.data);
    } else {
      client.busy = false;
    }
  });
}

function handleClientDisconnection(client: CalculationClient) {
  client.queue.forEach((request) => {
    request.ws.send(
      JSON.stringify({
        type: "error",
        message:
          "The calculation client has disconnected. Further waiting is futile.",
      }),
    );
  });
  calculationClients = calculationClients.filter((c) => c !== client);
}
