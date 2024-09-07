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

// calculation_clientの登録メッセージ
#[derive(Serialize, Deserialize)]
struct RegisterMessage {
    r#type: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let url = "ws://localhost:8080";
    let (ws_stream, _) = connect_async(url).await?;

    println!("Connected to WebSocket server");

    let (mut write, mut read) = ws_stream.split();

    // サーバにcalculation_clientとして登録を通知
    let register_msg = RegisterMessage {
        r#type: "calculation_client".to_string(),
    };
    let register_msg_str = serde_json::to_string(&register_msg)?;
    write.send(Message::Text(register_msg_str)).await?;

    // WebSocketメッセージの受信ループ
    while let Some(msg) = read.next().await {
        let msg = msg?;

        if msg.is_text() {
            let request: CalculationRequest = serde_json::from_str(msg.to_text()?)?;

            let now = time::Instant::now();

            // 計算の実行
            let result = perform_calculation(request);

            // 結果をWebSocketサーバーに送信
            let result_msg = serde_json::to_string(&result)?;
            write.send(Message::Text(result_msg)).await?;

            println!("Total elapsed time: {} ms", now.elapsed().as_millis());
        }
    }

    Ok(())
}

// 計算処理の関数
fn perform_calculation(req: CalculationRequest) -> CalculationResult {
    let now = time::Instant::now();

    let center_re_i = Float::parse(&req.x).unwrap();
    let center_im_i = Float::parse(&req.y).unwrap();

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
        "Calculation elapsed time: {} ms (iter={})",
        now.elapsed().as_millis(),
        n
    );

    CalculationResult {
        ref_orbit: result.clone(),
        bla_table: result,
    }
}
