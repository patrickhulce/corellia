import logging
from typing import List

from rtvideo.common.structs import FrameProcessor, FrameSource
from rtvideo.common.timer import Timer


class SingleThreadPipeline:
    def __init__(self, source: FrameSource, processors: List[FrameProcessor], logger: logging.Logger, timer: Timer):
        self.source = source
        self.processors = processors
        self.logger = logger
        self.timer = timer

    def run(self):
        source = self.source
        processors = self.processors
        log = self.logger
        timer = self.timer

        try:
            log.info("Opening source, sink, and processors...")
            with timer.span("source.open()"):
                source.open()
            for processor in processors:
                with timer.span(f"{processor}.open()"):
                    processor.open()

            log.info("Processing frames...")
            for frame in source:
                with timer.span("SingleThreadPipeline(frame)"):
                    for processor in processors:
                        log.debug(f"Processing frame with {processor}")
                        with timer.span(f"{processor}(frame)") as frame_span:
                            processor.active_span = frame_span
                            frame = processor(frame)
        except KeyboardInterrupt:
            log.warn("User interrupted, exiting gracefully...")
        finally:
            try:
                source.close()
            except Exception as e:
                log.error(f"Error closing source: {e}")

            for processor in processors:
                try:
                    processor.close()
                except Exception as e:
                    log.error(f"Error closing processor {processor}: {e}")
            
            log.info(f"timer results:\n{timer}")