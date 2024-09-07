use futures_util::{SinkExt, StreamExt};
use rug::{Complex, Float};
use serde::{Deserialize, Serialize};
use std::time;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::protocol::Message;

#[derive(Serialize, Deserialize)]
struct CalculationRequest {
    x: String,
    y: String,
    max_iter: u32,
}

#[derive(Serialize, Deserialize)]
struct CalculationResult {
    ref_orbit: Vec<f64>,
    bla_table: Vec<f64>,
}

#[tokio::main]
async fn main() {
    // WebSocket URLを文字列で指定
    let url = "ws://localhost:8080";
    let (ws_stream, _) = connect_async(url).await.expect("Failed to connect");

    println!("Connected to WebSocket server");

    let (mut write, mut read) = ws_stream.split();

    // WebSocketメッセージの受信ループ
    while let Some(msg) = read.next().await {
        let msg = msg.expect("Error receiving message");

        if msg.is_text() {
            let request: CalculationRequest = serde_json::from_str(msg.to_text().unwrap()).unwrap();

            // 計算の実行
            let result = perform_calculation(request);

            // 結果をWebSocketサーバーに送信
            let result_msg = serde_json::to_string(&result).unwrap();
            write.send(Message::Text(result_msg)).await.unwrap();
        }
    }
}

// 計算処理の関数
fn perform_calculation(req: CalculationRequest) -> CalculationResult {
    let now = time::Instant::now();

    // 任意精度小数点数に変換
    let center_re_i = Float::parse(&req.x).unwrap(); // 文字列をFloatに変換
    let center_im_i = Float::parse(&req.y).unwrap(); // 同様に変換

    let center = Complex::with_val(
        1000,
        (
            Float::with_val(1000, center_re_i),
            Float::with_val(1000, center_im_i),
        ),
    );

    let mut n = 0;
    let mut result: Vec<f64> = Vec::new();
    let mut z = Complex::with_val(1000, (0.0, 0.0));
    let mut z_norm = Float::with_val(1000, 0.0);

    while n <= req.max_iter && z_norm < 4.0 {
        z = z.square() + center.clone();

        result.push(z.real().to_f64());
        result.push(z.imag().to_f64());

        z_norm = Float::with_val(53, z.norm_ref());

        n += 1;
    }

    println!(
        "Elapsed time: {} ms (iter={})",
        now.elapsed().as_millis(),
        n
    );

    CalculationResult {
        ref_orbit: result.clone(),
        bla_table: result,
    }
}
