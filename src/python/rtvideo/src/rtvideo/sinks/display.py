from rtvideo.common.structs import Frame, FrameProcessor

import cv2

class DisplaySink(FrameProcessor):
    def __init__(self, window_name: str):
        self.window_name = window_name

    def __str__(self) -> str:
        return f"DisplaySink(window_name={self.window_name})"

    def close(self):
        cv2.destroyAllWindows()

    def __call__(self, frame: Frame):
        # Display the frame.
        cv2.imshow(self.window_name, frame.as_bgr())
        # Quit if the user has pressed 'q'
        if cv2.waitKey(1) & 0xFF == ord('q'):
            raise KeyboardInterrupt

    