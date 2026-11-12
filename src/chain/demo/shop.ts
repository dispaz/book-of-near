/**
 * Lesson 2.2's two demo contracts, deployed at genesis on DemoChain: a buyer contract (contract A) that
 * reserves an order and calls the shop (contract B) on another shard, then waits for the answer in a
 * callback. Real Wasm cannot run in demo mode; these are their JavaScript stand-ins (docs/chain.md).
 * Gas numbers are illustrative, not measured.
 */
import { tgas } from "../units";
import type { DemoContract } from "./contracts";

/** Contract A, the caller. Demo shard 2 (DEMO_SHARD_LAYOUT). */
export const DEMO_BUYER = "buyer.demo.testnet";
/** Contract B, the shop. Demo shard 4. */
export const DEMO_SHOP = "shop.demo.testnet";
/** Gas the buyer hands the shop's `buy`, and keeps for its own callback. */
export const SHOP_CALL_GAS = tgas(8);
export const ORDER_CALLBACK_GAS = tgas(8);

/** Contract B: sells an item, or panics when it is out of stock. */
export const shopContract: DemoContract = {
  buy: {
    gas: tgas(3),
    run(ctx) {
      const item = String(ctx.args.item ?? "notebook");
      if (ctx.args.out_of_stock) throw new Error(`Out of stock: no ${item} left`);
      const sold = Number(ctx.get("sold") ?? "0") + 1;
      ctx.set("sold", String(sold));
      ctx.log(`Sold one ${item}`);
      return { item, ok: true };
    },
  },
  sold: { view: true, gas: tgas(1), run: (ctx) => Number(ctx.get("sold") ?? "0") },
};

/** Contract A: reserves the order, calls the shop, and settles in `on_order_completed`. */
export const buyerContract: DemoContract = {
  order: {
    gas: tgas(2.5),
    run(ctx) {
      const item = String(ctx.args.item ?? "notebook");
      // This write commits now, in this receipt. If the shop fails, only the callback can undo it.
      ctx.set("reserved", item);
      ctx.log(`Reserved one ${item}; asking ${DEMO_SHOP}`);
      return ctx.functionCall(
        DEMO_SHOP,
        "buy",
        { item, out_of_stock: !!ctx.args.out_of_stock },
        {
          gas: SHOP_CALL_GAS,
          then: { methodName: "on_order_completed", args: { item }, gas: ORDER_CALLBACK_GAS },
        },
      );
    },
  },
  on_order_completed: {
    gas: tgas(2),
    run(ctx) {
      if (ctx.predecessorId !== ctx.contractId) throw new Error("Only the contract itself may call this");
      const item = String(ctx.args.item ?? "notebook");
      ctx.remove("reserved");
      if (ctx.promiseResult?.ok) {
        ctx.set("last_order", "confirmed");
        ctx.log(`Order confirmed: one ${item}`);
        return "confirmed";
      }
      ctx.set("last_order", "refunded");
      ctx.log("The shop failed, so the callback undid the reservation");
      return "refunded";
    },
  },
  reserved: { view: true, gas: tgas(1), run: (ctx) => ctx.get("reserved") ?? null },
  last_order: { view: true, gas: tgas(1), run: (ctx) => ctx.get("last_order") ?? null },
};
