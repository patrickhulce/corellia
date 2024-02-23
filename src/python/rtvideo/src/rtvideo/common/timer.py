import time
from collections import deque
from typing import Any, Optional

class NoopTimerSpan:
    def start(self):
        pass

    def stop(self):
        pass

    def span(self, name: str):
        return self

    def __enter__(self):
        pass

    def __exit__(self, type, value, traceback):
        pass

class TimerSpan:
    def __init__(self, name: str, timer: Any, parent: Optional['TimerSpan'] = None):
        self.name = name
        self.timer = timer
        self.parent = parent

    def start(self):
        self.start_ts = time.time()

    def stop(self):
        self.end_ts = time.time()
        self.duration = self.end_ts - self.start_ts

    def child(self, name: str):
        return self.timer.span(name, parent=self)

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, type, value, traceback):
        self.stop()

class Timer:
    def __init__(self):
        self.spans = deque(maxlen=10000)

    def span(self, name: str, parent: Optional[TimerSpan] = None):
        span = TimerSpan(name, self, parent)
        self.spans.append(span)
        return span

    def __str__(self):
        spans_by_name = {}
        for span in self.spans:
            if 'duration' not in span.__dict__:
                continue
            if span.name not in spans_by_name:
                spans_by_name[span.name] = []
            spans_by_name[span.name].append(span)

        summary_items = []
        for name, spans in spans_by_name.items():
            sorted_durations = sorted(span.duration * 1000 for span in spans)

            # Summary statistics
            p50 = sorted_durations[int(len(spans) * 0.5)]
            p95 = sorted_durations[int(len(spans) * 0.95)]
            p99 = sorted_durations[int(len(spans) * 0.99)]

            summary = f"{name}:\n\tp50={p50:.2f}ms\tp95={p95:.2f}ms\tp99={p99:.2f}ms"
            summary_items.append((summary, p50))

        return "\n".join(summary for summary, _ in sorted(summary_items, key=lambda x: x[1], reverse=True))