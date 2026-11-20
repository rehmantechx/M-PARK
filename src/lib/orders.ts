// Allowed sticker order statuses in forward order. An order may only stay
// on its current status or move to a later step, never backwards.
export const ORDER_FLOW = ["ORDERED", "PRINTED", "SHIPPED", "DELIVERED", "ACTIVATED"] as const;

export type OrderStatus = (typeof ORDER_FLOW)[number];

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_FLOW as readonly string[]).includes(value);
}
