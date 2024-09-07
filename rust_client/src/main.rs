use futures_util::{SinkExt, StreamExt};
use rug::{Complex, Float};
use serde::{Deserialize, Serialize};
use std::time;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};

#[derive(Serialize, Deserialize)]
struct CalculationRequest {
    r#type: String,
    x: String,
    y: String,
    max_iter: u32,
}

#[derive(Serialize, Deserialize)]
struct CalculationResult {
    r#type: String,
    ref_orbit: Vec<f64>,
    bla_table: Vec<f64>,
}

#[derive(Serialize, Deserialize)]
struct ConnectionConfirmation {
    r#type: String,
    message: String,
}

#[derive(Serialize, Deserialize)]
struct RegisterMessage {
    r#type: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let url = "ws://localhost:8080".into_client_request()?;
    let (ws_stream, _) = connect_async(url).await?;
    let (mut write, mut read) = ws_stream.split(); // ここで WebSocketStream を使う

    println!("Connected to WebSocket server");

    // サーバにcalculation_clientとして登録を通知
    let register_msg = RegisterMessage {
        r#type: "register_calculation_client".to_string(),
    };
    let register_msg_str = serde_json::to_string(&register_msg)?;
    write.send(Message::Text(register_msg_str)).await?;

    // 接続確認メッセージを待つ
    if let Some(msg) = read.next().await {
        let msg = msg?;

        if msg.is_text() {
            let confirmation: ConnectionConfirmation = serde_json::from_str(msg.to_text()?)?;

            // 確認メッセージが"connection_confirmation"かどうか確認
            if confirmation.r#type == "connection_confirmation" {
                println!("{}", confirmation.message);
            } else {
                println!("Failed to receive connection confirmation. Exiting.");
                return Ok(());
            }
        }
    } else {
        println!("Failed to receive any message. Exiting.");
        return Ok(());
    }

    // ここから通常の処理を開始
    while let Some(msg) = read.next().await {
        let msg = msg?;

        if msg.is_text() {
            let request: CalculationRequest = serde_json::from_str(msg.to_text()?)?;

            let now = time::Instant::now();

            // 計算の実行
            let result = perform_calculation(request);

            // 結果をWebSocketサーバーに送信
            let result_msg = CalculationResult {
                r#type: "calculation_result".to_string(),
                ref_orbit: result.ref_orbit,
                bla_table: result.bla_table,
            };
            let result_msg_str = serde_json::to_string(&result_msg)?;
            write.send(Message::Text(result_msg_str)).await?;

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
        r#type: "calculation_result".to_string(),
        ref_orbit: result.clone(),
        bla_table: result,
    }
}
