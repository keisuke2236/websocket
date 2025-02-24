// メッセージブロードキャスト機能を修正したBun WebSocketサーバー
// server.js または server.ts として保存してください

// 接続中のクライアントを保持する配列
const clients = [];

const server = Bun.serve({
  port: 2236,
  fetch(req, server) {
    // WebSocketリクエストをアップグレード
    if (server.upgrade(req)) {
      return;
    }
    return new Response("Bunを使用したWebSocketサーバー", { status: 200 });
  },
  websocket: {
    // 接続が開始されたとき
    open(ws) {
      console.log("クライアントが接続しました");

      // クライアントIDを生成
      const clientId = Date.now();
      ws.data = { clientId };

      // クライアントをリストに追加
      clients.push(ws);

      // 接続数をログに出力
      console.log(`現在の接続数: ${clients.length}`);

      // 歓迎メッセージを送信
      ws.send(JSON.stringify({
        type: "welcome",
        message: "WebSocketサーバーへようこそ！",
        timestamp: new Date().toISOString()
      }));

      // クライアントIDを送信
      ws.send(JSON.stringify({
        type: "identity",
        clientId: clientId
      }));

      // 全クライアントに新しい接続を通知
      broadcastMessage({
        type: "user_joined",
        clientId: clientId,
        timestamp: new Date().toISOString(),
        clientCount: clients.length
      });
    },

    // メッセージを受信したとき
    message(ws, message) {
      try {
        const parsedMessage = JSON.parse(message);
        console.log(`クライアントID ${ws.data.clientId} からメッセージを受信:`, parsedMessage);

        // メッセージタイプによって処理を分岐
        switch (parsedMessage.type) {
          case "chat":
            // チャットメッセージを全クライアントにブロードキャスト
            broadcastMessage({
              type: "chat",
              clientId: ws.data.clientId,
              message: parsedMessage.message,
              timestamp: new Date().toISOString()
            });
            break;

          case "ping":
            // クライアントからのpingに対してpongを返す
            ws.send(JSON.stringify({
              type: "pong",
              timestamp: new Date().toISOString()
            }));
            break;

          default:
            console.log("不明なメッセージタイプです:", parsedMessage.type);
        }
      } catch (err) {
        console.error("メッセージの解析に失敗しました:", err);
      }
    },

    // 接続が閉じられたとき
    close(ws) {
      console.log(`クライアントID ${ws.data?.clientId} が切断しました`);

      // クライアントリストから削除
      const index = clients.findIndex(client => client === ws);
      if (index !== -1) {
        clients.splice(index, 1);
      }

      // 接続数をログに出力
      console.log(`現在の接続数: ${clients.length}`);

      // クライアントIDが設定されている場合のみブロードキャスト
      if (ws.data?.clientId) {
        // 全クライアントに切断を通知
        broadcastMessage({
          type: "user_left",
          clientId: ws.data.clientId,
          timestamp: new Date().toISOString(),
          clientCount: clients.length
        });
      }
    },

    // 接続エラー時
    drain(ws) {
      console.log(`クライアントID ${ws.data?.clientId} でドレインイベントが発生しました`);
    }
  },
});

// 全クライアントにメッセージをブロードキャストする関数
function broadcastMessage(messageObj) {
  const messageStr = JSON.stringify(messageObj);
  console.log(`ブロードキャスト: ${messageStr}`);

  for (const client of clients) {
    // WebSocketがオープンかつメッセージオブジェクトが有効な場合のみ送信
    try {
      client.send(messageStr);
    } catch (err) {
      console.error(`メッセージ送信エラー: ${err.message}`);
    }
  }
}

console.log(`WebSocketサーバーを起動しました。ポート: ${server.port}`);

// 定期的にクライアント数などの状態情報を送信（5秒ごと）
setInterval(() => {
  broadcastMessage({
    type: "status",
    clientCount: clients.length,
    timestamp: new Date().toISOString()
  });
}, 5000);