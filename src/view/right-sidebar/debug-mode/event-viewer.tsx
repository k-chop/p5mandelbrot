import { useEffect, useState } from "react";
import {
  getAllBatchTraces,
  getCurrentBatchId,
  getCurrentBatchTrace,
  type BatchTrace,
} from "@/event-viewer/event";
import type { AbsoluteTime } from "@/event-viewer/time";

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
  const [currentBatch, setCurrentBatch] = useState<BatchTrace | undefined>();
  const [currentBatchId, setCurrentBatchId] = useState<string>("");
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [allBatches, setAllBatches] = useState<Array<{ batchId: string; trace: BatchTrace }>>([]);
  const [filterEventType, setFilterEventType] = useState<EventType | "all">("all");

  const updateData = () => {
    const batchId = getCurrentBatchId();
    const batch = getCurrentBatchTrace();
    const all = getAllBatchTraces();
    
    setCurrentBatchId(batchId);
    setCurrentBatch(batch);
    setAllBatches(all);
    
    if (!selectedBatchId && batchId) {
      setSelectedBatchId(batchId);
    }
  };

  useEffect(() => {
    updateData();
    const interval = setInterval(updateData, 100);
    return () => clearInterval(interval);
  }, []);

  const selectedBatch = selectedBatchId === currentBatchId 
    ? currentBatch 
    : allBatches.find(b => b.batchId === selectedBatchId)?.trace;

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

    return events.sort((a, b) => a.time - b.time);
  };

  const filteredEvents = selectedBatch 
    ? flattenEvents(selectedBatch).filter(event => 
        filterEventType === "all" || event.type === filterEventType
      )
    : [];

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const renderEventDetails = (event: FlatEvent) => {
    switch (event.type) {
      case "worker":
        const workerEvent = event.data;
        return (
          <div className="text-xs text-gray-600">
            Worker {workerEvent.workerIdx}: {event.eventType}
            {"progress" in workerEvent && ` (${(workerEvent.progress * 100).toFixed(1)}%)`}
          </div>
        );
      case "renderer":
        const rendererEvent = event.data;
        return (
          <div className="text-xs text-gray-600">
            Resolution: {rendererEvent.resolution}, Count: {rendererEvent.count}, 
            Remaining: {rendererEvent.remaining}
          </div>
        );
      case "job":
        return <div className="text-xs text-gray-600">Job Event</div>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Batch selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Batch:</label>
        <select 
          value={selectedBatchId} 
          onChange={(e) => setSelectedBatchId(e.target.value)}
          className="w-full p-2 border rounded text-sm"
        >
          {allBatches.map(({ batchId }) => (
            <option key={batchId} value={batchId}>
              {batchId} {batchId === currentBatchId ? "(current)" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Event type filter */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Filter:</label>
        <select 
          value={filterEventType} 
          onChange={(e) => setFilterEventType(e.target.value as EventType | "all")}
          className="w-full p-2 border rounded text-sm"
        >
          <option value="all">All Events</option>
          <option value="worker">Worker Events</option>
          <option value="renderer">Renderer Events</option>
          <option value="job">Job Events</option>
        </select>
      </div>

      {/* Events timeline */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Events ({filteredEvents.length})</h3>
        <div className="max-h-96 overflow-y-auto space-y-1">
          {filteredEvents.map((event) => (
            <div key={event.id} className="border rounded p-2 bg-gray-50">
              <div className="flex items-center gap-2 mb-1">
                <span 
                  className={`w-3 h-3 rounded-full ${EVENT_TYPE_COLORS[event.type]}`}
                ></span>
                <span className="font-medium text-sm">
                  {EVENT_TYPE_LABELS[event.type]} - {event.eventType}
                </span>
                <span className="text-xs text-gray-500 ml-auto">
                  +{formatTime(event.relativeTime)}
                </span>
              </div>
              {renderEventDetails(event)}
            </div>
          ))}
          {filteredEvents.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              No events found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};