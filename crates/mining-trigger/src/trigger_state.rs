use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tokio::sync::{Mutex, mpsc};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ChainId(pub u8);

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Confirmations(pub usize);

#[derive(Debug)]
pub struct TriggerState {
    pub chain_map: HashMap<ChainId, Confirmations>,
    pub scheduled_trigger: Option<Instant>,
    pub pending_flush: bool,
}

impl TriggerState {
    pub fn new() -> Self {
        Self { chain_map: HashMap::new(), scheduled_trigger: None, pending_flush: false }
    }

    pub fn insert_transaction(
        &mut self,
        chain_id: ChainId,
        latest: Instant,
        confirmations: Confirmations,
    ) {
        let entry = self.chain_map.entry(chain_id).or_insert(Confirmations(0));
        *entry = Confirmations(entry.0.max(confirmations.0 + 1));
        self.scheduled_trigger = Some(self.scheduled_trigger.map_or(latest, |i| i.min(latest)));
        self.pending_flush = true;
    }

    pub fn pop_pending(
        &mut self,
        now: Instant,
        confirmation_period: Duration,
    ) -> (Vec<ChainId>, Confirmations) {
        if self.scheduled_trigger.map_or(true, |st| now < st) {
            return (vec![], Confirmations(0));
        }

        let confirmations_demand = if self.pending_flush { 2 } else { 1 };
        let next_trigger = now + confirmation_period;

        let mut chains_to_pop = vec![];
        self.chain_map.retain(|chain_id, confirmations| {
            if confirmations.0 > 0 {
                chains_to_pop.push(*chain_id);
                confirmations.0 -= confirmations_demand;
                confirmations.0 > 0
            } else {
                false
            }
        });

        if self.chain_map.is_empty() {
            self.scheduled_trigger = None;
        } else {
            self.scheduled_trigger = Some(next_trigger);
        }
        self.pending_flush = false;

        (chains_to_pop, Confirmations(confirmations_demand))
    }

    pub fn get_next_trigger(&self) -> Option<Instant> {
        self.scheduled_trigger
    }
}

#[derive(Clone)]
pub struct TTHandle {
    pub state: Arc<Mutex<TriggerState>>,
    pub signal: mpsc::Sender<()>,
}

impl TTHandle {
    pub fn new(buffer: usize) -> (Self, mpsc::Receiver<()>) {
        let (tx, rx) = mpsc::channel(buffer);
        (Self { state: Arc::new(Mutex::new(TriggerState::new())), signal: tx }, rx)
    }

    pub async fn push_transaction(
        &self,
        batch_period: Duration,
        chain_id: ChainId,
        pending: Confirmations,
    ) {
        let latest = Instant::now() + batch_period;
        let mut state = self.state.lock().await;
        state.insert_transaction(chain_id, latest, pending);
        let _ = self.signal.try_send(());
    }

    pub async fn pop_pending(
        &self,
        confirmation_period: Duration,
    ) -> (Vec<ChainId>, Confirmations) {
        let mut state = self.state.lock().await;
        state.pop_pending(Instant::now(), confirmation_period)
    }

    pub async fn get_next_trigger(&self) -> Option<Instant> {
        self.state.lock().await.get_next_trigger()
    }
}
