import time
from collections import deque

class TimerSpan:
    def __init__(self, name):
        self.name = name

    def start(self):
        self.start = time.time()

    def end(self):
        self.end = time.time()
        self.duration = self.end - self.start

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, type, value, traceback):
        self.end()

class Timer:
    def __init__(self):
        self.spans = deque(maxlen=10000)

    def span(self, name):
        span = TimerSpan(name)
        self.spans.append(span)
        return span

    def __str__(self):
        spans_by_name = {}
        for span in self.spans:
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