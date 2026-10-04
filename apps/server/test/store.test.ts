import { describe, expect, it } from "vitest";
import { InMemoryGameStore, type GameStore } from "../src/store.js";

describe("GameStore contract", () => {
  it("can be used through the async persistence interface", async () => {
    const store: GameStore = new InMemoryGameStore();
    const player = await store.createGuest("session_hash");

    expect(await store.findPlayerIdBySessionHash("session_hash")).toBe(player.id);
    expect(await store.getPlayer(player.id)).toEqual(player);

    await store.setPlayer({ ...player, gold: 777 });
    expect((await store.getPlayer(player.id))?.gold).toBe(777);
  });

  it("serializes async work for one player", async () => {
    const store: GameStore = new InMemoryGameStore();
    const order: string[] = [];

    await Promise.all([
      store.withPlayerLock("p1", async () => {
        order.push("first:start");
        await Promise.resolve();
        order.push("first:end");
      }),
      store.withPlayerLock("p1", async () => {
        order.push("second:start");
        order.push("second:end");
      }),
    ]);

    expect(order).toEqual(["first:start", "first:end", "second:start", "second:end"]);
  });
});
