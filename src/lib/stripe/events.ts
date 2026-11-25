import type Stripe from "stripe";

export type EventDeps = { syncAccount: (account: Stripe.Account) => Promise<void> };

/** Returns true if the event was handled. Unknown events are ignored (Stripe still gets a 200). */
export async function handleStripeEvent(event: Stripe.Event, deps: EventDeps): Promise<boolean> {
  switch (event.type) {
    case "account.updated":
      await deps.syncAccount(event.data.object as Stripe.Account);
      return true;
    default:
      return false;
  }
}
