import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { recordWebhookEvent } from "@/server/repositories/activities";
import { createActivityRecord } from "../../factories/activity";
import { insertTeam } from "../../factories/db";
import { clearDatabase } from "../setup/test-setup";

describe("webhook delivery atomicity", () => {
  beforeEach(clearDatabase);

  it("stores every SHA from overlapping concurrent deliveries exactly once", async () => {
    const team = await insertTeam();
    const shared = createActivityRecord({ sha: "shared" });
    const results = await Promise.all(
      ["left", "right"].map((deliveryId) =>
        recordWebhookEvent({
          teamId: team.id,
          event: "push",
          deliveryId,
          activities: [shared, createActivityRecord({ sha: deliveryId })],
        })
      )
    );
    expect(results.every((result) => !result.alreadyProcessed)).toBe(true);
    expect(
      results.reduce((sum, result) => sum + result.activitiesCreated, 0)
    ).toBe(3);
    expect((await db.activity.findMany()).map((row) => row.sha).sort()).toEqual(
      ["left", "right", "shared"]
    );
    expect(await db.webhookDelivery.count()).toBe(2);
  });

  it("reports exactly one duplicate when the same delivery arrives concurrently", async () => {
    const team = await insertTeam();
    const input = {
      teamId: team.id,
      event: "push",
      deliveryId: "same",
      activities: [createActivityRecord()],
    };
    const results = await Promise.all([
      recordWebhookEvent(input),
      recordWebhookEvent(input),
    ]);
    expect(results.map((result) => result.alreadyProcessed).sort()).toEqual([
      false,
      true,
    ]);
    expect(await db.activity.count()).toBe(1);
    expect(await db.webhookDelivery.count()).toBe(1);
  });

  it("reports zero inserted rows for commits already stored by another delivery", async () => {
    const team = await insertTeam();
    const input = {
      teamId: team.id,
      event: "push",
      activities: [createActivityRecord()],
    };
    await recordWebhookEvent({ ...input, deliveryId: "first" });
    expect(
      await recordWebhookEvent({ ...input, deliveryId: "second" })
    ).toEqual({
      alreadyProcessed: false,
      activitiesCreated: 0,
    });
  });

  it("stores a 2048-commit push within the default transaction timeout", async () => {
    const team = await insertTeam();
    const result = await recordWebhookEvent({
      teamId: team.id,
      event: "push",
      deliveryId: "large",
      activities: Array.from({ length: 2048 }, () => createActivityRecord()),
    });
    expect(result.activitiesCreated).toBe(2048);
    expect(await db.activity.count()).toBe(2048);
    expect(await db.webhookDelivery.count()).toBe(1);
  }, 15000);

  it("rolls back the delivery and earlier activities when an insert fails", async () => {
    const team = await insertTeam();
    await expect(
      recordWebhookEvent({
        teamId: team.id,
        event: "push",
        deliveryId: "failed",
        activities: [
          createActivityRecord(),
          createActivityRecord({ title: "bad\u0000text" }),
        ],
      })
    ).rejects.toThrow();
    expect(await db.activity.count()).toBe(0);
    expect(await db.webhookDelivery.count()).toBe(0);
  });
});
