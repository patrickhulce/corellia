from collections import deque
import logging
import queue
import threading
import traceback 
from typing import List

from rtvideo.common.structs import FrameProcessor, FrameSource
from rtvideo.common.timer import Timer


class MultiThreadPipeline:
    def __init__(self, source: FrameSource, processors: List[FrameProcessor], logger: logging.Logger, timer: Timer, target_fps: int = 30):
        self.source = source
        self.processors = processors
        self.logger = logger
        self.timer = timer
        self.fps = target_fps
        self.queues = [queue.Queue(maxsize=1) for _ in range(len(processors) + 1)]
        self.queues[-1] = queue.Queue(maxsize=5)
        self.exit_event = threading.Event()

        self.source.timer = timer

    def run(self):
        source = self.source
        processors = self.processors
        parent_log = self.logger
        timer = self.timer
        fps = self.fps
        queues = self.queues
        exit_event = self.exit_event
        frame_timestamps = deque(maxlen=1000)

        def source_thread():
            log = parent_log.getChild("source")
            try:
                log.info("Opening source...")
                with timer.span("source.open()"):
                    source.open()

                log.info("Processing frames...")
                for frame in source:
                    if exit_event.is_set():
                        source.close()
                        break
                    try:
                        queues[0].put(frame, timeout=1.0/fps)
                    except queue.Full:
                        log.warn("Dropping frame due to FPS timeout")
            except KeyboardInterrupt:
                log.warn("User interrupted, exiting gracefully...")
                exit_event.set()
            except Exception as e:
                log.error(f"Error in source: {e}")
                traceback.print_exc()
                exit_event.set()
            finally:
                try:
                    source.close()
                except Exception as e:
                    log.error(f"Error closing source: {e}")

        def processor_thread(processor, in_queue, out_queue):
            log = parent_log.getChild(processor.__class__.__name__)

            try:
                log.info(f"Opening processor {processor}...")
                with timer.span(f"{processor}.open()"):
                    processor.open()

                while True:
                    if exit_event.is_set():
                        processor.close()
                        break

                    try:
                        frame = in_queue.get(timeout=1.0/fps)
                    except queue.Empty:
                        log.warn(f"Dropping get frame in {processor} due to FPS timeout")
                        continue

                    if frame is None:
                        break
                    log.debug(f"Processing frame with {processor}")
                    with timer.span(f"{processor}(frame)") as frame_span:
                        processor.active_span = frame_span
                        frame = processor(frame)
                    try:
                        if out_queue is None:
                            frame.span.stop()
                            frame_timestamps.append(frame_span.end_ts)
                            fps_last_1s = len([ts for ts in frame_timestamps if ts > frame_span.end_ts - 1])
                            fps_last_5s = len([ts for ts in frame_timestamps if ts > frame_span.end_ts - 5]) / 5.0
                            log.debug(f"FPS: {fps_last_1s:.2f} (current) {fps_last_5s:.2f} (avg)")
                        else:
                            out_queue.put(frame, timeout=1.0/fps)
                    except queue.Full:
                        log.warn(f"Dropping put frame in {processor} due to FPS timeout")
            except Exception as e:
                log.error(f"Error in processor {processor}: {e}")
                traceback.print_exc()
                exit_event.set()
            finally:
                try:
                    log.info(f"Closing processor {processor}...")
                    processor.close()
                    log.info(f"Processor {processor} closed")
                except Exception as e:
                    log.error(f"Error closing processor {processor}: {e}")

        threads = []
        threads.append(threading.Thread(target=source_thread))
        
        sink = processors[-1]
        processors = processors[:-1]

        try:
            for i, processor in enumerate(processors):
                threads.append(threading.Thread(target=processor_thread, args=(processor, queues[i], queues[i+1],)))

            for thread in threads:
                thread.start()
            
            # Sink runs in main thread (in case it's display).
            processor_thread(sink, queues[-2], None)
        except KeyboardInterrupt:
            parent_log.warn("User interrupted, exiting gracefully...")
            exit_event.set()
        finally:
            for i, thread in enumerate(threads):
                label = 'source' if i == 0 else processors[i - 1].__class__.__name__
                print(f"Awaiting {label} thread#{i}...")
                thread.join()
                print(f"Thread#{i} done!")

            parent_log.info(f"timer results:\n{timer}")