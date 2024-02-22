import time


class Timer:
    def __init__(self):
        self.spans = []

    def span(self, name):
        class TimerSpan:
            def __enter__(self):
                self.name = name
                self.start = time.time()
                return self

            def __exit__(self, type, value, traceback):
                self.end = time.time()
                self.duration = self.end - self.start

        span = TimerSpan()
        self.spans.append(span)
        return span

    def __str__(self):
        spans_by_name = {}
        for span in self.spans:
            if span.name not in spans_by_name:
                spans_by_name[span.name] = []
            spans_by_name[span.name].append(span)

        summary = ''
        for name, spans in spans_by_name.items():
            sorted_durations = sorted(span.duration * 1000 for span in spans)

            # Summary statistics
            p50 = sorted_durations[int(len(spans) * 0.5)]
            p95 = sorted_durations[int(len(spans) * 0.95)]
            p99 = sorted_durations[int(len(spans) * 0.99)]

            summary = f"{summary}{name}: p50={p50:.2f}ms, p95={p95:.2f}ms, p99={p99:.2f}ms\n"

        return summary