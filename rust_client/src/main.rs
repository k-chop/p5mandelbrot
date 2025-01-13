use anyhow::{anyhow, Result};
use futures_util::{SinkExt, StreamExt};
use rug::{Complex, Float};
use serde::{Deserialize, Serialize};
use std::time::{self, Duration};
use tokio::time::sleep;
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

const CALCULATION_RESULT: u8 = 0x03;

#[tokio::main]
async fn main() -> Result<()> {
    let url = "ws://localhost:8080".into_client_request()?;

    // リトライ用の設定
    let max_retries = 5;
    let mut attempt = 0;

    let ws_stream = loop {
        match connect_async(url.clone()).await {
            Ok((ws_stream, _)) => {
                println!("Connected to WebSocket server");
                break ws_stream;
            }
            Err(e) => {
                attempt += 1;
                eprintln!("Failed to connect: {}. Attempt = {}", e, attempt);

                if attempt >= max_retries {
                    eprintln!("Reached maximum number of retries. Exiting.");
                    return Err(anyhow!(e));
                }

                sleep(Duration::from_secs(3)).await;
            }
        }
    };

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
            let str = msg.to_text()?;
            let request: CalculationRequest = serde_json::from_str(str)?;

            if request.r#type == "calculation_request" {
                println!(
                    "Received calculation request: x={}, y={}, max_iter={}",
                    request.x, request.y, request.max_iter
                );
                let now = time::Instant::now();

                let result = perform_calculation(request);

                let mut result_msg = vec![CALCULATION_RESULT];
                result_msg.extend(result.iter().flat_map(|f| f.to_le_bytes()));

                write.send(Message::Binary(result_msg)).await?;

                println!("Total elapsed time: {} ms", now.elapsed().as_millis());
            }
        }
    }

    Ok(())
}

// 計算処理の関数
fn perform_calculation(req: CalculationRequest) -> Vec<f64> {
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
        result.push(z.real().to_f64());
        result.push(z.imag().to_f64());

        z = z.square() + center.clone();

        z_norm = Float::with_val(1000, z.norm_ref());

        n += 1;
    }

    println!(
        "Calculation elapsed time: {} ms (iter={})",
        now.elapsed().as_millis(),
        n
    );

    result
}
