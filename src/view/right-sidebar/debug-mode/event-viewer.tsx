import {
  getCurrentBatchId,
  getCurrentBatchSnapshot,
  subscribeToEventUpdates,
  type BatchTrace,
} from "@/event-viewer/event";
import type { AbsoluteTime } from "@/event-viewer/time";
import { Switch } from "@/shadcn/components/ui/switch";
import { useState, useSyncExternalStore } from "react";

type EventType = "worker" | "renderer" | "job";

type FlatEvent = {
  id: string;
  type: EventType;
  eventType: string;
  time: AbsoluteTime;
  relativeTime: number;
  data: any;
};

const EVENT_TYPE_COLORS = {
  worker: "bg-blue-500",
  renderer: "bg-green-500",
  job: "bg-purple-500",
};

const EVENT_TYPE_LABELS = {
  worker: "Worker",
  renderer: "Renderer",
  job: "Job",
};

export const EventViewer = () => {
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [filterEventTypes, setFilterEventTypes] = useState<EventType[]>([
    "worker",
    "renderer",
    "job",
  ]);

  const currentBatchId = useSyncExternalStore(
    subscribeToEventUpdates,
    getCurrentBatchId,
  );

  const currentBatch = useSyncExternalStore(
    subscribeToEventUpdates,
    getCurrentBatchSnapshot,
  );

  // 初回時に現在のバッチIDを選択
  if (!selectedBatchId && currentBatchId) {
    setSelectedBatchId(currentBatchId);
  }

  const selectedBatch = currentBatch;

  const handleEventTypeToggle = (eventType: EventType) => {
    setFilterEventTypes((prev) =>
      prev.includes(eventType)
        ? prev.filter((type) => type !== eventType)
        : [...prev, eventType],
    );
  };

  const flattenEvents = (batch: BatchTrace): FlatEvent[] => {
    const events: FlatEvent[] = [];

    // Worker events
    batch.worker.forEach((event: any, index: number) => {
      events.push({
        id: `worker-${index}`,
        type: "worker",
        eventType: event.type,
        time: event.time,
        relativeTime: event.time - batch.baseTime,
        data: event,
      });
    });

    // Renderer events
    batch.renderer.forEach((event: any, index: number) => {
      events.push({
        id: `renderer-${index}`,
        type: "renderer",
        eventType: event.type,
        time: event.time,
        relativeTime: event.time - batch.baseTime,
        data: event,
      });
    });

    // Job events
    batch.job.forEach((event: any, index: number) => {
      events.push({
        id: `job-${index}`,
        type: "job",
        eventType: event.type,
        time: event.time,
        relativeTime: event.time - batch.baseTime,
        data: event,
      });
    });

    return events.sort((a, b) => b.time - a.time);
  };

  const getEventCount = (eventType: EventType): number => {
    if (!selectedBatch) return 0;
    return selectedBatch[eventType].length;
  };

  const filteredEvents = selectedBatch
    ? flattenEvents(selectedBatch).filter((event) =>
        filterEventTypes.includes(event.type),
      )
    : [];

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const findLaunchedEventForCompleted = (
    completedEvent: FlatEvent,
    allEvents: FlatEvent[],
  ): FlatEvent | null => {
    if (
      completedEvent.type !== "worker" ||
      completedEvent.eventType !== "completed"
    ) {
      return null;
    }

    const completedWorkerId = completedEvent.data.workerId;
    const completedTime = completedEvent.time;

    // 同じworkerIdのlaunchedイベントを時系列順で探す
    const launchedEvents = allEvents
      .filter(
        (event) =>
          event.type === "worker" &&
          event.eventType === "launched" &&
          event.data.workerId === completedWorkerId &&
          event.time < completedTime,
      )
      .sort((a, b) => b.time - a.time); // 新しい順

    return launchedEvents[0] || null;
  };

  const renderEventDetails = (event: FlatEvent) => {
    switch (event.type) {
      case "worker":
        const workerEvent = event.data;
        let elapsedTimeText = "";

        if (event.eventType === "completed") {
          const launchedEvent = findLaunchedEventForCompleted(
            event,
            filteredEvents,
          );
          if (launchedEvent) {
            const elapsedTime = event.time - launchedEvent.time;
            elapsedTimeText = ` (elapsed: ${formatTime(elapsedTime)})`;
          }
        }

        return (
          <div className="text-xs text-gray-600">
            Worker {workerEvent.workerId}: {event.eventType}
            {"progress" in workerEvent &&
              ` (${(workerEvent.progress * 100).toFixed(1)}%)`}
            {elapsedTimeText}
          </div>
        );
      case "renderer":
        const rendererEvent = event.data;
        return (
          <div className="text-xs text-gray-600">
            Resolution: {rendererEvent.resolution.toFixed(1)}, Count:{" "}
            {rendererEvent.count}, Remaining: {rendererEvent.remaining}
          </div>
        );
      case "job":
        return <div className="text-xs text-gray-600">Job Event</div>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 p-2">
      {/* Event type filter */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Filter:</label>
        {/* Individual event type toggles */}
        <div className="flex flex-wrap gap-3">
          {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((eventType) => (
            <div key={eventType} className="flex items-center gap-2">
              <Switch
                checked={filterEventTypes.includes(eventType)}
                onCheckedChange={() => handleEventTypeToggle(eventType)}
              />
              <span className="text-xs">
                {EVENT_TYPE_LABELS[eventType]} ({getEventCount(eventType)})
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Events timeline */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">
          Events ({filteredEvents.length})
        </h3>
        <div className="max-h-96 space-y-1 overflow-y-auto">
          {filteredEvents.map((event) => (
            <div key={event.id} className="rounded border bg-gray-50 p-2">
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={`h-3 w-3 rounded-full ${EVENT_TYPE_COLORS[event.type]}`}
                ></span>
                <span className="text-sm font-medium">
                  {EVENT_TYPE_LABELS[event.type]} - {event.eventType}
                </span>
                <span className="ml-auto text-xs text-gray-500">
                  +{formatTime(event.relativeTime)}
                </span>
              </div>
              {renderEventDetails(event)}
            </div>
          ))}
          {filteredEvents.length === 0 && (
            <div className="py-4 text-center text-gray-500">
              No events found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
