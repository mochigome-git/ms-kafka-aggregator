import { supabase } from "../config/supabase";

async function testRealtimeConnection() {
  console.log("Testing Supabase Realtime connection...");

  const channel = supabase
    .channel("test_realtime_connection")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "metric_method_config" },
      (payload) => {
        console.log("Change received:", payload);
      }
    )
    .subscribe((status) => {
      console.log("Realtime channel status:", status);
      if (status === "SUBSCRIBED") {
        console.log("Realtime connection successful!");
      } else if (status === "CLOSED") {
        console.log("Realtime connection closed.");
      } else if (status === "CHANNEL_ERROR") {
        console.log("Channel error — Realtime failed to connect.");
      } else if (status === "TIMED_OUT") {
        console.log("Connection timed out.");
      }
    });

  // Optional: auto-exit after 10 seconds if nothing happens
  setTimeout(async () => {
    console.log("Test finished, cleaning up...");
    await supabase.removeChannel(channel);
    process.exit(0);
  }, 10000);
}

testRealtimeConnection().catch((err) => {
  console.error("Realtime test failed:", err);
  process.exit(1);
});
