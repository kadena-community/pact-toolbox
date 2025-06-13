pub mod trigger_state;

use std::collections::HashMap;
use std::io;
use std::time::Duration;

use actix_cors::Cors;
use actix_web::{
    App, HttpRequest, HttpResponse, HttpServer, Responder, http::StatusCode, middleware, web,
};
use clap::Parser;
use rand;
use reqwest::{Client, header};
use tokio::sync::mpsc;
use tokio::time::sleep;
use tracing::{error, info};
use tracing_subscriber::{self, EnvFilter};

use crate::trigger_state::{ChainId, Confirmations, TTHandle};

struct AppState {
    tt_handle: TTHandle,
    chainweb_service_endpoint: String,
    default_confirmation: usize,
    transaction_batch_period: f64,
}

#[derive(Parser, Debug)]
#[clap(author, version, about, long_about = None)]
struct Args {
    #[clap(long, default_value = "http://localhost:1790")]
    mining_client_url: String,

    #[clap(long, default_value = "http://localhost:1848")]
    chainweb_service_endpoint: String,

    #[clap(long, default_value_t = 10)]
    idle_trigger_period: u64,

    #[clap(long, default_value_t = 1)]
    confirmation_trigger_period: u64,

    #[clap(long, default_value_t = 0.05)]
    transaction_batch_period: f64,

    #[clap(long, default_value_t = 0.05)]
    mining_cooldown: f64,

    #[clap(long, default_value_t = 5)]
    confirmation_count: usize,

    #[clap(long, default_value_t = 1791)]
    port: u16,

    #[clap(long)]
    disable_idle_worker: bool,

    #[clap(long)]
    disable_confirmation_worker: bool,

    #[clap(long, help = "Enable request logging in development mode")]
    dev_request_logger: bool,
}

#[tokio::main]
async fn main() -> io::Result<()> {
    let args = Args::parse();
    let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    tracing_subscriber::fmt().with_env_filter(env_filter).init();

    info!("Starting mining trigger with args: {:?}", args);

    let (tt_handle, tt_receiver) = TTHandle::new(100);
    let mut handles = vec![];

    if !args.disable_idle_worker {
        let mining_client_url = args.mining_client_url.clone();
        handles.push(tokio::spawn(async move {
            idle_trigger(&mining_client_url, args.idle_trigger_period).await;
        }));
    }

    if !args.disable_confirmation_worker {
        let mining_client_url = args.mining_client_url.clone();
        let tt_handle = tt_handle.clone();
        handles.push(tokio::spawn(async move {
            confirmation_trigger(
                &mining_client_url,
                args.confirmation_trigger_period,
                args.mining_cooldown,
                tt_handle,
                tt_receiver,
            )
            .await;
        }));
    }

    let app_state = web::Data::new(AppState {
        tt_handle: tt_handle.clone(),
        chainweb_service_endpoint: args.chainweb_service_endpoint,
        default_confirmation: args.confirmation_count,
        transaction_batch_period: args.transaction_batch_period,
    });

    let dev_request_logger = args.dev_request_logger;
    info!("Starting server on port {}", args.port);
    let server = HttpServer::new(move || {
        let cors = Cors::default().allow_any_origin().allow_any_method().allow_any_header();

        App::new()
            .wrap(cors)
            .wrap(middleware::Condition::new(dev_request_logger, middleware::Logger::default()))
            .app_data(app_state.clone())
            .route(
                "/chainweb/0.0/{network_id}/chain/{chain_id}/pact/api/v1/send",
                web::post().to(proxy_send),
            )
            .route("/health", web::get().to(health_check))
    })
    .bind(("0.0.0.0", args.port))?
    .run();

    server.await?;

    info!("Server stopped. Aborting worker tasks.");
    for handle in handles {
        handle.abort();
    }

    Ok(())
}

async fn health_check() -> impl Responder {
    HttpResponse::Ok().body("OK")
}

async fn proxy_send(
    req: HttpRequest,
    body: web::Bytes,
    data: web::Data<AppState>,
) -> impl Responder {
    info!("Received request: {:?}", req);
    let network_id: String = req.match_info().get("network_id").unwrap().parse().unwrap();
    let chain_id: u8 = req.match_info().get("chain_id").unwrap().parse().unwrap();

    let client = Client::new();
    let url = format!(
        "{}/chainweb/0.0/{}/chain/{}/pact/api/v1/send",
        data.chainweb_service_endpoint, network_id, chain_id
    );

    let mut headers = header::HeaderMap::new();
    for (name, value) in req.headers().iter() {
        if name != "host" {
            if let Ok(reqwest_name) = header::HeaderName::from_bytes(name.as_str().as_bytes()) {
                if let Ok(reqwest_value) = header::HeaderValue::from_bytes(value.as_bytes()) {
                    headers.append(reqwest_name, reqwest_value);
                }
            }
        }
    }

    let res = client.post(&url).headers(headers).body(body).send().await;

    match res {
        Ok(downstream_res) => {
            let status = StatusCode::from_u16(downstream_res.status().as_u16()).unwrap();
            let mut response_builder = HttpResponse::build(status);

            for (name, value) in downstream_res.headers().iter() {
                let name_lower = name.as_str().to_lowercase();
                if name_lower != "transfer-encoding"
                    && name_lower != "connection"
                    && name_lower != "access-control-allow-origin"
                {
                    if let Ok(actix_name) =
                        actix_web::http::header::HeaderName::from_bytes(name.as_str().as_bytes())
                    {
                        if let Ok(actix_value) =
                            actix_web::http::header::HeaderValue::from_bytes(value.as_bytes())
                        {
                            response_builder.append_header((actix_name, actix_value));
                        }
                    }
                }
            }

            if downstream_res.status().is_success() {
                let tt_handle = &data.tt_handle;
                let batch_period = Duration::from_secs_f64(data.transaction_batch_period);
                let confirmations = Confirmations(data.default_confirmation);

                tt_handle.push_transaction(batch_period, ChainId(chain_id), confirmations).await;
            }

            if let Ok(body) = downstream_res.bytes().await {
                response_builder.body(body)
            } else {
                HttpResponse::InternalServerError().finish()
            }
        }
        Err(_) => HttpResponse::InternalServerError().finish(),
    }
}

async fn confirmation_trigger(
    mining_client_url: &str,
    confirmation_trigger_period: u64,
    mining_cooldown: f64,
    tt_handle: TTHandle,
    mut tt_receiver: mpsc::Receiver<()>,
) {
    let client = Client::new();
    let confirmation_trigger_period = Duration::from_secs(confirmation_trigger_period);
    let mining_cooldown = Duration::from_secs_f64(mining_cooldown);

    loop {
        let next_trigger = tt_handle.get_next_trigger().await;
        match next_trigger {
            Some(t) => {
                tokio::select! {
                    _ = tokio::time::sleep_until(t.into()) => {},
                    _ = tt_receiver.recv() => {},
                }
            }
            None => {
                tt_receiver.recv().await;
            }
        }

        let (chains, confirmations) = tt_handle.pop_pending(confirmation_trigger_period).await;

        if chains.is_empty() {
            continue;
        }

        info!(
            "Confirmation trigger fired for chains {:?} with {} confirmations",
            chains, confirmations.0
        );

        for _ in 0..confirmations.0 {
            let map: HashMap<String, usize> = chains.iter().map(|c| (c.0.to_string(), 1)).collect();

            let res =
                client.post(format!("{}/make-blocks", mining_client_url)).json(&map).send().await;

            match res {
                Ok(res) => {
                    if res.status().is_success() {
                        info!("Successfully requested blocks for chains {:?}", chains);
                    } else {
                        error!(
                            "Failed to request blocks for chains {:?}: {}",
                            chains,
                            res.status()
                        );
                    }
                }
                Err(e) => {
                    error!("Failed to request blocks for chains {:?}: {}", chains, e);
                }
            }
            sleep(mining_cooldown).await;
        }
    }
}

async fn idle_trigger(mining_client_url: &str, idle_trigger_period: u64) {
    let client = Client::new();
    loop {
        sleep(Duration::from_secs(idle_trigger_period)).await;
        info!("Idle trigger fired");

        let mut map = HashMap::new();
        let chain_id = rand::random::<u8>() % 20;
        map.insert(chain_id.to_string(), 1);

        let res = client.post(format!("{}/make-blocks", mining_client_url)).json(&map).send().await;

        match res {
            Ok(res) => {
                if res.status().is_success() {
                    info!("Successfully requested a block on chain {}", chain_id);
                } else {
                    error!("Failed to request a block on chain {}: {}", chain_id, res.status());
                }
            }
            Err(e) => {
                error!("Failed to request a block on chain {}: {}", chain_id, e);
            }
        }
    }
}
